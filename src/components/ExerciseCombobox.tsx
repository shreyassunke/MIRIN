import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import Fuse from "fuse.js";
import { useLiveQuery } from "dexie-react-hooks";
import {
  EQUIPMENT_OPTIONS,
  MUSCLE_OPTIONS,
  createCustomExercise,
  equipmentLabel,
  fullLibrary,
  gymMachineFor,
  muscleLabel,
  stationsForMuscle,
  type ExerciseLibraryEntry,
  type GymMachineId,
} from "../lib/library";
import { MachineStationPicker, STATION_LABEL } from "./MachineStationPicker";
import { IconAddSet } from "./ItemOverflow";
import { useDismissOnPointerOutside } from "../hooks/useDismissOnPointerOutside";

const MAX_RESULTS = 12;
const DEBOUNCE_MS = 150;

interface ExerciseComboboxProps {
  /** Called with the chosen (or newly created) library entry. */
  onPick: (entry: ExerciseLibraryEntry) => void;
  onCancel?: () => void;
  /** Already-present ids, marked "Added" and skipped on pick. */
  excludeIds?: string[];
  autoFocus?: boolean;
  placeholder?: string;
  /** Optional label rendered inside the dismiss boundary. */
  label?: string;
  /**
   * Title-sized field. The caret is the only chrome; matches sit as text
   * under the title instead of in a panel.
   */
  inline?: boolean;
}

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

interface CreateFormProps {
  initialName: string;
  onCreate: (entry: ExerciseLibraryEntry) => void;
  onBack: () => void;
}

function CreateCustomForm({ initialName, onCreate, onBack }: CreateFormProps) {
  const [name, setName] = useState(initialName);
  const [equipment, setEquipment] = useState<string>("dumbbell");
  const [muscle, setMuscle] = useState<string>("chest");
  const [station, setStation] = useState<GymMachineId | null>(null);
  const [stationTouched, setStationTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const canSave = name.trim().length > 0 && !saving;

  useEffect(() => {
    if (equipment !== "machine") return;
    const choices = stationsForMuscle(muscle);
    const stillValid = station != null && choices.includes(station);
    if (stationTouched && stillValid) return;
    const guessed = gymMachineFor({
      id: "custom",
      name,
      equipment: "machine",
      isCustom: true,
    });
    const guessOk =
      guessed && guessed !== "cable" && choices.includes(guessed) ? guessed : null;
    const next = guessOk ?? (choices.length === 1 ? choices[0] : null);
    if (stationTouched && !stillValid) setStationTouched(false);
    if (station !== next) setStation(next);
  }, [equipment, name, muscle, station, stationTouched]);

  const selectClass =
    "h-11 w-full rounded-md border border-hairline bg-bg px-3 text-base text-ink focus:border-muted";

  return (
    <div className="rounded-xl glass p-4">
      <p className="mb-3 text-[13px] font-medium text-muted">
        New custom exercise
      </p>
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-[13px] font-medium text-muted">
            Name
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            className="h-11 w-full rounded-md border border-hairline bg-bg px-3 text-base text-ink placeholder:text-muted focus:border-muted"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-[13px] font-medium text-muted">
              Equipment
            </span>
            <select
              value={equipment}
              onChange={(e) => setEquipment(e.target.value)}
              className={selectClass}
            >
              {EQUIPMENT_OPTIONS.map((eq) => (
                <option key={eq} value={eq}>
                  {equipmentLabel(eq)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[13px] font-medium text-muted">
              Primary muscle
            </span>
            <select
              value={muscle}
              onChange={(e) => setMuscle(e.target.value)}
              className={selectClass}
            >
              {MUSCLE_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {muscleLabel(m)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {equipment === "machine" && stationsForMuscle(muscle).length > 0 && (
          <div>
            <span className="mb-1.5 block text-[13px] font-medium text-muted">
              Station
            </span>
            <MachineStationPicker
              muscle={muscle}
              value={station}
              onChange={(id) => {
                setStationTouched(true);
                setStation(id);
              }}
            />
          </div>
        )}
      </div>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={!canSave}
          onClick={async () => {
            setSaving(true);
            const entry = await createCustomExercise({
              name,
              equipment,
              primaryMuscle: muscle,
              station: equipment === "machine" ? (station ?? undefined) : undefined,
            });
            onCreate(entry);
          }}
          className="btn-primary h-11 flex-1 rounded-pill bg-accent px-4 text-sm font-semibold text-bg hover:bg-ink disabled:opacity-40"
        >
          Save exercise
        </button>
        <button
          type="button"
          onClick={onBack}
          className="glass-btn h-11 rounded-pill px-4 text-sm font-medium text-ink"
        >
          Back
        </button>
      </div>
    </div>
  );
}

/** Quiet plus that opens the exercise search. The name stays on the button. */
export function AddExerciseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Add exercise"
      className="glass-btn inline-flex h-11 w-11 items-center justify-center rounded-full text-muted hover:text-ink"
    >
      <IconAddSet />
    </button>
  );
}

/**
 * Searchable exercise picker over the static library plus custom exercises.
 * Fuzzy matches name and aliases; offers a create-custom escape hatch.
 */
export function ExerciseCombobox({
  onPick,
  onCancel,
  excludeIds = [],
  autoFocus = true,
  placeholder = "Search exercises",
  label,
  inline = false,
}: ExerciseComboboxProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounced(query, DEBOUNCE_MS);
  const [highlight, setHighlight] = useState(0);
  const [creating, setCreating] = useState(false);

  const dismiss = useCallback(() => {
    if (creating) {
      onCancel?.();
      return;
    }
    if (query) {
      setQuery("");
      inputRef.current?.focus();
      return;
    }
    onCancel?.();
  }, [creating, onCancel, query]);

  useDismissOnPointerOutside(rootRef, dismiss, Boolean(onCancel));

  const entries = useLiveQuery(fullLibrary, [], undefined);
  const fuse = useMemo(
    () =>
      entries &&
      new Fuse(entries, {
        keys: [
          { name: "name", weight: 0.7 },
          { name: "aliases", weight: 0.3 },
        ],
        threshold: 0.35,
        ignoreLocation: true,
      }),
    [entries],
  );

  const results = useMemo(() => {
    if (!fuse || !entries) return [];
    const q = debouncedQuery.trim();
    if (!q) return [];
    return fuse.search(q, { limit: MAX_RESULTS }).map((r) => r.item);
  }, [fuse, entries, debouncedQuery]);

  const excluded = useMemo(() => new Set(excludeIds), [excludeIds]);
  const hasQuery = debouncedQuery.trim().length > 0;
  // The create row is part of the option list, always last.
  const optionCount = results.length + (hasQuery ? 1 : 0);

  useEffect(() => setHighlight(0), [debouncedQuery]);

  if (creating) {
    return (
      <div ref={rootRef}>
        <CreateCustomForm
          initialName={query.trim()}
          onCreate={(entry) => {
            setCreating(false);
            setQuery("");
            onPick(entry);
          }}
          onBack={() => {
            setCreating(false);
            inputRef.current?.focus();
          }}
        />
      </div>
    );
  }

  const pick = (index: number) => {
    if (index >= results.length) {
      setCreating(true);
      return;
    }
    const entry = results[index];
    if (excluded.has(entry.id)) return;
    setQuery("");
    onPick(entry);
    inputRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, optionCount - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (optionCount > 0) pick(highlight);
    } else if (e.key === "Escape") {
      e.preventDefault();
      dismiss();
    }
  };

  return (
    <div ref={rootRef} className={inline ? "w-full" : undefined}>
      {label && (
        <p className="mb-2 text-[13px] font-medium text-muted">{label}</p>
      )}
      <div
        className={
          inline
            ? "flex h-11 min-w-0 items-center justify-center"
            : undefined
        }
      >
        {inline && !query && placeholder ? (
          <span
            className="min-w-0 truncate text-lg font-semibold tracking-tight text-ink"
            onMouseDown={(e) => {
              e.preventDefault();
              inputRef.current?.focus();
            }}
          >
            {placeholder}
          </span>
        ) : null}
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={optionCount > 0}
          aria-controls={listboxId}
          aria-activedescendant={
            optionCount > 0 ? `${listboxId}-${highlight}` : undefined
          }
          aria-label={inline ? "Replace exercise" : "Search exercises"}
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={inline ? undefined : placeholder}
          autoComplete="off"
          spellCheck={false}
          style={
            inline && !query
              ? { width: "1ch", fieldSizing: "fixed" }
              : undefined
          }
          className={
            inline
              ? "exercise-title h-11 max-w-full shrink-0 text-lg font-semibold tracking-tight text-ink"
              : "exercise-search"
          }
        />
      </div>

      {hasQuery && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Exercise results"
          className={
            inline
              ? "mt-1 max-h-60 overflow-y-auto"
              : "mt-2 max-h-72 overflow-y-auto rounded-xl glass"
          }
        >
          {results.map((entry, index) => {
            const isAdded = excluded.has(entry.id);
            return (
              <li
                key={entry.id}
                id={`${listboxId}-${index}`}
                role="option"
                aria-selected={highlight === index}
                aria-disabled={isAdded}
                onMouseEnter={() => setHighlight(index)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(index);
                }}
                className={[
                  inline
                    ? "flex cursor-pointer items-baseline justify-center gap-2 px-2 py-1.5"
                    : "flex cursor-pointer items-baseline justify-between gap-3 border-b border-hairline px-3 py-2.5 last:border-b-0",
                  inline
                    ? highlight === index
                      ? "text-ink"
                      : "text-muted"
                    : highlight === index
                      ? "bg-surface-raised"
                      : "",
                  isAdded ? "cursor-default opacity-50" : "",
                ].join(" ")}
              >
                <span className={inline ? "min-w-0 truncate text-[15px] font-medium" : "min-w-0"}>
                  {inline ? (
                    entry.name
                  ) : (
                    <>
                      <span className="block truncate text-sm font-medium text-ink">
                        {entry.name}
                      </span>
                      <span className="block text-[13px] text-muted">
                        {(entry.station && STATION_LABEL[entry.station]) ||
                          equipmentLabel(entry.equipment)}
                        {entry.primaryMuscles[0] &&
                          ` — ${muscleLabel(entry.primaryMuscles[0])}`}
                        {entry.isCustom && " — Custom"}
                      </span>
                    </>
                  )}
                </span>
                {isAdded && (
                  <span className="shrink-0 text-[13px] text-muted">Added</span>
                )}
              </li>
            );
          })}
          <li
            id={`${listboxId}-${results.length}`}
            role="option"
            aria-selected={highlight === results.length}
            onMouseEnter={() => setHighlight(results.length)}
            onMouseDown={(e) => {
              e.preventDefault();
              setCreating(true);
            }}
            className={
              inline
                ? [
                    "cursor-pointer px-2 py-1.5 text-center text-[13px]",
                    highlight === results.length ? "text-ink" : "text-muted",
                  ].join(" ")
                : [
                    "cursor-pointer px-3 py-2.5 text-sm font-medium text-ink",
                    highlight === results.length ? "bg-surface-raised" : "",
                  ].join(" ")
            }
          >
            {inline
              ? `Create “${debouncedQuery.trim()}”`
              : `Create custom exercise “${debouncedQuery.trim()}”`}
          </li>
        </ul>
      )}
    </div>
  );
}

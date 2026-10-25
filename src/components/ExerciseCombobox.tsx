import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
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
import { IconAddSet, IconPlus } from "./ItemOverflow";
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
   * under the title instead of in a panel. Opens on the current title so
   * the name can be corrected in place. Picking a match still swaps.
   */
  inline?: boolean;
  /** Keeps an edited inline title on the same exercise. */
  onRename?: (name: string) => void;
  /** This row's library id, omitted from inline swap matches. */
  selfId?: string;
  /**
   * Grows out of the header search mark. Results hang from that corner.
   */
  corner?: boolean;
}

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/** A correction of the open title, as opposed to a search for a different lift. */
function isTitleEdit(original: string, next: string) {
  const a = original.trim().toLowerCase();
  const b = next.trim().toLowerCase();
  if (!a || !b) return false;
  if (a === b || a.startsWith(b) || b.startsWith(a)) return true;
  let prefix = 0;
  const limit = Math.min(a.length, b.length);
  while (prefix < limit && a[prefix] === b[prefix]) prefix += 1;
  if (prefix >= 4 && Math.abs(a.length - b.length) <= 12) return true;
  return editDistance(a, b) <= 3;
}

function editDistance(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 8) return 9;
  const row = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) row[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const saved = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = saved;
    }
  }
  return row[b.length];
}

function titleIntent(
  original: string,
  next: string,
): "idle" | "edit" | "search" {
  const a = original.trim();
  const b = next.trim();
  if (!b || b === a) return "idle";
  return isTitleEdit(a, b) ? "edit" : "search";
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

/** A bare plus in the corner. Opens the exercise search so a lift can be added. */
export function SearchExerciseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Add exercise"
      className="exercise-search-trigger"
      style={{ color: "var(--color-ink)" }}
    >
      <IconPlus />
    </button>
  );
}

/** The plus becomes the field. The right edge stays put. */
export function HeaderExerciseSearch({
  open,
  onOpen,
  onClose,
  onPick,
  excludeIds,
}: {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onPick: (entry: ExerciseLibraryEntry) => void;
  excludeIds: string[];
}) {
  return (
    <div className={open ? "header-search is-open" : "header-search"}>
      {open ? (
        <ExerciseCombobox
          corner
          excludeIds={excludeIds}
          onCancel={onClose}
          onPick={onPick}
        />
      ) : (
        <SearchExerciseButton onClick={onOpen} />
      )}
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
  corner = false,
  onRename,
  selfId,
}: ExerciseComboboxProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pickedRef = useRef(false);
  const closingRef = useRef(false);
  const listPointerRef = useRef(false);
  const [query, setQuery] = useState(inline ? (placeholder ?? "") : "");
  const debouncedQuery = useDebounced(query, DEBOUNCE_MS);
  const [highlight, setHighlight] = useState(0);
  const [navigated, setNavigated] = useState(false);
  const [creating, setCreating] = useState(false);
  const titleSeed = inline ? (placeholder ?? "").trim() : "";

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
    if (!q || (inline && q === (placeholder ?? "").trim())) return [];
    return fuse
      .search(q, { limit: MAX_RESULTS })
      .map((r) => r.item)
      .filter((entry) => entry.id !== selfId);
  }, [fuse, entries, debouncedQuery, inline, placeholder, selfId]);

  const excluded = useMemo(() => new Set(excludeIds), [excludeIds]);
  const typedQuery = debouncedQuery.trim();
  const hasQuery = typedQuery.length > 0 && typedQuery !== titleSeed;
  // The create row is part of the option list, always last.
  const optionCount = results.length + (hasQuery ? 1 : 0);
  const intent = inline ? titleIntent(titleSeed, query) : "idle";

  const exactReplacement = useCallback(
    (name: string) => {
      const needle = name.trim().toLowerCase();
      if (!needle || !entries) return undefined;
      return entries.find(
        (entry) =>
          entry.id !== selfId &&
          !excluded.has(entry.id) &&
          entry.name.trim().toLowerCase() === needle,
      );
    },
    [entries, excluded, selfId],
  );

  const cancelEdit = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    onCancel?.();
  }, [onCancel]);

  const finishInline = useCallback(
    (reason: "commit" | "dismiss") => {
      if (pickedRef.current || closingRef.current) return;
      const next = query.trim();
      const nextIntent = titleIntent(titleSeed, next);
      if (
        !next ||
        next === titleSeed ||
        (reason === "dismiss" && nextIntent === "search")
      ) {
        cancelEdit();
        return;
      }
      const exact = exactReplacement(next);
      if (exact) {
        pickedRef.current = true;
        onPick(exact);
        return;
      }
      closingRef.current = true;
      if (nextIntent === "edit") onRename?.(next);
      onCancel?.();
    },
    [cancelEdit, exactReplacement, onCancel, onPick, onRename, query, titleSeed],
  );

  const dismiss = useCallback(() => {
    if (creating) {
      cancelEdit();
      return;
    }
    if (inline) {
      finishInline("dismiss");
      return;
    }
    if (query) {
      setQuery("");
      inputRef.current?.focus();
      return;
    }
    onCancel?.();
  }, [cancelEdit, creating, finishInline, inline, onCancel, query]);

  useDismissOnPointerOutside(rootRef, dismiss, Boolean(onCancel));

  useLayoutEffect(() => {
    if (!inline || !autoFocus) return;
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    const end = input.value.length;
    input.setSelectionRange(end, end);
  }, [autoFocus, inline]);

  if (creating) {
    return (
      <div ref={rootRef} className={corner ? "header-search-field" : undefined}>
        <CreateCustomForm
          initialName={query.trim()}
          onCreate={(entry) => {
            setCreating(false);
            setQuery("");
            onPick(entry);
          }}
          onBack={() => {
            pickedRef.current = false;
            closingRef.current = false;
            setCreating(false);
            inputRef.current?.focus();
          }}
        />
      </div>
    );
  }

  const pick = (index: number) => {
    if (index >= results.length) {
      pickedRef.current = true;
      setCreating(true);
      return;
    }
    const entry = results[index];
    if (excluded.has(entry.id)) return;
    pickedRef.current = true;
    setQuery("");
    onPick(entry);
    inputRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (inline) setNavigated(true);
      setHighlight((h) => Math.min(h + 1, Math.max(optionCount - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (inline) setNavigated(true);
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (inline) {
        const nextIntent = titleIntent(titleSeed, query);
        if (navigated && optionCount > 0) {
          pick(highlight);
          return;
        }
        if (nextIntent === "search") {
          const exact = exactReplacement(query);
          if (exact) {
            pickedRef.current = true;
            onPick(exact);
            return;
          }
          if (optionCount > 0) {
            pick(highlight);
            return;
          }
          const live = fuse
            ?.search(query.trim(), { limit: MAX_RESULTS })
            .map((result) => result.item)
            .find((entry) => entry.id !== selfId && !excluded.has(entry.id));
          if (live) {
            pickedRef.current = true;
            onPick(live);
            return;
          }
          if (query.trim()) {
            pickedRef.current = true;
            setCreating(true);
            return;
          }
        }
        finishInline("commit");
        return;
      }
      if (optionCount > 0) pick(highlight);
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (inline) {
        cancelEdit();
        return;
      }
      dismiss();
    }
  };

  return (
    <div
      ref={rootRef}
      className={
        corner ? "header-search-field" : inline ? "w-full" : undefined
      }
    >
      {label && (
        <p className="mb-2 text-[13px] font-medium text-muted">{label}</p>
      )}
      <div
        className={
          corner
            ? "header-search-clip"
            : inline
              ? "flex h-11 min-w-0 items-center justify-center"
              : undefined
        }
      >
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={optionCount > 0}
          aria-controls={listboxId}
          aria-activedescendant={
            optionCount > 0 && (!inline || navigated || intent === "search")
              ? `${listboxId}-${highlight}`
              : undefined
          }
          aria-label={inline ? "Edit exercise" : "Search exercises"}
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => {
            setNavigated(false);
            setHighlight(0);
            setQuery(e.target.value);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => {
            if (!inline) return;
            window.setTimeout(() => {
              if (closingRef.current || pickedRef.current) return;
              if (listPointerRef.current) {
                listPointerRef.current = false;
                return;
              }
              finishInline("dismiss");
            }, 0);
          }}
          placeholder={inline ? undefined : placeholder}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint={inline ? "done" : undefined}
          style={
            inline
              ? {
                  width: `${Math.max(query.length, 1)}ch`,
                  fieldSizing: query ? "content" : "fixed",
                }
              : undefined
          }
          className={
            inline
              ? "exercise-title h-11 max-w-full shrink-0 text-center text-lg font-semibold tracking-tight text-ink"
              : corner
                ? "exercise-search exercise-search-corner"
                : "exercise-search"
          }
        />
      </div>

      {hasQuery && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Exercise results"
          onPointerDown={() => {
            listPointerRef.current = true;
          }}
          className={
            inline
              ? "mt-1 max-h-60 overflow-y-auto"
              : corner
                ? "quiet-menu header-search-results max-h-72 overflow-y-auto rounded-xl"
                : "quiet-menu mt-2 max-h-72 overflow-y-auto rounded-xl"
          }
        >
          {results.map((entry, index) => {
            const isAdded = excluded.has(entry.id);
            return (
              <li
                key={entry.id}
                id={`${listboxId}-${index}`}
                role="option"
                aria-selected={
                  (!inline || navigated || intent === "search") &&
                  highlight === index
                }
                data-current={!inline && highlight === index ? "" : undefined}
                aria-disabled={isAdded}
                onMouseEnter={() => setHighlight(index)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(index);
                }}
                className={[
                  inline
                    ? "flex cursor-pointer items-baseline justify-center gap-2 px-2 py-1.5"
                    : "quiet-menu-item quiet-result",
                  inline
                    ? (navigated || intent === "search") && highlight === index
                      ? "text-ink"
                      : "text-muted hover:text-ink"
                    : "",
                  isAdded ? "cursor-default opacity-50" : "",
                ].join(" ")}
              >
                <span className={inline ? "min-w-0 truncate text-[15px] font-medium" : "min-w-0 flex-1"}>
                  {inline ? (
                    entry.name
                  ) : (
                    <>
                      <span className="quiet-result-name">
                        {entry.name}
                      </span>
                      <span className="quiet-result-meta">
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
            aria-selected={
              (!inline || navigated || intent === "search") &&
              highlight === results.length
            }
            data-current={!inline && highlight === results.length ? "" : undefined}
            onMouseEnter={() => setHighlight(results.length)}
            onMouseDown={(e) => {
              e.preventDefault();
              pick(results.length);
            }}
            className={
              inline
                ? [
                    "cursor-pointer px-2 py-1.5 text-center text-[13px] hover:text-ink",
                    (navigated || intent === "search") && highlight === results.length
                      ? "text-ink"
                      : "text-muted",
                  ].join(" ")
                : "quiet-menu-item"
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

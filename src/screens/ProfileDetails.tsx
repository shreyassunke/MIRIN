import { useEffect, useState, type FormEvent } from "react";
import { chipClass, chipTrackClass } from "../components/chip";
import { useAuth } from "../auth/AuthProvider";
import type { Gender } from "../lib/body";
import {
  AGE_KEY,
  GENDER_KEY,
  parseAge,
  parseGender,
  useSettingValue,
  writeSetting,
} from "../lib/profile";
import { getDisplayName } from "../lib/user";
import { ProfileBack, fieldLabel, inputClass } from "./profile/chrome";

const GENDERS: { value: Gender; label: string }[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

const primaryBtn =
  "btn-primary h-12 rounded-pill bg-accent px-5 text-sm font-medium text-bg hover:bg-ink disabled:opacity-40";

interface Draft {
  name: string;
  age: string;
  gender: Gender | null;
}

function same(a: Draft, b: Draft): boolean {
  return (
    a.name.trim() === b.name.trim() &&
    a.age.trim() === b.age.trim() &&
    a.gender === b.gender
  );
}

export function ProfileDetails() {
  const { user, updateDisplayName } = useAuth();
  const storedAge = useSettingValue(AGE_KEY);
  const storedGenderRaw = useSettingValue(GENDER_KEY);
  const loaded = storedAge !== null && storedGenderRaw !== null;

  const [draft, setDraft] = useState<Draft | null>(null);
  const [baseline, setBaseline] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (draft || !loaded || !user) return;
    const next: Draft = {
      name: getDisplayName(user),
      age: storedAge ?? "",
      gender: parseGender(storedGenderRaw),
    };
    setDraft(next);
    setBaseline(next);
  }, [draft, loaded, user, storedAge, storedGenderRaw]);

  const dirty = draft != null && baseline != null && !same(draft, baseline);

  function patch(partial: Partial<Draft>) {
    setDraft((current) => (current ? { ...current, ...partial } : current));
    setSaved(false);
    setError(null);
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!draft || !baseline) return;
    const name = draft.name.trim();
    if (!name) {
      setError("Enter a name.");
      setSaved(false);
      return;
    }
    const age = parseAge(draft.age);
    if (!age.ok) {
      setError(age.error);
      setSaved(false);
      return;
    }

    setSubmitting(true);
    setError(null);
    setSaved(false);
    try {
      const next: Draft = {
        name,
        age: age.value ?? "",
        gender: draft.gender,
      };
      if (next.age !== baseline.age) {
        await writeSetting(AGE_KEY, age.value);
      }
      if (next.gender !== baseline.gender && next.gender) {
        await writeSetting(GENDER_KEY, next.gender);
      }
      if (name !== baseline.name.trim()) {
        const result = await updateDisplayName(name);
        if (result.error) {
          setDraft(next);
          setBaseline({ ...next, name: baseline.name });
          setError(result.error);
          return;
        }
      }
      setDraft(next);
      setBaseline(next);
      setSaved(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <header className="mb-6">
        <ProfileBack />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Details</h1>
      </header>

      {draft == null ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <form className="flex flex-col gap-6" onSubmit={(e) => void onSave(e)}>
          <label className="flex flex-col gap-1.5">
            <span className={fieldLabel}>Name</span>
            <input
              className={inputClass}
              type="text"
              name="name"
              autoComplete="name"
              value={draft.name}
              onChange={(e) => patch({ name: e.target.value })}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className={fieldLabel}>Age</span>
            <input
              className={inputClass}
              type="text"
              name="age"
              inputMode="numeric"
              autoComplete="off"
              value={draft.age}
              onChange={(e) => patch({ age: e.target.value })}
            />
          </label>

          <div className="flex flex-col gap-1.5">
            <span className={fieldLabel} id="gender-label">
              Gender
            </span>
            <div
              role="group"
              aria-labelledby="gender-label"
              className={chipTrackClass}
            >
              {GENDERS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={draft.gender === option.value}
                  onClick={() => patch({ gender: option.value })}
                  className={`${chipClass(draft.gender === option.value)} h-11 px-5 text-sm`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="text-[13px] leading-relaxed text-muted">
              Used for the body-fat estimate.
            </p>
          </div>

          {error ? (
            <p className="text-[13px] leading-relaxed text-ink" role="alert">
              {error}
            </p>
          ) : null}
          {saved ? (
            <p className="text-[13px] leading-relaxed text-muted" role="status">
              Saved.
            </p>
          ) : null}

          <button
            type="submit"
            className={`${primaryBtn} w-full sm:w-fit`}
            disabled={!dirty || submitting}
          >
            {submitting ? "Saving…" : "Save"}
          </button>
        </form>
      )}
    </div>
  );
}

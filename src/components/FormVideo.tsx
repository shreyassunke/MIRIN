import { useState, type SVGProps } from "react";
import { useOnline } from "../hooks/useOnline";
import {
  CREATORS,
  embedUrl,
  formClipsFor,
  segmentLabel,
  type FormClip,
} from "../lib/formVideos";

const panelId = (exerciseId: string) => `form-video-${exerciseId}`;

function IconHelp(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M9.9 9.7a2.2 2.2 0 1 1 2.75 2.32c-.42.14-.65.53-.65.98v.35"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <circle cx="12" cy="16.1" r="1.05" fill="currentColor" />
    </svg>
  );
}

/**
 * Header affordance for the form walkthrough. Absent entirely on the many
 * library entries with no curated clip, so it never promises help that the
 * panel cannot give.
 */
export function FormVideoButton({
  exerciseId,
  open,
  onToggle,
}: {
  exerciseId: string;
  open: boolean;
  onToggle: () => void;
}) {
  if (formClipsFor(exerciseId).length === 0) return null;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={panelId(exerciseId)}
      aria-label={open ? "Hide form video" : "Show form video"}
      className={[
        "glass-btn flex h-11 w-11 shrink-0 items-center justify-center rounded-pill",
        open ? "glass-btn-active text-ink" : "text-muted hover:text-ink",
      ].join(" ")}
    >
      <IconHelp className="h-[22px] w-[22px]" />
    </button>
  );
}

/**
 * Nothing is requested from YouTube until the button opens this, and the
 * panel is the only place that can explain why playback is unavailable —
 * so it reports the offline case rather than the button disabling itself.
 */
export function FormVideoPanel({
  exerciseId,
  open,
}: {
  exerciseId: string;
  open: boolean;
}) {
  const clips = formClipsFor(exerciseId);
  const [active, setActive] = useState(0);
  const online = useOnline();

  if (!open || clips.length === 0) return null;

  const clip = clips[Math.min(active, clips.length - 1)];
  const others = clips.filter((c) => c !== clip);

  return (
    <section id={panelId(exerciseId)} className="panel-in mb-8">
      {online ? (
        <>
          <div className="overflow-hidden rounded-md border border-hairline bg-surface">
            {/* YouTube requires embedded players to be at least 200x200; a 16:9
                box falls under that on narrow phones, so the floor is explicit
                and sits inside the border rather than sharing a box with it. */}
            <div className="aspect-video min-h-[200px] w-full">
              <iframe
                key={`${clip.videoId}-${clip.start ?? 0}`}
                className="h-full w-full"
                src={embedUrl(clip)}
                title={`${CREATORS[clip.creator].name} — ${clip.label ?? "form walkthrough"}`}
                allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          </div>
          <Caption clip={clip} />
          {others.length > 0 && (
            <ul className="mt-3 flex flex-col gap-2">
              {others.map((other) => (
                <li key={`${other.videoId}-${other.start ?? 0}`}>
                  <ClipRow
                    clip={other}
                    onPlay={() => setActive(clips.indexOf(other))}
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <p className="max-w-[65ch] text-sm leading-relaxed text-muted">
          Form videos need a connection. Your log works offline as usual.
        </p>
      )}
    </section>
  );
}

function Caption({ clip }: { clip: FormClip }) {
  const segment = segmentLabel(clip);
  const creator = CREATORS[clip.creator];

  return (
    <p className="mt-2 text-[13px] leading-relaxed text-muted">
      {clip.label ?? "Form walkthrough"}
      {segment ? <span className="tnum"> · {segment}</span> : null}
      {" · "}
      <a
        href={creator.channelUrl}
        target="_blank"
        rel="noreferrer"
        className="transition-colors duration-150 hover:text-ink"
      >
        {creator.name}
      </a>
    </p>
  );
}

function ClipRow({ clip, onPlay }: { clip: FormClip; onPlay: () => void }) {
  const segment = segmentLabel(clip);

  return (
    <button
      type="button"
      onClick={onPlay}
      className="glass-chip flex w-full items-baseline justify-between gap-3 rounded-md border border-hairline bg-surface px-4 py-3 text-left"
    >
      <span className="min-w-0">
        <span className="block truncate text-sm text-ink">
          {clip.label ?? "Form walkthrough"}
        </span>
        <span className="mt-0.5 block text-[12px] text-muted">
          {CREATORS[clip.creator].name}
        </span>
      </span>
      <span className="tnum shrink-0 text-[13px] text-muted">
        {segment ?? "Play"}
      </span>
    </button>
  );
}

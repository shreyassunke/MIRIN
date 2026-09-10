import { useState } from "react";
import { useOnline } from "../hooks/useOnline";
import {
  CREATORS,
  embedUrl,
  formClipsFor,
  segmentLabel,
  type FormClip,
} from "../lib/formVideos";

/**
 * Collapsed chips render from committed JSON, so the section looks the same
 * offline; only the tap target is disabled. Nothing is requested from YouTube
 * until a chip is tapped.
 */
export function FormVideos({ exerciseId }: { exerciseId: string }) {
  const clips = formClipsFor(exerciseId);
  const [playing, setPlaying] = useState<number | null>(null);
  const online = useOnline();

  if (clips.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-2 text-[13px] font-medium text-muted">Form</h2>
      <ul className="flex flex-col gap-2">
        {clips.map((clip, i) => (
          <li key={`${clip.videoId}-${clip.start ?? 0}`}>
            {playing === i ? (
              <ClipPlayer clip={clip} />
            ) : (
              <ClipChip
                clip={clip}
                disabled={!online}
                onPlay={() => setPlaying(i)}
              />
            )}
          </li>
        ))}
      </ul>
      {!online && (
        <p className="mt-2 text-[12px] text-muted">
          Form videos need a connection.
        </p>
      )}
    </section>
  );
}

function ClipChip({
  clip,
  disabled,
  onPlay,
}: {
  clip: FormClip;
  disabled: boolean;
  onPlay: () => void;
}) {
  const creator = CREATORS[clip.creator];
  const segment = segmentLabel(clip);

  return (
    <button
      type="button"
      onClick={onPlay}
      disabled={disabled}
      className="glass-chip flex w-full items-baseline justify-between gap-3 rounded-md border border-hairline bg-surface px-4 py-3 text-left disabled:opacity-40"
    >
      <span className="min-w-0">
        <span className="block truncate text-sm text-ink">
          {clip.label ?? "Form walkthrough"}
        </span>
        <span className="mt-0.5 block text-[12px] text-muted">
          {creator.name}
        </span>
      </span>
      <span className="tnum shrink-0 text-[13px] text-muted">
        {segment ?? "Play"}
      </span>
    </button>
  );
}

function ClipPlayer({ clip }: { clip: FormClip }) {
  const creator = CREATORS[clip.creator];

  return (
    <div className="overflow-hidden rounded-md border border-hairline bg-surface">
      {/* YouTube requires embedded players to be at least 200x200; a 16:9 box
          falls under that on narrow phones, so the floor is explicit. */}
      <div className="aspect-video min-h-[200px] w-full">
        <iframe
          className="h-full w-full"
          src={embedUrl(clip)}
          title={`${creator.name} — ${clip.label ?? "form walkthrough"}`}
          allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
      <p className="px-4 py-2 text-[12px] text-muted">
        <a
          href={creator.channelUrl}
          target="_blank"
          rel="noreferrer"
          className="transition-colors duration-150 hover:text-ink"
        >
          {creator.name}
        </a>
      </p>
    </div>
  );
}

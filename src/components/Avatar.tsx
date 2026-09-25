import { profileInitial } from "../lib/profile";

export function Avatar({
  src,
  name,
  email,
  size = 64,
}: {
  src: string | null;
  name: string;
  email: string;
  size?: number;
}) {
  const initial = profileInitial(name, email);
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-pill border border-glass-border bg-surface font-semibold text-ink"
      style={{
        width: size,
        height: size,
        fontSize: size < 48 ? 13 : 18,
      }}
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        initial
      )}
    </span>
  );
}

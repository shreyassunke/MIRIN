import { useEffect, useState } from "react";

/** Two-tap destructive action: arms on the first tap, disarms after 4s. */
export function ConfirmDelete({
  onConfirm,
  label = "Remove",
  confirmLabel = "Confirm remove",
}: {
  onConfirm: () => void;
  label?: string;
  confirmLabel?: string;
}) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <button
      type="button"
      onClick={() => (armed ? onConfirm() : setArmed(true))}
      className="text-[13px] font-medium text-muted transition-colors duration-150 hover:text-ink"
    >
      {armed ? confirmLabel : label}
    </button>
  );
}

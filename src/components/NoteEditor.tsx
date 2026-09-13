import { useEffect, useRef, useState } from "react";

interface NoteEditorProps {
  initial: string;
  placeholder: string;
  label: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
}

/** Inline note field. Blur or Enter commits; Escape cancels. */
export function NoteEditor({
  initial,
  placeholder,
  label,
  onCommit,
  onCancel,
}: NoteEditorProps) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  function commit() {
    onCommit(value.trim());
  }

  return (
    <textarea
      ref={ref}
      rows={2}
      value={value}
      aria-label={label}
      placeholder={placeholder}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          e.currentTarget.blur();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
      }}
      className="mt-2 w-full resize-none rounded-md border border-hairline bg-bg px-3 py-2 text-[15px] leading-relaxed text-ink placeholder:text-muted focus:border-muted"
    />
  );
}

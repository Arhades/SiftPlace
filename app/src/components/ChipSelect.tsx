import { useState } from "react";
import type { Option } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface OtherProps {
  /** Free text typed under "Other" — flows into the search's NLP handling. */
  otherValue: string;
  onOtherChange: (next: string) => void;
  otherPlaceholder?: string;
}

type Props = (
  | {
      options: Option[];
      multiple: true;
      value: string[];
      onChange: (next: string[]) => void;
    }
  | {
      options: Option[];
      multiple?: false;
      value: string;
      onChange: (next: string) => void;
    }
) &
  Partial<OtherProps>;

/** Reusable pill chip group — single-select (vibe) or multi-select (nearby/types/
 * amenities). Pass `otherValue`/`onOtherChange` to add a consistent "Other…"
 * free-text chip whose text feeds the NLP side of the search. */
export function ChipSelect(props: Props) {
  const hasOther = props.onOtherChange != null;
  const [otherOpen, setOtherOpen] = useState(Boolean(props.otherValue));

  const isSelected = (v: string) =>
    props.multiple === true ? props.value.includes(v) : props.value === v;

  const toggle = (v: string) => {
    if (props.multiple === true) {
      const set = new Set(props.value);
      if (set.has(v)) set.delete(v);
      else set.add(v);
      props.onChange([...set]);
    } else {
      props.onChange(v);
    }
  };

  const toggleOther = () => {
    const next = !otherOpen;
    setOtherOpen(next);
    if (!next) props.onOtherChange?.("");
  };

  const otherOn = otherOpen || Boolean(props.otherValue);

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {props.options.map((opt) => {
          const on = isSelected(opt.value);
          return (
            <button
              key={opt.value || "any"}
              type="button"
              onClick={() => toggle(opt.value)}
              aria-pressed={on}
              className={cn(
                "px-3.5 py-2 rounded-full border-2 text-sm font-bold transition-all cursor-pointer active:scale-[0.95]",
                on
                  ? "bg-primary border-primary-dim text-on-primary shadow-[0_3px_0_var(--primary-dim)]"
                  : "bg-lowest border-line text-ink hover:bg-surface-c",
              )}
            >
              {opt.label}
            </button>
          );
        })}
        {hasOther && (
          <button
            type="button"
            onClick={toggleOther}
            aria-pressed={otherOn}
            className={cn(
              "px-3.5 py-2 rounded-full border-2 border-dashed text-sm font-bold transition-all cursor-pointer active:scale-[0.95]",
              otherOn
                ? "bg-primary/20 border-primary-dim text-ink"
                : "bg-lowest border-line text-muted hover:bg-surface-c",
            )}
          >
            ✏️ Other…
          </button>
        )}
      </div>
      {hasOther && otherOn && (
        <input
          className="sf-field mt-2"
          value={props.otherValue ?? ""}
          placeholder={props.otherPlaceholder ?? "Tell us what — we'll factor it in"}
          onChange={(e) => props.onOtherChange?.(e.target.value)}
        />
      )}
    </div>
  );
}

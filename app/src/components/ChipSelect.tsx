import type { Option } from "@/lib/constants";
import { cn } from "@/lib/utils";

type Props =
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
    };

/** Reusable pill chip group — single-select (vibe) or multi-select (nearby/types/amenities). */
export function ChipSelect(props: Props) {
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

  return (
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
              "px-3.5 py-2 rounded-xl border text-xs font-medium transition-all cursor-pointer active:scale-[0.97]",
              on
                ? "bg-indigo-500/25 border-indigo-500 text-white"
                : "bg-white/[0.02] border-white/[0.08] text-white/60 hover:bg-white/[0.05]",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

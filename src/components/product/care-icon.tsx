import { Droplets, Feather, Leaf, Ruler, ShieldCheck, Sparkles, WashingMachine, Wind } from "lucide-react";
import type { CareKind } from "@/types";

/** Simple line versions of the standard laundry symbols. */
export function CareIcon({ kind, text, className = "size-7" }: { kind: CareKind; text?: string; className?: string }) {
  const no = /do not|don't/i.test(text ?? "");
  const temp = text?.match(/(\d{2})°C/)?.[1];
  const cross = no ? <path d="M5 5l22 22M27 5L5 27" /> : null;
  const common = { viewBox: "0 0 32 32", fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, className, "aria-hidden": true };

  switch (kind) {
    case "wash":
      return (
        <svg {...common}>
          <path d="M4 10l3 15h18l3-15" />
          <path d="M4 10c2 2 4 2 6 0s4-2 6 0 4 2 6 0 4-2 6 0" />
          {temp && (
            <text x="16" y="22" textAnchor="middle" fontSize="8" fill="currentColor" stroke="none" fontFamily="inherit">
              {temp}
            </text>
          )}
          {cross}
        </svg>
      );
    case "bleach":
      return (
        <svg {...common}>
          <path d="M16 5l12 21H4z" />
          {cross}
        </svg>
      );
    case "dry":
      return (
        <svg {...common}>
          <rect x="5" y="5" width="22" height="22" rx="1" />
          <circle cx="16" cy="16" r="7.5" />
          {/low/i.test(text ?? "") && <circle cx="16" cy="16" r="1.2" fill="currentColor" />}
          {cross}
        </svg>
      );
    case "iron":
      return (
        <svg {...common}>
          <path d="M5 23h22l-2-9c-.4-2-2-3-4-3H11" />
          <path d="M11 11v-2h8" />
          {!no && <circle cx="16" cy="18.5" r="1.1" fill="currentColor" />}
          {cross}
        </svg>
      );
    case "dryclean":
      return (
        <svg {...common}>
          <circle cx="16" cy="16" r="10" />
          {cross}
        </svg>
      );
  }
}

/** Picks a line icon for a short feature like "650 GSM – plush & heavy". */
export function FeatureIcon({ text, className = "size-[18px]" }: { text: string; className?: string }) {
  const t = text.toLowerCase();
  const props = { className, strokeWidth: 1.4, "aria-hidden": true as const };
  if (/wash|°c/.test(t)) return <WashingMachine {...props} />;
  if (/quick|dry/.test(t)) return <Wind {...props} />;
  if (/gsm|plush|heavy|soft/.test(t)) return <Feather {...props} />;
  if (/cotton|linen|bamboo|organic|wool/.test(t)) return <Leaf {...props} />;
  if (/absorb|thirst|water/.test(t)) return <Droplets {...props} />;
  if (/size|cm|inch/.test(t)) return <Ruler {...props} />;
  if (/warrant|certified|tested|oeko/.test(t)) return <ShieldCheck {...props} />;
  return <Sparkles {...props} />;
}

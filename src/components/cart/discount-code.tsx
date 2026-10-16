import { useId, useState } from "react";
import { siteConfig } from "@/lib/config";
import { useCart } from "@/lib/store/cart";
import { useT } from "@/i18n";

/** Discount code field. Valid mock codes live in siteConfig.discountCodes. */
export function DiscountCode() {
  const id = useId();
  const code = useCart((s) => s.discountCode);
  const setCode = useCart((s) => s.setDiscountCode);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const t = useT("cart.discountCode");

  if (code) {
    return (
      <p className="flex items-center justify-between text-sm">
        <span>
          {t.rich("applied", { code: <span className="font-medium">{code}</span> }, { pct: siteConfig.discountCodes[code] })}
        </span>
        <button type="button" onClick={() => setCode(null)} className="text-xs underline underline-offset-4">
          {t("remove")}
        </button>
      </p>
    );
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const c = value.trim().toUpperCase();
        if (!c) return setError(t("empty"));
        if (!(c in siteConfig.discountCodes)) return setError(t("invalid"));
        setError(null);
        setCode(c);
        setValue("");
      }}
    >
      <label htmlFor={`${id}-code`} className="sr-only">
        {t("label")}
      </label>
      <div className="flex">
        <input
          id={`${id}-code`}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          placeholder={t("label")}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-err` : undefined}
          className="h-11 min-w-0 flex-1 rounded-l-sm border border-r-0 border-input bg-surface px-3.5 text-sm uppercase placeholder:normal-case placeholder:text-muted-foreground focus-visible:border-foreground focus-visible:outline-none aria-[invalid=true]:border-danger"
        />
        <button type="submit" className="h-11 shrink-0 whitespace-nowrap rounded-r-sm border border-foreground px-4 text-[13px] font-medium transition-colors hover:bg-foreground hover:text-background">
          {t("apply")}
        </button>
      </div>
      {error && (
        <p id={`${id}-err`} role="alert" className="mt-1.5 text-xs text-danger">
          {error}
        </p>
      )}
    </form>
  );
}

import { Check, LoaderCircle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/i18n";

const KEY = "vendora-back-in-stock";

/** Replaces "Add to bag" when the selected option is out of stock. */
export function NotifyMe({ productId, label }: { productId: string; label: string }) {
  const id = useId();
  const t = useT("notify");
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("saving");
    // TODO(backend): POST /back-in-stock { productId, variant, email }
    await new Promise((r) => setTimeout(r, 600));
    try {
      const list = JSON.parse(localStorage.getItem(KEY) ?? "[]") as unknown[];
      localStorage.setItem(KEY, JSON.stringify([...list, { productId, label, email, at: Date.now() }]));
    } catch {
      /* storage unavailable — fine for the demo */
    }
    setState("done");
    toast.success(t("toastTitle"), { description: t("toastBody", { email, label }) });
  };

  if (state === "done") {
    return (
      <p className="flex h-12 items-center justify-center gap-2 rounded-sm border border-navy/30 text-sm" role="status">
        <Check className="size-4" strokeWidth={1.5} aria-hidden="true" /> {t("done")}
      </p>
    );
  }

  return (
    <div>
      <Button type="button" size="lg" className="h-auto min-h-12 w-full whitespace-normal py-2" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={`${id}-form`}>
        {t("button")}
      </Button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.form
            id={`${id}-form`}
            onSubmit={submit}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <label htmlFor={`${id}-email`} className="mt-3 block text-xs text-muted-foreground">
              {t("emailLabel", { label })}
            </label>
            <div className="mt-1.5 flex gap-2">
              <Input id={`${id}-email`} type="email" required autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 flex-1" />
              <Button type="submit" variant="outline" className="h-11" disabled={state === "saving"}>
                {state === "saving" ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : t("submit")}
              </Button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}

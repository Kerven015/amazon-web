import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Label, Select } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { toast } from "@/components/ui/toaster";
import { useT } from "@/i18n";
import { siteConfig } from "@/lib/config";
import { countryName } from "@/lib/order-format";
import { type AddressField, emptyAddress, useAddressBook, validateAddress } from "@/lib/store/addresses";
import type { Address } from "@/types";

type Draft = Omit<Address, "id">;

/** Add or edit an address in the address book (right-hand sheet on desktop, full width on phones). */
export function AddressSheet({ open, onOpenChange, address }: { open: boolean; onOpenChange: (open: boolean) => void; address?: Address | null }) {
  const t = useT("account");
  const tc = useT("checkout");
  const uid = useId();
  const add = useAddressBook((s) => s.add);
  const update = useAddressBook((s) => s.update);
  const setDefault = useAddressBook((s) => s.setDefault);
  const [draft, setDraft] = useState<Draft>(() => emptyAddress(siteConfig.shippingCountries[0]));
  const [makeDefault, setMakeDefault] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<AddressField, string>>>({});

  // Fresh form each time the sheet opens
  useEffect(() => {
    if (!open) return;
    const { id: _id, isDefault, ...rest } = address ?? { id: "", isDefault: false, ...emptyAddress(siteConfig.shippingCountries[0]) };
    // Older addresses may use a label we show translated ("home"/"work"); keep it as stored.
    setDraft({ ...rest, label: rest.label ?? "" });
    setMakeDefault(!!isDefault);
    setErrors({});
  }, [open, address]);

  const set = (f: keyof Draft, v: string) => {
    setDraft((d) => ({ ...d, [f]: v }));
    if (errors[f as AddressField]) setErrors((e) => ({ ...e, [f]: undefined }));
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validateAddress(draft);
    setErrors(errs);
    if (Object.keys(errs).length) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-form="${uid}"] [aria-invalid="true"]`)?.focus());
      return;
    }
    const clean = { ...draft, line2: draft.line2?.trim() || undefined };
    if (address) {
      update(address.id, clean);
      if (makeDefault && !address.isDefault) setDefault(address.id);
    } else {
      add(clean, makeDefault);
    }
    toast.success(t("addressSaved"));
    onOpenChange(false);
  };

  const field = (f: keyof Draft, label: string, props: React.ComponentProps<typeof Input> = {}) => {
    const id = `${uid}-${f}`;
    const err = errors[f as AddressField];
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id}>{label}</Label>
        <Input
          id={id}
          value={String(draft[f] ?? "")}
          onChange={(e) => set(f, e.target.value)}
          aria-invalid={err ? true : undefined}
          aria-describedby={err ? `${id}-error` : undefined}
          {...props}
        />
        {err && (
          <p id={`${id}-error`} className="text-xs text-danger">
            {tc(`errors.${err}`)}
          </p>
        )}
      </div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" title={address ? t("addressForm.editTitle") : t("addressForm.addTitle")} bodyClassName="px-5 py-5 sm:px-6">
        <form noValidate onSubmit={save} className="space-y-4" data-form={uid}>
          {Object.values(errors).some(Boolean) && (
            <p role="alert" className="text-sm text-danger">
              {tc("errors.summary")}
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor={`${uid}-label`}>{t("addressForm.label")}</Label>
            <Input id={`${uid}-label`} value={draft.label === "home" ? t("addressLabels.home") : draft.label === "work" ? t("addressLabels.work") : draft.label} onChange={(e) => set("label", e.target.value)} aria-describedby={`${uid}-label-hint`} />
            <p id={`${uid}-label-hint`} className="text-xs text-muted-foreground">
              {t("addressForm.labelHint")}
            </p>
          </div>
          {field("fullName", tc("address.fullName"), { autoComplete: "name" })}
          {field("line1", tc("address.street"), { autoComplete: "address-line1" })}
          {field("line2", tc("address.apt"), { autoComplete: "address-line2" })}
          <div className="grid gap-4 sm:grid-cols-2">
            {field("city", tc("address.city"), { autoComplete: "address-level2" })}
            {field("region", tc("address.region"), { autoComplete: "address-level1" })}
            {field("postalCode", tc("address.postalCode"), { autoComplete: "postal-code" })}
            <div className="space-y-1.5">
              <Label htmlFor={`${uid}-country`}>{tc("address.country")}</Label>
              <Select id={`${uid}-country`} value={draft.country} onChange={(e) => set("country", e.target.value)} autoComplete="country">
                {[...new Set([...siteConfig.shippingCountries, draft.country])].map((c) => (
                  <option key={c} value={c}>
                    {countryName(c)}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          {field("phone", tc("address.phone"), { type: "tel", autoComplete: "tel" })}
          <label className="flex min-h-10 items-center gap-2 text-sm">
            <Checkbox checked={makeDefault} disabled={!!address?.isDefault} onChange={(e) => setMakeDefault(e.target.checked)} /> {t("addressForm.makeDefault")}
          </label>
          <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t("addressForm.cancel")}
            </Button>
            <Button type="submit">{t("addressForm.save")}</Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

import { useTheme } from "@/lib/theme";
import { Toaster as Sonner } from "sonner";
import { translate } from "@/i18n";

export function Toaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Sonner
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      position="bottom-right"
      // Below lg the bag and product pages have a sticky bottom bar: keep toasts above it (--toast-bottom in globals.css)
      offset={{ bottom: "var(--toast-bottom)", right: "24px" }}
      mobileOffset={{ bottom: "var(--toast-bottom)", left: "16px", right: "16px" }}
      closeButton
      containerAriaLabel={translate("common.notifications")}
      toastOptions={{
        closeButtonAriaLabel: translate("common.close"),
        classNames: {
          toast: "!rounded-sm !border-border !bg-popover !text-popover-foreground !shadow-pop",
          description: "!text-muted-foreground",
          actionButton: "!bg-primary !text-primary-foreground",
        },
      }}
    />
  );
}

export { toast } from "sonner";

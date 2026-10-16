import { Link } from "@/lib/router";
import { openPanel } from "@/lib/store/ui";
import { cn } from "@/lib/utils";

/** A link that also understands the special "#quiz" target (opens the product finder). */
export function MenuAnchor({
  link,
  className,
  onNavigate,
  children,
}: {
  link: { href: string };
  className?: string;
  onNavigate?: () => void;
  children: React.ReactNode;
}) {
  if (link.href === "#quiz") {
    return (
      <button
        type="button"
        className={cn("text-left", className)}
        onClick={() => {
          onNavigate?.();
          openPanel("quiz");
        }}
      >
        {children}
      </button>
    );
  }
  return (
    <Link href={link.href} className={className} onClick={onNavigate}>
      {children}
    </Link>
  );
}

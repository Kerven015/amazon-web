import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap rounded-xs px-2 py-1 text-[10px] font-semibold uppercase leading-none tracking-[0.12em]",
  {
    variants: {
      variant: {
        default: "bg-primary-soft text-foreground",
        deal: "bg-accent text-accent-foreground",
        "deal-soft": "bg-accent-soft text-accent",
        success: "bg-success-soft text-success",
        warning: "bg-warning-soft text-warning",
        danger: "bg-danger-soft text-danger",
        outline: "border border-border text-muted-foreground",
        neutral: "bg-muted text-muted-foreground",
        surface: "bg-surface/95 text-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-sm text-center leading-tight text-[13px] font-medium tracking-[0.04em] transition-[color,background-color,border-color,opacity] duration-300 ease-calm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover",
        deal: "bg-accent text-accent-foreground hover:opacity-90",
        secondary: "bg-muted text-foreground hover:bg-primary-soft",
        outline: "border border-foreground/80 bg-transparent text-foreground hover:bg-foreground hover:text-background",
        ghost: "text-foreground hover:bg-muted",
        link: "h-auto px-0 text-foreground underline decoration-1 underline-offset-4 hover:decoration-2",
        destructive: "bg-danger text-white hover:opacity-90",
      },
      size: {
        // min-height (not fixed height): longer Turkish/Turkmen labels wrap instead of overflowing
        sm: "min-h-9 px-3 py-1.5 text-xs",
        default: "min-h-11 px-5 py-2",
        lg: "min-h-12 px-7 py-2.5 text-sm",
        icon: "size-10",
        "icon-sm": "size-8",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

/** React 19: `ref` is a normal prop, so it's part of the button's props. */
export interface ButtonProps
  extends React.ComponentProps<"button">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

function Button({ className, variant, size, asChild = false, type, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      type={asChild ? undefined : (type ?? "button")}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };

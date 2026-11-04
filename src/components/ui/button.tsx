import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-chip text-sm font-semibold transition-[background-color,border-color,color,opacity] duration-200 disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-ink hover:bg-[#e7ffa8] active:bg-[#c8e07c]",
        secondary:
          "border border-line bg-raised text-fg hover:border-rail hover:bg-[#222722] active:bg-[#151815]",
        outline:
          "border border-line-light bg-transparent text-ink hover:bg-subtle/70 active:bg-subtle",
        ghost: "text-fg-muted hover:bg-white/5 hover:text-fg",
        "ghost-light": "text-ink-muted hover:bg-subtle hover:text-ink",
        danger: "bg-danger text-danger-ink hover:bg-[#ffd9cf] active:bg-[#efb7a8]",
        link: "text-accent-ink underline decoration-line-light underline-offset-4 hover:decoration-ink",
      },
      size: {
        sm: "h-9 px-3 text-xs",
        md: "h-11 px-4",
        lg: "h-12 px-6 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}

export { buttonVariants };

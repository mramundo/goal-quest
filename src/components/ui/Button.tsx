import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-display uppercase tracking-wider text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 disabled:pointer-events-none active:translate-y-[1px]",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-medieval hover:brightness-110 medieval-border",
        secondary:
          "bg-secondary text-secondary-foreground shadow-medieval hover:brightness-110 medieval-border",
        ghost: "hover:bg-muted/60 text-foreground",
        outline:
          "border border-border bg-transparent hover:bg-muted/60 text-foreground",
        destructive:
          "bg-destructive text-destructive-foreground shadow-medieval hover:brightness-110 medieval-border",
        gold:
          "bg-[linear-gradient(135deg,hsl(var(--accent)),hsl(var(--primary)))] text-primary-foreground shadow-medieval hover:brightness-110 medieval-border font-bold",
        link: "underline-offset-4 hover:underline text-primary",
      },
      size: {
        sm: "h-9 px-3",
        md: "h-11 px-5",
        lg: "h-12 px-7 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { buttonVariants };

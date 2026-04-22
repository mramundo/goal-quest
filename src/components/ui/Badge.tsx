import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-display uppercase tracking-wider",
  {
    variants: {
      variant: {
        default: "border-border bg-card/70 text-foreground",
        gold: "border-accent/60 bg-accent/15 text-accent-foreground",
        secondary: "border-secondary/60 bg-secondary/15 text-secondary-foreground",
        muted: "border-muted bg-muted text-muted-foreground",
        success: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export const Badge = ({ className, variant, ...props }: BadgeProps) => (
  <span className={cn(badgeVariants({ variant }), className)} {...props} />
);

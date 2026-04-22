import * as React from "react";
import { cn } from "@/lib/utils";

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number; // 0-100
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
}

export const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ value, showLabel, size = "md", className, ...props }, ref) => {
    const pct = Math.max(0, Math.min(100, value));
    const heights = { sm: "h-2", md: "h-3", lg: "h-4" }[size];
    return (
      <div
        ref={ref}
        className={cn("relative w-full rounded-full xp-track overflow-hidden medieval-border", heights, className)}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        {...props}
      >
        <div
          className="xp-fill h-full transition-[width] duration-500 ease-out rounded-full"
          style={{ width: `${pct}%` }}
        />
        {showLabel && (
          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-display font-bold text-foreground/90 mix-blend-difference">
            {Math.round(pct)} / 100
          </span>
        )}
      </div>
    );
  }
);
Progress.displayName = "Progress";

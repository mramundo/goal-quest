import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type = "text", ...props }, ref) => {
  return (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex h-11 w-full rounded-md border border-input bg-card/70 px-3 text-sm",
        "placeholder:text-muted-foreground focus-visible:outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring",
        "disabled:opacity-50 medieval-border",
        className
      )}
      {...props}
    />
  );
});
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-[96px] w-full rounded-md border border-input bg-card/70 px-3 py-2 text-sm",
        "placeholder:text-muted-foreground focus-visible:outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring",
        "disabled:opacity-50 medieval-border resize-y",
        className
      )}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn(
      "text-xs font-display uppercase tracking-[0.18em] text-muted-foreground",
      className
    )}
    {...props}
  />
));
Label.displayName = "Label";

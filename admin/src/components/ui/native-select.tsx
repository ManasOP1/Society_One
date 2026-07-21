import * as React from "react";
import { cn } from "@/lib/utils";

export interface NativeSelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  /** `filter` = toolbar row (h-9); `default` = forms (h-10) */
  fieldSize?: "default" | "filter";
}

const NativeSelect = React.forwardRef<HTMLSelectElement, NativeSelectProps>(
  ({ className, fieldSize = "default", children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          "appearance-none rounded-2xl border border-input bg-card text-sm text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          fieldSize === "filter" ? "h-9 px-3" : "h-10 px-3",
          className
        )}
        {...props}
      >
        {children}
      </select>
    );
  }
);
NativeSelect.displayName = "NativeSelect";

export { NativeSelect };

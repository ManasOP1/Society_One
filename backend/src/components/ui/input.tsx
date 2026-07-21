import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends Omit<React.ComponentProps<"input">, "size"> {
  /** `filter` = toolbar/search (h-9); `default` = forms (h-10) */
  fieldSize?: "default" | "filter";
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, fieldSize = "default", ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex w-full rounded-2xl border border-input bg-card text-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          fieldSize === "filter" ? "h-9 px-3" : "h-10 px-4",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };

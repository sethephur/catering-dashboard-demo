import * as React from "react";
import { cn } from "@/lib/utils";

type FieldProps = React.HTMLAttributes<HTMLDivElement> & {
  orientation?: "vertical" | "horizontal";
};

const Field = React.forwardRef<HTMLDivElement, FieldProps>(
  ({ className, orientation = "vertical", ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex gap-2",
        orientation === "horizontal"
          ? "flex-row items-center"
          : "flex-col items-start",
        className,
      )}
      {...props}
    />
  ),
);

Field.displayName = "Field";

export { Field };

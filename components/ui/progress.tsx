"use client";

import * as React from "react";
import { Progress as ProgressPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

function Progress({ className, value, indicatorClassName, ...props }: React.ComponentProps<typeof ProgressPrimitive.Root> & { indicatorClassName?: string }) {
  return (
    <ProgressPrimitive.Root data-slot="progress" className={cn("relative h-2 w-full overflow-hidden rounded-full bg-muted", className)} value={value} {...props}>
      <ProgressPrimitive.Indicator
        className={cn("h-full w-full flex-1 bg-primary transition-transform", indicatorClassName)}
        style={{ transform: `translateX(-${100 - Math.min(100, value ?? 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };

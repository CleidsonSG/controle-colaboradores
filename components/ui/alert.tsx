import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative grid w-full grid-cols-[0_1fr] items-start gap-y-1 rounded-lg border px-4 py-3 text-sm has-[>svg]:grid-cols-[1.25rem_1fr] has-[>svg]:gap-x-3 [&>svg]:size-5 [&>svg]:translate-y-px",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground [&>svg]:text-muted-foreground",
        info: "border-primary/25 bg-secondary text-foreground [&>svg]:text-primary",
        success: "border-success/30 bg-success/10 text-foreground [&>svg]:text-success",
        warning: "border-warning/30 bg-warning/10 text-foreground [&>svg]:text-warning",
        destructive: "border-destructive/30 bg-destructive/10 text-foreground [&>svg]:text-destructive",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Alert({ className, variant, ...props }: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return <div data-slot="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
}
function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="alert-title" className={cn("col-start-2 font-semibold", className)} {...props} />;
}
function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="alert-description" className={cn("col-start-2 grid gap-1 text-muted-foreground [&_strong]:text-foreground", className)} {...props} />;
}

export { Alert, AlertTitle, AlertDescription };

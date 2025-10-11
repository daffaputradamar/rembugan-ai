import * as React from "react"

import { cn } from "@/lib/utils"

export type StepStatus = "complete" | "current" | "upcoming"

export interface StepperStep {
  key: string
  title: React.ReactNode
  description?: React.ReactNode
  status: StepStatus
  onSelect?: () => void
}

export interface StepperProps extends React.HTMLAttributes<HTMLOListElement> {
  steps: StepperStep[]
  size?: "sm" | "md"
  withNumbers?: boolean
}

const badgeSizes: Record<NonNullable<StepperProps["size"]>, string> = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
}

const cardPadding: Record<NonNullable<StepperProps["size"]>, string> = {
  sm: "p-3",
  md: "p-4",
}

const mobileConnectorOffset: Record<NonNullable<StepperProps["size"]>, string> = {
  sm: "left-5",
  md: "left-6",
}

const Stepper = React.forwardRef<HTMLOListElement, StepperProps>(
  ({ steps, size = "md", withNumbers = true, className, ...props }, ref) => {
    return (
      <ol
        ref={ref}
        className={cn("relative grid gap-8 sm:grid-cols-3 sm:items-stretch", className)}
        {...props}
      >
        {steps.map((step, index) => (
          <li key={step.key} className="relative flex h-full sm:items-stretch">
            {/* Desktop horizontal connector - before the card */}
            {index > 0 ? (
              <span
                aria-hidden
                className="pointer-events-none absolute right-full top-0 hidden h-full w-8 items-center sm:flex"
              >
                <span className="h-px w-full bg-border" />
              </span>
            ) : null}

            <div className="relative flex-1 h-full">
              <div
                className={cn(
                  "relative flex h-full flex-col rounded-xl border transition",
                  cardPadding[size],
                  step.status === "current" && "border-primary bg-primary/5",
                  step.status === "complete" && "border-primary/40 bg-primary/10",
                  step.status === "upcoming" && "border-primary/20 bg-muted/30",
                  step.onSelect && "cursor-pointer hover:border-primary/60 hover:bg-primary/5"
                )}
                onClick={step.onSelect}
              >
                <div className="relative flex items-start gap-3">
                  <span
                    className={cn(
                      "relative flex flex-shrink-0 items-center justify-center rounded-full font-semibold",
                      badgeSizes[size],
                      step.status === "current" && "bg-primary text-primary-foreground",
                      step.status === "complete" && "bg-primary text-primary-foreground",
                      step.status === "upcoming" && "bg-muted-foreground/10 text-muted-foreground"
                    )}
                  >
                    {withNumbers ? index + 1 : <span className="h-2 w-2 rounded-full bg-current" />}
                  </span>
                  <div className="space-y-1 text-left">
                    <p className="text-sm font-semibold text-foreground">{step.title}</p>
                    {step.description ? (
                      <p className="text-xs text-muted-foreground">{step.description}</p>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Mobile vertical connector - below the card */}
              {index < steps.length - 1 ? (
                <span
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute top-full mt-3 h-3 w-px bg-border sm:hidden",
                    mobileConnectorOffset[size]
                  )}
                />
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    )
  }
)
Stepper.displayName = "Stepper"

export { Stepper }

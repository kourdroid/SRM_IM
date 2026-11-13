import type { ReactNode } from "react"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"

export type SegmentedOption<T extends string> = {
  value: T
  label: ReactNode
  ariaLabel?: string
}

/** Single-choice segmented control on a soft track (wraps the shadcn ToggleGroup). */
export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  ariaLabel,
  className,
}: {
  value: T
  onValueChange: (value: T) => void
  options: SegmentedOption<T>[]
  ariaLabel: string
  className?: string
}) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      aria-label={ariaLabel}
      onValueChange={(next: string) => {
        // Radix emits an empty string when the active item is pressed again; keep the choice.
        if (next) onValueChange(next as T)
      }}
      className={cn("rounded-lg bg-muted p-1", className)}
    >
      {options.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          aria-label={option.ariaLabel}
          className="rounded-md px-3 text-sm data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-soft"
        >
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

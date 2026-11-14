import type { ReactNode } from "react"

import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

/**
 * Soft card with an optional title, description and header action.
 * Pass `revealDelay` (ms) on first paint to fade the card in; `interactive` adds the hover shadow for clickable cards.
 */
export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
  revealDelay,
  interactive = false,
}: {
  title?: string
  description?: string
  action?: ReactNode
  children?: ReactNode
  className?: string
  contentClassName?: string
  revealDelay?: number
  interactive?: boolean
}) {
  const hasHeader = Boolean(title || description || action)
  const revealed = revealDelay !== undefined

  return (
    <Card
      className={cn(
        revealed ? "animate-reveal" : undefined,
        interactive ? "transition-shadow duration-(--duration-base) hover:shadow-soft-lg" : undefined,
        className
      )}
      style={revealed ? { animationDelay: `${revealDelay}ms` } : undefined}
    >
      {hasHeader ? (
        <CardHeader>
          {title ? <CardTitle>{title}</CardTitle> : null}
          {description ? <CardDescription>{description}</CardDescription> : null}
          {action ? <CardAction>{action}</CardAction> : null}
        </CardHeader>
      ) : null}
      {children ? <CardContent className={cn(contentClassName)}>{children}</CardContent> : null}
    </Card>
  )
}

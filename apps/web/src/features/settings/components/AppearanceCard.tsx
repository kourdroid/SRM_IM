import { Monitor, Moon, Sun } from "lucide-react"

import { SectionCard } from "@/components/shared/SectionCard"
import { SegmentedControl, type SegmentedOption } from "@/components/shared/SegmentedControl"
import { useTheme } from "@/components/shared/theme-context"
import type { Theme } from "@/components/shared/theme-context"

const THEME_OPTIONS: SegmentedOption<Theme>[] = [
  {
    value: "light",
    label: (
      <span className="inline-flex items-center gap-1.5">
        <Sun className="size-4" aria-hidden="true" />
        Clair
      </span>
    ),
  },
  {
    value: "dark",
    label: (
      <span className="inline-flex items-center gap-1.5">
        <Moon className="size-4" aria-hidden="true" />
        Sombre
      </span>
    ),
  },
  {
    value: "system",
    label: (
      <span className="inline-flex items-center gap-1.5">
        <Monitor className="size-4" aria-hidden="true" />
        Système
      </span>
    ),
  },
]

/** Theme choice for this browser, reusing the app-wide theme context. */
export function AppearanceCard() {
  const { theme, setTheme } = useTheme()

  return (
    <SectionCard title="Apparence" description="Le choix s'applique à ce navigateur. « Système » suit le réglage de votre appareil.">
      <SegmentedControl ariaLabel="Thème" value={theme} onValueChange={setTheme} options={THEME_OPTIONS} className="w-full sm:w-fit" />
    </SectionCard>
  )
}

import { MapPin } from "lucide-react"
import { Link } from "react-router"

import { SectionCard } from "@/components/shared/SectionCard"
import { Button } from "@/components/ui/button"
import { formatNumber } from "@/lib/format"

/** Pin positions on the decorative surface, in a 320 x 200 viewBox. Illustrative only, not real coordinates. */
const PINS: { x: number; y: number; network: "bt" | "mt" }[] = [
  { x: 52, y: 64, network: "bt" },
  { x: 96, y: 118, network: "mt" },
  { x: 150, y: 52, network: "bt" },
  { x: 188, y: 142, network: "bt" },
  { x: 236, y: 84, network: "mt" },
  { x: 274, y: 38, network: "bt" },
  { x: 128, y: 170, network: "bt" },
]

/** Teaser for the map page: an illustrative surface (no map library) and how many incidents have a position. */
export function MapTeaserCard({ mapped, total, search }: { mapped: number; total: number; search: string }) {
  return (
    <SectionCard
      title="Carte des incidents"
      description="Incidents géolocalisés"
      contentClassName="gap-4"
    >
      <div className="relative aspect-[16/10] overflow-hidden rounded-lg bg-muted/60" aria-hidden="true">
        <svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full">
          <g fill="none" strokeWidth="1" className="stroke-muted-foreground/20">
            <path d="M0 40H320M0 100H320M0 160H320M64 0V200M128 0V200M192 0V200M256 0V200" />
          </g>
          <path
            d="M-10 176C48 128 112 188 176 132S280 70 330 96"
            fill="none"
            strokeWidth="10"
            strokeLinecap="round"
            className="stroke-card/80"
          />
          {PINS.map((pin) => (
            <circle
              key={`${pin.x}-${pin.y}`}
              cx={pin.x}
              cy={pin.y}
              r="6"
              strokeWidth="2"
              className={pin.network === "bt" ? "fill-bt stroke-card" : "fill-mt stroke-card"}
            />
          ))}
        </svg>
      </div>

      <p className="text-sm">
        <span className="text-2xl font-semibold tabular-nums">{formatNumber(mapped)}</span>{" "}
        <span className="text-muted-foreground">positions sur {formatNumber(total)}</span>
      </p>

      <Button variant="secondary" asChild>
        <Link to={`/carte${search}`}>
          <MapPin aria-hidden="true" />
          Ouvrir la carte
        </Link>
      </Button>
    </SectionCard>
  )
}

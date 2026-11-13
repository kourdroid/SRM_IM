import { cn } from "@/lib/utils"

/** Solid BT (blue) or MT (red) pill identifying the network level. */
export function NetworkBadge({ network }: { network: "BT" | "MT" }) {
  const isBt = network === "BT"

  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-full px-2 text-xs font-semibold tabular-nums",
        isBt ? "bg-bt text-bt-foreground" : "bg-mt text-mt-foreground"
      )}
    >
      {network}
      <span className="sr-only">{isBt ? " (basse tension)" : " (moyenne tension)"}</span>
    </span>
  )
}

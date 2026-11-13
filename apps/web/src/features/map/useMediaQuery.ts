import { useSyncExternalStore } from "react"

/** Subscribes to a CSS media query; false during server rendering. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      const media = window.matchMedia(query)
      media.addEventListener("change", notify)
      return () => media.removeEventListener("change", notify)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/** Shared colors for the HTA network: the map lines and points and the legend read the same palette. */

/** Soft but distinguishable hues, readable on the light OSM basemap and the dimmed dark one. */
export const NETWORK_PALETTE: readonly string[] = [
  "#14918a", // muted teal
  "#7c5cc4", // violet
  "#d99a1e", // amber
  "#3b9ce0", // sky
  "#e0557f", // rose
  "#2f9e5a", // emerald
  "#ea7a3b", // orange
  "#5b6ad8", // indigo
  "#8fa31f", // lime-olive
  "#1db4c4", // cyan
  "#c75bc0", // fuchsia
  "#6b7a90", // slate
]

/** Color of a poste by its index; indexes past the palette length wrap around. */
export function networkPosteColor(index: number): string {
  const size = NETWORK_PALETTE.length
  return NETWORK_PALETTE[((index % size) + size) % size]
}

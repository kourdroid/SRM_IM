import "maplibre-gl/dist/maplibre-gl.css"
import "./incident-map.css"

import {
  Map as MapLibreMap,
  NavigationControl,
  Popup,
  setWorkerUrl,
  type ExpressionSpecification,
  type GeoJSONSource,
  type MapGeoJSONFeature,
  type Point,
  type PointLike,
  type StyleSpecification,
} from "maplibre-gl"
// MapLibre locates its worker next to its own file, which breaks once Vite pre-bundles or bundles it:
// the worker never starts and GeoJSON layers (points, clusters, heatmap) silently never render.
// Let Vite build the worker as its own file and hand MapLibre its exact URL.
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url"
import { MapPinOff } from "lucide-react"

setWorkerUrl(maplibreWorkerUrl)
import { useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from "react"

import { EmptyState } from "@/components/shared/EmptyState"
import type { ResolvedTheme } from "@/components/shared/theme-context"
import { departBounds, type NetworkLineCollection, type NetworkPosteCollection } from "@/data/network"
import {
  boundsOf,
  filterByDay,
  PROVINCE_BOUNDS,
  toPointCollection,
  type MapMode,
  type PointCollection,
  type PositionedIncident,
} from "@/features/map/geo"
import { NETWORK_PALETTE } from "@/features/map/network-style"

/** Imperative controls exposed to the page (used by the accessible incident list). */
export type IncidentMapHandle = {
  flyToIncident: (id: string) => void
}

export type IncidentMapProps = {
  ref?: Ref<IncidentMapHandle>
  /** Every incident with a position for the current filters; drives the fit when data loads. */
  incidents: PositionedIncident[]
  /** Local day (YYYY-MM-DD) to restrict the map to, or null for the whole period. */
  dayKey: string | null
  selectedId: string | null
  onSelect: (id: string) => void
  mode: MapMode
  theme: ResolvedTheme
  /** HTA network lines (aerial and underground segments of every départ), or null while not loaded. */
  networkLines?: NetworkLineCollection | null
  /** HTA network postes sources, or null while not loaded. */
  networkPostes?: NetworkPosteCollection | null
  networkVisible?: boolean
  /** Départ to emphasise: its lines are widened and the others faded; the map fits to it. */
  highlightedDepartId?: string | null
}

const SOURCE = {
  points: "incidents",
  heat: "incidents-heat",
  selected: "incidents-selected",
} as const

const LAYER = {
  basemap: "basemap",
  heat: "heatmap",
  clusters: "clusters",
  clusterCount: "cluster-count",
  points: "points",
  selected: "selected-point",
} as const

const NETWORK_SOURCE = {
  lines: "network-lines",
  postes: "network-postes",
} as const

const NETWORK_LAYER = {
  aerial: "network-aerial",
  underground: "network-underground",
  postes: "network-postes",
  posteLabels: "network-postes-label",
} as const

const NETWORK_LINE_LAYERS = [NETWORK_LAYER.aerial, NETWORK_LAYER.underground]
const NETWORK_LAYERS = [...NETWORK_LINE_LAYERS, NETWORK_LAYER.postes, NETWORK_LAYER.posteLabels]

const NETWORK_LINE_OPACITY = 0.8
const NETWORK_DIMMED_OPACITY = 0.2

const EMPTY_POINTS: PointCollection = { type: "FeatureCollection", features: [] }
const EMPTY_LINES: NetworkLineCollection = { type: "FeatureCollection", features: [] }
const EMPTY_POSTES: NetworkPosteCollection = { type: "FeatureCollection", features: [] }

const LIME = "#DAF22C"

/** Minimal style: one OpenStreetMap raster layer, plus glyphs for the cluster count labels. */
const BASEMAP_STYLE: StyleSpecification = {
  version: 8,
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: LAYER.basemap, type: "raster", source: "osm" }],
}

const HEAT_COLOR: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["heatmap-density"],
  0,
  "rgba(251, 191, 36, 0)",
  0.25,
  "rgba(251, 191, 36, 0.55)",
  0.5,
  "rgba(249, 115, 22, 0.75)",
  0.8,
  "rgba(220, 38, 38, 0.9)",
  1,
  "rgba(153, 27, 27, 1)",
]

type Palette = { bt: string; mt: string; cluster: string }

/** Network colors come from the --bt / --mt tokens so the dark mode values apply. */
function readPalette(dark: boolean): Palette {
  const styles = getComputedStyle(document.documentElement)
  const read = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback
  return {
    bt: read("--bt", "#2563eb"),
    mt: read("--mt", "#dc2626"),
    cluster: dark ? "#525252" : "#111827",
  }
}

function networkColor(palette: Palette): ExpressionSpecification {
  return ["match", ["get", "network"], "MT", palette.mt, palette.bt]
}

/** Poste color per feature: the palette wraps around, so any number of postes gets a color. */
function posteColorExpression(): ExpressionSpecification {
  const expression: unknown[] = ["match", ["%", ["get", "posteIndex"], NETWORK_PALETTE.length]]
  NETWORK_PALETTE.forEach((color, index) => expression.push(index, color))
  expression.push(NETWORK_PALETTE[0])
  return expression as ExpressionSpecification
}

/** Line widths by zoom; a highlighted départ is doubled. Zoom stays the top-level input of the interpolation. */
function lineWidthExpression(highlightedDepartId: string | null): ExpressionSpecification {
  if (!highlightedDepartId) {
    return ["interpolate", ["linear"], ["zoom"], 7, 1, 11, 2, 15, 3.5]
  }
  const isHighlighted: ExpressionSpecification = ["==", ["get", "departId"], highlightedDepartId]
  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    7,
    ["case", isHighlighted, 2, 1],
    11,
    ["case", isHighlighted, 4, 2],
    15,
    ["case", isHighlighted, 7, 3.5],
  ]
}

function lineOpacityExpression(highlightedDepartId: string | null): ExpressionSpecification | number {
  if (!highlightedDepartId) return NETWORK_LINE_OPACITY
  return ["case", ["==", ["get", "departId"], highlightedDepartId], 1, NETWORK_DIMMED_OPACITY]
}

function networkLabelColors(dark: boolean): { text: string; halo: string } {
  return dark ? { text: "#e5e5e5", halo: "#141414" } : { text: "#111827", halo: "#ffffff" }
}

function canRenderWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas")
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"))
  } catch {
    return false
  }
}

type SourceData = PointCollection | NetworkLineCollection | NetworkPosteCollection

function setSourceData(map: MapLibreMap, sourceId: string, data: SourceData) {
  void map.getSource<GeoJSONSource>(sourceId)?.setData(data)
}

function textOf(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : ""
}

/** Popup body built with text nodes only: départ names come from the database and are never parsed as HTML. */
function networkPopupContent(properties: Record<string, unknown>): HTMLElement {
  const box = document.createElement("div")
  const title = document.createElement("strong")
  title.textContent = textOf(properties.depart)
  const detail = document.createElement("div")
  detail.textContent = `Poste ${textOf(properties.poste)} · ${textOf(properties.km)} km`
  const kind = document.createElement("div")
  kind.className = "network-popup-kind"
  kind.textContent = properties.underground === true ? "Souterrain" : "Aérien"
  box.append(title, detail, kind)
  return box
}

function addNetworkLayers(map: MapLibreMap, dark: boolean) {
  const labels = networkLabelColors(dark)

  map.addSource(NETWORK_SOURCE.lines, { type: "geojson", data: EMPTY_LINES })
  map.addSource(NETWORK_SOURCE.postes, { type: "geojson", data: EMPTY_POSTES })

  map.addLayer({
    id: NETWORK_LAYER.aerial,
    type: "line",
    source: NETWORK_SOURCE.lines,
    filter: ["==", ["get", "underground"], false],
    layout: { visibility: "none", "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": posteColorExpression(),
      "line-width": lineWidthExpression(null),
      "line-opacity": NETWORK_LINE_OPACITY,
    },
  })

  map.addLayer({
    id: NETWORK_LAYER.underground,
    type: "line",
    source: NETWORK_SOURCE.lines,
    filter: ["==", ["get", "underground"], true],
    layout: { visibility: "none", "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": posteColorExpression(),
      "line-width": lineWidthExpression(null),
      "line-opacity": NETWORK_LINE_OPACITY,
      "line-dasharray": [2, 1.5],
    },
  })

  map.addLayer({
    id: NETWORK_LAYER.postes,
    type: "circle",
    source: NETWORK_SOURCE.postes,
    layout: { visibility: "none" },
    paint: {
      "circle-color": posteColorExpression(),
      "circle-radius": 7,
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 2,
    },
  })

  map.addLayer({
    id: NETWORK_LAYER.posteLabels,
    type: "symbol",
    source: NETWORK_SOURCE.postes,
    layout: {
      visibility: "none",
      "text-field": ["get", "name"],
      "text-font": ["Noto Sans Bold"],
      "text-size": 11,
      "text-offset": [0, 1.3],
      "text-anchor": "top",
    },
    paint: {
      "text-color": labels.text,
      "text-halo-color": labels.halo,
      "text-halo-width": 1.5,
    },
  })
}

function addIncidentLayers(map: MapLibreMap) {
  const palette = readPalette(document.documentElement.classList.contains("dark"))

  map.addSource(SOURCE.points, {
    type: "geojson",
    data: EMPTY_POINTS,
    cluster: true,
    clusterRadius: 50,
    clusterMaxZoom: 13,
  })
  map.addSource(SOURCE.heat, { type: "geojson", data: EMPTY_POINTS })
  map.addSource(SOURCE.selected, { type: "geojson", data: EMPTY_POINTS })

  map.addLayer({
    id: LAYER.heat,
    type: "heatmap",
    source: SOURCE.heat,
    layout: { visibility: "none" },
    paint: {
      "heatmap-weight": 1,
      "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 6, 0.8, 14, 2.5],
      "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 6, 10, 12, 22, 15, 32],
      "heatmap-color": HEAT_COLOR,
      "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 11, 0.9, 15, 0.6],
    },
  })

  map.addLayer({
    id: LAYER.clusters,
    type: "circle",
    source: SOURCE.points,
    filter: ["has", "point_count"],
    paint: {
      "circle-color": palette.cluster,
      "circle-radius": ["step", ["get", "point_count"], 16, 10, 20, 50, 26, 150, 32],
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 2,
      "circle-opacity": 0.92,
    },
  })

  map.addLayer({
    id: LAYER.clusterCount,
    type: "symbol",
    source: SOURCE.points,
    filter: ["has", "point_count"],
    layout: {
      "text-field": ["get", "point_count_abbreviated"],
      "text-font": ["Noto Sans Bold"],
      "text-size": 13,
      "text-allow-overlap": true,
    },
    paint: { "text-color": "#ffffff" },
  })

  map.addLayer({
    id: LAYER.points,
    type: "circle",
    source: SOURCE.points,
    filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-color": networkColor(palette),
      "circle-radius": 6,
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 2,
    },
  })

  map.addLayer({
    id: LAYER.selected,
    type: "circle",
    source: SOURCE.selected,
    paint: {
      "circle-color": networkColor(palette),
      "circle-radius": 9,
      "circle-stroke-color": LIME,
      "circle-stroke-width": 3,
    },
  })

}

const POINT_LAYERS: readonly string[] = [LAYER.points, LAYER.selected]
const INCIDENT_LAYERS: readonly string[] = [...POINT_LAYERS, LAYER.clusters, LAYER.clusterCount]
/** Half the side of the hit box around the pointer, in px. */
const HIT_TOLERANCE = 6

/**
 * Rendered features under the pointer, with a tolerance box. Layers that do not exist yet
 * (or are hidden) return nothing, so callers can pass the full list.
 */
function queryAt(map: MapLibreMap, point: Point, layerIds: readonly string[]): MapGeoJSONFeature[] {
  const layers = layerIds.filter((id) => map.getLayer(id) !== undefined)
  if (layers.length === 0) return []
  const box: [PointLike, PointLike] = [
    [point.x - HIT_TOLERANCE, point.y - HIT_TOLERANCE],
    [point.x + HIT_TOLERANCE, point.y + HIT_TOLERANCE],
  ]
  return map.queryRenderedFeatures(box, { layers })
}

/** Feature property; typed unknown so callers narrow it before use. */
function propertyOf(feature: MapGeoJSONFeature, key: string): unknown {
  return feature.properties?.[key]
}

/** Point feature nearest the pointer, measured on screen. */
function closestFeature(map: MapLibreMap, features: MapGeoJSONFeature[], point: Point): MapGeoJSONFeature | undefined {
  let closest: MapGeoJSONFeature | undefined
  let closestDistance = Infinity
  for (const feature of features) {
    if (feature.geometry.type !== "Point") continue
    const projected = map.project(feature.geometry.coordinates as [number, number])
    const distance = Math.hypot(projected.x - point.x, projected.y - point.y)
    if (distance < closestDistance) {
      closest = feature
      closestDistance = distance
    }
  }
  return closest
}

/**
 * One map-level mousemove and click handler own the cursor and the clicks for incidents and network lines.
 * Per-layer handlers overwrote each other's cursor where a dot sits on a line, and exact-pixel hits missed small dots.
 */
function addMapInteractions(map: MapLibreMap, popup: Popup, onSelect: (id: string) => void) {
  // Key of the départ/segment the popup shows; its DOM is rebuilt only when this changes.
  let popupKey: string | null = null
  const hidePopup = () => {
    popupKey = null
    popup.remove()
  }

  map.on("mousemove", (event) => {
    const canvas = map.getCanvas()
    if (queryAt(map, event.point, INCIDENT_LAYERS).length > 0) {
      canvas.style.cursor = "pointer"
      hidePopup()
      return
    }
    const line = queryAt(map, event.point, NETWORK_LINE_LAYERS)[0]
    if (!line) {
      canvas.style.cursor = ""
      hidePopup()
      return
    }
    canvas.style.cursor = "pointer"
    const properties = line.properties ?? {}
    const key = `${textOf(properties.departId)}|${properties.underground === true}`
    if (key !== popupKey) {
      popupKey = key
      popup.setDOMContent(networkPopupContent(properties))
    }
    popup.setLngLat(event.lngLat)
    if (!popup.isOpen()) popup.addTo(map)
  })

  map.on("mouseout", () => {
    map.getCanvas().style.cursor = ""
    hidePopup()
  })

  map.on("click", (event) => {
    const incidents = queryAt(map, event.point, INCIDENT_LAYERS)

    // An unclustered dot wins over a cluster; among several, the one nearest the pointer.
    const dot = closestFeature(
      map,
      incidents.filter((feature) => POINT_LAYERS.includes(feature.layer.id) && typeof propertyOf(feature, "id") === "string"),
      event.point,
    )
    const id = dot ? propertyOf(dot, "id") : undefined
    if (typeof id === "string") {
      onSelect(id)
      return
    }

    // Clicking a cluster (disc or count label) zooms to the level where it splits.
    const cluster = closestFeature(
      map,
      incidents.filter((feature) => typeof propertyOf(feature, "cluster_id") === "number"),
      event.point,
    )
    if (!cluster || cluster.geometry.type !== "Point") return
    const clusterId = propertyOf(cluster, "cluster_id")
    if (typeof clusterId !== "number") return
    const center = cluster.geometry.coordinates as [number, number]
    const source = map.getSource<GeoJSONSource>(SOURCE.points)
    if (!source) return
    source.getClusterExpansionZoom(clusterId).then(
      (zoom) => map.easeTo({ center, zoom }),
      () => undefined,
    )
  })
}

/** Light or dark look: a dimmed raster basemap in dark mode, theme colors on the markers and network labels. */
function applyTheme(map: MapLibreMap, dark: boolean) {
  const palette = readPalette(dark)
  const labels = networkLabelColors(dark)
  map.setPaintProperty(LAYER.basemap, "raster-brightness-max", dark ? 0.55 : 1)
  map.setPaintProperty(LAYER.basemap, "raster-saturation", dark ? -0.4 : 0)
  map.setPaintProperty(LAYER.basemap, "raster-contrast", dark ? 0.05 : 0)
  map.setPaintProperty(LAYER.clusters, "circle-color", palette.cluster)
  map.setPaintProperty(LAYER.points, "circle-color", networkColor(palette))
  map.setPaintProperty(LAYER.selected, "circle-color", networkColor(palette))
  map.setPaintProperty(NETWORK_LAYER.posteLabels, "text-color", labels.text)
  map.setPaintProperty(NETWORK_LAYER.posteLabels, "text-halo-color", labels.halo)
}

/** MapLibre map of incidents: clustered points, density heatmap, selection halo, theme-aware basemap, HTA network. */
export function IncidentMap({
  ref,
  incidents,
  dayKey,
  selectedId,
  onSelect,
  mode,
  theme,
  networkLines = null,
  networkPostes = null,
  networkVisible = false,
  highlightedDepartId = null,
}: IncidentMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const networkPopupRef = useRef<Popup | null>(null)
  const onSelectRef = useRef(onSelect)
  const [ready, setReady] = useState(false)
  const [unsupported, setUnsupported] = useState(() => !canRenderWebGL())

  const shown = useMemo(() => filterByDay(incidents, dayKey), [incidents, dayKey])
  const points = useMemo(() => toPointCollection(shown), [shown])
  const selectedPoints = useMemo(
    () => toPointCollection(shown.filter((incident) => incident.id === selectedId)),
    [shown, selectedId],
  )

  useEffect(() => {
    onSelectRef.current = onSelect
  }, [onSelect])

  useImperativeHandle(
    ref,
    () => ({
      flyToIncident(id: string) {
        const map = mapRef.current
        const incident = incidents.find((item) => item.id === id)
        if (!map || !incident) return
        map.flyTo({
          center: [incident.longitude, incident.latitude],
          zoom: Math.max(map.getZoom(), 14),
          duration: 800,
        })
      },
    }),
    [incidents],
  )

  // Created once per mount; removed on unmount (StrictMode mounts twice in development).
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let map: MapLibreMap
    try {
      map = new MapLibreMap({
        container,
        style: BASEMAP_STYLE,
        attributionControl: { compact: false },
        dragRotate: false,
        touchPitch: false,
        maxPitch: 0,
        renderWorldCopies: false,
      })
    } catch {
      // WebGL can fail even after the probe (driver reset, hardware acceleration off).
      // Deferred out of the effect body so the fallback state is set outside the synchronous effect pass.
      queueMicrotask(() => setUnsupported(true))
      return
    }

    map.touchZoomRotate.disableRotation()
    map.keyboard.disableRotation()
    map.addControl(new NavigationControl({ showCompass: false, visualizePitch: false }), "top-right")
    map.fitBounds(PROVINCE_BOUNDS, { padding: 60, duration: 0 })
    map.on("load", () => {
      const popup = new Popup({ closeButton: false, closeOnClick: false, className: "network-popup", offset: 12 })
      networkPopupRef.current = popup
      // Network first so the incident layers are drawn above it.
      addNetworkLayers(map, document.documentElement.classList.contains("dark"))
      addIncidentLayers(map)
      addMapInteractions(map, popup, (id) => onSelectRef.current(id))
      setReady(true)
    })
    mapRef.current = map

    return () => {
      mapRef.current = null
      networkPopupRef.current?.remove()
      networkPopupRef.current = null
      map.remove()
      setReady(false)
    }
  }, [unsupported])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    setSourceData(map, SOURCE.points, points)
    setSourceData(map, SOURCE.heat, points)
  }, [ready, points])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    setSourceData(map, SOURCE.selected, selectedPoints)
  }, [ready, selectedPoints])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    setSourceData(map, NETWORK_SOURCE.lines, networkLines ?? EMPTY_LINES)
    setSourceData(map, NETWORK_SOURCE.postes, networkPostes ?? EMPTY_POSTES)
  }, [ready, networkLines, networkPostes])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const visibility = networkVisible ? "visible" : "none"
    for (const layer of NETWORK_LAYERS) {
      map.setLayoutProperty(layer, "visibility", visibility)
    }
    if (!networkVisible) networkPopupRef.current?.remove()
  }, [ready, networkVisible])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    for (const layer of NETWORK_LINE_LAYERS) {
      map.setPaintProperty(layer, "line-width", lineWidthExpression(highlightedDepartId))
      map.setPaintProperty(layer, "line-opacity", lineOpacityExpression(highlightedDepartId))
    }
  }, [ready, highlightedDepartId])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map || !highlightedDepartId || !networkLines) return
    const bounds = departBounds(networkLines, highlightedDepartId)
    if (bounds) map.fitBounds(bounds, { padding: 80, maxZoom: 14, duration: 600 })
  }, [ready, highlightedDepartId, networkLines])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const pointsVisibility = mode === "points" ? "visible" : "none"
    const heatVisibility = mode === "heat" ? "visible" : "none"
    for (const layer of [LAYER.clusters, LAYER.clusterCount, LAYER.points, LAYER.selected]) {
      map.setLayoutProperty(layer, "visibility", pointsVisibility)
    }
    map.setLayoutProperty(LAYER.heat, "visibility", heatVisibility)
  }, [ready, mode])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    // Next frame: ThemeProvider toggles the "dark" class on <html> in its own effect.
    const frame = requestAnimationFrame(() => applyTheme(map, theme === "dark"))
    return () => cancelAnimationFrame(frame)
  }, [ready, theme])

  useEffect(() => {
    const map = mapRef.current
    const bounds = boundsOf(incidents)
    if (!ready || !map || !bounds) return
    map.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 600 })
  }, [ready, incidents])

  return (
    <div className="absolute inset-0 bg-muted">
      {unsupported ? (
        <div className="flex h-full items-center justify-center p-6">
          <EmptyState
            icon={MapPinOff}
            title="Votre navigateur ne peut pas afficher la carte"
            description="Activez l'accélération graphique ou essayez un navigateur plus récent."
          />
        </div>
      ) : (
        <div ref={containerRef} role="region" aria-label="Carte des incidents" className="incident-map h-full w-full" />
      )}
    </div>
  )
}

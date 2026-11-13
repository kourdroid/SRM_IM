import "maplibre-gl/dist/maplibre-gl.css"
import "./incident-map.css"

import {
  Map as MapLibreMap,
  NavigationControl,
  setWorkerUrl,
  type ExpressionSpecification,
  type GeoJSONSource,
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
import {
  boundsOf,
  filterByDay,
  PROVINCE_BOUNDS,
  toPointCollection,
  type MapMode,
  type PointCollection,
  type PositionedIncident,
} from "@/features/map/geo"

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

function canRenderWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas")
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"))
  } catch {
    return false
  }
}

function setSourceData(map: MapLibreMap, sourceId: string, data: PointCollection) {
  void map.getSource<GeoJSONSource>(sourceId)?.setData(data)
}

function addIncidentLayers(map: MapLibreMap, onSelect: (id: string) => void) {
  const palette = readPalette(document.documentElement.classList.contains("dark"))
  const empty: PointCollection = { type: "FeatureCollection", features: [] }

  map.addSource(SOURCE.points, {
    type: "geojson",
    data: empty,
    cluster: true,
    clusterRadius: 50,
    clusterMaxZoom: 13,
  })
  map.addSource(SOURCE.heat, { type: "geojson", data: empty })
  map.addSource(SOURCE.selected, { type: "geojson", data: empty })

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

  // Clicking a cluster (disc or count label) zooms to the level where it splits.
  map.on("click", [LAYER.clusters, LAYER.clusterCount], (event) => {
    const feature = event.features?.[0]
    if (!feature || feature.geometry.type !== "Point") return
    const clusterId = feature.properties.cluster_id
    if (typeof clusterId !== "number") return
    const center = feature.geometry.coordinates as [number, number]
    const source = map.getSource<GeoJSONSource>(SOURCE.points)
    if (!source) return
    source.getClusterExpansionZoom(clusterId).then(
      (zoom) => map.easeTo({ center, zoom }),
      () => undefined,
    )
  })

  map.on("click", LAYER.points, (event) => {
    const id = event.features?.[0]?.properties.id
    if (typeof id === "string") onSelect(id)
  })

  map.on("mouseenter", [LAYER.clusters, LAYER.clusterCount, LAYER.points], () => {
    map.getCanvas().style.cursor = "pointer"
  })
  map.on("mouseleave", [LAYER.clusters, LAYER.clusterCount, LAYER.points], () => {
    map.getCanvas().style.cursor = ""
  })
}

/** Light or dark look: a dimmed raster basemap in dark mode, theme colors on the markers. */
function applyTheme(map: MapLibreMap, dark: boolean) {
  const palette = readPalette(dark)
  map.setPaintProperty(LAYER.basemap, "raster-brightness-max", dark ? 0.55 : 1)
  map.setPaintProperty(LAYER.basemap, "raster-saturation", dark ? -0.4 : 0)
  map.setPaintProperty(LAYER.basemap, "raster-contrast", dark ? 0.05 : 0)
  map.setPaintProperty(LAYER.clusters, "circle-color", palette.cluster)
  map.setPaintProperty(LAYER.points, "circle-color", networkColor(palette))
  map.setPaintProperty(LAYER.selected, "circle-color", networkColor(palette))
}

/** MapLibre map of incidents: clustered points, density heatmap, selection halo, theme-aware basemap. */
export function IncidentMap({ ref, incidents, dayKey, selectedId, onSelect, mode, theme }: IncidentMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
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
      addIncidentLayers(map, (id) => onSelectRef.current(id))
      setReady(true)
    })
    mapRef.current = map

    return () => {
      mapRef.current = null
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

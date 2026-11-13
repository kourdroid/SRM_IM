import { Download } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { Incident } from "@/data/incidents"
import { buildIncidentsCsv } from "@/features/overview/stats"

/** Downloads the given incidents as a CSV file, built and saved entirely in the browser. */
function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

/** Primary button exporting the filtered incidents to CSV. */
export function ExportCsvButton({
  incidents,
  filename,
  disabled,
}: {
  incidents: Incident[]
  filename: string
  disabled?: boolean
}) {
  return (
    <Button
      disabled={disabled || incidents.length === 0}
      onClick={() => downloadCsv(filename, buildIncidentsCsv(incidents))}
    >
      <Download aria-hidden="true" />
      Exporter
    </Button>
  )
}

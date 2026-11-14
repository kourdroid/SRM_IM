import { SectionCard } from "@/components/shared/SectionCard"

import { SettingsRow } from "./SettingsRow"

/** Kept in step with the version field of apps/web/package.json. */
const DASHBOARD_VERSION = "0.1.0"

/** Identity of the dashboard itself. */
export function AboutCard() {
  return (
    <SectionCard title="À propos">
      <dl className="flex flex-col gap-3 text-sm">
        <SettingsRow label="Application">Intervx Supervision</SettingsRow>
        <SettingsRow label="Type">Tableau de bord web</SettingsRow>
        <SettingsRow label="Version">{DASHBOARD_VERSION}</SettingsRow>
      </dl>
    </SectionCard>
  )
}

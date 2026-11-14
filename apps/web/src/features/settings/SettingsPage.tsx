import { PageHeader } from "@/components/shared/PageHeader"

import { AboutCard } from "./components/AboutCard"
import { AccountCard } from "./components/AccountCard"
import { AppearanceCard } from "./components/AppearanceCard"
import { MobileAppCard } from "./components/MobileAppCard"

/** Settings: the signed-in account, the theme for this browser, the mobile release info and the dashboard identity. */
export function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Paramètres" description="Votre compte, l'apparence du tableau de bord et les versions de l'application mobile." />

      <div className="grid gap-4 lg:grid-cols-2">
        <AccountCard />
        <AppearanceCard />
        <MobileAppCard />
        <AboutCard />
      </div>
    </div>
  )
}

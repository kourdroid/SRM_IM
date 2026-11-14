import { PageHeader } from "@/components/shared/PageHeader"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { CommunesPanel } from "./components/CommunesPanel"
import { DepartsHtaPanel } from "./components/DepartsHtaPanel"
import { IncidentTypesPanel } from "./components/IncidentTypesPanel"

const TAB_TRIGGER_CLASS = "h-8 rounded-md px-3 text-sm data-[state=active]:bg-card data-[state=active]:shadow-soft"

/** Admin page for the lists offered to field agents: communes, incident types (BT/MT) and Départs HTA. */
export function ReferencesPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Communes et types"
        description="Listes proposées aux agents dans le formulaire terrain."
      />

      <Tabs defaultValue="communes" className="gap-6">
        <TabsList aria-label="Référentiels" className="h-auto max-w-full flex-wrap justify-start gap-1 p-1">
          <TabsTrigger value="communes" className={TAB_TRIGGER_CLASS}>
            Communes
          </TabsTrigger>
          <TabsTrigger value="types" className={TAB_TRIGGER_CLASS}>
            Types d'incidents
          </TabsTrigger>
          <TabsTrigger value="departs" className={TAB_TRIGGER_CLASS}>
            Départs HTA
          </TabsTrigger>
        </TabsList>

        <TabsContent value="communes">
          <CommunesPanel />
        </TabsContent>
        <TabsContent value="types">
          <IncidentTypesPanel />
        </TabsContent>
        <TabsContent value="departs">
          <DepartsHtaPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}

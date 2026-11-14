import { useId, useState, type ReactNode } from "react"

import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  useDepartHtaOptions,
  useIncidentTypeOptions,
  useUpdateIncidentDetails,
  type DepartHtaOption,
  type IncidentDetailsDraft,
  type IncidentTypeOption,
} from "@/data/incidentMutations"
import { useCommunes, type Commune, type Incident } from "@/data/incidents"
import { describeError } from "@/lib/rpc"

import { ActionDialog, ActionDialogPlaceholder } from "./ActionDialog"

const TITLE = "Modifier l'incident"
const DESCRIPTION = "Corrigez les informations saisies. Le statut, le réseau, la date, la position et les photos ne changent pas."

/** Modifier: corrects type, départ HTA, commune, village, description and claim details. */
export function IncidentEditDialog({ incident, onClose }: { incident: Incident; onClose: () => void }) {
  const isMt = incident.network === "MT"
  const types = useIncidentTypeOptions()
  const departs = useDepartHtaOptions(isMt)
  const communes = useCommunes()
  const close = (open: boolean) => {
    if (!open) onClose()
  }

  const loadError = types.error ?? departs.error ?? communes.error
  if (loadError) {
    return <ActionDialogPlaceholder title={TITLE} submitLabel="Enregistrer" message={describeError(loadError)} onOpenChange={close} />
  }
  if (!types.data || !communes.data || (isMt && !departs.data)) {
    return <ActionDialogPlaceholder title={TITLE} submitLabel="Enregistrer" message="Chargement des options…" onOpenChange={close} />
  }

  return (
    <IncidentEditForm
      incident={incident}
      types={types.data}
      departs={departs.data ?? []}
      communes={communes.data}
      onClose={onClose}
    />
  )
}

function IncidentEditForm({
  incident,
  types,
  departs,
  communes,
  onClose,
}: {
  incident: Incident
  types: IncidentTypeOption[]
  departs: DepartHtaOption[]
  communes: Commune[]
  onClose: () => void
}) {
  const id = useId()
  const update = useUpdateIncidentDetails()
  const isMt = incident.network === "MT"

  const [incidentType, setIncidentType] = useState(incident.incidentType)
  const [departHta, setDepartHta] = useState(isMt ? (incident.departHta ?? "") : "")
  const [communeId, setCommuneId] = useState(incident.communeId ?? "")
  const [village, setVillage] = useState(incident.village)
  const [description, setDescription] = useState(incident.description ?? "")
  const [reclamation, setReclamation] = useState(incident.reclamation)
  const [reclamationName, setReclamationName] = useState(incident.reclamationName ?? "")
  const [reclamationBy, setReclamationBy] = useState(incident.reclamationBy ?? "Administration")
  const [error, setError] = useState<string | null>(null)

  // The current value stays selectable even when its option was deactivated since.
  const typeNames = withCurrent(
    types
      .filter((option) => option.network === incident.network && (option.active || option.name === incident.incidentType))
      .map((option) => option.name),
    incident.incidentType,
  )
  const departNames = withCurrent(
    departs.filter((option) => option.active || option.name === incident.departHta).map((option) => option.name),
    isMt ? incident.departHta : null,
  )

  const original: IncidentDetailsDraft = {
    incidentType: incident.incidentType,
    departHta: isMt ? incident.departHta : null,
    communeId: incident.communeId ?? "",
    village: incident.village,
    description: incident.description ?? "",
    reclamation: incident.reclamation,
    reclamationName: incident.reclamation ? incident.reclamationName : null,
    reclamationBy: incident.reclamation ? incident.reclamationBy : null,
  }

  const next: IncidentDetailsDraft = {
    incidentType,
    departHta: isMt ? departHta : null,
    communeId,
    village: village.trim(),
    description: description.trim(),
    reclamation,
    reclamationName: reclamation ? reclamationName.trim() || null : null,
    reclamationBy: reclamation ? reclamationBy.trim() || null : null,
  }

  const submit = async () => {
    if (!incidentType) {
      setError("Choisissez le type d'incident.")
      return
    }
    if (isMt && !departHta) {
      setError("Choisissez le départ HTA.")
      return
    }
    if (!communeId) {
      setError("Choisissez la commune.")
      return
    }
    if (next.village === "") {
      setError("Saisissez le village ou quartier.")
      return
    }
    setError(null)

    const changed = (Object.keys(next) as (keyof IncidentDetailsDraft)[]).some((key) => next[key] !== original[key])
    if (!changed) {
      onClose()
      return
    }

    try {
      await update.mutateAsync({ incidentId: incident.id, ...next })
      onClose()
    } catch {
      // The mutation hook already shows the error; the dialog stays open so the admin can fix and retry.
    }
  }

  return (
    <ActionDialog
      title={TITLE}
      description={DESCRIPTION}
      submitLabel="Enregistrer"
      pending={update.isPending}
      error={error}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      onSubmit={() => void submit()}
    >
      <div className="flex flex-col gap-4">
        <Field id={`${id}-type`} label="Type d'incident">
          <Select value={incidentType} onValueChange={setIncidentType} disabled={update.isPending}>
            <SelectTrigger id={`${id}-type`} className="w-full">
              <SelectValue placeholder="Choisir un type" />
            </SelectTrigger>
            <SelectContent>
              {typeNames.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {isMt ? (
          <Field id={`${id}-depart`} label="Départ HTA">
            <Select value={departHta} onValueChange={setDepartHta} disabled={update.isPending}>
              <SelectTrigger id={`${id}-depart`} className="w-full">
                <SelectValue placeholder="Choisir un départ" />
              </SelectTrigger>
              <SelectContent>
                {departNames.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : null}

        <Field id={`${id}-commune`} label="Commune">
          <Select value={communeId} onValueChange={setCommuneId} disabled={update.isPending}>
            <SelectTrigger id={`${id}-commune`} className="w-full">
              <SelectValue placeholder="Choisir une commune" />
            </SelectTrigger>
            <SelectContent>
              {communes.map((commune) => (
                <SelectItem key={commune.id} value={commune.id}>
                  {commune.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field id={`${id}-village`} label="Village ou quartier">
          <Input
            id={`${id}-village`}
            value={village}
            required
            aria-required="true"
            autoComplete="off"
            disabled={update.isPending}
            onChange={(event) => setVillage(event.target.value)}
          />
        </Field>

        <Field id={`${id}-description`} label="Description">
          <Textarea
            id={`${id}-description`}
            rows={3}
            value={description}
            disabled={update.isPending}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>

        <div className="flex items-center gap-3 rounded-xl bg-muted/50 px-3.5 py-3">
          <Checkbox
            id={`${id}-reclamation`}
            checked={reclamation}
            disabled={update.isPending}
            onCheckedChange={(checked) => setReclamation(checked === true)}
          />
          <Label htmlFor={`${id}-reclamation`}>Réclamation déposée</Label>
        </div>

        {reclamation ? (
          <>
            <Field id={`${id}-reclamant`} label="Nom du réclamant">
              <Input
                id={`${id}-reclamant`}
                value={reclamationName}
                autoComplete="off"
                disabled={update.isPending}
                onChange={(event) => setReclamationName(event.target.value)}
              />
            </Field>
            <Field id={`${id}-deposee`} label="Déposée par">
              <Input
                id={`${id}-deposee`}
                value={reclamationBy}
                autoComplete="off"
                disabled={update.isPending}
                onChange={(event) => setReclamationBy(event.target.value)}
              />
            </Field>
          </>
        ) : null}
      </div>
    </ActionDialog>
  )
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}

function withCurrent(names: string[], current: string | null): string[] {
  if (!current || names.includes(current)) return names
  return [current, ...names]
}

import { KeyRound } from "lucide-react"
import { useState } from "react"

import { SectionCard } from "@/components/shared/SectionCard"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/features/auth/auth-context"
import { ROLE_LABELS } from "@/features/auth/roles"
import { useCurrentUser } from "@/features/auth/useCurrentUser"

import { ChangePasswordDialog } from "./ChangePasswordDialog"
import { SettingsRow } from "./SettingsRow"

/** Name, role and e-mail of the signed-in user, with the password change dialog. */
export function AccountCard() {
  const user = useCurrentUser()
  const { session } = useAuth()
  const [passwordOpen, setPasswordOpen] = useState(false)

  return (
    <SectionCard title="Mon compte" description="Vos informations de connexion au tableau de bord.">
      <dl className="flex flex-col gap-3 text-sm">
        <SettingsRow label="Nom">{user.name}</SettingsRow>
        <SettingsRow label="Rôle">{ROLE_LABELS[user.role]}</SettingsRow>
        <SettingsRow label="E-mail">{session?.user.email ?? "—"}</SettingsRow>
      </dl>

      <div>
        <Button variant="secondary" onClick={() => setPasswordOpen(true)}>
          <KeyRound aria-hidden="true" />
          Changer le mot de passe
        </Button>
      </div>

      <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </SectionCard>
  )
}

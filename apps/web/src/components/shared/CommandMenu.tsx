import { Moon } from "lucide-react"
import { Fragment } from "react"
import { useNavigate } from "react-router"

import { getSectionsForRole, type ModuleItem } from "@/app/modules"
import { useCurrentUser } from "@/features/auth/useCurrentUser"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"

import { useTheme } from "./theme-context"

/** Command palette (Ctrl/Cmd+K) listing ready modules for the user's role, plus theme switching. */
export function CommandMenu({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const user = useCurrentUser()
  const navigate = useNavigate()
  const { resolvedTheme, setTheme } = useTheme()
  const sections = getSectionsForRole(user.role)

  function runAndClose(action: () => void) {
    onOpenChange(false)
    action()
  }

  function go(item: ModuleItem) {
    runAndClose(() => navigate(item.path))
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Recherche" description="Accéder à un module">
      <CommandInput placeholder="Rechercher un module…" />
      <CommandList>
        <CommandEmpty>Aucun résultat.</CommandEmpty>
        {sections.map((section, index) => {
          const readyItems = section.items.filter((item) => item.status === "ready")
          if (readyItems.length === 0) return null
          return (
            <Fragment key={section.id}>
              {index > 0 ? <CommandSeparator /> : null}
              <CommandGroup heading={section.label}>
                {readyItems.map((item) => {
                  const Icon = item.icon
                  return (
                    <CommandItem key={item.id} value={`${section.label} ${item.label}`} onSelect={() => go(item)}>
                      <Icon aria-hidden="true" />
                      <span>{item.label}</span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </Fragment>
          )
        })}
        <CommandSeparator />
        <CommandGroup heading="Préférences">
          <CommandItem
            value="changer de thème"
            onSelect={() => runAndClose(() => setTheme(resolvedTheme === "dark" ? "light" : "dark"))}
          >
            <Moon aria-hidden="true" />
            <span>Changer de thème</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}

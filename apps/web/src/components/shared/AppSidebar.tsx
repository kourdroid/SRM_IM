import { LogOut } from "lucide-react"
import { NavLink } from "react-router"

import { getSectionsForRole, type ModuleItem } from "@/app/modules"
import { preloadRoute } from "@/app/preload"
import { useAuth } from "@/features/auth/auth-context"
import { ROLE_LABELS } from "@/features/auth/roles"
import { useCurrentUser } from "@/features/auth/useCurrentUser"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { getInitials } from "@/lib/format"
import { cn } from "@/lib/utils"

import { BrandMark } from "./BrandMark"

/** Sidebar: workspace card, module sections from the registry and the user card. */
export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const user = useCurrentUser()
  const sections = getSectionsForRole(user.role)

  return (
    <div className="flex h-full flex-col gap-4 bg-sidebar p-3 text-sidebar-foreground">
      <div className="flex items-center gap-3 rounded-lg bg-card p-3 shadow-soft">
        <BrandMark showWordmark={false} />
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight">Intervx · ONEE</p>
          <p className="truncate text-xs text-muted-foreground">Province Sidi Bennour</p>
        </div>
      </div>

      <nav aria-label="Navigation principale" className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-1">
        {sections.map((section) => (
          <div key={section.id} className="flex flex-col gap-1">
            <p className="px-3 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              {section.label}
            </p>
            <ul className="flex flex-col gap-0.5">
              {section.items.map((item) => (
                <li key={item.id}>
                  <SidebarItem item={item} onNavigate={onNavigate} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <UserCard />
    </div>
  )
}

function SidebarItem({ item, onNavigate }: { item: ModuleItem; onNavigate?: () => void }) {
  const Icon = item.icon
  const baseClass = "flex h-9 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors"

  if (item.status === "soon") {
    return (
      <div aria-disabled="true" className={cn(baseClass, "cursor-not-allowed text-muted-foreground/70")}>
        <Icon className="size-4 shrink-0" aria-hidden="true" />
        <span className="truncate">{item.label}</span>
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          Bientôt
        </span>
      </div>
    )
  }

  return (
    <NavLink
      to={item.path}
      end={item.path === "/"}
      onClick={onNavigate}
      onPointerEnter={() => preloadRoute(item.path)}
      onFocus={() => preloadRoute(item.path)}
      className={({ isActive }) =>
        cn(
          baseClass,
          isActive
            ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-soft"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            className={cn("size-4 shrink-0", isActive ? "text-sidebar-icon-active" : "text-muted-foreground")}
            aria-hidden="true"
          />
          <span className="truncate">{item.label}</span>
        </>
      )}
    </NavLink>
  )
}

function UserCard() {
  const user = useCurrentUser()
  const { signOut } = useAuth()

  return (
    <div className="flex items-center gap-3 rounded-lg bg-card p-3 shadow-soft">
      <Avatar size="sm">
        <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
          {getInitials(user.name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{user.name}</p>
        <p className="truncate text-xs text-muted-foreground">{ROLE_LABELS[user.role]}</p>
      </div>
      <Button variant="ghost" size="icon-sm" aria-label="Se déconnecter" onClick={() => void signOut()}>
        <LogOut aria-hidden="true" />
      </Button>
    </div>
  )
}


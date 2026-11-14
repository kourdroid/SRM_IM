import { Bell, Menu, Search } from "lucide-react"
import { lazy, Suspense, useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router"

import { findModuleByPath } from "@/app/modules"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { ThemeToggle } from "./ThemeToggle"

/** The command palette is split out of the initial bundle: it loads on first use or when a search button is hovered or focused. */
const loadCommandMenu = () => import("./CommandMenu")
const CommandMenu = lazy(() => loadCommandMenu().then((module) => ({ default: module.CommandMenu })))

function preloadCommandMenu() {
  loadCommandMenu().catch(() => undefined)
}

/** Top bar: mobile menu button, "Section › Page" breadcrumb, search, notifications and theme toggle. */
export function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [commandOpen, setCommandOpen] = useState(false)
  const [hasOpened, setHasOpened] = useState(false)
  const match = findModuleByPath(location.pathname)

  function openCommandMenu() {
    setHasOpened(true)
    setCommandOpen(true)
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setHasOpened(true)
        setCommandOpen((open) => !open)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 bg-background/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Ouvrir le menu" onClick={onOpenMenu}>
        <Menu aria-hidden="true" />
      </Button>

      <nav aria-label="Fil d'Ariane" className="min-w-0 truncate text-sm">
        {match ? (
          <p className="truncate">
            <span className="text-muted-foreground">{match.section.label}</span>
            <span className="px-1.5 text-muted-foreground/60" aria-hidden="true">
              ›
            </span>
            <span className="font-medium">{match.item.label}</span>
          </p>
        ) : (
          <p className="font-medium">Intervx</p>
        )}
      </nav>

      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        <Button
          variant="ghost"
          className={cn("hidden gap-2 bg-muted/60 text-muted-foreground hover:bg-muted sm:inline-flex")}
          onClick={openCommandMenu}
          onPointerEnter={preloadCommandMenu}
          onFocus={preloadCommandMenu}
        >
          <Search aria-hidden="true" />
          <span className="text-sm">Rechercher</span>
          <kbd className="rounded bg-background px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            Ctrl K
          </kbd>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="sm:hidden"
          aria-label="Rechercher"
          onClick={openCommandMenu}
          onPointerEnter={preloadCommandMenu}
          onFocus={preloadCommandMenu}
        >
          <Search aria-hidden="true" />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Notifications" onClick={() => navigate("/notifications")}>
          <Bell aria-hidden="true" />
        </Button>
        <ThemeToggle />
      </div>

      {hasOpened ? (
        <Suspense fallback={null}>
          <CommandMenu open={commandOpen} onOpenChange={setCommandOpen} />
        </Suspense>
      ) : null}
    </header>
  )
}

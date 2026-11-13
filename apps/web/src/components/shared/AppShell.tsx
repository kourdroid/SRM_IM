import { useState } from "react"
import { Outlet } from "react-router"

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { TooltipProvider } from "@/components/ui/tooltip"

import { AppSidebar } from "./AppSidebar"
import { Topbar } from "./Topbar"

/** Authenticated layout: fixed sidebar on desktop, Sheet drawer below 1024px, top bar and page outlet. */
export function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-svh bg-background">
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-0 lg:block">
          <AppSidebar />
        </aside>

        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetContent side="left" className="w-72 bg-sidebar p-0 text-sidebar-foreground">
            <SheetHeader className="sr-only">
              <SheetTitle>Navigation</SheetTitle>
            </SheetHeader>
            <AppSidebar onNavigate={() => setDrawerOpen(false)} />
          </SheetContent>
        </Sheet>

        <div className="flex min-h-svh flex-col lg:pl-64">
          <Topbar onOpenMenu={() => setDrawerOpen(true)} />
          <main className="flex-1 p-4 sm:p-6 lg:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </TooltipProvider>
  )
}

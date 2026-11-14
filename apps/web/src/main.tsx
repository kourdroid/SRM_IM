import { QueryClientProvider } from "@tanstack/react-query"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "react-router"

import { router } from "@/app/router"
import { ThemeProvider } from "@/components/shared/ThemeProvider"
import { Toaster } from "@/components/ui/sonner"
import { AuthProvider } from "@/features/auth/AuthProvider"
import { queryClient } from "@/lib/queryClient"
import { reloadForNewVersion } from "@/lib/staleBuild"

import "./index.css"

// Vite reports a page file that failed to download (typically after a new deploy) through this event.
window.addEventListener("vite:preloadError", (event) => {
  if (reloadForNewVersion()) event.preventDefault()
})

const rootElement = document.getElementById("root")
if (!rootElement) {
  throw new Error("Élément #root introuvable dans index.html.")
}

createRoot(rootElement).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RouterProvider router={router} />
          <Toaster />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>
)

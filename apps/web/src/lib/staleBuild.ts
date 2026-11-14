// After a deploy, a tab still running the previous version asks for page files that no longer exist
// (file names change with every build). Reloading once loads the new version and its files.

const RELOAD_KEY = "intervx.stale-build-reload"
// Ignore a second failure within this window so a real outage cannot cause a reload loop.
const RELOAD_GUARD_MS = 30_000

/** True when the error comes from a page file that could not be downloaded. */
export function isStaleBuildError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : ""
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported|Unable to preload CSS|Loading chunk .* failed/i.test(
    message
  )
}

/** Reloads the page once to pick up the new version. Returns false when a reload was just attempted. */
export function reloadForNewVersion(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0)
    if (Date.now() - last < RELOAD_GUARD_MS) return false
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
  } catch {
    // Without storage we still reload; the guard only prevents loops.
  }
  window.location.reload()
  return true
}

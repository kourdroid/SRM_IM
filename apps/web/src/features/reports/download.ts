/**
 * Saves a file from a signed URL. The file is fetched so the browser saves it under the given name; if the fetch
 * is refused (network or storage CORS), the signed link opens in a new tab instead, which still delivers the file.
 */
export async function downloadFile(url: string, filename: string): Promise<"saved" | "opened"> {
  let blob: Blob
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Téléchargement refusé (${response.status}).`)
    blob = await response.blob()
  } catch {
    window.open(url, "_blank", "noopener,noreferrer")
    return "opened"
  }

  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = objectUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
  return "saved"
}

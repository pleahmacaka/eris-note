import { join } from "@tauri-apps/api/path"
import { readBytes } from "./disk"
import { extension } from "./paths"
import { vault } from "./vault.svelte"

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".bmp": "image/bmp",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
}

export const readAttachment = (path: string) => readBytes(vault.root, path)

export const attachmentUrl = async (path: string) => {
  const bytes = await readAttachment(path)
  const type = MIME[extension(path)] ?? "application/octet-stream"

  return URL.createObjectURL(new Blob([bytes], { type }))
}

export const openWithSystem = async (path: string) => {
  const { openPath } = await import("@tauri-apps/plugin-opener")

  await openPath(await join(vault.root, ...path.split("/")))
}

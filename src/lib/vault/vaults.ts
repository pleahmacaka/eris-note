import { open } from "@tauri-apps/plugin-dialog"
import { patchVault } from "../settings"
import { device } from "../settings.svelte"
import { defaultRoot, listEntries } from "./disk"
import { basename } from "./paths"

const RECENT_LIMIT = 12

export const vaultName = (path: string) => basename(path.replaceAll("\\", "/"))

export const switchVault = (path: string) =>
  patchVault({
    path,
    recent: [
      path,
      ...device.value.vault.recent.filter(entry => entry !== path),
    ].slice(0, RECENT_LIMIT),
  })

export const forgetVault = (path: string) =>
  patchVault({
    recent: device.value.vault.recent.filter(entry => entry !== path),
  })

export const chooseVault = async () => {
  const chosen = await open({
    directory: true,
    recursive: true,
    title: "볼트 폴더 선택",
  })

  if (typeof chosen === "string") {
    await switchVault(chosen)
  }
}

export const adoptLegacyVault = async () => {
  const root = await defaultRoot()
  const entries = await listEntries(root).catch(() => [])

  if (entries.length > 0) {
    await switchVault(root)
  }
}

import { resolveLink } from "../vault/links"
import { isCanvas } from "../vault/paths"
import { createFile, vault } from "../vault/vault.svelte"
import {
  dockPath,
  type Edge,
  type OpenOptions,
  openView,
  type Pane,
} from "./workspace.svelte"

export const filePaths = () =>
  vault.entries.filter(e => !e.folder).map(e => e.path)

export const openPath = (path: string, options: OpenOptions = {}) =>
  openView(isCanvas(path) ? "canvas" : "note", path, options)

export const dockFile = (path: string, target: Pane, edge: Edge) => {
  if (vault.entries.some(e => e.path === path && !e.folder)) {
    dockPath(isCanvas(path) ? "canvas" : "note", path, target, edge)
  }
}

export const openLink = async (
  target: string,
  from: string,
  newTab = false,
) => {
  const resolved = resolveLink(target, from, filePaths())

  openPath(resolved ?? (await createFile("", target, ".md")), { newTab })
}

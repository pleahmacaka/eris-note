import { citedPath } from "../markdown/cite"
import { openExternal } from "../platform/links"
import { resolveLink } from "../vault/links"
import { isCanvas, isText } from "../vault/paths"
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

const kindOf = (path: string) =>
  isCanvas(path) ? "canvas" : isText(path) ? "note" : "file"

export const openPath = (path: string, options: OpenOptions = {}) =>
  openView(kindOf(path), path, options)

export const dockFile = (path: string, target: Pane, edge: Edge) => {
  if (vault.entries.some(e => e.path === path && !e.folder)) {
    dockPath(kindOf(path), path, target, edge)
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

export const openHref = async (href: string, newTab = false) => {
  const cited = citedPath(href)

  if (cited) {
    openPath(cited, { newTab })
  } else {
    await openExternal(href)
  }
}

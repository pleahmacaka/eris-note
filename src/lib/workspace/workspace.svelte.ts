import { type KeyValueStore, openStore } from "../platform/storage"
import { displayName, fileIcon } from "../vault/paths"

export type ViewKind =
  | "note"
  | "canvas"
  | "file"
  | "graph"
  | "calendar"
  | "todos"
  | "settings"

export type Tab = { id: string; kind: ViewKind; path: string | null }

export type Pane = { id: string; tabs: Tab[]; active: string | null }

export type Direction = "row" | "column"

export type Split = { id: string; direction: Direction; children: Region[] }

export type Region = Pane | Split

export type Edge = "left" | "right" | "top" | "bottom"

type Saved = { root?: Region; panes?: Pane[]; focus: string }

const FILE = "settings.json"
const KEY = "workspace"
const SINGLETONS: ViewKind[] = ["graph", "calendar", "todos", "settings"]
const FILE_KINDS: ViewKind[] = ["note", "canvas", "file"]

const LABELS: Record<ViewKind, string> = {
  note: "노트",
  canvas: "캔버스",
  file: "파일",
  graph: "그래프",
  calendar: "캘린더",
  todos: "할 일",
  settings: "설정",
}

const ICONS: Record<ViewKind, string> = {
  note: "lucide:file-text",
  canvas: "lucide:layout-dashboard",
  file: "lucide:file",
  graph: "lucide:waypoints",
  calendar: "lucide:calendar-days",
  todos: "lucide:list-checks",
  settings: "lucide:settings",
}

const newId = () => crypto.randomUUID()

const emptyPane = (): Pane => ({ id: newId(), tabs: [], active: null })

const first = emptyPane()

export const workspace = $state({
  root: first as Region,
  focus: first.id,
})

export const isPane = (region: Region): region is Pane => "tabs" in region

export const panes = (region: Region = workspace.root): Pane[] =>
  isPane(region) ? [region] : region.children.flatMap(child => panes(child))

const parentOf = (
  id: string,
  region: Region = workspace.root,
): Split | null => {
  if (isPane(region)) {
    return null
  }

  for (const child of region.children) {
    if (child.id === id) {
      return region
    }

    const found = parentOf(id, child)

    if (found) {
      return found
    }
  }

  return null
}

const replace = (id: string, next: Region) => {
  const parent = parentOf(id)

  if (!parent) {
    workspace.root = next

    return
  }

  const at = parent.children.findIndex(child => child.id === id)

  if (!isPane(next) && next.direction === parent.direction) {
    parent.children.splice(at, 1, ...next.children)
  } else {
    parent.children[at] = next
  }
}

const place = (pane: Pane, target: Pane, edge: Edge) => {
  const direction: Direction =
    edge === "left" || edge === "right" ? "row" : "column"
  const after = edge === "right" || edge === "bottom"
  const parent = parentOf(target.id)

  if (parent?.direction === direction) {
    const at = parent.children.findIndex(child => child.id === target.id)

    parent.children.splice(after ? at + 1 : at, 0, pane)

    return
  }

  replace(target.id, {
    id: newId(),
    direction,
    children: after ? [target, pane] : [pane, target],
  })
}

const removePane = (pane: Pane) => {
  const parent = parentOf(pane.id)

  if (!parent) {
    return
  }

  parent.children.splice(
    parent.children.findIndex(child => child.id === pane.id),
    1,
  )

  if (parent.children.length === 1) {
    replace(parent.id, parent.children[0])
  }

  if (workspace.focus === pane.id) {
    workspace.focus = panes()[0].id
  }
}

export const tabTitle = (tab: Tab) =>
  tab.path ? displayName(tab.path) : LABELS[tab.kind]

export const tabIcon = (tab: Tab) =>
  tab.kind === "file" && tab.path ? fileIcon(tab.path) : ICONS[tab.kind]

export const activeTab = (pane: Pane) =>
  pane.tabs.find(t => t.id === pane.active) ?? null

export const focusedPane = () => {
  const all = panes()

  return all.find(p => p.id === workspace.focus) ?? all[0]
}

export const focusedTab = () => activeTab(focusedPane())

export const focusPane = (id: string) => {
  workspace.focus = id
}

export const activate = (pane: Pane, tabId: string) => {
  pane.active = tabId
  workspace.focus = pane.id
}

export type OpenOptions = { newTab?: boolean; split?: boolean }

export const openView = (
  kind: ViewKind,
  path: string | null = null,
  options: OpenOptions = {},
) => {
  const existing = panes()
    .flatMap(pane => pane.tabs.map(tab => ({ pane, tab })))
    .find(({ tab }) =>
      SINGLETONS.includes(kind) ? tab.kind === kind : tab.path === path,
    )

  if (existing && !options.split) {
    activate(existing.pane, existing.tab.id)

    return
  }

  const tab: Tab = { id: newId(), kind, path }

  if (options.split) {
    const pane: Pane = { id: newId(), tabs: [tab], active: tab.id }

    place(pane, focusedPane(), "right")
    workspace.focus = pane.id

    return
  }

  const pane = focusedPane()
  const current = activeTab(pane)
  const replace =
    !options.newTab &&
    current !== null &&
    FILE_KINDS.includes(current.kind) &&
    FILE_KINDS.includes(kind)

  if (replace && current) {
    current.kind = kind
    current.path = path
  } else {
    pane.tabs.push(tab)
    pane.active = tab.id
  }

  workspace.focus = pane.id
}

export const splitPane = (pane: Pane) => {
  const fresh = emptyPane()

  place(fresh, pane, "right")
  workspace.focus = fresh.id
}

export const closeTab = (pane: Pane, tabId: string) => {
  const at = pane.tabs.findIndex(t => t.id === tabId)

  if (at === -1) {
    return
  }

  pane.tabs.splice(at, 1)

  if (pane.active === tabId) {
    pane.active = pane.tabs[Math.min(at, pane.tabs.length - 1)]?.id ?? null
  }

  if (pane.tabs.length === 0) {
    removePane(pane)
  }
}

export const closeOthers = (pane: Pane, keep: string) => {
  pane.tabs = pane.tabs.filter(t => t.id === keep)
  pane.active = keep
}

const detach = (tabId: string) => {
  const source = panes().find(p => p.tabs.some(t => t.id === tabId))
  const tab = source?.tabs.find(t => t.id === tabId)

  if (!source || !tab) {
    return null
  }

  source.tabs.splice(source.tabs.indexOf(tab), 1)

  if (source.active === tabId) {
    source.active = source.tabs[0]?.id ?? null
  }

  return { source, tab }
}

export const dockTab = (tabId: string, target: Pane, edge: Edge) => {
  const moved = detach(tabId)

  if (!moved) {
    return
  }

  const pane: Pane = { id: newId(), tabs: [moved.tab], active: moved.tab.id }

  place(pane, target, edge)

  if (moved.source.tabs.length === 0) {
    removePane(moved.source)
  }

  workspace.focus = pane.id
}

export const dockPath = (
  kind: ViewKind,
  path: string,
  target: Pane,
  edge: Edge,
) => {
  const tab: Tab = { id: newId(), kind, path }
  const pane: Pane = { id: newId(), tabs: [tab], active: tab.id }

  place(pane, target, edge)
  workspace.focus = pane.id
}

export const moveTab = (tabId: string, target: Pane, before: string | null) => {
  const source = panes().find(p => p.tabs.some(t => t.id === tabId))
  const tab = source?.tabs.find(t => t.id === tabId)

  if (!source || !tab || tabId === before) {
    return
  }

  source.tabs.splice(source.tabs.indexOf(tab), 1)

  const at = before ? target.tabs.findIndex(t => t.id === before) : -1

  target.tabs.splice(at === -1 ? target.tabs.length : at, 0, tab)
  target.active = tab.id
  workspace.focus = target.id

  if (source !== target) {
    if (source.active === tabId) {
      source.active = source.tabs[0]?.id ?? null
    }

    if (source.tabs.length === 0) {
      removePane(source)
    }
  }
}

export const retarget = (from: string, to: string) => {
  for (const pane of panes()) {
    for (const tab of pane.tabs) {
      if (tab.path === from || tab.path?.startsWith(`${from}/`)) {
        tab.path = to + tab.path.slice(from.length)
      }
    }
  }
}

export const forget = (path: string) => {
  for (const pane of panes()) {
    for (const tab of [...pane.tabs]) {
      if (tab.path === path || tab.path?.startsWith(`${path}/`)) {
        closeTab(pane, tab.id)
      }
    }
  }
}

let handle: Promise<KeyValueStore> | undefined

const store = () => {
  handle ??= openStore(FILE)

  return handle
}

const valid = (region: unknown): region is Region => {
  if (typeof region !== "object" || region === null || !("id" in region)) {
    return false
  }

  if ("tabs" in region) {
    return Array.isArray(region.tabs)
  }

  return (
    "children" in region &&
    Array.isArray(region.children) &&
    region.children.length > 0 &&
    region.children.every(valid)
  )
}

const legacy = (saved: Pane[]): Region | null => {
  const kept = saved.filter(valid)

  if (kept.length < 2) {
    return kept[0] ?? null
  }

  return { id: newId(), direction: "row", children: kept }
}

export const restoreWorkspace = async () => {
  const saved = await (await store()).get<Saved>(KEY)
  const candidate = saved?.root
  const root = valid(candidate) ? candidate : legacy(saved?.panes ?? [])

  if (!root) {
    openView("calendar")

    return
  }

  workspace.root = root

  const all = panes()

  workspace.focus = all.some(p => p.id === saved?.focus)
    ? (saved?.focus ?? all[0].id)
    : all[0].id
}

export const persistWorkspace = async () => {
  const db = await store()

  await db.set(KEY, $state.snapshot(workspace) satisfies Saved)
  await db.save()
}

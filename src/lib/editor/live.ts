import { syntaxTree } from "@codemirror/language"
import {
  type EditorState,
  type Range,
  StateEffect,
  StateField,
  type Transaction,
} from "@codemirror/state"
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  type WidgetType,
} from "@codemirror/view"
import { parseLinks } from "@eris/markdown"
import type { SyntaxNode, SyntaxNodeRef } from "@lezer/common"
import { Bullet, Formula, Picture, Rule, Task } from "./widgets"

const CODE = new Set([
  "FencedCode",
  "CodeBlock",
  "InlineCode",
  "InlineMath",
  "BlockMath",
])

const CONTAINERS = new Set([
  "Document",
  "Blockquote",
  "BulletList",
  "OrderedList",
  "ListItem",
])

const IMAGE_SOURCE = /^data:image\//i

const hidden = Decoration.replace({})

const setFocus = StateEffect.define<boolean>()

const focus = StateField.define<boolean>({
  create: () => false,
  update: (value, tr) => {
    for (const effect of tr.effects) {
      if (effect.is(setFocus)) {
        return effect.value
      }
    }

    return value
  },
})

export const touched = (state: EditorState, from: number, to = from) => {
  if (!state.field(focus, false)) {
    return false
  }

  const start = state.doc.lineAt(from).from
  const end = state.doc.lineAt(to).to

  return state.selection.ranges.some(r => r.from <= end && r.to >= start)
}

export const inCode = (state: EditorState, pos: number) => {
  let node: SyntaxNode | null = syntaxTree(state).resolveInner(pos, -1)

  for (; node; node = node.parent) {
    if (CODE.has(node.name)) {
      return true
    }
  }

  return false
}

const isMathFence = (state: EditorState, node: SyntaxNode) => {
  const info = node.getChild("CodeInfo")

  return info !== null && state.sliceDoc(info.from, info.to) === "math"
}

const fenceBody = (state: EditorState, node: SyntaxNode) => {
  const marks = node.getChildren("CodeMark")
  const close = marks.at(1)
  const from = state.doc.lineAt(marks[0].to).to + 1
  const to = close ? state.doc.lineAt(close.from).from - 1 : node.to

  return from < to ? state.sliceDoc(from, to) : ""
}

const blockTex = (state: EditorState, node: SyntaxNode) => {
  if (node.name === "FencedCode" && isMathFence(state, node)) {
    return fenceBody(state, node)
  }

  if (node.name !== "BlockMath") {
    return null
  }

  const marks = node.getChildren("MathMark")
  const close = marks.at(1)

  return state.sliceDoc(marks[0].to, close ? close.from : node.to)
}

class Collector {
  readonly ranges: Range<Decoration>[] = []

  constructor(readonly state: EditorState) {}

  active(from: number, to = from) {
    return touched(this.state, from, to)
  }

  text(from: number, to: number) {
    return this.state.sliceDoc(from, to)
  }

  line(pos: number, className: string) {
    const { from } = this.state.doc.lineAt(pos)

    this.ranges.push(Decoration.line({ class: className }).range(from))
  }

  lines(from: number, to: number, className: (n: number) => string) {
    const first = this.state.doc.lineAt(from).number
    const last = this.state.doc.lineAt(to).number

    for (let n = first; n <= last; n++) {
      this.line(this.state.doc.line(n).from, className(n))
    }
  }

  hide(from: number, to: number) {
    if (from < to) {
      this.ranges.push(hidden.range(from, to))
    }
  }

  hideWithSpace(from: number, to: number) {
    this.hide(from, this.text(to, to + 1) === " " ? to + 1 : to)
  }

  replace(from: number, to: number, widget: WidgetType) {
    this.ranges.push(Decoration.replace({ widget }).range(from, to))
  }

  mark(from: number, to: number, className: string) {
    if (from < to) {
      this.ranges.push(Decoration.mark({ class: className }).range(from, to))
    }
  }

  link(from: number, to: number, attributes: Record<string, string>) {
    const className = this.active(from) ? "cm-link" : "cm-link cm-chip"

    this.ranges.push(
      Decoration.mark({ class: className, attributes }).range(from, to),
    )
  }
}

const heading = (c: Collector, node: SyntaxNodeRef) => {
  const level = node.name.slice("ATXHeading".length)

  c.line(node.from, `cm-h${level}`)
}

const fencedCode = (c: Collector, node: SyntaxNode) => {
  const active = c.active(node.from, node.to)

  if (!active && isMathFence(c.state, node)) {
    return
  }

  const first = c.state.doc.lineAt(node.from).number
  const last = c.state.doc.lineAt(node.to).number

  c.lines(node.from, node.to, n =>
    ["cm-code", n === first && "cm-code-first", n === last && "cm-code-last"]
      .filter(Boolean)
      .join(" "),
  )

  const info = node.getChild("CodeInfo")

  if (info) {
    c.mark(info.from, info.to, "cm-code-info")
  }

  if (!active) {
    for (const mark of node.getChildren("CodeMark")) {
      c.hide(mark.from, mark.to)
    }
  }
}

const link = (c: Collector, node: SyntaxNode) => {
  const url = node.getChild("URL")

  if (!url) {
    return
  }

  const [open, close] = node.getChildren("LinkMark")

  c.link(node.from, node.to, { "data-href": c.text(url.from, url.to) })

  if (!c.active(node.from) && open && close) {
    c.hide(node.from, open.to)
    c.hide(close.from, node.to)
  }
}

const bareUrl = (c: Collector, node: SyntaxNode) => {
  const parent = node.parent?.name

  if (parent !== "Link" && parent !== "Image") {
    c.link(node.from, node.to, { "data-href": c.text(node.from, node.to) })
  }
}

const autolink = (c: Collector, node: SyntaxNode) => {
  for (const mark of node.getChildren("LinkMark")) {
    c.hide(mark.from, mark.to)
  }
}

const image = (c: Collector, node: SyntaxNode) => {
  const url = node.getChild("URL")
  const [open, close] = node.getChildren("LinkMark")
  const src = url ? c.text(url.from, url.to) : ""

  if (IMAGE_SOURCE.test(src) && open && close) {
    c.replace(node.from, node.to, new Picture(src, c.text(open.to, close.from)))
  }
}

const listMark = (c: Collector, node: SyntaxNode) => {
  const item = node.parent
  const list = item?.parent?.name

  if (item?.getChild("Task")) {
    c.hideWithSpace(node.from, node.to)
  } else if (list === "BulletList") {
    c.replace(node.from, node.to, new Bullet())
  } else if (list === "OrderedList") {
    c.mark(node.from, node.to, "cm-list-number")
  }
}

const taskMarker = (c: Collector, node: SyntaxNodeRef) => {
  const done = c.text(node.from, node.to).toLowerCase() === "[x]"

  c.replace(node.from, node.to, new Task(done))

  if (done) {
    c.line(node.from, "cm-task-done")
  }
}

const inlineMath = (c: Collector, node: SyntaxNode) => {
  const [open, close] = node.getChildren("MathMark")
  const display = open.to - open.from === 2

  c.replace(
    node.from,
    node.to,
    new Formula(c.text(open.to, close.from), display),
  )
}

const parentName = (node: SyntaxNodeRef) => node.node.parent?.name ?? ""

const rendered = (c: Collector, node: SyntaxNodeRef) => {
  switch (node.name) {
    case "HeaderMark":
      if (parentName(node).startsWith("ATXHeading")) {
        c.hideWithSpace(node.from, node.to)
      }
      break
    case "EmphasisMark":
    case "StrikethroughMark":
      c.hide(node.from, node.to)
      break
    case "CodeMark":
      if (parentName(node) === "InlineCode") {
        c.hide(node.from, node.to)
      }
      break
    case "QuoteMark":
      c.hideWithSpace(node.from, node.to)
      break
    case "Autolink":
      autolink(c, node.node)
      break
    case "Image":
      image(c, node.node)
      return false
    case "ListMark":
      listMark(c, node.node)
      break
    case "TaskMarker":
      taskMarker(c, node)
      break
    case "HorizontalRule":
      c.replace(node.from, node.to, new Rule())
      break
    case "InlineMath":
      inlineMath(c, node.node)
      return false
  }
}

const decorate = (c: Collector, node: SyntaxNodeRef) => {
  if (node.name.startsWith("ATXHeading")) {
    heading(c, node)
  }

  switch (node.name) {
    case "Blockquote":
      c.lines(node.from, node.to, () => "cm-quote")
      break
    case "FencedCode":
      fencedCode(c, node.node)
      return false
    case "BlockMath":
      return false
    case "Link":
      link(c, node.node)
      break
    case "URL":
      bareUrl(c, node.node)
      break
  }

  if (!c.active(node.from)) {
    return rendered(c, node)
  }
}

const wikilinks = (c: Collector, from: number, to: number) => {
  for (let pos = from; pos <= to; ) {
    const line = c.state.doc.lineAt(pos)

    for (const found of parseLinks(line.text)) {
      const start = line.from + found.from
      const end = line.from + found.to
      const raw = line.text.slice(found.from, found.to)

      if (inCode(c.state, start + 1)) {
        continue
      }

      c.link(start, end, { "data-target": found.target })

      if (!c.active(start)) {
        const prefix = raw.startsWith("!") ? 3 : 2

        c.hide(start, start + (found.alias ? raw.indexOf("|") + 1 : prefix))
        c.hide(end - 2, end)
      }
    }

    pos = line.to + 1
  }
}

const buildInline = (view: EditorView) => {
  const c = new Collector(view.state)

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter: node => decorate(c, node),
    })
    wikilinks(c, from, to)
  }

  return Decoration.set(c.ranges, true)
}

const mathBlock = (state: EditorState, node: SyntaxNode, tex: string) => {
  const widget = new Formula(tex, true)
  const from = state.doc.lineAt(node.from).from
  const to = state.doc.lineAt(node.to).to

  return Decoration.replace({ widget, block: true }).range(from, to)
}

const buildBlocks = (state: EditorState) => {
  const ranges: Range<Decoration>[] = []

  syntaxTree(state).iterate({
    enter: node => {
      const tex = blockTex(state, node.node)

      if (tex !== null && !touched(state, node.from, node.to)) {
        ranges.push(mathBlock(state, node.node, tex))
      }

      return CONTAINERS.has(node.name)
    },
  })

  return Decoration.set(ranges)
}

const moved = (before: EditorState, after: EditorState) =>
  before.field(focus) !== after.field(focus) ||
  syntaxTree(before) !== syntaxTree(after)

const blocksStale = (tr: Transaction) =>
  tr.docChanged || tr.selection !== undefined || moved(tr.startState, tr.state)

const inlineStale = (update: ViewUpdate) =>
  update.docChanged ||
  update.viewportChanged ||
  update.selectionSet ||
  moved(update.startState, update.state)

const mathBlocks = StateField.define<DecorationSet>({
  create: buildBlocks,
  update: (value, tr) => (blocksStale(tr) ? buildBlocks(tr.state) : value),
  provide: field => EditorView.decorations.from(field),
})

const inline = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = buildInline(view)
    }

    update(update: ViewUpdate) {
      if (inlineStale(update)) {
        this.decorations = buildInline(update.view)
      }
    }
  },
  { decorations: v => v.decorations },
)

export const livePreview = [
  focus,
  EditorView.focusChangeEffect.of((_state, focusing) => setFocus.of(focusing)),
  mathBlocks,
  inline,
]

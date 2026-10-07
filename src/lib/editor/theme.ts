import { HighlightStyle } from "@codemirror/language"
import { EditorView } from "@codemirror/view"
import { tags } from "@lezer/highlight"

const tint = (color: string, amount: number) =>
  `color-mix(in oklch, ${color} ${amount}%, transparent)`

const faded = (amount: number) => tint("currentColor", amount)

const hairline = `var(--border) solid ${faded(12)}`

export const highlight = HighlightStyle.define([
  { tag: tags.strong, fontWeight: "700" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: tags.heading, fontWeight: "700" },
  { tag: tags.link, color: "var(--color-primary)" },
  { tag: tags.url, color: faded(55) },
  { tag: tags.monospace, backgroundColor: faded(8) },
  { tag: tags.quote, color: faded(75) },
  {
    tag: [tags.processingInstruction, tags.meta, tags.contentSeparator],
    color: faded(40),
  },
  { tag: tags.keyword, color: "var(--color-primary)" },
  { tag: tags.string, color: "var(--color-accent)" },
  { tag: [tags.number, tags.bool], color: "var(--color-success)" },
  { tag: tags.comment, color: faded(50) },
])

const blocks = {
  ".cm-h1": { fontSize: "1.9em", lineHeight: "1.4" },
  ".cm-h2": { fontSize: "1.55em", lineHeight: "1.4" },
  ".cm-h3": { fontSize: "1.3em" },
  ".cm-h4": { fontSize: "1.12em" },
  ".cm-quote": {
    borderLeft: "0.1875rem solid var(--color-primary)",
    paddingLeft: "0.75rem",
    color: faded(80),
  },
  ".cm-code": {
    backgroundColor: faded(6),
    paddingLeft: "1rem",
    paddingRight: "1rem",
  },
  ".cm-code-first": {
    paddingTop: "0.375rem",
    borderTopLeftRadius: "var(--radius-box)",
    borderTopRightRadius: "var(--radius-box)",
  },
  ".cm-code-last": {
    paddingBottom: "0.375rem",
    borderBottomLeftRadius: "var(--radius-box)",
    borderBottomRightRadius: "var(--radius-box)",
  },
  ".cm-code-info": { fontSize: "0.75em", color: faded(50) },
  ".cm-rule": {
    display: "inline-block",
    width: "100%",
    verticalAlign: "middle",
    borderTop: `var(--border) solid ${faded(20)}`,
  },
  ".cm-math": { cursor: "text" },
  ".cm-math-block": {
    padding: "0.5rem 0",
    overflowX: "auto",
    overflowY: "hidden",
    textAlign: "center",
  },
  ".cm-math-block .katex-display": { margin: "0" },
  ".cm-math-empty": { color: faded(40), fontSize: "0.875em" },
  ".cm-image": {
    maxWidth: "100%",
    verticalAlign: "bottom",
    borderRadius: "var(--radius-box)",
  },
}

const lists = {
  ".cm-bullet": { color: "var(--color-primary)", fontWeight: "700" },
  ".cm-list-number": { color: "var(--color-primary)", fontWeight: "600" },
  ".cm-task": { verticalAlign: "middle", marginRight: "0.25rem" },
  ".cm-task-done": { color: faded(50), textDecoration: "line-through" },
}

const links = {
  ".cm-link": {
    color: "var(--color-primary)",
    cursor: "pointer",
    textDecoration: "underline",
    textDecorationColor: tint("var(--color-primary)", 40),
    textUnderlineOffset: "0.2em",
  },
  ".cm-chip": {
    backgroundColor: tint("var(--color-primary)", 12),
    borderRadius: "var(--radius-field)",
    padding: "0.0625rem 0.25rem",
    textDecoration: "none",
  },
}

const search = {
  ".cm-panels": { backgroundColor: "var(--color-base-100)", color: "inherit" },
  ".cm-panels-top": { borderBottom: hairline },
  ".cm-search": { fontSize: "0.8125rem", padding: "0.375rem 0.75rem" },
  ".cm-search input, .cm-search button": {
    fontFamily: "inherit",
    fontSize: "inherit",
    border: `var(--border) solid ${faded(15)}`,
    background: "var(--color-base-200)",
    color: "inherit",
    borderRadius: "var(--radius-field)",
  },
  ".cm-searchMatch": { backgroundColor: tint("var(--color-warning)", 30) },
  ".cm-searchMatch-selected": {
    backgroundColor: tint("var(--color-primary)", 40),
  },
  ".cm-selectionMatch": { backgroundColor: tint("var(--color-primary)", 14) },
}

const menus = {
  ".cm-tooltip": {
    border: hairline,
    backgroundColor: "var(--color-base-100)",
    borderRadius: "var(--radius-box)",
  },
  ".cm-tooltip.cm-tooltip-autocomplete": { padding: "0.25rem" },
  ".cm-tooltip.cm-tooltip-autocomplete > ul": {
    fontFamily: "inherit",
    minWidth: "13rem",
    maxHeight: "20rem",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul > li": {
    display: "flex",
    alignItems: "baseline",
    gap: "1rem",
    padding: "0.375rem 0.625rem",
    lineHeight: "1.4",
    borderRadius: "var(--radius-field)",
  },
  ".cm-tooltip-autocomplete ul li[aria-selected]": {
    backgroundColor: tint("var(--color-primary)", 25),
    color: "inherit",
  },
  ".cm-completionLabel": { flex: "1" },
  ".cm-completionDetail": {
    marginLeft: "0",
    fontSize: "0.75em",
    fontStyle: "normal",
    color: faded(50),
  },
  ".cm-completionMatchedText": { textDecoration: "none", fontWeight: "700" },
}

export const theme = EditorView.theme({
  "&": { height: "100%", backgroundColor: "transparent" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: "inherit", lineHeight: "1.75" },
  ".cm-content": {
    maxWidth: "46rem",
    margin: "0 auto",
    padding: "1.5rem 1.5rem 40vh",
    caretColor: "var(--color-primary)",
  },
  ".cm-cursor": { borderLeftColor: "var(--color-primary)" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
    backgroundColor: tint("var(--color-primary)", 28),
  },
  ".cm-placeholder": { color: faded(35) },
  ...blocks,
  ...lists,
  ...links,
  ...search,
  ...menus,
})

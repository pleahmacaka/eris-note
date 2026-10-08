import {
  autocompletion,
  type Completion,
  type CompletionContext,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from "@codemirror/autocomplete"
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands"
import { markdown, markdownLanguage } from "@codemirror/lang-markdown"
import {
  bracketMatching,
  indentOnInput,
  syntaxHighlighting,
} from "@codemirror/language"
import { languages } from "@codemirror/language-data"
import {
  highlightSelectionMatches,
  search,
  searchKeymap,
} from "@codemirror/search"
import { EditorState } from "@codemirror/state"
import {
  drawSelection,
  dropCursor,
  EditorView,
  keymap,
  placeholder,
} from "@codemirror/view"
import { linkText } from "../vault/links"
import { dirname } from "../vault/paths"
import { formatKeymap } from "./blocks"
import { livePreview, touched } from "./live"
import { mathSyntax } from "./math"
import { slashCompletion } from "./slash"
import { highlight, theme } from "./theme"

export type EditorOptions = {
  parent: HTMLElement
  doc: string
  paths: () => readonly string[]
  onChange: (text: string) => void
  onLink: (target: string, newTab: boolean) => void
  onHref: (href: string, newTab: boolean) => void
}

const wikilinkCompletion =
  (paths: () => readonly string[]) => (context: CompletionContext) => {
    const before = context.matchBefore(/\[\[[^\]\n|]*/)

    if (!before) {
      return null
    }

    const all = paths()

    const options: Completion[] = all.map(path => {
      const label = linkText(path, all)

      return {
        label,
        detail: dirname(path) || undefined,
        apply: (view, _completion, from, to) => {
          const closed = view.state.sliceDoc(to, to + 2) === "]]"
          const insert = closed ? label : `${label}]]`

          view.dispatch({
            changes: { from, to, insert },
            selection: { anchor: from + insert.length + (closed ? 2 : 0) },
          })
        },
      }
    })

    return { from: before.from + 2, options, validFor: /^[^\]\n|]*$/ }
  }

const toggleTask = (view: EditorView, box: HTMLElement) => {
  const pos = view.posAtDOM(box)
  const marker = view.state.sliceDoc(pos, pos + 3)

  if (!/^\[[ xX]\]$/.test(marker)) {
    return false
  }

  view.dispatch({
    changes: {
      from: pos + 1,
      to: pos + 2,
      insert: marker[1] === " " ? "x" : " ",
    },
  })

  return true
}

const followLink = (
  view: EditorView,
  link: HTMLElement,
  newTab: boolean,
  options: EditorOptions,
) => {
  const { target, href } = link.dataset

  if (!target && !href) {
    return false
  }

  if (!newTab && touched(view.state, view.posAtDOM(link))) {
    return false
  }

  if (target) {
    options.onLink(target, newTab)
  } else if (href) {
    options.onHref(href, newTab)
  }

  return true
}

const clicks = (options: EditorOptions) =>
  EditorView.domEventHandlers({
    mousedown: (event, view) => {
      if (event.button !== 0 || !(event.target instanceof HTMLElement)) {
        return false
      }

      if (event.target.classList.contains("cm-task")) {
        event.preventDefault()

        return toggleTask(view, event.target)
      }

      const link = event.target.closest<HTMLElement>(".cm-link")
      const newTab = event.ctrlKey || event.metaKey

      if (!link || !followLink(view, link, newTab, options)) {
        return false
      }

      event.preventDefault()

      return true
    },
  })

export const createEditor = (options: EditorOptions) =>
  new EditorView({
    parent: options.parent,
    state: EditorState.create({
      doc: options.doc,
      extensions: [
        history(),
        drawSelection(),
        dropCursor(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        autocompletion({
          override: [wikilinkCompletion(options.paths), slashCompletion],
          icons: false,
        }),
        formatKeymap,
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...historyKeymap,
          ...completionKeymap,
          ...searchKeymap,
          indentWithTab,
        ]),
        search({ top: true }),
        highlightSelectionMatches(),
        markdown({
          base: markdownLanguage,
          codeLanguages: languages,
          extensions: [mathSyntax],
        }),
        syntaxHighlighting(highlight),
        livePreview,
        EditorView.lineWrapping,
        placeholder("내용을 입력하세요."),
        theme,
        EditorView.updateListener.of(update => {
          if (update.docChanged) {
            options.onChange(update.state.doc.toString())
          }
        }),
        clicks(options),
      ],
    }),
  })

export const replaceDoc = (view: EditorView, text: string) => {
  if (view.state.doc.toString() === text) {
    return
  }

  const anchor = Math.min(view.state.selection.main.anchor, text.length)

  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: text },
    selection: { anchor },
  })
}

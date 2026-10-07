import {
  type Completion,
  type CompletionContext,
  snippet,
  startCompletion,
} from "@codemirror/autocomplete"
import type { Line } from "@codemirror/state"
import type { EditorView } from "@codemirror/view"
import { inCode } from "./live"

type Apply = (
  view: EditorView,
  completion: Completion,
  from: number,
  to: number,
) => void

const BLOCK_PREFIX = /^(\s*)(?:#{1,6} |[-*+] \[[ xX]\] |[-*+] |\d+[.)] |> ?)?/

const turnInto =
  (prefix: string): Apply =>
  (view, _completion, from, to) => {
    const line = view.state.doc.lineAt(from)
    const slash = from - 1 - line.from
    const text = line.text.slice(0, slash) + line.text.slice(to - line.from)
    const [current, indent] = BLOCK_PREFIX.exec(text) ?? ["", ""]
    const head = indent + prefix

    view.dispatch({
      changes: {
        from: line.from,
        to: line.to,
        insert: head + text.slice(current.length),
      },
      selection: {
        anchor: line.from + head.length + Math.max(slash - current.length, 0),
      },
    })
  }

const gapBefore = (view: EditorView, line: Line, slash: number) => {
  if (view.state.sliceDoc(line.from, slash).trim() !== "") {
    return "\n\n"
  }

  const previous = line.number > 1 ? view.state.doc.line(line.number - 1) : null

  return previous && previous.text.trim() !== "" ? "\n" : ""
}

const insertBlock =
  (template: string): Apply =>
  (view, completion, from, to) => {
    const line = view.state.doc.lineAt(from)
    const before = gapBefore(view, line, from - 1)
    const after = view.state.sliceDoc(to, line.to).trim() === "" ? "" : "\n"

    snippet(before + template + after)(view, completion, from - 1, to)
  }

const insertNoteLink: Apply = (view, _completion, from, to) => {
  view.dispatch({
    changes: { from: from - 1, to, insert: "[[]]" },
    selection: { anchor: from + 1 },
  })
  startCompletion(view)
}

const BLOCKS: { label: string; detail: string; apply: Apply }[] = [
  { label: "텍스트", detail: "", apply: turnInto("") },
  { label: "제목 1", detail: "#", apply: turnInto("# ") },
  { label: "제목 2", detail: "##", apply: turnInto("## ") },
  { label: "제목 3", detail: "###", apply: turnInto("### ") },
  { label: "할 일 목록", detail: "- [ ]", apply: turnInto("- [ ] ") },
  { label: "글머리 기호 목록", detail: "-", apply: turnInto("- ") },
  { label: "번호 목록", detail: "1.", apply: turnInto("1. ") },
  { label: "인용", detail: ">", apply: turnInto("> ") },
  { label: "코드 블록", detail: "```", apply: insertBlock("```\n#{}\n```") },
  { label: "구분선", detail: "---", apply: insertBlock("---\n#{}") },
  { label: "수식 블록", detail: "$$", apply: insertBlock("$$\n#{}\n$$") },
  {
    label: "표",
    detail: "|",
    apply: insertBlock("| #{열 1} | #{열 2} |\n| --- | --- |\n| #{} | #{} |"),
  },
  { label: "노트 링크", detail: "[[ ]]", apply: insertNoteLink },
]

const options: Completion[] = BLOCKS.map((block, index) => ({
  ...block,
  boost: BLOCKS.length - index,
}))

const afterSpace = (context: CompletionContext, slash: number) =>
  slash === context.state.doc.lineAt(slash).from ||
  context.state.sliceDoc(slash - 1, slash).trim() === ""

export const slashCompletion = (context: CompletionContext) => {
  const query = context.matchBefore(/\/[^\s/]*/)

  if (!query || !afterSpace(context, query.from)) {
    return null
  }

  if (inCode(context.state, query.from + 1)) {
    return null
  }

  return { from: query.from + 1, options, validFor: /^[^\s/]*$/ }
}

import { tags } from "@lezer/highlight"
import type {
  BlockContext,
  BlockParser,
  InlineContext,
  InlineParser,
  Line,
  MarkdownConfig,
} from "@lezer/markdown"

const DOLLAR = 36

const FENCE = "$$"

const isSpace = (code: number) => code === 32 || code === 9 || code === 10

const isDigit = (code: number) => code >= 48 && code <= 57

const opensBlock = (line: Line) => line.text.startsWith(FENCE, line.pos)

const parseInlineMath = (cx: InlineContext, next: number, pos: number) => {
  if (next !== DOLLAR) {
    return -1
  }

  const size = cx.char(pos + 1) === DOLLAR ? 2 : 1
  const open = pos + size
  const close = cx.slice(open, cx.end).indexOf(size === 2 ? FENCE : "$")

  if (close <= 0) {
    return -1
  }

  const end = open + close

  if (cx.slice(open, end).includes("\n")) {
    return -1
  }

  const loose =
    isSpace(cx.char(open)) ||
    isSpace(cx.char(end - 1)) ||
    isDigit(cx.char(end + size))

  if (size === 1 && loose) {
    return -1
  }

  return cx.addElement(
    cx.elt("InlineMath", pos, end + size, [
      cx.elt("MathMark", pos, open),
      cx.elt("MathMark", end, end + size),
    ]),
  )
}

const parseBlockMath = (cx: BlockContext, line: Line) => {
  if (!opensBlock(line)) {
    return false
  }

  const from = cx.lineStart + line.pos
  const marks = [cx.elt("MathMark", from, from + FENCE.length)]
  let close = line.text.indexOf(FENCE, line.pos + FENCE.length)
  let to = cx.lineStart + line.text.length

  while (close < 0 && cx.nextLine()) {
    close = line.text.indexOf(FENCE, line.pos)
    to = cx.lineStart + line.text.length
  }

  if (close >= 0) {
    to = cx.lineStart + close + FENCE.length
    marks.push(cx.elt("MathMark", to - FENCE.length, to))
    cx.nextLine()
  }

  cx.addElement(cx.elt("BlockMath", from, to, marks))

  return true
}

const inlineMath: InlineParser = {
  name: "InlineMath",
  parse: parseInlineMath,
  before: "Emphasis",
}

const blockMath: BlockParser = {
  name: "BlockMath",
  parse: parseBlockMath,
  endLeaf: (_cx, line) => opensBlock(line),
  before: "FencedCode",
}

export const mathSyntax: MarkdownConfig = {
  defineNodes: [
    "InlineMath",
    { name: "BlockMath", block: true },
    { name: "MathMark", style: tags.processingInstruction },
  ],
  parseInline: [inlineMath],
  parseBlock: [blockMath],
}

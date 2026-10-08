import { NOTE_SCHEME, notePathOf, noteUrl } from "../bridge"
import { anyFilePath, displayName } from "../vault/paths"

export type Segment = { text: string } | { label: string; path: string }

const CITATION = new RegExp(
  `\\[([^\\]\\n]*)\\]\\((${NOTE_SCHEME}://[^)\\s]+)\\)|(${NOTE_SCHEME}://\\S+)`,
  "g",
)

export const citeUrl = noteUrl

export const citeLink = (path: string) =>
  `[${displayName(path)}](${citeUrl(path)})`

export const citedPath = (url: string): string | null => {
  const path = notePathOf(url)

  return path && anyFilePath(path) === path ? path : null
}

export const segments = (text: string): Segment[] => {
  const parts: Segment[] = []
  let last = 0

  for (const match of text.matchAll(CITATION)) {
    const path = citedPath(match[2] ?? match[3])

    if (!path) {
      continue
    }

    parts.push({ text: text.slice(last, match.index) })
    parts.push({ label: match[1] || displayName(path), path })
    last = match.index + match[0].length
  }

  parts.push({ text: text.slice(last) })

  return parts.filter(part => !("text" in part) || part.text !== "")
}

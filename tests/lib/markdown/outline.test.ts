import { describe, expect, test } from "bun:test"
import { outline } from "../../../src/lib/markdown/outline"

describe("outline", () => {
  test("lists headings with their line numbers and skips code fences", () => {
    const text = ["# 하나", "본문", "```", "# 코드", "```", "## 둘 ##"].join(
      "\n",
    )

    expect(outline(text)).toEqual([
      { level: 1, text: "하나", line: 1 },
      { level: 2, text: "둘", line: 6 },
    ])
  })
})

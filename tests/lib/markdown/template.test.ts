import { describe, expect, test } from "bun:test"
import { fillTemplate } from "../../../src/lib/markdown/template"

describe("fillTemplate", () => {
  test("replaces title, date and time", () => {
    const now = new Date(2026, 8, 29, 7, 5)

    expect(
      fillTemplate("# {{title}} {{date}} {{time}} {{title}}", "회의", now),
    ).toBe("# 회의 2026-09-29 07:05 회의")
  })
})

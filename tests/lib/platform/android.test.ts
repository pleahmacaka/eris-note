import { describe, expect, test } from "bun:test"
import { occurrences } from "../../../src/lib/data/calendar"
import type { CalendarEvent } from "../../../src/lib/data/types"
import { mirrored } from "../../../src/lib/platform/android"

const event = (over: Partial<CalendarEvent>): CalendarEvent => ({
  id: "e",
  title: "e",
  notes: "",
  start: "2026-10-08",
  end: "2026-10-09",
  allDay: true,
  color: null,
  reminderMinutes: null,
  recurrence: "none",
  createdAt: 0,
  updatedAt: 0,
  ...over,
})

describe("mirrored", () => {
  test("all-day spans UTC midnights with an exclusive end", () => {
    const row = mirrored(event({}))

    expect(row.start).toBe(Date.UTC(2026, 9, 8))
    expect(row.end).toBe(Date.UTC(2026, 9, 10))
    expect(row.key).toBe("e@2026-10-08")
  })

  test("a recurring occurrence is keyed by its series date", () => {
    const [first] = occurrences(
      event({
        recurrence: "monthly",
        shift: "next",
        start: "2026-10-25",
        end: "2026-10-25",
      }),
      new Date(2026, 9, 1),
      new Date(2026, 10, 1),
    )

    expect(mirrored(first).key).toBe("e@2026-10-25")
    expect(mirrored(first).start).toBe(Date.UTC(2026, 9, 26))
  })

  test("timed events keep local wall time", () => {
    const row = mirrored(
      event({
        allDay: false,
        start: "2026-10-08T14:00",
        end: "2026-10-08T15:30",
      }),
    )

    expect(row.end - row.start).toBe(90 * 60_000)
    expect(row.start).toBe(new Date(2026, 9, 8, 14).getTime())
  })
})

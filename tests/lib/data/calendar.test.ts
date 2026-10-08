import { describe, expect, test } from "bun:test"
import {
  dateKey,
  eventsOn,
  formatRange,
  isDone,
  monthGrid,
  notesShared,
  occurrences,
  parseQuickEvent,
  upcoming,
} from "../../../src/lib/data/calendar"
import type { CalendarEvent } from "../../../src/lib/data/types"

const now = new Date(2026, 8, 2, 10, 0)

const event = (over: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: "e",
  title: "e",
  notes: "",
  start: "2026-09-02T09:00",
  end: "2026-09-02T10:00",
  allDay: false,
  color: null,
  reminderMinutes: null,
  recurrence: "none",
  createdAt: 0,
  updatedAt: 0,
  ...over,
})

const on = (events: CalendarEvent[], day: string) =>
  eventsOn(events, new Date(`${day}T12:00`))

describe("monthGrid", () => {
  test("six weeks of seven days", () => {
    const grid = monthGrid(2026, 8, 1)

    expect(grid).toHaveLength(6)
    expect(grid.every(week => week.length === 7)).toBe(true)
  })

  test("starts on the configured weekday", () => {
    expect(dateKey(monthGrid(2026, 8, 1)[0][0])).toBe("2026-08-31")
    expect(dateKey(monthGrid(2026, 8, 0)[0][0])).toBe("2026-08-30")
    expect(dateKey(monthGrid(2026, 8, 1)[5][6])).toBe("2026-10-11")
  })
})

describe("eventsOn", () => {
  test("single event only on its day", () => {
    const list = [event()]

    expect(on(list, "2026-09-02")).toHaveLength(1)
    expect(on(list, "2026-09-03")).toHaveLength(0)
  })

  test("multi-day all-day event spans inclusive end", () => {
    const list = [
      event({ allDay: true, start: "2026-09-02", end: "2026-09-04" }),
    ]

    expect(on(list, "2026-09-01")).toHaveLength(0)
    expect(on(list, "2026-09-04")).toHaveLength(1)
    expect(on(list, "2026-09-05")).toHaveLength(0)
  })

  test("daily shifts start and end", () => {
    const [hit] = on([event({ recurrence: "daily" })], "2026-09-10")

    expect(hit.start).toBe("2026-09-10T09:00")
    expect(hit.end).toBe("2026-09-10T10:00")
    expect(on([event({ recurrence: "daily" })], "2026-09-01")).toHaveLength(0)
  })

  test("weekdays skip weekends", () => {
    const list = [event({ recurrence: "weekdays" })]

    expect(on(list, "2026-09-04")).toHaveLength(1)
    expect(on(list, "2026-09-05")).toHaveLength(0)
    expect(on(list, "2026-09-06")).toHaveLength(0)
    expect(on(list, "2026-09-07")).toHaveLength(1)
  })

  test("a years-old recurrence keeps every occurrence", () => {
    const old = { start: "2015-01-05T09:00", end: "2015-01-05T10:00" }
    const from = (recurrence: CalendarEvent["recurrence"]) => [
      event({ recurrence, ...old }),
    ]

    expect(on(from("weekdays"), "2015-01-05")).toHaveLength(1)
    expect(on(from("weekdays"), "2026-09-04")).toHaveLength(1)
    expect(on(from("weekdays"), "2026-09-05")).toHaveLength(0)
    expect(on(from("monthly"), "2026-09-05")).toHaveLength(1)
    expect(on(from("monthly"), "2026-09-06")).toHaveLength(0)
    expect(on(from("yearly"), "2027-01-05")).toHaveLength(1)
  })

  test("weekly lands on the same weekday", () => {
    const list = [event({ recurrence: "weekly" })]

    expect(on(list, "2026-09-09")).toHaveLength(1)
    expect(on(list, "2026-09-10")).toHaveLength(0)
    expect(on(list, "2027-03-03")).toHaveLength(1)
  })

  test("monthly clamps to the last day", () => {
    const list = [
      event({
        recurrence: "monthly",
        start: "2026-01-31T09:00",
        end: "2026-01-31T10:00",
      }),
    ]

    expect(on(list, "2026-02-28")).toHaveLength(1)
    expect(on(list, "2026-03-31")).toHaveLength(1)
    expect(on(list, "2026-03-03")).toHaveLength(0)
  })

  test("yearly", () => {
    const list = [event({ recurrence: "yearly" })]

    expect(on(list, "2027-09-02")).toHaveLength(1)
    expect(on(list, "2027-09-03")).toHaveLength(0)
  })

  test("all-day first, then by start", () => {
    const list = [
      event({ id: "late", start: "2026-09-02T14:00", end: "2026-09-02T15:00" }),
      event({ id: "early" }),
      event({
        id: "day",
        allDay: true,
        start: "2026-09-02",
        end: "2026-09-02",
      }),
    ]

    expect(on(list, "2026-09-02").map(e => e.id)).toEqual([
      "day",
      "early",
      "late",
    ])
  })
})

describe("upcoming", () => {
  test("collects occurrences within the window in order", () => {
    const list = [
      event({ id: "daily", recurrence: "daily" }),
      event({
        id: "once",
        start: "2026-09-03T08:00",
        end: "2026-09-03T08:30",
      }),
    ]

    const from = new Date(2026, 8, 2, 8, 0)

    expect(upcoming(list, from, 2).map(e => `${e.id}@${e.start}`)).toEqual([
      "daily@2026-09-02T09:00",
      "once@2026-09-03T08:00",
      "daily@2026-09-03T09:00",
    ])
  })
})

describe("parseQuickEvent", () => {
  test("title only becomes all-day today", () => {
    expect(parseQuickEvent("Lunch", now)).toEqual({
      title: "Lunch",
      allDay: true,
      start: "2026-09-02",
      end: "2026-09-02",
    })
  })

  test("day plus time defaults to one hour", () => {
    expect(parseQuickEvent("Dentist tomorrow 3pm", now)).toEqual({
      title: "Dentist",
      allDay: false,
      start: "2026-09-03T15:00",
      end: "2026-09-03T16:00",
    })
  })

  test("weekday with range", () => {
    expect(parseQuickEvent("Standup mon 9:30-10", now)).toEqual({
      title: "Standup",
      allDay: false,
      start: "2026-09-07T09:30",
      end: "2026-09-07T10:00",
    })
  })

  test("meridiem on the end applies to the start", () => {
    expect(parseQuickEvent("Review 1-2pm", now)).toMatchObject({
      start: "2026-09-02T13:00",
      end: "2026-09-02T14:00",
    })
    expect(parseQuickEvent("Review 11-1pm", now)).toMatchObject({
      start: "2026-09-02T11:00",
      end: "2026-09-02T13:00",
    })
  })

  test("end before start rolls to the afternoon", () => {
    expect(parseQuickEvent("Lunch 11-1", now)).toMatchObject({
      start: "2026-09-02T11:00",
      end: "2026-09-02T13:00",
    })
  })

  test("explicit date and 24h time", () => {
    expect(parseQuickEvent("Flight 2026-12-24 06:45", now)).toMatchObject({
      title: "Flight",
      start: "2026-12-24T06:45",
      end: "2026-12-24T07:45",
    })
  })

  test("hyphenated words stay in the title", () => {
    expect(parseQuickEvent("Check-in follow-up", now).title).toBe(
      "Check-in follow-up",
    )
  })
})

describe("formatRange", () => {
  test("all day", () => {
    expect(
      formatRange(
        event({ allDay: true, start: "2026-09-02", end: "2026-09-02" }),
      ),
    ).toBe("All day")
  })

  test("same day times", () => {
    expect(formatRange(event())).toMatch(/^9:00\sAM – 10:00\sAM$/)
  })
})

describe("series rules shared with Eris", () => {
  const monthly = event({
    start: "2026-09-25",
    end: "2026-09-25",
    allDay: true,
    recurrence: "monthly",
  })

  const keys = (e: CalendarEvent, from: string, to: string) =>
    occurrences(e, new Date(`${from}T00:00`), new Date(`${to}T00:00`)).map(
      o => o.start,
    )

  test("exdates drop a single occurrence", () => {
    expect(
      keys({ ...monthly, exdates: ["2026-10-25"] }, "2026-09-01", "2026-12-01"),
    ).toEqual(["2026-09-25", "2026-11-25"])
  })

  test("until ends the series inclusively", () => {
    expect(
      keys({ ...monthly, until: "2026-10-25" }, "2026-09-01", "2027-01-01"),
    ).toEqual(["2026-09-25", "2026-10-25"])
  })

  test("shift next moves a weekend occurrence to monday", () => {
    const found = occurrences(
      { ...monthly, shift: "next" },
      new Date(2026, 9, 1),
      new Date(2026, 10, 1),
    )

    expect(found.map(o => [o.start, o.seriesDate, o.shiftedFrom])).toEqual([
      ["2026-10-26", "2026-10-25", "2026-10-25"],
    ])
  })

  test("shift previous honors a holiday check", () => {
    const holiday = (d: Date) => dateKey(d) === "2026-11-25"
    const found = occurrences(
      { ...monthly, shift: "previous" },
      new Date(2026, 10, 1),
      new Date(2026, 11, 1),
      holiday,
    )

    expect(found.map(o => o.start)).toEqual(["2026-11-24"])
  })

  test("done is keyed by the series date of a shifted occurrence", () => {
    const [moved] = occurrences(
      { ...monthly, shift: "next", task: true, done: ["2026-10-25"] },
      new Date(2026, 9, 1),
      new Date(2026, 10, 1),
    )

    expect(isDone(moved)).toBe(true)
  })
})

describe("notesShared", () => {
  const series = event({ id: "s", recurrence: "weekly", notesSync: true })
  const child = event({ id: "c", seriesId: "s", originalDate: "2026-09-09" })

  test("copies edited notes across a synced series", () => {
    const edited = { ...child, notes: "memo" }
    const out = notesShared(edited, [series, edited], 5)

    expect(out.map(e => [e.id, e.notes, e.updatedAt])).toEqual([
      ["s", "memo", 5],
    ])
  })

  test("leaves an unsynced series alone", () => {
    const edited = { ...series, notesSync: false, notes: "memo" }

    expect(notesShared(edited, [edited, child], 5)).toEqual([])
  })
})

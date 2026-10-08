import type { CalendarEvent, Occurrence, Recurrence } from "./types"

export type HolidayCheck = (day: Date) => boolean

const DAY = 86_400_000
const SHIFT_LIMIT = 14
const SHIFTABLE: Recurrence[] = ["weekly", "monthly", "yearly"]
const DAY_NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]
const FULL_DAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
]

export type Meridiem = "am" | "pm" | null

export type Time = { hours: number; minutes: number; meridiem: Meridiem }

const pad = (n: number) => String(n).padStart(2, "0")

export const dateKey = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const dateTimeKey = (d: Date) =>
  `${dateKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`

// date-only ISO strings parse as UTC midnight; all-day dates must stay local
export const parseLocal = (value: string) => {
  if (value.length === 10) {
    const [year, month, day] = value.split("-").map(Number)

    return new Date(year, month - 1, day)
  }

  return new Date(value)
}

export const startOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate())

export const addDays = (d: Date, n: number) => {
  const next = new Date(d)
  next.setDate(next.getDate() + n)

  return next
}

const shiftMonths = (origin: Date, months: number) => {
  const next = new Date(
    origin.getFullYear(),
    origin.getMonth() + months,
    1,
    origin.getHours(),
    origin.getMinutes(),
  )
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
  next.setDate(Math.min(origin.getDate(), lastDay))

  return next
}

const shiftStart = (recurrence: Recurrence, origin: Date, n: number) => {
  switch (recurrence) {
    case "weekly":
      return addDays(origin, 7 * n)
    case "monthly":
      return shiftMonths(origin, n)
    case "yearly":
      return shiftMonths(origin, 12 * n)
    default:
      return addDays(origin, n)
  }
}

const monthsBetween = (origin: Date, target: Date) =>
  (target.getFullYear() - origin.getFullYear()) * 12 +
  target.getMonth() -
  origin.getMonth()

const firstStep = (
  recurrence: Recurrence,
  origin: Date,
  duration: number,
  from: Date,
) => {
  const target = new Date(from.getTime() - duration)
  const gap = target.getTime() - origin.getTime()

  if (gap <= 0) {
    return 0
  }

  const steps =
    recurrence === "weekly"
      ? gap / (7 * DAY)
      : recurrence === "daily" || recurrence === "weekdays"
        ? gap / DAY
        : recurrence === "monthly"
          ? monthsBetween(origin, target)
          : recurrence === "yearly"
            ? monthsBetween(origin, target) / 12
            : 0

  return Math.max(0, Math.floor(steps) - 1)
}

const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6

const restDay = (d: Date, isHoliday?: HolidayCheck) =>
  isWeekend(d) || (isHoliday?.(d) ?? false)

const moveOff = (d: Date, step: 1 | -1, isHoliday?: HolidayCheck) => {
  let moved = d

  for (let i = 0; i < SHIFT_LIMIT && restDay(moved, isHoliday); i++) {
    moved = addDays(moved, step)
  }

  return moved
}

const shiftStep = (event: CalendarEvent) =>
  !SHIFTABLE.includes(event.recurrence)
    ? 0
    : event.shift === "next"
      ? 1
      : event.shift === "previous"
        ? -1
        : 0

const span = (event: CalendarEvent) => {
  const start = parseLocal(event.start)
  const rawEnd = parseLocal(event.end)
  const end = event.allDay
    ? addDays(startOfDay(rawEnd < start ? start : rawEnd), 1)
    : rawEnd < start
      ? start
      : rawEnd

  return { start, end }
}

const inWindow = (start: Date, end: Date, from: Date, to: Date) =>
  start < to && (end > from || start >= from)

const occurrenceOf = (
  event: CalendarEvent,
  start: Date,
  end: Date,
): Occurrence => ({
  ...event,
  start: event.allDay ? dateKey(start) : dateTimeKey(start),
  end: event.allDay ? dateKey(addDays(end, -1)) : dateTimeKey(end),
})

// mirrors Eris's packages/data occurrences(); both apps must expand a series identically
export const occurrences = (
  event: CalendarEvent,
  from: Date,
  to: Date,
  isHoliday?: HolidayCheck,
): Occurrence[] => {
  const origin = span(event)
  const duration = origin.end.getTime() - origin.start.getTime()

  if (Number.isNaN(duration)) {
    return []
  }

  if (event.recurrence === "none") {
    return inWindow(origin.start, origin.end, from, to) ? [event] : []
  }

  const found: Occurrence[] = []
  const days = Math.round(duration / DAY)
  const excluded = new Set(event.exdates ?? [])
  const step = shiftStep(event)
  const horizon = step < 0 ? addDays(to, SHIFT_LIMIT) : to
  const lookback = duration + (step > 0 ? SHIFT_LIMIT * DAY : 0)

  for (
    let n = firstStep(event.recurrence, origin.start, lookback, from);
    ;
    n++
  ) {
    const raw = shiftStart(event.recurrence, origin.start, n)
    const key = dateKey(raw)

    if (raw >= horizon || (event.until && key > event.until)) {
      break
    }

    if (
      excluded.has(key) ||
      (event.recurrence === "weekdays" && isWeekend(raw))
    ) {
      continue
    }

    const moved =
      step !== 0 && restDay(raw, isHoliday)
        ? moveOff(raw, step > 0 ? 1 : -1, isHoliday)
        : raw
    const neighbor = startOfDay(
      shiftStart(event.recurrence, origin.start, n + step),
    )

    // a long holiday run must not push one occurrence onto its neighbor's day
    if (
      moved !== raw &&
      (step > 0 ? moved >= neighbor : moved < addDays(neighbor, 1))
    ) {
      continue
    }

    const end = event.allDay
      ? addDays(moved, days)
      : new Date(moved.getTime() + duration)

    if (!inWindow(moved, end, from, to)) {
      continue
    }

    found.push({
      ...occurrenceOf(event, moved, end),
      seriesDate: key,
      ...(moved === raw ? {} : { shiftedFrom: key }),
    })
  }

  return found
}

export const notesShared = (
  edited: CalendarEvent,
  all: CalendarEvent[],
  stamp: number,
): CalendarEvent[] => {
  const seriesId = edited.seriesId ?? edited.id
  const series = all.find(e => e.id === seriesId)

  if (!series?.notesSync) {
    return []
  }

  return all
    .filter(
      e => (e.id === seriesId || e.seriesId === seriesId) && e.id !== edited.id,
    )
    .filter(e => e.notes !== edited.notes)
    .map(e => ({ ...e, notes: edited.notes, updatedAt: stamp }))
}

// recurring occurrences are keyed by their series date, which a holiday shift never moves
export const occurrenceKey = (event: Occurrence) =>
  event.seriesDate ?? dateKey(parseLocal(event.start))

export const isDone = (event: Occurrence) =>
  event.task === true && (event.done ?? []).includes(occurrenceKey(event))

const byStart = (a: CalendarEvent, b: CalendarEvent) =>
  Number(b.allDay) - Number(a.allDay) ||
  parseLocal(a.start).getTime() - parseLocal(b.start).getTime()

export const monthGrid = (
  year: number,
  month: number,
  weekStartsOn: 0 | 1,
): Date[][] => {
  const first = new Date(year, month, 1)
  const offset = (first.getDay() - weekStartsOn + 7) % 7
  const start = addDays(first, -offset)

  return Array.from({ length: 6 }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => addDays(start, week * 7 + day)),
  )
}

export const eventsOn = (
  events: CalendarEvent[],
  date: Date,
  isHoliday?: HolidayCheck,
) => {
  const from = startOfDay(date)
  const to = addDays(from, 1)

  return events.flatMap(e => occurrences(e, from, to, isHoliday)).sort(byStart)
}

export const upcoming = (
  events: CalendarEvent[],
  from: Date,
  days: number,
  isHoliday?: HolidayCheck,
) => {
  const to = addDays(from, days)

  return events.flatMap(e => occurrences(e, from, to, isHoliday)).sort(byStart)
}

const formatTime = (d: Date) =>
  d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })

const formatDay = (d: Date) =>
  d.toLocaleDateString("en-US", { month: "short", day: "numeric" })

export const formatRange = (event: CalendarEvent) => {
  const start = parseLocal(event.start)
  const end = parseLocal(event.end)
  const sameDay = dateKey(start) === dateKey(end)

  if (event.allDay) {
    return sameDay ? "All day" : `${formatDay(start)} – ${formatDay(end)}`
  }

  if (sameDay) {
    return `${formatTime(start)} – ${formatTime(end)}`
  }

  return `${formatDay(start)} ${formatTime(start)} – ${formatDay(end)} ${formatTime(end)}`
}

export const parseDay = (token: string, now: Date): Date | null => {
  const word = token.toLowerCase()
  const today = startOfDay(now)

  if (word === "today") {
    return today
  }

  if (word === "tomorrow") {
    return addDays(today, 1)
  }

  const weekday = Math.max(
    DAY_NAMES.indexOf(word),
    FULL_DAY_NAMES.indexOf(word),
  )

  if (weekday >= 0) {
    return addDays(today, ((weekday - today.getDay() + 6) % 7) + 1)
  }

  if (word.length === 10 && word.split("-").length === 3) {
    const parsed = parseLocal(word)

    return dateKey(parsed) === word ? parsed : null
  }

  return null
}

export const parseTime = (token: string, allowBare = false): Time | null => {
  const word = token.toLowerCase()
  const meridiem: Meridiem = word.endsWith("am")
    ? "am"
    : word.endsWith("pm")
      ? "pm"
      : null
  const digits = meridiem ? word.slice(0, -2) : word

  if (!meridiem && !digits.includes(":") && !allowBare) {
    return null
  }

  const [hoursText, minutesText = "0", extra] = digits.split(":")

  if (extra !== undefined || !/^\d{1,2}$/.test(hoursText)) {
    return null
  }

  if (minutesText !== "0" && !/^\d{2}$/.test(minutesText)) {
    return null
  }

  const hours = Number(hoursText)
  const minutes = Number(minutesText)

  if (hours > 23 || minutes > 59 || (meridiem && hours > 12)) {
    return null
  }

  return { hours, minutes, meridiem }
}

const toMinutes = (time: Time) => {
  const hours =
    time.meridiem === "pm" && time.hours < 12
      ? time.hours + 12
      : time.meridiem === "am" && time.hours === 12
        ? 0
        : time.hours

  return hours * 60 + time.minutes
}

export const parseTimeRange = (token: string) => {
  const [first, second, extra] = token.toLowerCase().split("-")

  if (extra !== undefined || !first) {
    return null
  }

  const start = parseTime(first, second !== undefined)

  if (!start) {
    return null
  }

  if (second === undefined) {
    return { start, end: null }
  }

  const end = parseTime(second, true)

  return end ? { start, end } : null
}

export const resolveRange = (start: Time, end: Time | null) => {
  let startMinutes = toMinutes(start)

  if (!end) {
    return { start: startMinutes, end: startMinutes + 60 }
  }

  let endMinutes = toMinutes(end)

  if (
    !start.meridiem &&
    end.meridiem === "pm" &&
    startMinutes < 12 * 60 &&
    startMinutes + 12 * 60 <= endMinutes
  ) {
    startMinutes += 12 * 60
  }

  if (!end.meridiem && endMinutes < startMinutes) {
    endMinutes += 12 * 60
  }

  if (endMinutes < startMinutes) {
    endMinutes = toMinutes(end) + 24 * 60
  } else if (endMinutes === startMinutes) {
    endMinutes = startMinutes + 60
  }

  return { start: startMinutes, end: endMinutes }
}

export const atMinutes = (day: Date, minutes: number) =>
  new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    Math.floor(minutes / 60),
    minutes % 60,
  )

export const parseQuickEvent = (
  text: string,
  now = new Date(),
): Partial<CalendarEvent> => {
  const words: string[] = []
  let day: Date | null = null
  let range: { start: Time; end: Time | null } | null = null

  for (const token of text.trim().split(" ").filter(Boolean)) {
    const parsedDay = parseDay(token, now)

    if (parsedDay) {
      day = parsedDay
      continue
    }

    const parsedRange = parseTimeRange(token)

    if (parsedRange) {
      range = parsedRange
      continue
    }

    words.push(token)
  }

  const title = words.join(" ")
  const base = day ?? startOfDay(now)

  if (!range) {
    return { title, allDay: true, start: dateKey(base), end: dateKey(base) }
  }

  const minutes = resolveRange(range.start, range.end)

  return {
    title,
    allDay: false,
    start: dateTimeKey(atMinutes(base, minutes.start)),
    end: dateTimeKey(atMinutes(base, minutes.end)),
  }
}

import {
  addDays,
  dateKey,
  occurrences,
  parseLocal,
  startOfDay,
} from "../data/calendar"
import { holidayCheck, loadHolidays } from "../data/holidays"
import { events } from "../data/store"
import type { CalendarEvent, Occurrence } from "../data/types"

type Bridge = {
  calendarAccess(): boolean
  requestCalendar(): void
  mirror(json: string): void
}

type Mirrored = {
  key: string
  title: string
  notes: string
  start: number
  end: number
  allDay: boolean
}

const PAST_DAYS = 40
const FUTURE_DAYS = 400
const DEBOUNCE = 800
const ASKED = "arixlab-note:calendar-asked"

const bridge = () => (globalThis as { NoteAndroid?: Bridge }).NoteAndroid

const utcDay = (key: string) => {
  const [year, month, day] = key.split("-").map(Number)

  return Date.UTC(year, month - 1, day)
}

export const mirrored = (event: Occurrence): Mirrored => {
  const key = `${event.id}@${event.seriesDate ?? event.start.slice(0, 10)}`

  if (event.allDay) {
    return {
      key,
      title: event.title,
      notes: event.notes,
      start: utcDay(event.start),
      end: utcDay(dateKey(addDays(parseLocal(event.end), 1))),
      allDay: true,
    }
  }

  const start = parseLocal(event.start).getTime()

  return {
    key,
    title: event.title,
    notes: event.notes,
    start,
    end: Math.max(start, parseLocal(event.end).getTime()),
    allDay: false,
  }
}

const snapshot = (
  items: CalendarEvent[],
  weekStartsMonday: boolean,
  isHoliday?: (day: Date) => boolean,
) => {
  const today = startOfDay(new Date())
  const from = addDays(today, -PAST_DAYS)
  const to = addDays(today, FUTURE_DAYS)

  return JSON.stringify({
    weekStartsMonday,
    events: items
      .flatMap(e => occurrences(e, from, to, isHoliday))
      .map(mirrored),
  })
}

export const startCalendarMirror = (weekStartsMonday: boolean) => {
  const android = bridge()

  if (!android) {
    return () => undefined
  }

  if (!android.calendarAccess() && localStorage.getItem(ASKED) === null) {
    localStorage.setItem(ASKED, "1")
    android.requestCalendar()
  }

  let timer: ReturnType<typeof setTimeout> | undefined
  let isHoliday: ((day: Date) => boolean) | undefined
  let latest: CalendarEvent[] = []

  const push = () => {
    clearTimeout(timer)
    timer = setTimeout(
      () => android.mirror(snapshot(latest, weekStartsMonday, isHoliday)),
      DEBOUNCE,
    )
  }

  const stop = events.subscribe(items => {
    latest = items

    if (isHoliday || !items.some(e => e.shift)) {
      push()

      return
    }

    loadHolidays().then(() => {
      isHoliday = holidayCheck()
      push()
    })
  })

  return () => {
    clearTimeout(timer)
    stop()
  }
}

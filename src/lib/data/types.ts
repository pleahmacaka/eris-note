export type Priority = 0 | 1 | 2 | 3

export type Todo = {
  id: string
  title: string
  notes: string
  done: boolean
  doneAt: number | null
  priority: Priority
  due: string | null
  tags: string[]
  order: number
  createdAt: number
  updatedAt: number
}

export type Recurrence =
  | "none"
  | "daily"
  | "weekdays"
  | "weekly"
  | "monthly"
  | "yearly"

export type Shift = "next" | "previous"

export type CalendarEvent = {
  id: string
  title: string
  notes: string
  start: string
  end: string
  allDay: boolean
  color: string | null
  reminderMinutes: number | null
  recurrence: Recurrence
  order?: number
  tags?: string[]
  parentId?: string | null
  exdates?: string[]
  until?: string | null
  shift?: Shift
  seriesId?: string | null
  originalDate?: string | null
  task?: boolean
  done?: string[]
  notesSync?: boolean
  group?: string | null
  createdAt: number
  updatedAt: number
}

export type Occurrence = CalendarEvent & {
  seriesDate?: string
  shiftedFrom?: string
}

export type Note = {
  id: string
  title: string
  body: string
  pinned: boolean
  color: string | null
  createdAt: number
  updatedAt: number
}

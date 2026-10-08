import type Holidays from "date-holidays"
import type { HolidayCheck } from "./calendar"

let Engine: typeof Holidays | null = null

let loading: Promise<void> | null = null

const engines = new Map<string, Holidays>()

const SEOLLAL = {
  name: { ko: "설날", en: "Korean New Year" },
  type: "public" as const,
}

// every country's rules ship in one 1.4 MB module, so it loads only when a calendar needs it
export const loadHolidays = () => {
  loading ??= import("date-holidays").then(module => {
    Engine = module.default
  })

  return loading
}

const engine = (country: string) => {
  if (!Engine) {
    return null
  }

  let hd = engines.get(country)

  if (!hd) {
    hd = new Engine(country)

    // date-holidays starts the 3-day Seollal span on the new year day; the law starts it on the eve
    if (country === "KR" && hd.unsetRule("korean 01-0-01 P3D")) {
      hd.setHoliday("1 day before korean 01-0-01 P3D", SEOLLAL)
    }

    engines.set(country, hd)
  }

  return hd
}

export const systemRegion = () => {
  const candidates = [
    Intl.DateTimeFormat().resolvedOptions().locale,
    ...(globalThis.navigator?.languages ?? []),
  ]

  for (const tag of candidates) {
    try {
      const region = new Intl.Locale(tag).maximize().region

      if (region) {
        return region
      }
    } catch {}
  }

  return "US"
}

const pad = (n: number) => String(n).padStart(2, "0")

export const holidayCheck =
  (region = systemRegion()): HolidayCheck =>
  day => {
    try {
      // a Date is shifted into the region's timezone and can land on the previous day
      const found = engine(region)?.isHoliday(
        `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`,
      )

      return (found || []).some(holiday => holiday.type === "public")
    } catch {
      return false
    }
  }

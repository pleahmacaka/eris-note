import { isRecord } from "./data/guards"
import type { Appearance, ThemeMode } from "./settings"

export const STYLE_TOKENS = [
  "base-100",
  "base-200",
  "base-300",
  "base-content",
  "primary",
  "primary-content",
  "secondary",
  "secondary-content",
  "accent",
  "accent-content",
  "neutral",
  "neutral-content",
] as const

export type StyleToken = (typeof STYLE_TOKENS)[number]

export type FollowedStyle = {
  mode: "dark" | "light"
  colors: Partial<Record<StyleToken, string>>
}

const isToken = (value: string): value is StyleToken =>
  (STYLE_TOKENS as readonly string[]).includes(value)

export const readStyle = (text: string): FollowedStyle | null => {
  let parsed: unknown

  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }

  if (
    !isRecord(parsed) ||
    parsed.version !== 1 ||
    parsed.follow !== true ||
    (parsed.mode !== "dark" && parsed.mode !== "light") ||
    !isRecord(parsed.colors)
  ) {
    return null
  }

  const colors: FollowedStyle["colors"] = {}

  for (const [token, color] of Object.entries(parsed.colors)) {
    if (!isToken(token) || typeof color !== "string") {
      continue
    }

    colors[token] = color
  }

  return { mode: parsed.mode, colors }
}

export const resolveMode = (mode: ThemeMode): "dark" | "light" => {
  if (mode !== "system") {
    return mode
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light"
}

export const applyAppearance = (
  appearance: Appearance,
  followed: FollowedStyle | null,
) => {
  const root = document.documentElement
  const mode = followed?.mode ?? resolveMode(appearance.mode)

  root.dataset.theme = mode === "light" ? "arixlab-light" : "arixlab"
  root.dataset.mode = mode
  root.style.setProperty("--font-scale", String(appearance.fontScale))

  for (const token of STYLE_TOKENS) {
    const color = followed?.colors[token]

    if (color === undefined) {
      root.style.removeProperty(`--color-${token}`)
    } else {
      root.style.setProperty(`--color-${token}`, color)
    }
  }
}

import filenamify from "filenamify/browser"

export const NOTE_EXTENSIONS = [".md", ".mdx"] as const

export const TEXT_EXTENSIONS = [...NOTE_EXTENSIONS, ".canvas"] as const

const IMAGE_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".avif",
  ".bmp",
  ".svg",
]

const DRIVE = /^[a-z]:/i

const extensionOf = (path: string) => {
  const name = basename(path)
  const dot = name.lastIndexOf(".")

  return dot <= 0 ? "" : name.slice(dot).toLowerCase()
}

const validSegments = (path: string) =>
  path
    .split("/")
    .every(
      segment =>
        segment !== "" &&
        !segment.startsWith(".") &&
        !segment.endsWith(".") &&
        !segment.includes("\\") &&
        !segment.includes(":") &&
        segment.trim() === segment,
    )

export const folderPath = (input: string): string | null => {
  const path = input.normalize("NFC")

  if (path === "") {
    return ""
  }

  if (path.startsWith("/") || DRIVE.test(path) || !validSegments(path)) {
    return null
  }

  return path
}

export const anyFilePath = (input: string): string | null =>
  folderPath(input) || null

export const filePath = (input: string): string | null => {
  const path = folderPath(input)

  if (
    !path ||
    !(TEXT_EXTENSIONS as readonly string[]).includes(extensionOf(path))
  ) {
    return null
  }

  return path
}

export const isNote = (path: string) =>
  (NOTE_EXTENSIONS as readonly string[]).includes(extensionOf(path))

export const isCanvas = (path: string) => extensionOf(path) === ".canvas"

export const isText = (path: string) =>
  (TEXT_EXTENSIONS as readonly string[]).includes(extensionOf(path))

export const isPdf = (path: string) => extensionOf(path) === ".pdf"

export const isImage = (path: string) =>
  IMAGE_EXTENSIONS.includes(extensionOf(path))

export const displayName = (path: string) =>
  isText(path) ? stem(path) : basename(path)

export const fileIcon = (path: string) =>
  isNote(path)
    ? "lucide:file-text"
    : isCanvas(path)
      ? "lucide:layout-dashboard"
      : isPdf(path)
        ? "lucide:file-type"
        : isImage(path)
          ? "lucide:file-image"
          : "lucide:file"

export const basename = (path: string) => path.slice(path.lastIndexOf("/") + 1)

export const dirname = (path: string) => {
  const slash = path.lastIndexOf("/")

  return slash === -1 ? "" : path.slice(0, slash)
}

export const stem = (path: string) => {
  const name = basename(path)
  const dot = name.lastIndexOf(".")

  return dot <= 0 ? name : name.slice(0, dot)
}

export const extension = extensionOf

export const join = (...parts: string[]) => parts.filter(Boolean).join("/")

export const safeName = (name: string) =>
  filenamify(name.normalize("NFC").trim(), { replacement: "-" })
    .replace(/^\.+/, "")
    .trim()

export const sameIgnoringCase = (a: string, b: string) =>
  a.toLocaleLowerCase() === b.toLocaleLowerCase()

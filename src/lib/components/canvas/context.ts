import { createContext } from "svelte"

export type CanvasContext = {
  readonly path: string
  readonly editing: string | null
  edit: (id: string | null) => void
  addTextAt: (event: MouseEvent) => void
  showEdgeMenu: (event: MouseEvent, id: string) => void
}

export const [useCanvas, provideCanvas] = createContext<CanvasContext>()

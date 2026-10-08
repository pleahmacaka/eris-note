import * as pdfjs from "pdfjs-dist"
import worker from "pdfjs-dist/build/pdf.worker.min.mjs?url"

pdfjs.GlobalWorkerOptions.workerSrc = worker

// pdf_viewer.mjs reads the core library from this global instead of importing it
;(globalThis as { pdfjsLib?: typeof pdfjs }).pdfjsLib = pdfjs

const ASSETS = "/pdfjs"

export const openPdf = (data: Uint8Array) =>
  pdfjs.getDocument({
    data,
    cMapUrl: `${ASSETS}/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${ASSETS}/standard_fonts/`,
    wasmUrl: `${ASSETS}/wasm/`,
    iccUrl: `${ASSETS}/iccs/`,
  })

export const viewerModule = () => import("pdfjs-dist/web/pdf_viewer.mjs")

export const renderFirstPage = async (
  data: Uint8Array,
  canvas: HTMLCanvasElement,
  width: number,
) => {
  const task = openPdf(data)
  const doc = await task.promise

  try {
    const page = await doc.getPage(1)
    const base = page.getViewport({ scale: 1 })
    const ratio = globalThis.devicePixelRatio || 1
    const viewport = page.getViewport({ scale: (width / base.width) * ratio })

    canvas.width = viewport.width
    canvas.height = viewport.height
    canvas.style.width = `${width}px`
    await page.render({ canvas, viewport }).promise

    return doc.numPages
  } finally {
    await task.destroy()
  }
}

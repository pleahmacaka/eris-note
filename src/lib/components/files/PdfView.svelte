<script lang="ts">
  import "pdfjs-dist/web/pdf_viewer.css"
  import Icon from "@iconify/svelte"
  import type { PDFDocumentLoadingTask } from "pdfjs-dist"
  import type { PDFViewer } from "pdfjs-dist/web/pdf_viewer.mjs"
  import { onMount } from "svelte"
  import { openExternal } from "$lib/platform/links"
  import { readAttachment } from "$lib/vault/attachments"

  const { path }: { path: string } = $props()

  const STEP = 1.2

  let container: HTMLDivElement
  let viewer = $state.raw<PDFViewer | null>(null)
  let page = $state(1)
  let pages = $state(0)
  let failure = $state("")

  const zoom = (factor: number) => {
    if (viewer) {
      viewer.currentScale = viewer.currentScale * factor
    }
  }

  const fitWidth = () => {
    if (viewer) {
      viewer.currentScaleValue = "page-width"
    }
  }

  const followLinks = (event: MouseEvent) => {
    const link = (event.target as Element).closest<HTMLAnchorElement>("a[href]")

    if (link && /^https?:/i.test(link.href)) {
      event.preventDefault()
      openExternal(link.href)
    }
  }

  onMount(() => {
    let task: PDFDocumentLoadingTask | null = null
    let disposed = false

    const load = async () => {
      const [{ openPdf, viewerModule }, bytes] = await Promise.all([
        import("$lib/vault/pdf"),
        readAttachment(path),
      ])
      const { EventBus, PDFLinkService, PDFViewer } = await viewerModule()

      if (disposed) {
        return
      }

      const eventBus = new EventBus()
      const linkService = new PDFLinkService({ eventBus })
      const next = new PDFViewer({ container, eventBus, linkService })

      linkService.setViewer(next)
      eventBus.on("pagesinit", () => {
        next.currentScaleValue = "page-width"
      })
      eventBus.on("pagechanging", (e: { pageNumber: number }) => {
        page = e.pageNumber
      })

      task = openPdf(bytes)

      const doc = await task.promise

      if (disposed) {
        return
      }

      next.setDocument(doc)
      linkService.setDocument(doc)
      pages = doc.numPages
      viewer = next
    }

    load().catch(error => {
      failure = error instanceof Error ? error.message : String(error)
    })

    return () => {
      disposed = true
      task?.destroy()
    }
  })
</script>

<div class="flex min-h-0 flex-1 flex-col bg-base-200">
  <div
    class="flex shrink-0 items-center gap-1 border-b border-base-content/10 bg-base-100 px-2 py-1"
  >
    <span class="px-2 text-xs tabular-nums text-base-content/60">
      {pages > 0 ? `${page} / ${pages}` : ""}
    </span>

    <div class="flex-1"></div>

    <button
      class="btn btn-ghost btn-square btn-sm"
      aria-label="축소"
      onclick={() => zoom(1 / STEP)}
    >
      <Icon icon="lucide:zoom-out" class="size-4" />
    </button>
    <button
      class="btn btn-ghost btn-square btn-sm"
      aria-label="확대"
      onclick={() => zoom(STEP)}
    >
      <Icon icon="lucide:zoom-in" class="size-4" />
    </button>
    <button
      class="btn btn-ghost btn-square btn-sm"
      aria-label="너비 맞춤"
      onclick={fitWidth}
    >
      <Icon icon="lucide:move-horizontal" class="size-4" />
    </button>
  </div>

  {#if failure}
    <p class="p-6 text-sm text-error">{failure}</p>
  {/if}

  <div class="relative min-h-0 flex-1">
    <div
      bind:this={container}
      class="pdf-scroll absolute inset-0 overflow-auto"
      role="presentation"
      onclick={followLinks}
    >
      <div class="pdfViewer"></div>
    </div>
  </div>
</div>

<style>
  .pdf-scroll :global(.page) {
    box-shadow: 0 0.0625rem 0.25rem rgb(0 0 0 / 0.18);
  }
</style>

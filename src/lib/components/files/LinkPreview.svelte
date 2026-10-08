<script lang="ts">
  import Icon from "@iconify/svelte"
  import { citedPath } from "$lib/markdown/cite"
  import { renderMarkdown } from "@eris/markdown"
  import { attachmentUrl, readAttachment } from "$lib/vault/attachments"
  import { resolveLink } from "$lib/vault/links"
  import {
    displayName,
    fileIcon,
    isImage,
    isNote,
    isPdf,
  } from "$lib/vault/paths"
  import { texts } from "$lib/vault/vault.svelte"
  import { filePaths } from "$lib/workspace/navigate"
  import { focusedTab } from "$lib/workspace/workspace.svelte"

  const DELAY = 350
  const GAP = 8
  const WIDTH = 320
  const HEIGHT = 280
  const EXCERPT_LINES = 16

  const SOURCES = "[data-preview-path], [data-target], a[href^='arixlab-note:']"

  type Shown = { path: string; left: number; top: number }

  let shown = $state<Shown | null>(null)
  let image = $state<string | null>(null)
  let canvas = $state<HTMLCanvasElement>()
  let pages = $state(0)
  let timer: ReturnType<typeof setTimeout> | undefined
  let anchor: Element | null = null

  const pathOf = (el: HTMLElement) => {
    if (el.dataset.previewPath) {
      return el.dataset.previewPath
    }

    if (el.dataset.target) {
      return resolveLink(el.dataset.target, focusedTab()?.path ?? "", filePaths())
    }

    return citedPath(el.getAttribute("href") ?? "")
  }

  const place = (el: Element, path: string) => {
    const box = el.getBoundingClientRect()
    const below = box.bottom + GAP + HEIGHT <= innerHeight

    shown = {
      path,
      left: Math.max(GAP, Math.min(box.left, innerWidth - WIDTH - GAP)),
      top: below ? box.bottom + GAP : Math.max(GAP, box.top - GAP - HEIGHT),
    }
  }

  const hide = () => {
    clearTimeout(timer)
    anchor = null
    shown = null
  }

  const onpointerover = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") {
      return
    }

    const el = (e.target as Element).closest<HTMLElement>(SOURCES)

    if (!el || el === anchor) {
      return
    }

    const path = pathOf(el)

    hide()

    if (!path) {
      return
    }

    anchor = el
    timer = setTimeout(() => place(el, path), DELAY)
  }

  const onpointerout = (e: PointerEvent) => {
    const to = (e.relatedTarget as Element | null)?.closest(SOURCES)

    if (anchor && to !== anchor) {
      hide()
    }
  }

  $effect(() => {
    const path = shown?.path

    if (!path || !isImage(path)) {
      return
    }

    let url: string | null = null
    let gone = false

    attachmentUrl(path).then(next => {
      url = next

      if (gone) {
        URL.revokeObjectURL(next)
      } else {
        image = next
      }
    })

    return () => {
      gone = true
      image = null

      if (url) {
        URL.revokeObjectURL(url)
      }
    }
  })

  $effect(() => {
    const path = shown?.path
    const target = canvas

    if (!path || !isPdf(path) || !target) {
      return
    }

    pages = 0
    Promise.all([import("$lib/vault/pdf"), readAttachment(path)])
      .then(([{ renderFirstPage }, bytes]) => renderFirstPage(bytes, target, WIDTH - 24))
      .then(count => (pages = count))
      .catch(() => undefined)
  })

  const excerpt = (path: string) =>
    (texts.get(path) ?? "").split("\n").slice(0, EXCERPT_LINES).join("\n")
</script>

<svelte:document
  {onpointerover}
  {onpointerout}
  onscrollcapture={hide}
  onpointerdown={hide}
/>

{#if shown}
  {@const path = shown.path}

  <section
    role="tooltip"
    class={[
      "pointer-events-none fixed z-50 flex flex-col gap-2 overflow-hidden border",
      "border-base-content/12 bg-base-100 p-3 shadow-xl",
    ]}
    style:left="{shown.left}px"
    style:top="{shown.top}px"
    style:width="{WIDTH}px"
    style:max-height="{HEIGHT}px"
  >
    <header class="flex items-center gap-2">
      <Icon icon={fileIcon(path)} class="size-4 shrink-0 text-primary" />
      <h4 class="min-w-0 grow truncate text-sm font-semibold">{displayName(path)}</h4>
      {#if pages > 0 && isPdf(path)}
        <span class="shrink-0 text-xs tabular-nums text-base-content/50">{pages}쪽</span>
      {/if}
    </header>

    {#if isNote(path)}
      <div class="markdown min-h-0 overflow-hidden text-xs text-base-content/80">
        {@html renderMarkdown(excerpt(path))}
      </div>
    {:else if isPdf(path)}
      <canvas bind:this={canvas} class="bg-white"></canvas>
    {:else if isImage(path)}
      {#if image}
        <img src={image} alt={displayName(path)} class="min-h-0 object-contain" />
      {/if}
    {:else}
      <p class="text-xs text-base-content/55">미리보기 미지원</p>
    {/if}
  </section>
{/if}

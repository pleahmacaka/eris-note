<script lang="ts">
  import Icon from "@iconify/svelte"
  import { fly } from "svelte/transition"
  import { rem } from "$lib/ascii/motion"
  import { showMenu } from "$lib/menu/menu.svelte"
  import PanelView from "$lib/components/panels/PanelView.svelte"
  import ActivityBar from "./ActivityBar.svelte"
  import {
    accept,
    drag,
    endDrag,
    payload,
    startDrag,
  } from "$lib/workspace/drag.svelte"
  import {
    layout,
    movePanel,
    PANELS,
    type PanelId,
    resizeSide,
    type Side,
  } from "$lib/workspace/layout.svelte"

  const { side }: { side: Side } = $props()

  const panels = $derived(layout.docks[side])

  const active = $derived(layout.active[side] ?? panels[0] ?? null)

  const LEAVE_DELAY = 200

  let hover = $state<PanelId | "end" | null>(null)
  let resizing = $state(false)
  let hovering = $state(false)
  let typing = $state(false)
  let leave: ReturnType<typeof setTimeout> | undefined
  let dragged = false

  const open = $derived(layout.open[side])

  const peeking = $derived(!open && (hovering || typing))

  const peek = (on: boolean) => {
    clearTimeout(leave)

    if (on) {
      hovering = true
    } else {
      leave = setTimeout(() => (hovering = false), LEAVE_DELAY)
    }
  }

  const field = (target: EventTarget | null) =>
    target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement

  $effect(() => {
    if (drag.kind) {
      dragged = true
    } else if (dragged) {
      dragged = false
      hovering = false
    }
  })

  const panelMenu = (event: MouseEvent, panel: PanelId) => {
    const other = side === "left" ? "right" : "left"

    showMenu(event, [
      {
        label: other === "left" ? "왼쪽 사이드바로 이동" : "오른쪽 사이드바로 이동",
        icon: other === "left" ? "lucide:panel-left" : "lucide:panel-right",
        run: () => movePanel(panel, other),
      },
      { label: "사이드바 닫기", icon: "lucide:x", run: () => (layout.open[side] = false) },
    ])
  }

  const drop = (event: DragEvent, before?: PanelId) => {
    event.stopPropagation()

    const panel = payload(event, "panel") as PanelId

    if (panel in PANELS) {
      movePanel(panel, side, before)
    }

    hover = null
    endDrag()
  }

  const resize = (event: PointerEvent) => {
    const handle = event.currentTarget as HTMLElement
    const start = event.clientX
    const width = layout.width[side]
    const unit = rem(1)

    handle.setPointerCapture(event.pointerId)
    resizing = true

    const moveTo = (e: PointerEvent) => {
      const delta = (e.clientX - start) / unit

      resizeSide(side, side === "left" ? width + delta : width - delta)
    }

    const stop = () => {
      resizing = false
      handle.removeEventListener("pointermove", moveTo)
      handle.removeEventListener("pointerup", stop)
    }

    handle.addEventListener("pointermove", moveTo)
    handle.addEventListener("pointerup", stop)
  }
</script>

{#snippet body(panel: PanelId)}
  {#if side === "left"}
    <div class="lg:hidden">
      <ActivityBar horizontal />
    </div>
  {:else}
    <div
      class="flex h-9 shrink-0 items-stretch border-b border-base-content/10"
      role="tablist"
    >
      {#each panels as tab (tab)}
        {@const on = tab === panel}
        <button
          role="tab"
          aria-selected={on}
          draggable="true"
          class={[
            "relative flex cursor-pointer items-center gap-1.5 px-3 text-xs",
            on ? "text-base-content" : "text-base-content/50 hover:text-base-content",
            hover === tab && "bg-primary/10",
          ]}
          title={PANELS[tab].label}
          onclick={() => (layout.active[side] = tab)}
          oncontextmenu={e => panelMenu(e, tab)}
          ondragstart={e => startDrag(e, "panel", tab)}
          ondragend={endDrag}
          ondragenter={() => (hover = tab)}
          ondragleave={() => (hover = null)}
          ondragover={e => accept(e, "panel")}
          ondrop={e => drop(e, tab)}
        >
          {#if on}
            <span class="absolute inset-x-2 bottom-0 h-0.5 bg-primary"></span>
          {/if}
          <Icon icon={PANELS[tab].icon} class="size-4" />
          <span class={[panels.length > 2 && "sr-only"]}>
            {PANELS[tab].label}
          </span>
        </button>
      {/each}
    </div>
  {/if}

  <PanelView {panel} />
{/snippet}

{#if active}
  <div class="relative flex shrink-0">
  <aside
    class={[
      "pad-bottom relative flex shrink-0 overflow-hidden bg-base-100",
      "border-base-content/10 ease-out max-lg:fixed max-lg:inset-y-0",
      "max-lg:z-40 max-lg:w-72!",
      resizing ? "transition-none" : "transition-all duration-200",
      side === "left" ? "max-lg:left-0" : "max-lg:right-0",
      open && (side === "left" ? "border-r" : "border-l"),
      !open && (side === "left" ? "max-lg:-translate-x-full" : "max-lg:translate-x-full"),
      drag.kind === "panel" && "ring-1 ring-primary/40 ring-inset",
    ]}
    style:width="{open ? layout.width[side] : 0}rem"
    inert={!open}
    aria-label={side === "left" ? "왼쪽 사이드바" : "오른쪽 사이드바"}
    ondragover={e => accept(e, "panel")}
    ondrop={e => drop(e)}
  >
    <div
      class="flex h-full shrink-0 flex-col max-lg:w-full!"
      style:width="{layout.width[side]}rem"
    >
      {#if !peeking}
        {@render body(active)}
      {/if}
    </div>

    <div
      class={[
        "absolute inset-y-0 w-1 cursor-col-resize transition hover:bg-primary/40",
        "max-lg:hidden",
        side === "left" ? "-right-0.5" : "-left-0.5",
      ]}
      role="separator"
      aria-orientation="vertical"
      aria-label="사이드바 너비"
      onpointerdown={resize}
    ></div>
  </aside>

  {#if !open}
    <div
      class={[
        "absolute inset-y-0 z-30 w-2 max-lg:hidden",
        side === "left" ? "left-0" : "right-0",
      ]}
      role="presentation"
      onmouseenter={() => peek(true)}
      onmouseleave={() => peek(false)}
    ></div>
  {/if}

  {#if peeking}
    <div
      class={[
        "absolute inset-y-2 z-40 flex flex-col overflow-hidden rounded-box border",
        "border-base-content/10 bg-base-100 shadow-xl max-lg:hidden",
        side === "left" ? "left-1" : "right-1",
        drag.kind && "pointer-events-none opacity-0",
      ]}
      style:width="{layout.width[side]}rem"
      role="complementary"
      aria-label={side === "left" ? "왼쪽 사이드바" : "오른쪽 사이드바"}
      transition:fly={{ x: side === "left" ? -12 : 12, duration: 150 }}
      onmouseenter={() => peek(true)}
      onmouseleave={() => peek(false)}
      onfocusin={e => (typing = field(e.target))}
      onfocusout={() => (typing = false)}
    >
      {@render body(active)}
    </div>
  {/if}
  </div>
{/if}

<script lang="ts">
  import { renderMarkdown, withoutFrontmatter } from "@eris/markdown"
  import Icon from "@iconify/svelte"
  import {
    Handle,
    NodeResizer,
    type NodeProps,
    Position,
    useSvelteFlow,
  } from "@xyflow/svelte"
  import { openExternal } from "$lib/platform/links"
  import { basename, isCanvas, isNote, stem } from "$lib/vault/paths"
  import { texts, vault } from "$lib/vault/vault.svelte"
  import { openLink, openPath } from "$lib/workspace/navigate"
  import { useCanvas } from "./context"
  import type { CanvasFlowEdge, CardFlowNode } from "./flow"
  import { colorOf, SIDES } from "./jsoncanvas"

  const { id, data, selected }: NodeProps<CardFlowNode> = $props()

  const canvas = useCanvas()

  const { updateNodeData } = useSvelteFlow<CardFlowNode, CanvasFlowEdge>()

  const POSITIONS = {
    top: Position.Top,
    right: Position.Right,
    bottom: Position.Bottom,
    left: Position.Left,
  }

  const node = $derived(data.node)

  const color = $derived(colorOf(node.color))

  const editing = $derived(canvas.editing === id)

  const tint = $derived(
    color
      ? `color-mix(in oklch, ${color} 12%, var(--color-base-100))`
      : undefined,
  )

  const opens = (file: string) => isNote(file) || isCanvas(file)

  const exists = (file: string) =>
    vault.entries.some(e => !e.folder && e.path === file)

  const stopEditing = () => {
    if (editing) {
      canvas.edit(null)
    }
  }

  const saveText = (text: string) => {
    stopEditing()

    if (node.type === "text" && text !== node.text) {
      updateNodeData(id, { node: { ...node, text } })
    }
  }

  const saveLabel = (value: string) => {
    stopEditing()

    const label = value.trim() || undefined

    if (node.type === "group" && label !== node.label) {
      updateNodeData(id, { node: { ...node, label } })
    }
  }

  const begin = () => {
    if (node.type === "text") {
      canvas.edit(id)
    } else if (node.type === "file" && opens(node.file)) {
      openPath(node.file)
    }
  }

  const addInside = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      canvas.addTextAt(e)
    }
  }

  const follow = (e: MouseEvent, from: string) => {
    const anchor =
      e.target instanceof Element ? e.target.closest("a") : null

    if (!anchor) {
      return
    }

    e.preventDefault()

    const newTab = e.ctrlKey || e.metaKey
    const { target, notePath } = anchor.dataset

    if (target) {
      openLink(target, from, newTab)
    } else if (notePath) {
      openPath(notePath, { newTab })
    } else {
      openExternal(anchor.getAttribute("href") ?? "")
    }
  }

  const blurOn =
    (...keys: string[]) =>
    (e: KeyboardEvent & { currentTarget: HTMLElement }) => {
      if (keys.includes(e.key)) {
        e.currentTarget.blur()
      }
    }

  const focusAll = (element: HTMLInputElement) => {
    element.focus()
    element.select()
  }

  const focusEnd = (element: HTMLTextAreaElement) => {
    element.focus()
    element.setSelectionRange(element.value.length, element.value.length)
  }
</script>

<NodeResizer
  isVisible={selected}
  minWidth={120}
  minHeight={60}
  lineClass="canvas-resize-line"
  handleClass="canvas-resize-handle"
/>

{#each SIDES as side (side)}
  <Handle
    type="source"
    id={side}
    position={POSITIONS[side]}
    class="canvas-handle"
  />
{/each}

{#if node.type === "group"}
  <div
    class={[
      "relative size-full border border-dashed",
      selected ? "border-primary" : "border-base-content/25",
    ]}
    style:border-color={selected ? undefined : color}
    style:background-color={color
      ? `color-mix(in oklch, ${color} 6%, transparent)`
      : undefined}
    role="presentation"
    ondblclick={addInside}
  >
    <div class="absolute bottom-full left-0 pb-1">
      {#if editing}
        <input
          class="input input-xs nodrag"
          aria-label="그룹 이름"
          value={node.label ?? ""}
          onblur={e => saveLabel(e.currentTarget.value)}
          onkeydown={blurOn("Enter", "Escape")}
          use:focusAll
        />
      {:else}
        <button
          class={[
            "cursor-pointer text-sm font-medium text-base-content/70",
            "transition-colors duration-140 hover:text-base-content",
          ]}
          ondblclick={() => canvas.edit(id)}
        >
          {node.label || "그룹"}
        </button>
      {/if}
    </div>
  </div>
{:else}
  <div
    class={[
      "flex size-full flex-col overflow-hidden border bg-base-100",
      "transition-colors duration-140",
      selected ? "border-primary" : "border-base-content/10",
    ]}
    style:border-color={selected ? undefined : color}
    style:background-color={tint}
    role="presentation"
    ondblclick={begin}
  >
    {#if node.type === "text"}
      {#if editing}
        <textarea
          class={[
            "nodrag nowheel size-full resize-none bg-transparent p-3",
            "text-sm leading-relaxed outline-none",
          ]}
          aria-label="카드 내용"
          value={node.text}
          onblur={e => saveText(e.currentTarget.value)}
          onkeydown={blurOn("Escape")}
          use:focusEnd
        ></textarea>
      {:else}
        <div
          class="markdown nowheel min-h-0 flex-1 overflow-auto p-3 text-sm"
          role="presentation"
          onclick={e => follow(e, canvas.path)}
        >
          {#if node.text.trim()}
            {@html renderMarkdown(node.text)}
          {:else}
            <p class="text-base-content/40">내용 없음</p>
          {/if}
        </div>
      {/if}
    {:else if node.type === "file"}
      {@const found = exists(node.file)}
      <div
        class={[
          "flex shrink-0 items-center gap-2 border-b border-base-content/10",
          "px-3 py-2",
        ]}
      >
        <Icon
          icon={isCanvas(node.file)
            ? "lucide:layout-dashboard"
            : "lucide:file-text"}
          class="size-4 shrink-0 text-base-content/50"
        />
        <span class="min-w-0 flex-1 truncate text-sm font-medium">
          {opens(node.file) ? stem(node.file) : basename(node.file)}
        </span>
        {#if found && opens(node.file)}
          <button
            class="btn btn-ghost btn-square btn-xs nodrag"
            aria-label="열기"
            onclick={() => openPath(node.file)}
          >
            <Icon icon="lucide:arrow-up-right" class="size-3.5" />
          </button>
        {/if}
      </div>

      <div
        class="markdown nowheel min-h-0 flex-1 overflow-auto p-3 text-sm"
        role="presentation"
        onclick={e => follow(e, node.file)}
      >
        {#if !found}
          <p class="text-base-content/40">파일 없음</p>
        {:else if isNote(node.file)}
          {@html renderMarkdown(withoutFrontmatter(texts.get(node.file) ?? ""))}
        {/if}
      </div>
    {:else if node.type === "link"}
      <div class="flex min-h-0 flex-1 flex-col justify-center gap-1 p-3">
        <div class="flex items-center gap-2 text-base-content/50">
          <Icon icon="lucide:link" class="size-4 shrink-0" />
          <span class="truncate text-xs">
            {URL.canParse(node.url) ? new URL(node.url).host : "링크"}
          </span>
        </div>
        <p class="select-text break-all text-sm">{node.url}</p>
      </div>
    {/if}
  </div>
{/if}

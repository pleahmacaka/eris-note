<script lang="ts">
  import {
    BaseEdge,
    EdgeLabel,
    type EdgeProps,
    getBezierPath,
    useSvelteFlow,
  } from "@xyflow/svelte"
  import { useCanvas } from "./context"
  import { type CanvasFlowEdge, type CardFlowNode, patchEdge } from "./flow"

  const {
    id,
    label,
    style,
    markerStart,
    markerEnd,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  }: EdgeProps<CanvasFlowEdge> = $props()

  const canvas = useCanvas()

  const { updateEdge } = useSvelteFlow<CardFlowNode, CanvasFlowEdge>()

  const [path, labelX, labelY] = $derived(
    getBezierPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
    }),
  )

  const editing = $derived(canvas.editing === id)

  const save = (value: string) => {
    if (editing) {
      canvas.edit(null)
    }

    const text = value.trim()

    if (text !== (label ?? "")) {
      updateEdge(id, edge => patchEdge(edge, { label: text || undefined }))
    }
  }

  const keydown = (e: KeyboardEvent & { currentTarget: HTMLInputElement }) => {
    if (e.key === "Enter" || e.key === "Escape") {
      e.currentTarget.blur()
    }
  }

  const focus = (element: HTMLInputElement) => {
    // EdgeLabel portals its node after children mount, which drops focus
    queueMicrotask(() => {
      element.focus()
      element.select()
    })
  }
</script>

<BaseEdge
  {path}
  {style}
  {markerStart}
  {markerEnd}
  ondblclick={() => canvas.edit(id)}
/>

{#if editing}
  <EdgeLabel x={labelX} y={labelY} class="nodrag nopan">
    <input
      class="input input-xs w-40"
      aria-label="레이블"
      value={label ?? ""}
      onblur={e => save(e.currentTarget.value)}
      onkeydown={keydown}
      use:focus
    />
  </EdgeLabel>
{:else if label}
  <EdgeLabel
    x={labelX}
    y={labelY}
    class="canvas-edge-label"
    selectEdgeOnClick
    ondblclick={() => canvas.edit(id)}
    oncontextmenu={e => canvas.showEdgeMenu(e, id)}
  >
    {label}
  </EdgeLabel>
{/if}

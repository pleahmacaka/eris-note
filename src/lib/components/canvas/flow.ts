import {
  type Edge,
  MarkerType,
  type Node,
  type Rect,
  type XYPosition,
} from "@xyflow/svelte"
import {
  type CanvasDoc,
  type CanvasEdge,
  type CanvasNode,
  colorOf,
  newCanvasId,
  SIDES,
  type Side,
} from "./jsoncanvas"

export type CardData = { node: CanvasNode }

export type CardFlowNode = Node<CardData, "card">

export type CanvasFlowEdge = Edge<{ edge: CanvasEdge }, "card">

export type Cards = { nodes: CanvasNode[]; edges: CanvasEdge[] }

const arrow = (color: string | null) =>
  color?.startsWith("#")
    ? { type: MarkerType.ArrowClosed, color }
    : { type: MarkerType.ArrowClosed }

export const toFlowNode = (node: CanvasNode): CardFlowNode => ({
  id: node.id,
  type: "card",
  position: { x: node.x, y: node.y },
  width: node.width,
  height: node.height,
  zIndex: node.type === "group" ? -1 : 0,
  data: { node },
})

export const toFlowEdge = (edge: CanvasEdge): CanvasFlowEdge => {
  const color = colorOf(edge.color)

  return {
    id: edge.id,
    type: "card",
    source: edge.fromNode,
    target: edge.toNode,
    sourceHandle: edge.fromSide ?? null,
    targetHandle: edge.toSide ?? null,
    label: edge.label,
    markerStart: edge.fromEnd === "arrow" ? arrow(color) : undefined,
    markerEnd: edge.toEnd === "none" ? undefined : arrow(color),
    style: color ? `stroke: ${color}` : undefined,
    data: { edge },
  }
}

const sideOf = (handle: string | null | undefined): Side | undefined =>
  SIDES.find(side => side === handle)

export const boxOf = (node: CardFlowNode): Rect => ({
  x: node.position.x,
  y: node.position.y,
  width: node.width ?? node.measured?.width ?? node.data.node.width,
  height: node.height ?? node.measured?.height ?? node.data.node.height,
})

export const toCanvasNode = (node: CardFlowNode): CanvasNode => {
  const box = boxOf(node)

  return {
    ...node.data.node,
    x: Math.round(box.x),
    y: Math.round(box.y),
    width: Math.round(box.width),
    height: Math.round(box.height),
  }
}

export const toCanvasEdge = (edge: CanvasFlowEdge): CanvasEdge => ({
  ...edge.data?.edge,
  id: edge.id,
  fromNode: edge.source,
  toNode: edge.target,
  fromSide: sideOf(edge.sourceHandle),
  toSide: sideOf(edge.targetHandle),
})

export const fromFlow = (
  doc: CanvasDoc,
  nodes: CardFlowNode[],
  edges: CanvasFlowEdge[],
): CanvasDoc => ({
  ...doc,
  nodes: nodes.map(toCanvasNode),
  edges: edges.map(toCanvasEdge),
})

export const withNode = (
  flow: CardFlowNode,
  node: CanvasNode,
): CardFlowNode => ({ ...flow, data: { ...flow.data, node } })

export const patchEdge = (edge: CanvasFlowEdge, patch: Partial<CanvasEdge>) =>
  toFlowEdge({ ...toCanvasEdge(edge), ...patch })

export const connectEdge = (connection: {
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
}) =>
  toFlowEdge({
    id: newCanvasId(),
    fromNode: connection.source,
    toNode: connection.target,
    fromSide: sideOf(connection.sourceHandle),
    toSide: sideOf(connection.targetHandle),
  })

const isGroup = (node: CardFlowNode) => node.data.node.type === "group"

const encloses = (outer: Rect, inner: Rect) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height

const covers = (box: Rect, point: XYPosition) =>
  point.x >= box.x &&
  point.y >= box.y &&
  point.x <= box.x + box.width &&
  point.y <= box.y + box.height

export const contentsOf = (
  picked: CardFlowNode[],
  candidates: CardFlowNode[],
) => {
  const groups = picked.filter(isGroup).map(boxOf)

  return candidates.filter(node =>
    groups.some(group => encloses(group, boxOf(node))),
  )
}

export const cardAt = (nodes: CardFlowNode[], point: XYPosition) => {
  const hits = nodes.filter(node => covers(boxOf(node), point))

  return hits.findLast(node => !isGroup(node)) ?? hits.at(-1)
}

export const nearestSide = (box: Rect, point: XYPosition): Side => {
  const gaps: Record<Side, number> = {
    top: Math.abs(point.y - box.y),
    right: Math.abs(box.x + box.width - point.x),
    bottom: Math.abs(box.y + box.height - point.y),
    left: Math.abs(point.x - box.x),
  }

  return SIDES.reduce((best, side) => (gaps[side] < gaps[best] ? side : best))
}

export const centerOf = (nodes: CanvasNode[]): XYPosition => {
  const left = Math.min(...nodes.map(n => n.x))
  const top = Math.min(...nodes.map(n => n.y))
  const right = Math.max(...nodes.map(n => n.x + n.width))
  const bottom = Math.max(...nodes.map(n => n.y + n.height))

  return { x: (left + right) / 2, y: (top + bottom) / 2 }
}

export const cloneCards = (cards: Cards, offset: XYPosition): Cards => {
  const pairs = cards.nodes.map(node => ({ node, id: newCanvasId() }))
  const idOf = new Map(pairs.map(pair => [pair.node.id, pair.id]))

  const nodes = pairs.map(({ node, id }) => ({
    ...node,
    id,
    x: Math.round(node.x + offset.x),
    y: Math.round(node.y + offset.y),
  }))

  const edges = cards.edges.flatMap(edge => {
    const fromNode = idOf.get(edge.fromNode)
    const toNode = idOf.get(edge.toNode)

    return fromNode && toNode
      ? [{ ...edge, id: newCanvasId(), fromNode, toNode }]
      : []
  })

  return { nodes, edges }
}

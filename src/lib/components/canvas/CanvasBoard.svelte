<script lang="ts" module>
  import type { Cards } from "./flow"

  let clipboard: Cards | null = null
</script>

<script lang="ts">
  import Icon from "@iconify/svelte"
  import {
    Background,
    BackgroundVariant,
    ConnectionMode,
    type OnConnectEnd,
    Panel,
    SvelteFlow,
    useSvelteFlow,
    type XYPosition,
  } from "@xyflow/svelte"
  import { onDestroy, untrack } from "svelte"
  import { type MenuItem, showMenu } from "$lib/menu/menu.svelte"
  import { isCanvas, isNote } from "$lib/vault/paths"
  import { onVaultChange, readFile, saveFile } from "$lib/vault/vault.svelte"
  import { layout } from "$lib/workspace/layout.svelte"
  import { openPath } from "$lib/workspace/navigate"
  import CardEdge from "./CardEdge.svelte"
  import CardNode from "./CardNode.svelte"
  import { provideCanvas } from "./context"
  import {
    boxOf,
    type CanvasFlowEdge,
    type CardFlowNode,
    cardAt,
    centerOf,
    cloneCards,
    connectEdge,
    contentsOf,
    fromFlow,
    nearestSide,
    patchEdge,
    toCanvasEdge,
    toCanvasNode,
    toFlowEdge,
    toFlowNode,
    withNode,
  } from "./flow"
  import {
    type CanvasDoc,
    type CanvasNode,
    newCanvasId,
    parseCanvas,
    serializeCanvas,
  } from "./jsoncanvas"

  const { path }: { path: string } = $props()

  const {
    fitView,
    zoomIn,
    zoomOut,
    screenToFlowPosition,
    deleteElements,
    updateEdge,
  } = useSvelteFlow<CardFlowNode, CanvasFlowEdge>()

  const nodeTypes = { card: CardNode }

  const edgeTypes = { card: CardEdge }

  const SAVE_DELAY = 500

  const DUPLICATE_OFFSET = 30

  const MOTION = { duration: 140 }

  const COLORS = [
    { color: undefined, label: "색상 없음" },
    { color: "1", label: "빨강" },
    { color: "2", label: "주황" },
    { color: "3", label: "노랑" },
    { color: "4", label: "초록" },
    { color: "5", label: "청록" },
    { color: "6", label: "보라" },
  ]

  const DIRECTIONS = [
    { label: "방향 없음", fromEnd: "none", toEnd: "none" },
    { label: "단방향", fromEnd: "none", toEnd: "arrow" },
    { label: "양방향", fromEnd: "arrow", toEnd: "arrow" },
  ] as const

  type Carry = { lead: CardFlowNode; starts: Map<string, XYPosition> }

  type CardEvent = { node: CardFlowNode; event: MouseEvent }

  type EdgeEvent = { edge: CanvasFlowEdge; event: MouseEvent }

  let doc = $state.raw<CanvasDoc | null>(null)
  let nodes = $state.raw<CardFlowNode[]>([])
  let edges = $state.raw<CanvasFlowEdge[]>([])
  let status = $state<"loading" | "ready" | "invalid" | "missing">("loading")
  let editing = $state<string | null>(null)
  let container = $state<HTMLDivElement>()
  let saved = ""
  let timer: ReturnType<typeof setTimeout> | undefined
  let pointer: XYPosition | null = null
  let carry: Carry | null = null

  const current = () =>
    doc ? serializeCanvas(fromFlow(doc, nodes, edges)) : null

  const flush = async () => {
    clearTimeout(timer)
    timer = undefined

    const text = current()

    if (text === null || text === saved) {
      return
    }

    saved = text
    await saveFile(path, text)
  }

  const load = async () => {
    let text: string

    try {
      text = await readFile(path)
    } catch {
      status = "missing"
      doc = null

      return
    }

    const parsed = parseCanvas(text)

    if (!parsed) {
      status = "invalid"
      doc = null

      return
    }

    doc = parsed
    nodes = parsed.nodes.map(toFlowNode)
    edges = parsed.edges.map(toFlowEdge)
    editing = null
    saved = current() ?? ""
    status = "ready"
  }

  $effect(() => {
    path

    untrack(() => {
      status = "loading"
      load()
    })
  })

  $effect(() => {
    if (status !== "ready") {
      return
    }

    if (current() !== saved) {
      clearTimeout(timer)
      timer = setTimeout(flush, SAVE_DELAY)
    }
  })

  const stop = onVaultChange(change => {
    if (!change.paths.includes(path) || status === "loading") {
      return
    }

    if (status === "ready" && current() !== saved) {
      return
    }

    readFile(path)
      .then(text => {
        if (text !== saved) {
          load()
        }
      })
      .catch(() => {
        status = "missing"
      })
  })

  onDestroy(() => {
    stop()
    flush()
  })

  const flowPoint = (e: { clientX: number; clientY: number }) =>
    screenToFlowPosition({ x: e.clientX, y: e.clientY })

  const center = (): XYPosition => {
    const rect = container?.getBoundingClientRect()

    return screenToFlowPosition({
      x: (rect?.left ?? 0) + (rect?.width ?? 0) / 2,
      y: (rect?.top ?? 0) + (rect?.height ?? 0) / 2,
    })
  }

  const edit = (id: string | null) => {
    editing = id
  }

  const inField = (target: EventTarget | null) =>
    target instanceof Element && target.closest("input, textarea") !== null

  const withSelected = <T extends { selected?: boolean }>(
    item: T,
    selected: boolean,
  ): T => (Boolean(item.selected) === selected ? item : { ...item, selected })

  const selectOnly = (id: string) => {
    nodes = nodes.map(n => withSelected(n, n.id === id))
    edges = edges.map(e => withSelected(e, e.id === id))
  }

  const addCards = (cards: Cards) => {
    nodes = [
      ...nodes.map(n => withSelected(n, false)),
      ...cards.nodes.map(n => ({ ...toFlowNode(n), selected: true })),
    ]
    edges = [
      ...edges.map(e => withSelected(e, false)),
      ...cards.edges.map(toFlowEdge),
    ]
  }

  const addCard = (node: CanvasNode) => addCards({ nodes: [node], edges: [] })

  const frame = (at: XYPosition, width: number, height: number) => ({
    x: Math.round(at.x - width / 2),
    y: Math.round(at.y - height / 2),
    width,
    height,
  })

  const addText = (at: XYPosition) => {
    const id = newCanvasId()

    addCard({ id, type: "text", text: "", ...frame(at, 260, 120) })
    editing = id
  }

  const addNote = (file: string, at: XYPosition) =>
    addCard({ id: newCanvasId(), type: "file", file, ...frame(at, 400, 400) })

  const addGroup = (at: XYPosition) =>
    addCard({ id: newCanvasId(), type: "group", ...frame(at, 480, 320) })

  const pickNote = (at: XYPosition) => {
    layout.citeInto = file => addNote(file, at)
    layout.palette = "cite-note"
  }

  const selectedCards = (): Cards => {
    const picked = nodes.filter(n => n.selected)
    const rest = nodes.filter(n => !n.selected)
    const all = [...picked, ...contentsOf(picked, rest)]
    const ids = new Set(all.map(n => n.id))

    return {
      nodes: all.map(toCanvasNode),
      edges: edges
        .filter(e => ids.has(e.source) && ids.has(e.target))
        .map(toCanvasEdge),
    }
  }

  const copy = () => {
    const cards = selectedCards()

    if (cards.nodes.length > 0) {
      clipboard = cards
    }
  }

  const paste = (at: XYPosition) => {
    if (!clipboard) {
      return
    }

    const middle = centerOf(clipboard.nodes)

    addCards(cloneCards(clipboard, { x: at.x - middle.x, y: at.y - middle.y }))
  }

  const duplicate = () => {
    const cards = selectedCards()

    if (cards.nodes.length > 0) {
      addCards(cloneCards(cards, { x: DUPLICATE_OFFSET, y: DUPLICATE_OFFSET }))
    }
  }

  const remove = () =>
    deleteElements({
      nodes: nodes.filter(n => n.selected),
      edges: edges.filter(e => e.selected),
    })

  const paint = (color: string | undefined) => {
    nodes = nodes.map(n =>
      n.selected ? withNode(n, { ...n.data.node, color }) : n,
    )
  }

  const fit = () => fitView(MOTION)

  const colorItems = (current: string | null | undefined): MenuItem[] =>
    COLORS.map(({ color, label }) => ({
      label,
      icon: color === current ? "lucide:check" : undefined,
      run: () => paint(color),
    }))

  const directionItems = (edge: CanvasFlowEdge): MenuItem[] => {
    const { fromEnd = "none", toEnd = "arrow" } = toCanvasEdge(edge)

    return DIRECTIONS.map(direction => ({
      label: direction.label,
      icon:
        direction.fromEnd === fromEnd && direction.toEnd === toEnd
          ? "lucide:check"
          : undefined,
      run: () =>
        updateEdge(edge.id, e =>
          patchEdge(e, { fromEnd: direction.fromEnd, toEnd: direction.toEnd }),
        ),
    }))
  }

  const openItems = (card?: CanvasNode): MenuItem[] => {
    if (card?.type === "text" || card?.type === "group") {
      return [
        { label: "편집", icon: "lucide:pencil", run: () => edit(card.id) },
        "separator",
      ]
    }

    if (card?.type === "file" && (isNote(card.file) || isCanvas(card.file))) {
      return [
        {
          label: isCanvas(card.file) ? "캔버스 열기" : "노트 열기",
          icon: "lucide:arrow-up-right",
          run: () => openPath(card.file),
        },
        "separator",
      ]
    }

    return []
  }

  const paneMenu = (event: MouseEvent): MenuItem[] => {
    const at = flowPoint(event)

    return [
      {
        label: "텍스트 카드 추가",
        icon: "lucide:type",
        run: () => addText(at),
      },
      {
        label: "노트 카드 추가",
        icon: "lucide:file-plus",
        run: () => pickNote(at),
      },
      {
        label: "그룹 추가",
        icon: "lucide:square-dashed",
        run: () => addGroup(at),
      },
      "separator",
      {
        label: "붙여넣기",
        icon: "lucide:clipboard-paste",
        keys: "Ctrl V",
        disabled: !clipboard,
        run: () => paste(at),
      },
      {
        label: "화면에 맞추기",
        icon: "lucide:scan",
        run: fit,
      },
    ]
  }

  const cardMenu = (card?: CanvasNode): MenuItem[] => [
    ...openItems(card),
    ...colorItems(card ? card.color : null),
    "separator",
    {
      label: "복제",
      icon: "lucide:copy",
      keys: "Ctrl D",
      run: duplicate,
    },
    "separator",
    {
      label: "삭제",
      icon: "lucide:trash-2",
      keys: "Delete",
      danger: true,
      run: remove,
    },
  ]

  const edgeMenu = (edge: CanvasFlowEdge): MenuItem[] => [
    {
      label: "레이블 편집",
      icon: "lucide:text-cursor-input",
      run: () => edit(edge.id),
    },
    "separator",
    ...directionItems(edge),
    "separator",
    {
      label: "삭제",
      icon: "lucide:trash-2",
      keys: "Delete",
      danger: true,
      run: remove,
    },
  ]

  const onPaneMenu = ({ event }: { event: MouseEvent }) =>
    showMenu(event, paneMenu(event))

  const onCardMenu = ({ node, event }: CardEvent) => {
    if (inField(event.target)) {
      return
    }

    if (!node.selected) {
      selectOnly(node.id)
    }

    showMenu(event, cardMenu(node.data.node))
  }

  const onSelectionMenu = ({ event }: { event: MouseEvent }) =>
    showMenu(event, cardMenu())

  const onEdgeMenu = ({ edge, event }: EdgeEvent) => {
    if (inField(event.target)) {
      return
    }

    selectOnly(edge.id)
    showMenu(event, edgeMenu(edge))
  }

  const connectToCard: OnConnectEnd = (event, state) => {
    if (state.isValid || state.fromNode === null) {
      return
    }

    const point = flowPoint(
      "changedTouches" in event ? event.changedTouches[0] : event,
    )
    const target = cardAt(nodes, point)

    if (!target || target.id === state.fromNode.id) {
      return
    }

    edges = [
      ...edges,
      connectEdge({
        source: state.fromNode.id,
        sourceHandle: state.fromHandle.id,
        target: target.id,
        targetHandle: nearestSide(boxOf(target), point),
      }),
    ]
  }

  const startCarry = ({ nodes: dragged }: { nodes: CardFlowNode[] }) => {
    const moving = new Set(dragged.map(n => n.id))
    const inside = contentsOf(dragged, nodes.filter(n => !moving.has(n.id)))
    const lead = dragged[0]

    carry =
      lead && inside.length > 0
        ? { lead, starts: new Map(inside.map(n => [n.id, n.position])) }
        : null
  }

  const moveCarry = ({ nodes: dragged }: { nodes: CardFlowNode[] }) => {
    const lead = dragged.find(n => n.id === carry?.lead.id)

    if (!carry || !lead) {
      return
    }

    const dx = lead.position.x - carry.lead.position.x
    const dy = lead.position.y - carry.lead.position.y
    const { starts } = carry

    nodes = nodes.map(n => {
      const start = starts.get(n.id)

      return start
        ? { ...n, position: { x: start.x + dx, y: start.y + dy } }
        : n
    })
  }

  const endCarry = () => {
    carry = null
  }

  const shortcuts: Record<string, () => unknown> = {
    c: copy,
    d: duplicate,
    v: () => paste(pointer ? screenToFlowPosition(pointer) : center()),
  }

  const keydown = (e: KeyboardEvent) => {
    const command = (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey
    const run = command ? shortcuts[e.key.toLowerCase()] : undefined

    if (!run || inField(e.target)) {
      return
    }

    e.preventDefault()
    run()
  }

  const claimFocus = (e: PointerEvent) => {
    if (!inField(e.target)) {
      container?.focus({ preventScroll: true })
    }
  }

  const track = (e: PointerEvent) => {
    pointer = { x: e.clientX, y: e.clientY }
  }

  const onPaneDoubleClick = (e: MouseEvent) => {
    if (
      e.target instanceof Element &&
      e.target.classList.contains("svelte-flow__pane")
    ) {
      addText(flowPoint(e))
    }
  }

  const ZOOMS = [
    { label: "확대", icon: "lucide:plus", run: () => zoomIn(MOTION) },
    { label: "축소", icon: "lucide:minus", run: () => zoomOut(MOTION) },
    { label: "화면에 맞추기", icon: "lucide:scan", run: fit },
  ]

  provideCanvas({
    get path() {
      return path
    },
    get editing() {
      return editing
    },
    edit,
    addTextAt: e => addText(flowPoint(e)),
    showEdgeMenu: (event, id) => {
      const edge = edges.find(e => e.id === id)

      if (edge) {
        onEdgeMenu({ edge, event })
      }
    },
  })
</script>

<div
  class="canvas-board relative size-full min-h-0 outline-none"
  bind:this={container}
  role="presentation"
  tabindex="-1"
  ondblclick={onPaneDoubleClick}
  onkeydown={keydown}
  onpointerdown={claimFocus}
  onpointermove={track}
>
  {#if status === "ready"}
    <SvelteFlow
      bind:nodes
      bind:edges
      {nodeTypes}
      {edgeTypes}
      fitView
      minZoom={0.1}
      maxZoom={4}
      panOnDrag={[1]}
      selectionOnDrag
      zoomOnDoubleClick={false}
      elevateNodesOnSelect={false}
      connectionMode={ConnectionMode.Loose}
      deleteKey={["Backspace", "Delete"]}
      defaultMarkerColor="var(--xy-edge-stroke)"
      proOptions={{ hideAttribution: true }}
      onbeforeconnect={connectEdge}
      onconnectend={connectToCard}
      onnodedragstart={startCarry}
      onnodedrag={moveCarry}
      onnodedragstop={endCarry}
      onpanecontextmenu={onPaneMenu}
      onnodecontextmenu={onCardMenu}
      onselectioncontextmenu={onSelectionMenu}
      onedgecontextmenu={onEdgeMenu}
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={24}
        size={1.5}
        bgColor="var(--color-base-200)"
        patternColor="color-mix(in oklch, var(--color-base-content) 18%, transparent)"
      />

      <Panel position="bottom-right">
        <div
          class="join join-vertical border border-base-content/10 bg-base-100"
        >
          {#each ZOOMS as zoom (zoom.label)}
            <button
              class="btn btn-ghost btn-square btn-sm join-item"
              aria-label={zoom.label}
              title={zoom.label}
              onclick={zoom.run}
            >
              <Icon icon={zoom.icon} class="size-4" />
            </button>
          {/each}
        </div>
      </Panel>
    </SvelteFlow>
  {:else if status === "loading"}
    <div class="flex size-full items-center justify-center">
      <span class="loading loading-spinner loading-sm text-base-content/40"></span>
    </div>
  {:else}
    <div class="flex size-full items-center justify-center p-6">
      <div
        class={[
          "flex max-w-sm flex-col items-center gap-2 border border-dashed",
          "border-base-content/15 px-6 py-10 text-center",
        ]}
      >
        <Icon icon="lucide:triangle-alert" class="size-6 text-warning" />
        <p class="font-medium">
          {status === "invalid"
            ? "캔버스를 읽을 수 없습니다."
            : "캔버스를 열 수 없습니다."}
        </p>
        <p class="text-sm text-base-content/50">
          {status === "invalid"
            ? "파일 형식을 확인하세요."
            : "파일이 이동되었거나 삭제되었는지 확인하세요."}
        </p>
      </div>
    </div>
  {/if}
</div>

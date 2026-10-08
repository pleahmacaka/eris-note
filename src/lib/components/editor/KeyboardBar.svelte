<script lang="ts">
  import { startCompletion } from "@codemirror/autocomplete"
  import { indentLess, indentMore, redo, undo } from "@codemirror/commands"
  import type { EditorView } from "@codemirror/view"
  import Icon from "@iconify/svelte"
  import { toggleTaskLine, wrapWith } from "$lib/editor/blocks"

  const { view }: { view: EditorView } = $props()

  let focused = $state(false)

  $effect(() => {
    const sync = () => {
      focused = view.hasFocus
    }

    view.dom.addEventListener("focusin", sync)
    view.dom.addEventListener("focusout", sync)

    return () => {
      view.dom.removeEventListener("focusin", sync)
      view.dom.removeEventListener("focusout", sync)
    }
  })

  const insert = (text: string) => {
    view.dispatch(view.state.replaceSelection(text))
  }

  const ACTIONS: { label: string; icon: string; run: () => unknown }[] = [
    {
      label: "블록 추가",
      icon: "lucide:square-slash",
      run: () => {
        insert("/")
        startCompletion(view)
      },
    },
    { label: "할 일", icon: "lucide:square-check", run: () => toggleTaskLine(view) },
    { label: "굵게", icon: "lucide:bold", run: () => wrapWith("**")(view) },
    { label: "기울임", icon: "lucide:italic", run: () => wrapWith("*")(view) },
    { label: "노트 링크", icon: "lucide:link-2", run: () => insert("[[") },
    { label: "내어쓰기", icon: "lucide:indent-decrease", run: () => indentLess(view) },
    { label: "들여쓰기", icon: "lucide:indent-increase", run: () => indentMore(view) },
    { label: "실행 취소", icon: "lucide:undo-2", run: () => undo(view) },
    { label: "다시 실행", icon: "lucide:redo-2", run: () => redo(view) },
  ]
</script>

{#if focused}
  <div
    class={[
      "keyboard-bar flex shrink-0 items-center overflow-x-auto border-t",
      "border-base-content/10 bg-base-100 px-1",
    ]}
    role="toolbar"
    aria-label="서식"
  >
    {#each ACTIONS as action (action.label)}
      <button
        class="btn btn-ghost btn-square size-11 shrink-0"
        aria-label={action.label}
        onpointerdown={e => {
          e.preventDefault()
          action.run()
        }}
      >
        <Icon icon={action.icon} class="size-5" />
      </button>
    {/each}

    <button
      class="btn btn-ghost btn-square ml-auto size-11 shrink-0"
      aria-label="키보드 숨기기"
      onpointerdown={e => {
        e.preventDefault()
        view.contentDOM.blur()
      }}
    >
      <Icon icon="lucide:keyboard-off" class="size-5" />
    </button>
  </div>
{/if}

<style>
  .keyboard-bar {
    scrollbar-width: none;
  }

  @media (pointer: fine) {
    .keyboard-bar {
      display: none;
    }
  }
</style>

<script lang="ts">
  import Icon from "@iconify/svelte"
  import { isAndroid } from "$lib/platform/runtime"
  import { layout } from "$lib/workspace/layout.svelte"
  import { focusedTab, tabTitle } from "$lib/workspace/workspace.svelte"
  import VaultMenu from "./VaultMenu.svelte"
  import WindowControls from "./WindowControls.svelte"

  const current = $derived(focusedTab())

  const desktop = !isAndroid()
</script>

<header
  data-tauri-drag-region
  class={[
    "pad-top grid h-10 shrink-0 grid-cols-[minmax(0,1fr)_minmax(0,28rem)_minmax(0,1fr)]",
    "items-center gap-2 border-b border-base-content/10 bg-base-100 select-none lg:h-9",
  ]}
>
  <div data-tauri-drag-region class="flex min-w-0 items-center gap-1 pl-1">
    <button
      class="btn btn-ghost btn-square btn-sm lg:hidden"
      aria-label="왼쪽 사이드바"
      onclick={() => (layout.open.left = !layout.open.left)}
    >
      <Icon icon="lucide:menu" class="size-5" />
    </button>

    <VaultMenu />
  </div>

  <div data-tauri-drag-region class="flex min-w-0 justify-center">
    <button
      class={[
        "flex h-6.5 w-full max-w-md cursor-pointer items-center gap-2 border",
        "border-base-content/10 bg-base-200 px-2.5 text-xs text-base-content/60",
        "transition hover:border-base-content/25 hover:text-base-content",
      ]}
      onclick={() => (layout.palette = "commands")}
    >
      <Icon icon="lucide:search" class="size-3.5 shrink-0" />
      <span class="min-w-0 flex-1 truncate text-left">
        {current ? tabTitle(current) : "검색 또는 명령 실행"}
      </span>
      <kbd class="kbd kbd-xs max-lg:hidden">Ctrl P</kbd>
    </button>
  </div>

  <div data-tauri-drag-region class="flex min-w-0 items-center justify-end gap-0.5">
    <button
      class="btn btn-ghost btn-square btn-sm"
      aria-label="왼쪽 사이드바"
      title="왼쪽 사이드바"
      onclick={() => (layout.open.left = !layout.open.left)}
    >
      <Icon
        icon={layout.open.left ? "lucide:panel-left-close" : "lucide:panel-left"}
        class="size-4"
      />
    </button>
    <button
      class="btn btn-ghost btn-square btn-sm"
      aria-label="오른쪽 사이드바"
      title="오른쪽 사이드바"
      onclick={() => (layout.open.right = !layout.open.right)}
    >
      <Icon
        icon={layout.open.right ? "lucide:panel-right-close" : "lucide:panel-right"}
        class="size-4"
      />
    </button>

    {#if desktop}
      <WindowControls />
    {/if}
  </div>
</header>

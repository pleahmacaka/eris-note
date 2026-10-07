<script lang="ts">
  import Icon from "@iconify/svelte"
  import NoteLogo from "$lib/components/ui/NoteLogo.svelte"
  import { isAndroid } from "$lib/platform/runtime"
  import { device } from "$lib/settings.svelte"
  import { adoptLegacyVault, chooseVault, forgetVault, switchVault, vaultName } from "$lib/vault/vaults"
  import WindowControls from "./WindowControls.svelte"

  let failure = $state("")

  const attempt = async (task: () => Promise<unknown>) => {
    failure = ""

    try {
      await task()
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error)
    }
  }

  $effect(() => {
    adoptLegacyVault().catch(() => undefined)
  })
</script>

<div class="flex h-dvh flex-col bg-base-200 text-base-content">
  <header data-tauri-drag-region class="flex h-9 shrink-0 items-center justify-end select-none">
    {#if !isAndroid()}
      <WindowControls />
    {/if}
  </header>

  <main class="flex min-h-0 flex-1 items-center justify-center p-6">
    <section class="flex w-full max-w-md flex-col gap-6 border border-base-content/10 bg-base-100 p-6">
      <div class="flex items-center gap-3">
        <NoteLogo class="size-8" />

        <div>
          <h1 class="text-lg font-black tracking-tighter">note</h1>
          <p class="text-sm text-base-content/60">노트를 저장할 폴더를 볼트로 지정하세요.</p>
        </div>
      </div>

      {#if device.value.vault.recent.length > 0}
        <ul class="flex flex-col border border-base-content/10">
          {#each device.value.vault.recent as path (path)}
            <li class="group flex items-center gap-1 border-b border-base-content/10 last:border-b-0">
              <button
                type="button"
                class="flex min-w-0 flex-1 cursor-pointer flex-col items-start px-3 py-2 text-left hover:bg-base-content/5"
                onclick={() => attempt(() => switchVault(path))}
              >
                <span class="truncate text-sm font-semibold">{vaultName(path)}</span>
                <span class="w-full truncate text-xs text-base-content/50">{path}</span>
              </button>

              <button
                type="button"
                class="btn btn-ghost btn-square btn-xs mr-2 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                aria-label="목록에서 제거"
                title="목록에서 제거"
                onclick={() => attempt(() => forgetVault(path))}
              >
                <Icon icon="lucide:x" class="size-3.5" />
              </button>
            </li>
          {/each}
        </ul>
      {/if}

      <button type="button" class="btn btn-primary" onclick={() => attempt(chooseVault)}>
        <Icon icon="lucide:folder-open" class="size-4" />
        폴더를 볼트로 열기
      </button>

      {#if failure}
        <p class="text-xs text-error">{failure}</p>
      {/if}
    </section>
  </main>
</div>

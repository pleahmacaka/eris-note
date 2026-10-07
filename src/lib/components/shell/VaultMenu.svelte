<script lang="ts">
  import Icon from "@iconify/svelte"
  import NoteLogo from "$lib/components/ui/NoteLogo.svelte"
  import { anchorMenu, type MenuItem } from "$lib/menu/menu.svelte"
  import { device } from "$lib/settings.svelte"
  import { chooseVault, switchVault, vaultName } from "$lib/vault/vaults"
  import { openView } from "$lib/workspace/workspace.svelte"

  const current = $derived(device.value.vault.path)

  const items = (): MenuItem[] => [
    ...device.value.vault.recent.map(path => ({
      label: vaultName(path),
      icon: path === current ? "lucide:check" : "lucide:vault",
      run: () => (path === current ? undefined : switchVault(path)),
    })),
    "separator",
    { label: "폴더를 볼트로 열기", icon: "lucide:folder-open", run: chooseVault },
    "separator",
    { label: "설정", icon: "lucide:settings", keys: "Ctrl ,", run: () => openView("settings") },
  ]
</script>

<button
  type="button"
  class={[
    "flex h-7 max-w-56 min-w-0 cursor-pointer items-center gap-2 px-2 text-sm",
    "transition-colors hover:bg-base-content/8",
  ]}
  title={current ?? ""}
  onclick={e => anchorMenu(e.currentTarget, items())}
>
  <NoteLogo class="size-4.5 shrink-0" />
  <span class="min-w-0 truncate font-semibold">{current ? vaultName(current) : "note"}</span>
  <Icon icon="lucide:chevrons-up-down" class="size-3.5 shrink-0 text-base-content/50" />
</button>

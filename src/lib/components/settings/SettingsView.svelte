<script lang="ts">
  import { type PrefsPage, PrefsWindow } from "@eris/ui"
  import AboutSection from "./AboutSection.svelte"
  import AppearanceSection from "./AppearanceSection.svelte"
  import LayoutSection from "./LayoutSection.svelte"
  import SyncSection from "./SyncSection.svelte"
  import VaultSection from "./VaultSection.svelte"

  const PAGES: PrefsPage[] = [
    { id: "general", label: "일반", icon: "lucide:sliders-horizontal" },
    { id: "vault", label: "볼트", icon: "lucide:vault" },
    { id: "sync", label: "동기화", icon: "lucide:radio-tower" },
    { id: "layout", label: "레이아웃", icon: "lucide:panels-top-left" },
    { id: "about", label: "정보", icon: "lucide:info" },
  ]

  const VIEWS = {
    general: AppearanceSection,
    vault: VaultSection,
    sync: SyncSection,
    layout: LayoutSection,
    about: AboutSection,
  }

  let page = $state<keyof typeof VIEWS>("general")

  const View = $derived(VIEWS[page])
</script>

<div class="flex min-h-0 flex-1 bg-base-100">
  <PrefsWindow
    title="설정"
    pages={PAGES}
    bind:page={() => page, next => (page = next as keyof typeof VIEWS)}
  >
    {#key page}
      <View />
    {/key}
  </PrefsWindow>
</div>

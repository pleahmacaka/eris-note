<script lang="ts">
  import { icons as lucide } from "@iconify-json/lucide"
  import { addCollection } from "@iconify/svelte"
  import { isTauri } from "$lib/platform/runtime"
  import { device, watchDevice } from "$lib/settings.svelte"
  import { startAutoSync } from "$lib/sync/engine"
  import { erisStyle, startErisLink } from "$lib/sync/eris.svelte"
  import { applyAppearance } from "$lib/theme"
  import "@eris/markdown/markdown.css"
  import "./layout.css"

  const { children } = $props()

  addCollection(lucide)

  $effect(() => watchDevice())

  $effect(() => (isTauri() ? startAutoSync() : undefined))

  $effect(() => (isTauri() ? startErisLink() : undefined))

  $effect(() => {
    applyAppearance(device.value.look, device.value.followEris ? erisStyle.value : null)
  })
</script>

{@render children()}

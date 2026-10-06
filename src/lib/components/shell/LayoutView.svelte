<script lang="ts">
  import { isPane, type Region } from "$lib/workspace/workspace.svelte"
  import LayoutView from "./LayoutView.svelte"
  import PaneView from "./PaneView.svelte"

  const { region }: { region: Region } = $props()
</script>

{#if isPane(region)}
  <PaneView pane={region} />
{:else}
  <div
    class={[
      "flex min-h-0 min-w-0 flex-1 divide-base-content/10 max-lg:contents",
      region.direction === "row" ? "flex-row divide-x" : "flex-col divide-y",
    ]}
  >
    {#each region.children as child (child.id)}
      <LayoutView region={child} />
    {/each}
  </div>
{/if}

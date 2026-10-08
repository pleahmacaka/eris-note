<script lang="ts">
  import Icon from "@iconify/svelte"
  import { attachmentUrl, openWithSystem } from "$lib/vault/attachments"
  import { basename, fileIcon, isImage, isPdf } from "$lib/vault/paths"
  import PdfView from "./PdfView.svelte"

  const { path }: { path: string } = $props()

  let image = $state<string | null>(null)
  let failure = $state("")

  $effect(() => {
    if (!isImage(path)) {
      return
    }

    let url: string | null = null
    let disposed = false

    attachmentUrl(path)
      .then(next => {
        url = next

        if (disposed) {
          URL.revokeObjectURL(next)
        } else {
          image = next
        }
      })
      .catch(error => (failure = String(error)))

    return () => {
      disposed = true

      if (url) {
        URL.revokeObjectURL(url)
      }
    }
  })

  const openSystem = () => {
    openWithSystem(path).catch(error => (failure = String(error)))
  }
</script>

{#if isPdf(path)}
  <PdfView {path} />
{:else if isImage(path)}
  <div class="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-base-200 p-4">
    {#if image}
      <img src={image} alt={basename(path)} class="max-h-full max-w-full object-contain" />
    {/if}
  </div>
{:else}
  <div class="flex flex-1 flex-col items-center justify-center gap-3 bg-base-100 p-6 text-center">
    <Icon icon={fileIcon(path)} class="size-10 text-base-content/40" />
    <p class="text-sm font-medium break-all">{basename(path)}</p>
    <p class="text-xs text-base-content/55">미리보기 미지원</p>
    <button class="btn btn-sm" onclick={openSystem}>기본 앱으로 열기</button>
  </div>
{/if}

{#if failure}
  <p class="px-6 pb-4 text-xs text-error">{failure}</p>
{/if}

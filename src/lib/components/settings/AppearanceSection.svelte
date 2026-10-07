<script lang="ts">
  import { Row, Section, Segmented, StandaloneTheme } from "@eris/ui"
  import { debounce } from "es-toolkit"
  import { noteLook, patchAppearance, saveStyle, type TodoSort } from "$lib/settings"
  import { device } from "$lib/settings.svelte"

  type Style = { followEris: boolean; look: typeof device.value.look }

  const SAVE_DELAY = 250

  const SORTS: { value: TodoSort; label: string }[] = [
    { value: "due", label: "마감순" },
    { value: "priority", label: "중요도순" },
    { value: "manual", label: "직접" },
  ]

  const WEEK: { value: "monday" | "sunday"; label: string }[] = [
    { value: "monday", label: "월요일" },
    { value: "sunday", label: "일요일" },
  ]

  const appearance = $derived(device.value.appearance)

  const styleOf = (): Style => ({
    followEris: device.value.followEris,
    look: $state.snapshot(device.value.look),
  })

  let saved = JSON.stringify(styleOf())

  const persist = debounce((style: Style) => {
    saved = JSON.stringify(style)
    saveStyle(style)
  }, SAVE_DELAY)

  $effect(() => {
    const style = styleOf()

    if (JSON.stringify(style) !== saved) {
      persist(style)
    }
  })
</script>

<StandaloneTheme prefs={device.value} defaults={noteLook} />

<Section title="캘린더와 할 일">
  <Row label="한 주의 시작" hint="캘린더 첫 열입니다.">
    <Segmented
      label="한 주의 시작"
      options={WEEK}
      value={appearance.weekStartsMonday ? "monday" : "sunday"}
      onchange={value => patchAppearance({ weekStartsMonday: value === "monday" })}
    />
  </Row>

  <Row label="할 일 정렬" hint="할 일 보드 정렬 순서입니다.">
    <Segmented
      label="할 일 정렬"
      options={SORTS}
      value={appearance.todoSort}
      onchange={value => patchAppearance({ todoSort: value })}
    />
  </Row>
</Section>

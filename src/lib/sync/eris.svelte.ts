import { erisStyle as sharedStyle } from "@eris/ui"
import { localRecords, onDataChange } from "../data/store"
import { ensureDevice } from "../device"
import { erisBridgePublish, erisBridgeRead } from "../platform/eris"
import { type FollowedStyle, readStyle } from "../theme"
import { applyLocalSnapshot, pack } from "./engine"

const POLL = 15_000
const DEBOUNCE = 1_000

export const erisStyle = $state<{ value: FollowedStyle | null }>({
  value: null,
})

const linked = async () => {
  const device = await ensureDevice()

  return device.sync.collections.events ? device : null
}

export const startErisLink = () => {
  let published = ""
  let received = ""
  let styled: string | null = null
  let timer: ReturnType<typeof setTimeout> | undefined

  const publish = async () => {
    const device = await linked()

    if (!device) {
      return
    }

    const text = pack(device.deviceId, await localRecords(["events"]))

    if (text !== published) {
      await erisBridgePublish(text)
      published = text
    }
  }

  const pull = async () => {
    if (!(await linked())) {
      return
    }

    const text = await erisBridgeRead("events.json")

    if (!text || text === received) {
      return
    }

    await applyLocalSnapshot(text)
    received = text
  }

  const follow = async () => {
    const text = await erisBridgeRead("style.json")

    if (text !== styled) {
      styled = text
      erisStyle.value = text === null ? null : readStyle(text)
      sharedStyle.linked = erisStyle.value !== null
    }
  }

  const tick = () => {
    pull()
      .then(publish)
      .catch(() => undefined)

    follow().catch(() => undefined)
  }

  tick()

  const poll = setInterval(tick, POLL)
  const stop = onDataChange(change => {
    if (change.collection === "events" && !change.remote) {
      clearTimeout(timer)
      timer = setTimeout(() => publish().catch(() => undefined), DEBOUNCE)
    }
  })

  return () => {
    clearInterval(poll)
    clearTimeout(timer)
    stop.then(fn => fn())
  }
}

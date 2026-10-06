export type ErisBridgeFile = "events.json" | "style.json"

const call = async <T>(command: string, args: Record<string, unknown>) => {
  const { invoke } = await import("@tauri-apps/api/core")

  return invoke<T>(command, args)
}

export const erisBridgeRead = (name: ErisBridgeFile) =>
  call<string | null>("eris_bridge_read", { name })

export const erisBridgePublish = (text: string) =>
  call<void>("eris_bridge_publish", { text })

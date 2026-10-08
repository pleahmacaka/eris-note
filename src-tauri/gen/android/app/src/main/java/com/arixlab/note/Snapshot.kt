package com.arixlab.note

import org.json.JSONObject

data class MirroredEvent(
  val key: String,
  val title: String,
  val notes: String,
  val start: Long,
  val end: Long,
  val allDay: Boolean,
) {
  val stamp get() = "$title|$notes|$start|$end|$allDay".hashCode().toString()
}

data class Snapshot(val events: List<MirroredEvent>, val weekStartsMonday: Boolean) {
  companion object {
    const val FILE = "calendar-widget.json"

    fun parse(json: String): Snapshot {
      val root = JSONObject(json)
      val list = root.optJSONArray("events")
      val events = (0 until (list?.length() ?: 0)).map {
        val item = list!!.getJSONObject(it)

        MirroredEvent(
          key = item.getString("key"),
          title = item.optString("title"),
          notes = item.optString("notes"),
          start = item.getLong("start"),
          end = item.getLong("end"),
          allDay = item.optBoolean("allDay"),
        )
      }

      return Snapshot(events, root.optBoolean("weekStartsMonday"))
    }
  }
}

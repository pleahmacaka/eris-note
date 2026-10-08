package com.arixlab.note

import android.Manifest
import android.content.pm.PackageManager
import android.webkit.JavascriptInterface
import androidx.core.content.ContextCompat
import java.io.File
import java.util.concurrent.Executors

class NoteBridge(private val activity: MainActivity) {
  private val worker = Executors.newSingleThreadExecutor()

  private fun granted() = CALENDAR_PERMISSIONS.all {
    ContextCompat.checkSelfPermission(activity, it) == PackageManager.PERMISSION_GRANTED
  }

  @JavascriptInterface
  fun calendarAccess(): Boolean = granted()

  @JavascriptInterface
  fun requestCalendar() {
    activity.runOnUiThread {
      activity.requestPermissions(CALENDAR_PERMISSIONS) { resync() }
    }
  }

  private fun resync() {
    worker.execute {
      val saved = File(activity.filesDir, Snapshot.FILE)

      if (granted() && saved.exists()) {
        runCatching { CalendarMirror.sync(activity, Snapshot.parse(saved.readText()).events) }
      }
    }
  }

  @JavascriptInterface
  fun mirror(json: String) {
    worker.execute {
      val snapshot = Snapshot.parse(json)

      File(activity.filesDir, Snapshot.FILE).writeText(json)
      CalendarWidget.refresh(activity)

      if (granted()) {
        runCatching { CalendarMirror.sync(activity, snapshot.events) }
      }
    }
  }

  companion object {
    val CALENDAR_PERMISSIONS = arrayOf(
      Manifest.permission.READ_CALENDAR,
      Manifest.permission.WRITE_CALENDAR,
    )
  }
}

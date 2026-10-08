package com.arixlab.note

import android.content.ContentProviderOperation
import android.content.ContentUris
import android.content.ContentValues
import android.content.Context
import android.net.Uri
import android.provider.CalendarContract
import android.provider.CalendarContract.Calendars
import android.provider.CalendarContract.Events
import java.util.TimeZone

object CalendarMirror {
  private const val ACCOUNT = "arixlab Note"
  private const val COLOR = 0xFF8B48D9.toInt()
  private const val BATCH = 200

  private fun asSyncAdapter(uri: Uri): Uri = uri.buildUpon()
    .appendQueryParameter(CalendarContract.CALLER_IS_SYNCADAPTER, "true")
    .appendQueryParameter(Calendars.ACCOUNT_NAME, ACCOUNT)
    .appendQueryParameter(Calendars.ACCOUNT_TYPE, CalendarContract.ACCOUNT_TYPE_LOCAL)
    .build()

  private fun findCalendar(context: Context): Long? =
    context.contentResolver.query(
      Calendars.CONTENT_URI,
      arrayOf(Calendars._ID),
      "${Calendars.ACCOUNT_NAME} = ? AND ${Calendars.ACCOUNT_TYPE} = ?",
      arrayOf(ACCOUNT, CalendarContract.ACCOUNT_TYPE_LOCAL),
      null,
    )?.use { if (it.moveToFirst()) it.getLong(0) else null }

  private fun createCalendar(context: Context): Long {
    val values = ContentValues().apply {
      put(Calendars.ACCOUNT_NAME, ACCOUNT)
      put(Calendars.ACCOUNT_TYPE, CalendarContract.ACCOUNT_TYPE_LOCAL)
      put(Calendars.NAME, ACCOUNT)
      put(Calendars.CALENDAR_DISPLAY_NAME, ACCOUNT)
      put(Calendars.CALENDAR_COLOR, COLOR)
      put(Calendars.CALENDAR_ACCESS_LEVEL, Calendars.CAL_ACCESS_READ)
      put(Calendars.OWNER_ACCOUNT, ACCOUNT)
      put(Calendars.VISIBLE, 1)
      put(Calendars.SYNC_EVENTS, 1)
      put(Calendars.CALENDAR_TIME_ZONE, TimeZone.getDefault().id)
    }
    val uri = context.contentResolver.insert(asSyncAdapter(Calendars.CONTENT_URI), values)
      ?: error("calendar provider refused the Note calendar")

    return ContentUris.parseId(uri)
  }

  private fun valuesOf(event: MirroredEvent, calendar: Long) = ContentValues().apply {
    put(Events.CALENDAR_ID, calendar)
    put(Events.TITLE, event.title)
    put(Events.DESCRIPTION, event.notes)
    put(Events.DTSTART, event.start)
    put(Events.DTEND, event.end)
    put(Events.ALL_DAY, if (event.allDay) 1 else 0)
    put(Events.EVENT_TIMEZONE, if (event.allDay) "UTC" else TimeZone.getDefault().id)
    put(Events._SYNC_ID, event.key)
    put(Events.SYNC_DATA1, event.stamp)
  }

  private fun rowUri(id: Long) = asSyncAdapter(ContentUris.withAppendedId(Events.CONTENT_URI, id))

  fun sync(context: Context, events: List<MirroredEvent>) {
    val calendar = findCalendar(context) ?: createCalendar(context)
    val stored = HashMap<String, Pair<Long, String?>>()

    context.contentResolver.query(
      asSyncAdapter(Events.CONTENT_URI),
      arrayOf(Events._ID, Events._SYNC_ID, Events.SYNC_DATA1),
      "${Events.CALENDAR_ID} = ?",
      arrayOf(calendar.toString()),
      null,
    )?.use {
      while (it.moveToNext()) {
        val key = it.getString(1) ?: continue

        stored[key] = it.getLong(0) to it.getString(2)
      }
    }

    val operations = ArrayList<ContentProviderOperation>()
    val wanted = HashSet<String>()

    for (event in events) {
      wanted += event.key

      val row = stored[event.key]

      if (row?.second == event.stamp) {
        continue
      }

      val values = valuesOf(event, calendar)

      operations += if (row == null) {
        ContentProviderOperation.newInsert(asSyncAdapter(Events.CONTENT_URI)).withValues(values).build()
      } else {
        ContentProviderOperation.newUpdate(rowUri(row.first)).withValues(values).build()
      }
    }

    for ((key, row) in stored) {
      if (key !in wanted) {
        operations += ContentProviderOperation.newDelete(rowUri(row.first)).build()
      }
    }

    // one binder transaction caps near 1 MB, so a large first mirror goes in slices
    for (slice in operations.chunked(BATCH)) {
      context.contentResolver.applyBatch(CalendarContract.AUTHORITY, ArrayList(slice))
    }
  }
}

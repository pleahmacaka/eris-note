package com.arixlab.note

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.widget.RemoteViews
import java.io.File
import java.text.DateFormatSymbols
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import java.util.TimeZone

class CalendarWidget : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    manager.updateAppWidget(ids, render(context))
  }

  companion object {
    private const val TITLES_PER_DAY = 3
    private const val SPAN_LIMIT_DAYS = 62
    private const val SUNDAY = 0xFFFF6B6B.toInt()
    private const val SATURDAY = 0xFF6BA8FF.toInt()
    private const val TEXT = Color.WHITE

    fun refresh(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, CalendarWidget::class.java))

      if (ids.isNotEmpty()) {
        manager.updateAppWidget(ids, render(context))
      }
    }

    private fun load(context: Context) = runCatching {
      Snapshot.parse(File(context.filesDir, Snapshot.FILE).readText())
    }.getOrElse { Snapshot(emptyList(), false) }

    private fun dayKey(calendar: Calendar) =
      calendar.get(Calendar.YEAR) * 10_000 +
        (calendar.get(Calendar.MONTH) + 1) * 100 +
        calendar.get(Calendar.DAY_OF_MONTH)

    private fun titlesByDay(events: List<MirroredEvent>): Map<Int, List<String>> {
      val days = HashMap<Int, MutableList<String>>()

      for (event in events.sortedWith(compareBy({ !it.allDay }, { it.start }))) {
        val zone = if (event.allDay) TimeZone.getTimeZone("UTC") else TimeZone.getDefault()
        val cursor = Calendar.getInstance(zone).apply { timeInMillis = event.start }
        val last = Calendar.getInstance(zone).apply { timeInMillis = maxOf(event.start, event.end - 1) }

        var spanned = 0

        while (spanned < SPAN_LIMIT_DAYS) {
          days.getOrPut(dayKey(cursor)) { mutableListOf() } += event.title

          if (dayKey(cursor) >= dayKey(last)) {
            break
          }

          cursor.add(Calendar.DAY_OF_MONTH, 1)
          spanned++
        }
      }

      return days
    }

    private fun weekdayColor(weekday: Int) = when (weekday) {
      Calendar.SUNDAY -> SUNDAY
      Calendar.SATURDAY -> SATURDAY
      else -> TEXT
    }

    private fun openApp(context: Context) = PendingIntent.getActivity(
      context,
      0,
      Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )

    fun render(context: Context): RemoteViews {
      val snapshot = load(context)
      val titles = titlesByDay(snapshot.events)
      val locale = Locale.getDefault()
      val today = Calendar.getInstance()
      val todayKey = dayKey(today)
      val month = today.get(Calendar.MONTH)
      val weekStart = if (snapshot.weekStartsMonday) Calendar.MONDAY else Calendar.SUNDAY
      val first = (today.clone() as Calendar).apply { set(Calendar.DAY_OF_MONTH, 1) }
      val offset = (first.get(Calendar.DAY_OF_WEEK) - weekStart + 7) % 7
      val weeks = (offset + first.getActualMaximum(Calendar.DAY_OF_MONTH) + 6) / 7
      val cursor = (first.clone() as Calendar).apply { add(Calendar.DAY_OF_MONTH, -offset) }
      val pattern = android.text.format.DateFormat.getBestDateTimePattern(locale, "yMMMM")
      val names = DateFormatSymbols(locale).shortWeekdays
      val views = RemoteViews(context.packageName, R.layout.widget_month)

      views.setTextViewText(R.id.widget_title, SimpleDateFormat(pattern, locale).format(today.time))
      views.removeAllViews(R.id.widget_weekdays)
      views.removeAllViews(R.id.widget_weeks)

      for (index in 0 until 7) {
        val weekday = (weekStart - 1 + index) % 7 + 1
        val label = RemoteViews(context.packageName, R.layout.widget_weekday)

        label.setTextViewText(R.id.weekday, names[weekday])
        label.setTextColor(R.id.weekday, weekdayColor(weekday))
        views.addView(R.id.widget_weekdays, label)
      }

      repeat(weeks) {
        val row = RemoteViews(context.packageName, R.layout.widget_row)

        repeat(7) {
          val cell = RemoteViews(context.packageName, R.layout.widget_cell)
          val key = dayKey(cursor)
          val inMonth = cursor.get(Calendar.MONTH) == month
          val color = weekdayColor(cursor.get(Calendar.DAY_OF_WEEK)).let {
            if (inMonth) it else it and 0x66FFFFFF
          }

          cell.setTextViewText(R.id.cell_day, cursor.get(Calendar.DAY_OF_MONTH).toString())
          cell.setTextColor(R.id.cell_day, if (key == todayKey) TEXT else color)
          cell.setInt(R.id.cell_day, "setBackgroundResource", if (key == todayKey) R.drawable.widget_today else 0)
          cell.setTextViewText(R.id.cell_events, titles[key].orEmpty().take(TITLES_PER_DAY).joinToString("\n"))
          row.addView(R.id.widget_row, cell)
          cursor.add(Calendar.DAY_OF_MONTH, 1)
        }

        views.addView(R.id.widget_weeks, row)
      }

      views.setOnClickPendingIntent(R.id.widget_root, openApp(context))

      return views
    }
  }
}

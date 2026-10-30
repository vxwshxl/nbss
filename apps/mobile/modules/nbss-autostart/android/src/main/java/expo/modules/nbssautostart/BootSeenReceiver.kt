package expo.modules.nbssautostart

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

internal const val PREFS = "nbss.autostart"
internal const val BOOT_SEEN_AT = "bootSeenAt"

/**
 * Android hands the phone-started broadcast only to apps it lets start by themselves. Where
 * Autostart is off (Xiaomi, Vivo, Oppo and the rest), this never runs; where it is on, it
 * runs at every restart and notes when.
 */
class BootSeenReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putLong(BOOT_SEEN_AT, System.currentTimeMillis()).apply()
  }
}

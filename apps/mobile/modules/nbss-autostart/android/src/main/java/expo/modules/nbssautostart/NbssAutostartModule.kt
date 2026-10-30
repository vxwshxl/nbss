package expo.modules.nbssautostart

import android.app.AppOpsManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Process
import android.os.SystemClock
import android.provider.Settings
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Each brand's own Autostart screen, newest first; the first one this phone has opens. */
private val AUTOSTART_SCREENS = listOf(
  // Xiaomi, Redmi, POCO (MIUI, HyperOS)
  "com.miui.securitycenter" to "com.miui.permcenter.autostart.AutoStartManagementActivity",
  // Vivo, iQOO
  "com.vivo.permissionmanager" to "com.vivo.permissionmanager.activity.BgStartUpManagerActivity",
  "com.iqoo.secure" to "com.iqoo.secure.ui.phoneoptimize.BgStartUpManager",
  "com.iqoo.secure" to "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity",
  // Oppo, Realme, OnePlus (ColorOS)
  "com.coloros.safecenter" to "com.coloros.safecenter.permission.startup.StartupAppListActivity",
  "com.coloros.safecenter" to "com.coloros.safecenter.startupapp.StartupAppListActivity",
  "com.oppo.safe" to "com.oppo.safe.permission.startup.StartupAppListActivity",
  "com.oneplus.security" to "com.oneplus.security.chainlaunch.view.ChainLaunchAppListActivity",
  // Huawei, Honor
  "com.huawei.systemmanager" to "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity",
  "com.huawei.systemmanager" to "com.huawei.systemmanager.optimize.process.ProtectActivity",
  "com.hihonor.systemmanager" to "com.hihonor.systemmanager.startupmgr.ui.StartupNormalAppListActivity",
  // Asus
  "com.asus.mobilemanager" to "com.asus.mobilemanager.autostart.AutoStartActivity",
  "com.asus.mobilemanager" to "com.asus.mobilemanager.entry.FunctionActivity",
  // Tecno, Infinix, itel
  "com.transsion.phonemaster" to "com.cyin.himgr.autostart.AutoStartActivity",
  // Letv
  "com.letv.android.letvsafe" to "com.letv.android.letvsafe.AutobootManageActivity",
)

/** MIUI's own app-op for Autostart (not in Android itself). */
private const val OP_MIUI_AUTOSTART = 10008

class NbssAutostartModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("NbssAutostart")

    /** "on", "off", or "unknown": the Autostart switch itself, readable on Xiaomi, Redmi and POCO only. */
    Function("miuiAutostart") {
      val brand = "${Build.BRAND} ${Build.MANUFACTURER}".lowercase()
      if (!brand.contains("xiaomi") && !brand.contains("redmi") && !brand.contains("poco")) return@Function "unknown"
      try {
        val ops = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val check = AppOpsManager::class.java.getMethod("checkOpNoThrow", Int::class.javaPrimitiveType, Int::class.javaPrimitiveType, String::class.java)
        when (check.invoke(ops, OP_MIUI_AUTOSTART, Process.myUid(), context.packageName) as Int) {
          AppOpsManager.MODE_ALLOWED -> "on"
          AppOpsManager.MODE_IGNORED, AppOpsManager.MODE_ERRORED -> "off"
          else -> "unknown"
        }
      } catch (e: Throwable) {
        "unknown"
      }
    }

    /** When the phone last started (epoch ms) and when the app last saw a start by itself (0 = never). */
    Function("bootState") {
      val bootAt = System.currentTimeMillis() - SystemClock.elapsedRealtime()
      val seen = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getLong(BOOT_SEEN_AT, 0L)
      mapOf("bootAt" to bootAt.toDouble(), "seenAt" to seen.toDouble())
    }

    /** Opens this brand's Autostart screen; false when it has none, and the app's own settings opened instead. */
    Function("openAutostartSettings") {
      for ((pkg, cls) in AUTOSTART_SCREENS) {
        try {
          val intent = Intent().setComponent(ComponentName(pkg, cls)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          context.startActivity(intent)
          return@Function true
        } catch (e: Throwable) {
          // Not this brand, or not this version of it: try the next.
        }
      }
      try {
        context.startActivity(
          Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        )
      } catch (e: Throwable) {
        // Nothing left to open.
      }
      false
    }
  }
}

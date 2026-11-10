package com.kereem.pbs163

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import org.json.JSONObject
import java.util.LinkedHashMap

// Reads phone notifications for the in-app feed and provides the component
// MediaSessionManager needs for music control.
class MediaListenerService : NotificationListenerService() {

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        val n = sbn.notification ?: return
        if (sbn.packageName == packageName) return
        if (n.flags and Notification.FLAG_GROUP_SUMMARY != 0) return
        if (n.flags and Notification.FLAG_ONGOING_EVENT != 0) return

        val extras = n.extras ?: return
        val title = (extras.getCharSequence(Notification.EXTRA_TITLE)
            ?: extras.getCharSequence(Notification.EXTRA_TEXT))?.toString()?.trim()
        if (title.isNullOrEmpty()) return
        val text = (extras.getCharSequence(Notification.EXTRA_BIG_TEXT)
            ?: extras.getCharSequence(Notification.EXTRA_TEXT))?.toString()?.trim() ?: ""

        val appLabel = try {
            val pm = packageManager
            pm.getApplicationLabel(pm.getApplicationInfo(sbn.packageName, 0)).toString()
        } catch (e: Exception) {
            sbn.packageName
        }

        val obj = JSONObject()
            .put("key", sbn.key ?: "${sbn.packageName}:${sbn.postTime}")
            .put("app", appLabel)
            .put("title", title.take(120))
            .put("text", text.take(180))
            .put("time", sbn.postTime)

        synchronized(store) {
            store.remove(obj.getString("key"))
            store[obj.getString("key")] = obj
            while (store.size > 50) {
                val first = store.keys.firstOrNull() ?: break
                store.remove(first)
            }
        }
    }

    companion object {
        val store = LinkedHashMap<String, JSONObject>()
    }
}

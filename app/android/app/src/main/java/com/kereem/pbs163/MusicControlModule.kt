package com.kereem.pbs163

import android.content.ComponentName
import android.content.Intent
import android.media.session.MediaController
import android.media.session.MediaSessionManager
import android.media.session.PlaybackState
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import org.json.JSONArray

class MusicControlModule(private val ctx: ReactApplicationContext) :
    ReactContextBaseJavaModule(ctx) {

    override fun getName() = "MusicControl"

    private fun manager(): MediaSessionManager? =
        ctx.getSystemService(MediaSessionManager::class.java)

    private fun listenerComponent() =
        ComponentName(ctx, MediaListenerService::class.java)

    private fun activeController(): MediaController? {
        val sessions = try {
            manager()?.getActiveSessions(listenerComponent())
        } catch (e: SecurityException) {
            null
        } ?: return null
        return sessions.firstOrNull {
            it.playbackState?.state == PlaybackState.STATE_PLAYING
        } ?: sessions.firstOrNull()
    }

    private fun hasAccess(): Boolean {
        val enabled = Settings.Secure.getString(
            ctx.contentResolver,
            "enabled_notification_listeners"
        ) ?: return false
        return enabled.contains(ctx.packageName)
    }

    @ReactMethod
    fun hasAccess(promise: Promise) {
        promise.resolve(hasAccess())
    }

    @ReactMethod
    fun send(action: String, promise: Promise) {
        try {
            val controller = activeController()
            if (controller == null) {
                promise.resolve(false)
                return
            }
            val controls = controller.transportControls
            when (action) {
                "next" -> controls.skipToNext()
                "prev" -> controls.skipToPrevious()
                "playpause" -> {
                    if (controller.playbackState?.state == PlaybackState.STATE_PLAYING) {
                        controls.pause()
                    } else {
                        controls.play()
                    }
                }
                else -> {
                    promise.resolve(false)
                    return
                }
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("music_control", e.message, e)
        }
    }

    @ReactMethod
    fun getNotifications(promise: Promise) {
        val arr = JSONArray()
        synchronized(MediaListenerService.store) {
            MediaListenerService.store.values.forEach { arr.put(it) }
        }
        promise.resolve(arr.toString())
    }

    @ReactMethod
    fun clearNotifications() {
        synchronized(MediaListenerService.store) { MediaListenerService.store.clear() }
    }

    @ReactMethod
    fun openSettings() {
        val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        ctx.startActivity(intent)
    }
}

package com.kereem.pbs163

import android.service.notification.NotificationListenerService

// Exists only to satisfy MediaSessionManager.getActiveSessions().
// The user must grant BandBridge notification access.
class MediaListenerService : NotificationListenerService()

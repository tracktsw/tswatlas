package app.tracktsw.atlas;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.BitmapFactory;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

/**
 * BroadcastReceiver for AlarmManager-based daily reminders.
 * When the alarm fires, this receiver shows the notification and schedules the next day's alarm.
 */
public class ReminderAlarmReceiver extends BroadcastReceiver {
    private static final String TAG = "ReminderAlarmReceiver";
    public static final String CHANNEL_ID = "tsw_reminders";
    public static final String CHANNEL_NAME = "Daily Reminders";
    public static final int NOTIFICATION_ID = 1;
    public static final String ACTION_SHOW_REMINDER = "app.tracktsw.atlas.ACTION_SHOW_REMINDER";

    @Override
    public void onReceive(Context context, Intent intent) {
        Log.d(TAG, "Alarm received at " + System.currentTimeMillis());

        if (!ACTION_SHOW_REMINDER.equals(intent.getAction())) {
            Log.d(TAG, "Unknown action: " + intent.getAction());
            return;
        }

        // Check if reminders are still enabled
        SharedPreferences prefs = context.getSharedPreferences("tsw_reminder_prefs", Context.MODE_PRIVATE);
        boolean enabled = prefs.getBoolean("reminders_enabled", false);

        if (!enabled) {
            Log.d(TAG, "Reminders disabled, skipping notification");
            return;
        }

        // Create notification channel (required for Android 8+)
        createNotificationChannel(context);

        // Show the notification
        showNotification(context);

        // Schedule the next alarm for tomorrow
        int[] time = ReminderScheduler.getReminderTime(context);
        if (time != null) {
            ReminderScheduler.scheduleReminder(context, time[0], time[1]);
            Log.d(TAG, "Next reminder scheduled for " + time[0] + ":" + time[1]);
        } else {
            Log.d(TAG, "No reminder time set; skipping reschedule");
        }

        Log.d(TAG, "ReminderAlarmReceiver completed");
    }

    private void createNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH // Enables heads-up display
            );
            channel.setDescription("Daily check-in reminder notifications");
            channel.enableVibration(true);
            channel.enableLights(true);
            channel.setLightColor(0xFF6B8E7A);
            channel.setShowBadge(true);
            channel.setBypassDnd(false);
            channel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);

            NotificationManager manager = context.getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
                Log.d(TAG, "Notification channel created with IMPORTANCE_HIGH");
            }
        }
    }

    private void showNotification(Context context) {
        // Create intent to open the app when notification is tapped
        Intent intent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (intent != null) {
            intent.putExtra("route", "/check-in");
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        }

        PendingIntent pendingIntent = PendingIntent.getActivity(
            context,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Get the app icon resource - use mipmap foreground for the TrackTSW logo
        int smallIconRes = context.getResources().getIdentifier("ic_launcher_foreground", "mipmap", context.getPackageName());
        if (smallIconRes == 0) {
            smallIconRes = context.getResources().getIdentifier("ic_launcher", "mipmap", context.getPackageName());
        }
        if (smallIconRes == 0) {
            smallIconRes = android.R.drawable.ic_popup_reminder;
        }

        // Build the notification with HIGH priority for heads-up display
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(smallIconRes)
            .setContentTitle("Daily check-in ✨")
            .setContentText("How is your skin today? Take a moment to log your progress.")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_ALARM) // Use ALARM category for higher priority
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setColor(0xFF6B8E7A);

        // Try to set the app icon as large icon
        try {
            int largeIconRes = context.getResources().getIdentifier("ic_launcher", "mipmap", context.getPackageName());
            if (largeIconRes != 0) {
                builder.setLargeIcon(BitmapFactory.decodeResource(context.getResources(), largeIconRes));
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not set large icon: " + e.getMessage());
        }

        // Show the notification
        try {
            NotificationManagerCompat notificationManager = NotificationManagerCompat.from(context);
            notificationManager.notify(NOTIFICATION_ID, builder.build());
            Log.d(TAG, "Notification shown successfully with heads-up priority");
        } catch (SecurityException e) {
            Log.e(TAG, "No permission to post notifications: " + e.getMessage());
        }
    }
}

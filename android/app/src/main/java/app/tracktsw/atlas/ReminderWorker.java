package app.tracktsw.atlas;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.BitmapFactory;
import android.os.Build;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

/**
 * WorkManager-based daily reminder worker.
 * This replaces exact alarms with a more battery-friendly and policy-compliant approach.
 * The worker is scheduled daily with flexible timing (within a 15-minute window).
 */
public class ReminderWorker extends Worker {
    private static final String TAG = "ReminderWorker";
    public static final String CHANNEL_ID = "tsw_reminders";
    public static final String CHANNEL_NAME = "Daily Reminders";
    public static final int NOTIFICATION_ID = 1;

    public ReminderWorker(@NonNull Context context, @NonNull WorkerParameters workerParams) {
        super(context, workerParams);
    }

    @NonNull
    @Override
    public Result doWork() {
        Log.d(TAG, "ReminderWorker executing at " + System.currentTimeMillis());

        // Check if reminders are still enabled
        SharedPreferences prefs = getApplicationContext().getSharedPreferences("tsw_reminder_prefs", Context.MODE_PRIVATE);
        boolean enabled = prefs.getBoolean("reminders_enabled", false);

        if (!enabled) {
            Log.d(TAG, "Reminders disabled, skipping notification");
            return Result.success();
        }

        // Create notification channel (required for Android 8+)
        createNotificationChannel();

        // Show the notification
        showNotification();

        // Reschedule the next run (one-time work pattern)
        try {
            int[] time = ReminderScheduler.getReminderTime(getApplicationContext());
            if (time != null) {
                ReminderScheduler.scheduleReminder(getApplicationContext(), time[0], time[1]);
                Log.d(TAG, "Next reminder scheduled for " + time[0] + ":" + time[1]);
            } else {
                Log.d(TAG, "No reminder time set; skipping reschedule");
            }
        } catch (Exception e) {
            Log.w(TAG, "Failed to reschedule next reminder: " + e.getMessage());
        }

        Log.d(TAG, "ReminderWorker completed successfully");
        return Result.success();
    }

    private void createNotificationChannel() {
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
            // Force heads-up behavior
            channel.setBypassDnd(false);
            channel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);

            NotificationManager manager = getApplicationContext().getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
                Log.d(TAG, "Notification channel created with IMPORTANCE_HIGH");
            }
        }
    }

    private void showNotification() {
        Context context = getApplicationContext();

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
            .setPriority(NotificationCompat.PRIORITY_HIGH) // Critical for heads-up on older Android
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setColor(0xFF6B8E7A); // App brand color

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

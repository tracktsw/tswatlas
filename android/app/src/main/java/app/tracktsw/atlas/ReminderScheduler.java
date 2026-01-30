package app.tracktsw.atlas;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;

import java.util.Calendar;

/**
 * Handles scheduling and canceling of daily reminder alarms using AlarmManager.
 * Uses setExactAndAllowWhileIdle() for reliable exact-time delivery even under Doze mode.
 * 
 * This implementation:
 * - Uses a single exact alarm for the next trigger time
 * - When the alarm fires, ReminderAlarmReceiver schedules the next day's alarm
 * - Persists reminder settings to SharedPreferences
 * - Handles Android 12+ exact alarm permission requirements gracefully
 */
public class ReminderScheduler {
    private static final String TAG = "ReminderScheduler";
    private static final String PREFS_NAME = "tsw_reminder_prefs";
    private static final int ALARM_REQUEST_CODE = 1001;

    /**
     * Schedule the daily reminder using AlarmManager with exact timing.
     * Uses setExactAndAllowWhileIdle() to ensure delivery even under Doze mode.
     *
     * @param context Application context
     * @param hour Target hour (0-23)
     * @param minute Target minute (0-59)
     */
    public static void scheduleReminder(Context context, int hour, int minute) {
        Log.d(TAG, "Scheduling daily reminder for " + hour + ":" + minute);

        // Save the reminder settings
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit()
            .putBoolean("reminders_enabled", true)
            .putInt("reminder_hour", hour)
            .putInt("reminder_minute", minute)
            .putLong("scheduled_at", System.currentTimeMillis())
            .apply();

        // Calculate the trigger time
        long triggerTime = calculateTriggerTime(hour, minute);

        Log.d(TAG, "Trigger time: " + triggerTime + " (" + new java.util.Date(triggerTime) + ")");

        // Create the alarm intent
        Intent intent = new Intent(context, ReminderAlarmReceiver.class);
        intent.setAction(ReminderAlarmReceiver.ACTION_SHOW_REMINDER);

        PendingIntent pendingIntent = PendingIntent.getBroadcast(
            context,
            ALARM_REQUEST_CODE,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Get the AlarmManager
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) {
            Log.e(TAG, "AlarmManager is null, cannot schedule reminder");
            return;
        }

        // Cancel any existing alarm first
        alarmManager.cancel(pendingIntent);

        // Schedule the exact alarm
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                // Android 12+ requires checking canScheduleExactAlarms()
                if (alarmManager.canScheduleExactAlarms()) {
                    alarmManager.setExactAndAllowWhileIdle(
                        AlarmManager.RTC_WAKEUP,
                        triggerTime,
                        pendingIntent
                    );
                    Log.d(TAG, "Exact alarm scheduled successfully (Android 12+)");
                } else {
                    // Fallback: use setAndAllowWhileIdle (inexact but still works)
                    alarmManager.setAndAllowWhileIdle(
                        AlarmManager.RTC_WAKEUP,
                        triggerTime,
                        pendingIntent
                    );
                    Log.w(TAG, "Exact alarm permission not granted, using inexact alarm");
                }
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                // Android 6.0+ - use setExactAndAllowWhileIdle for Doze compatibility
                alarmManager.setExactAndAllowWhileIdle(
                    AlarmManager.RTC_WAKEUP,
                    triggerTime,
                    pendingIntent
                );
                Log.d(TAG, "Exact alarm scheduled successfully (Android 6+)");
            } else {
                // Pre-Android 6.0 - use setExact
                alarmManager.setExact(
                    AlarmManager.RTC_WAKEUP,
                    triggerTime,
                    pendingIntent
                );
                Log.d(TAG, "Exact alarm scheduled successfully (pre-Android 6)");
            }
        } catch (SecurityException e) {
            Log.e(TAG, "SecurityException scheduling alarm: " + e.getMessage());
            // Try inexact alarm as fallback
            try {
                alarmManager.setAndAllowWhileIdle(
                    AlarmManager.RTC_WAKEUP,
                    triggerTime,
                    pendingIntent
                );
                Log.w(TAG, "Fallback: inexact alarm scheduled");
            } catch (Exception fallbackException) {
                Log.e(TAG, "Failed to schedule any alarm: " + fallbackException.getMessage());
            }
        }
    }

    /**
     * Cancel the daily reminder.
     *
     * @param context Application context
     */
    public static void cancelReminder(Context context) {
        Log.d(TAG, "Canceling daily reminder");

        // Update preferences
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit()
            .putBoolean("reminders_enabled", false)
            .apply();

        // Cancel the alarm
        Intent intent = new Intent(context, ReminderAlarmReceiver.class);
        intent.setAction(ReminderAlarmReceiver.ACTION_SHOW_REMINDER);

        PendingIntent pendingIntent = PendingIntent.getBroadcast(
            context,
            ALARM_REQUEST_CODE,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager != null) {
            alarmManager.cancel(pendingIntent);
            Log.d(TAG, "Alarm canceled");
        }

        Log.d(TAG, "Daily reminder canceled");
    }

    /**
     * Check if reminders are currently enabled.
     *
     * @param context Application context
     * @return true if reminders are enabled
     */
    public static boolean isReminderEnabled(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        return prefs.getBoolean("reminders_enabled", false);
    }

    /**
     * Get the scheduled reminder time.
     *
     * @param context Application context
     * @return int array [hour, minute] or null if not set
     */
    public static int[] getReminderTime(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        if (!prefs.contains("reminder_hour")) {
            return null;
        }
        return new int[] {
            prefs.getInt("reminder_hour", 9),
            prefs.getInt("reminder_minute", 0)
        };
    }

    /**
     * Check if exact alarms can be scheduled (Android 12+).
     *
     * @param context Application context
     * @return true if exact alarms are allowed, or if running on pre-Android 12
     */
    public static boolean canScheduleExactAlarms(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            return alarmManager != null && alarmManager.canScheduleExactAlarms();
        }
        return true; // Pre-Android 12 doesn't need this permission
    }

    /**
     * Get the intent to open the exact alarm settings (Android 12+).
     *
     * @param context Application context
     * @return Intent to open settings, or null if not applicable
     */
    public static Intent getExactAlarmSettingsIntent(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
        }
        return null;
    }

    /**
     * Calculate the trigger time in milliseconds for the next occurrence of the target time.
     */
    private static long calculateTriggerTime(int targetHour, int targetMinute) {
        Calendar now = Calendar.getInstance();
        Calendar target = Calendar.getInstance();

        target.set(Calendar.HOUR_OF_DAY, targetHour);
        target.set(Calendar.MINUTE, targetMinute);
        target.set(Calendar.SECOND, 0);
        target.set(Calendar.MILLISECOND, 0);

        // If the target time has already passed today, schedule for tomorrow
        if (target.before(now) || target.equals(now)) {
            target.add(Calendar.DAY_OF_MONTH, 1);
        }

        long triggerTime = target.getTimeInMillis();
        long delay = triggerTime - now.getTimeInMillis();
        Log.d(TAG, "Trigger time calculated: " + triggerTime + " (delay: " + (delay / 1000 / 60) + " minutes)");
        return triggerTime;
    }

    /**
     * Reschedule reminders after device reboot.
     * Call this from a BroadcastReceiver that handles BOOT_COMPLETED.
     *
     * @param context Application context
     */
    public static void rescheduleAfterBoot(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        boolean enabled = prefs.getBoolean("reminders_enabled", false);

        if (enabled) {
            int hour = prefs.getInt("reminder_hour", 9);
            int minute = prefs.getInt("reminder_minute", 0);
            scheduleReminder(context, hour, minute);
            Log.d(TAG, "Reminders rescheduled after boot");
        }
    }
}

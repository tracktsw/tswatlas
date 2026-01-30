package app.tracktsw.atlas;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import androidx.work.ExistingWorkPolicy;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkManager;

import java.util.Calendar;
import java.util.concurrent.TimeUnit;

/**
 * Handles scheduling and canceling of daily reminder work using WorkManager.
 * This is compliant with Android 12+ restrictions on exact alarms and doesn't
 * require any special permissions.
 */
public class ReminderScheduler {
    private static final String TAG = "ReminderScheduler";
    private static final String WORK_NAME = "daily_checkin_reminder";
    private static final String PREFS_NAME = "tsw_reminder_prefs";

    /**
     * Schedule the daily reminder using WorkManager.
     * Uses a OneTimeWorkRequest that the worker reschedules after it runs.
     * This tends to behave more predictably than PeriodicWorkRequest across OEM task killers,
     * while still avoiding exact-alarm permissions.
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

        // Calculate the initial delay to the target time
        long initialDelay = calculateInitialDelay(hour, minute);

        Log.d(TAG, "Calculated initial delay: " + initialDelay + "ms (" + (initialDelay / 1000 / 60) + " minutes, " + (initialDelay / 1000 / 60 / 60) + " hours)");

        // Create a one-time work request and REPLACE any existing work.
        // ReminderWorker will schedule the next one after it runs.
        OneTimeWorkRequest reminderWork = new OneTimeWorkRequest.Builder(ReminderWorker.class)
            .setInitialDelay(initialDelay, TimeUnit.MILLISECONDS)
            .addTag("daily_reminder")
            .build();

        WorkManager.getInstance(context)
            .enqueueUniqueWork(
                WORK_NAME,
                ExistingWorkPolicy.REPLACE,
                reminderWork
            );

        Log.d(TAG, "Daily reminder scheduled successfully (one-time). Initial delay: " + (initialDelay / 1000 / 60) + " minutes");
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

        // Cancel the work
        WorkManager.getInstance(context)
            .cancelUniqueWork(WORK_NAME);

        Log.d(TAG, "Daily reminder canceled");
    }

    /**
     * Check if reminders are currently scheduled.
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
     * Calculate the delay in milliseconds until the next occurrence of the target time.
     */
    private static long calculateInitialDelay(int targetHour, int targetMinute) {
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

        long delay = target.getTimeInMillis() - now.getTimeInMillis();
        Log.d(TAG, "Initial delay calculated: " + delay + "ms (" + (delay / 1000 / 60) + " minutes)");
        return delay;
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

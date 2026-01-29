package app.tracktsw.atlas;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

/**
 * BroadcastReceiver to reschedule reminders after device reboot.
 * WorkManager handles this automatically, but this ensures immediate rescheduling.
 */
public class BootReceiver extends BroadcastReceiver {
    private static final String TAG = "BootReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {
            Log.d(TAG, "Device booted, rescheduling reminders");
            ReminderScheduler.rescheduleAfterBoot(context);
        }
    }
}

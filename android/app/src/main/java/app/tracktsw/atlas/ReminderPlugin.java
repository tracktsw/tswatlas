package app.tracktsw.atlas;

import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Capacitor plugin to interface with the native ReminderScheduler.
 * This allows the JavaScript/TypeScript code to schedule reminders using WorkManager
 * instead of exact alarms.
 */
@CapacitorPlugin(name = "ReminderPlugin")
public class ReminderPlugin extends Plugin {
    private static final String TAG = "ReminderPlugin";

    @PluginMethod
    public void scheduleReminder(PluginCall call) {
        int hour = call.getInt("hour", 9);
        int minute = call.getInt("minute", 0);

        Log.d(TAG, "scheduleReminder called: " + hour + ":" + minute);

        try {
            ReminderScheduler.scheduleReminder(getContext(), hour, minute);
            
            JSObject result = new JSObject();
            result.put("success", true);
            result.put("hour", hour);
            result.put("minute", minute);
            call.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Error scheduling reminder: " + e.getMessage());
            call.reject("Failed to schedule reminder", e);
        }
    }

    @PluginMethod
    public void cancelReminder(PluginCall call) {
        Log.d(TAG, "cancelReminder called");

        try {
            ReminderScheduler.cancelReminder(getContext());
            
            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Error canceling reminder: " + e.getMessage());
            call.reject("Failed to cancel reminder", e);
        }
    }

    @PluginMethod
    public void isReminderEnabled(PluginCall call) {
        Log.d(TAG, "isReminderEnabled called");

        try {
            boolean enabled = ReminderScheduler.isReminderEnabled(getContext());
            
            JSObject result = new JSObject();
            result.put("enabled", enabled);
            call.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Error checking reminder status: " + e.getMessage());
            call.reject("Failed to check reminder status", e);
        }
    }

    @PluginMethod
    public void getReminderTime(PluginCall call) {
        Log.d(TAG, "getReminderTime called");

        try {
            int[] time = ReminderScheduler.getReminderTime(getContext());
            
            JSObject result = new JSObject();
            if (time != null) {
                result.put("hour", time[0]);
                result.put("minute", time[1]);
                result.put("hasTime", true);
            } else {
                result.put("hasTime", false);
            }
            call.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Error getting reminder time: " + e.getMessage());
            call.reject("Failed to get reminder time", e);
        }
    }
}

package app.tracktsw.atlas;

import android.app.Activity;
import android.content.SharedPreferences;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.google.android.play.core.review.ReviewInfo;
import com.google.android.play.core.review.ReviewManager;
import com.google.android.play.core.review.ReviewManagerFactory;
import com.google.android.gms.tasks.Task;

@CapacitorPlugin(name = "InAppReview")
public class InAppReviewPlugin extends Plugin {
    
    private static final String TAG = "InAppReview";
    private static final String PREFS_NAME = "InAppReviewPrefs";
    private static final String KEY_HAS_REQUESTED = "hasRequestedInAppReview";
    
    @PluginMethod
    public void requestReview(PluginCall call) {
        Activity activity = getActivity();
        
        if (activity == null) {
            Log.e(TAG, "Activity is null");
            JSObject result = new JSObject();
            result.put("requested", false);
            call.resolve(result);
            return;
        }
        
        // Check if already requested
        SharedPreferences prefs = activity.getSharedPreferences(PREFS_NAME, Activity.MODE_PRIVATE);
        boolean hasRequested = prefs.getBoolean(KEY_HAS_REQUESTED, false);
        
        if (hasRequested) {
            Log.d(TAG, "Already requested, skipping");
            JSObject result = new JSObject();
            result.put("requested", false);
            call.resolve(result);
            return;
        }
        
        // Mark as requested immediately
        prefs.edit().putBoolean(KEY_HAS_REQUESTED, true).apply();
        
        // Create ReviewManager and request review flow
        ReviewManager reviewManager = ReviewManagerFactory.create(activity);
        Task<ReviewInfo> request = reviewManager.requestReviewFlow();
        
        request.addOnCompleteListener(task -> {
            if (task.isSuccessful()) {
                ReviewInfo reviewInfo = task.getResult();
                Task<Void> flow = reviewManager.launchReviewFlow(activity, reviewInfo);
                
                flow.addOnCompleteListener(flowTask -> {
                    // The flow has finished. The API does not indicate whether the user
                    // reviewed or not, or even whether the review dialog was shown.
                    Log.d(TAG, "Review flow completed");
                    JSObject result = new JSObject();
                    result.put("requested", true);
                    call.resolve(result);
                });
            } else {
                Log.e(TAG, "Failed to request review flow", task.getException());
                JSObject result = new JSObject();
                result.put("requested", false);
                call.resolve(result);
            }
        });
    }
    
    @PluginMethod
    public void hasAlreadyRequested(PluginCall call) {
        Activity activity = getActivity();
        
        if (activity == null) {
            JSObject result = new JSObject();
            result.put("hasRequested", false);
            call.resolve(result);
            return;
        }
        
        SharedPreferences prefs = activity.getSharedPreferences(PREFS_NAME, Activity.MODE_PRIVATE);
        boolean hasRequested = prefs.getBoolean(KEY_HAS_REQUESTED, false);
        
        JSObject result = new JSObject();
        result.put("hasRequested", hasRequested);
        call.resolve(result);
    }
}

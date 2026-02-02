package app.tracktsw.atlas;

import android.os.Bundle;
import android.util.Log;
import android.webkit.JavascriptInterface;

import com.facebook.appevents.AppEventsLogger;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.Iterator;

/**
 * JavaScript bridge for Meta (Facebook) App Events.
 * Receives events from Capacitor webview and logs them via Facebook SDK.
 */
public class MetaAnalyticsPlugin {
    private static final String TAG = "MetaAnalytics";
    private final AppEventsLogger logger;

    public MetaAnalyticsPlugin(AppEventsLogger logger) {
        this.logger = logger;
    }

    @JavascriptInterface
    public void logEvent(String eventName, String parametersJson) {
        Log.d(TAG, "Logging event: " + eventName + " with params: " + parametersJson);
        
        try {
            Bundle params = new Bundle();
            
            if (parametersJson != null && !parametersJson.isEmpty() && !parametersJson.equals("{}")) {
                JSONObject jsonParams = new JSONObject(parametersJson);
                Iterator<String> keys = jsonParams.keys();
                
                while (keys.hasNext()) {
                    String key = keys.next();
                    Object value = jsonParams.get(key);
                    
                    if (value instanceof String) {
                        params.putString(key, (String) value);
                    } else if (value instanceof Integer) {
                        params.putInt(key, (Integer) value);
                    } else if (value instanceof Double) {
                        params.putDouble(key, (Double) value);
                    } else if (value instanceof Boolean) {
                        params.putBoolean(key, (Boolean) value);
                    } else {
                        params.putString(key, value.toString());
                    }
                }
            }
            
            if (params.isEmpty()) {
                logger.logEvent(eventName);
            } else {
                logger.logEvent(eventName, params);
            }
            
            Log.d(TAG, "Event logged successfully: " + eventName);
        } catch (JSONException e) {
            Log.e(TAG, "Failed to parse parameters JSON: " + e.getMessage());
            // Still log the event without parameters
            logger.logEvent(eventName);
        }
    }
}

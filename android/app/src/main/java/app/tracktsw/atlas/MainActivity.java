package app.tracktsw.atlas;

import android.os.Bundle;
import android.util.Log;
import android.view.WindowManager;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;
import com.facebook.FacebookSdk;
import com.facebook.appevents.AppEventsLogger;
import java.security.MessageDigest;
import android.util.Base64;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "TrackTSW_Meta";
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Register custom plugins
        registerPlugin(InAppReviewPlugin.class);
        
        // Initialize Meta SDK for Facebook Ads Attribution
        FacebookSdk.sdkInitialize(getApplicationContext());
        AppEventsLogger.activateApp(getApplication());
        
        // Debug: Log SDK initialization status
        Log.d(TAG, "=== META SDK DEBUG ===");
        Log.d(TAG, "Facebook SDK initialized: " + FacebookSdk.isInitialized());
        Log.d(TAG, "Application ID: " + FacebookSdk.getApplicationId());
        Log.d(TAG, "Client Token set: " + (FacebookSdk.getClientToken() != null && !FacebookSdk.getClientToken().isEmpty()));
        
        // Print the key hash for Meta Dashboard configuration
        printKeyHash();
        
        // Enable edge-to-edge display
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        
        // Use adjustPan for keyboard handling
        getWindow().setSoftInputMode(
            WindowManager.LayoutParams.SOFT_INPUT_ADJUST_PAN |
            WindowManager.LayoutParams.SOFT_INPUT_STATE_HIDDEN
        );
        
        // That's it! The capacitor-plugin-safe-area handles all insets via CSS variables
        // No need to manually apply padding - this was causing the gap
    }
    
    private void printKeyHash() {
        try {
            PackageInfo info = getPackageManager().getPackageInfo(
                getPackageName(), 
                PackageManager.GET_SIGNATURES
            );
            for (Signature signature : info.signatures) {
                MessageDigest md = MessageDigest.getInstance("SHA");
                md.update(signature.toByteArray());
                String keyHash = Base64.encodeToString(md.digest(), Base64.DEFAULT);
                Log.d(TAG, "=== KEY HASH FOR META DASHBOARD ===");
                Log.d(TAG, "Key Hash: " + keyHash.trim());
                Log.d(TAG, "Copy this hash to Meta Dashboard > Settings > Basic > Android > Key Hashes");
                Log.d(TAG, "===================================");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error getting key hash: " + e.getMessage());
        }
    }
}
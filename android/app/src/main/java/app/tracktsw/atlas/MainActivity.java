package app.tracktsw.atlas;

import android.os.Bundle;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;
import com.facebook.FacebookSdk;
import com.facebook.appevents.AppEventsLogger;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Initialize Meta SDK for Facebook Ads Attribution
        FacebookSdk.sdkInitialize(getApplicationContext());
        AppEventsLogger.activateApp(getApplication());
        
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
}
package app.tracktsw.atlas;

import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import android.view.View;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Keep edge-to-edge enabled
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        
        // CRITICAL: Use adjustPan for Visual Viewport to work correctly
        // adjustPan doesn't resize viewport, it pans content - perfect for our use case
        getWindow().setSoftInputMode(
            WindowManager.LayoutParams.SOFT_INPUT_ADJUST_PAN |
            WindowManager.LayoutParams.SOFT_INPUT_STATE_HIDDEN
        );
        
        // Get the root view
        View rootView = findViewById(android.R.id.content);
        
        // Apply window insets - ONLY for system bars
        ViewCompat.setOnApplyWindowInsetsListener(rootView, (v, windowInsets) -> {
            // Get system bars and display cutout insets (status bar, nav bar)
            Insets systemInsets = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() | 
                WindowInsetsCompat.Type.displayCutout()
            );
            
            int left = systemInsets.left;
            int top = systemInsets.top;
            int right = systemInsets.right;
            int bottom = systemInsets.bottom;
            
            // For Android 15+, ensure navigation bar insets are properly accounted for
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.VANILLA_ICE_CREAM) {
                Insets navInsets = windowInsets.getInsets(WindowInsetsCompat.Type.navigationBars());
                left = Math.max(left, navInsets.left);
                right = Math.max(right, navInsets.right);
                bottom = Math.max(bottom, navInsets.bottom);
            }
            
            // Apply ONLY system insets as padding
            v.setPadding(left, top, right, bottom);
            
            // Return the original insets without consuming them
            // This allows Visual Viewport API to work correctly
            return windowInsets;
        });
    }
}
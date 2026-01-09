package app.tracktsw.atlas;

import android.os.Build;
import android.os.Bundle;
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
        
        // Enable edge-to-edge for all Android versions
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        
        // Get the root view
        View rootView = findViewById(android.R.id.content);
        
        // Apply window insets
        ViewCompat.setOnApplyWindowInsetsListener(rootView, (v, windowInsets) -> {
            // Get system bars (status bar, navigation bar) and display cutout insets
            Insets insets = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() | 
                WindowInsetsCompat.Type.displayCutout()
            );
            
            int left = insets.left;
            int top = insets.top;
            int right = insets.right;
            int bottom = insets.bottom;
            
            // For Android 15+, ensure navigation bar insets are properly accounted for
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.VANILLA_ICE_CREAM) {
                Insets navInsets = windowInsets.getInsets(WindowInsetsCompat.Type.navigationBars());
                left = Math.max(left, navInsets.left);
                right = Math.max(right, navInsets.right);
                bottom = Math.max(bottom, navInsets.bottom);
            }
            
            // Apply combined insets as padding
            v.setPadding(left, top, right, bottom);
            
            // CRITICAL: Return windowInsets, NOT CONSUMED
            // This allows keyboard insets to propagate and push content up
            return windowInsets;
        });
    }
}
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
            Insets insets = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() | 
                WindowInsetsCompat.Type.displayCutout()
            );
            
            // Apply insets as padding
            v.setPadding(insets.left, insets.top, insets.right, insets.bottom);
            
            // For Android 15+, also handle navigation bars explicitly
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.VANILLA_ICE_CREAM) {
                Insets navInsets = windowInsets.getInsets(WindowInsetsCompat.Type.navigationBars());
                v.setPadding(insets.left, insets.top, insets.right, Math.max(insets.bottom, navInsets.bottom));
            }
            
            return WindowInsetsCompat.CONSUMED;
        });
    }
}
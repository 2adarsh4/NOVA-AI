package ai.jarvis.nova;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override public void onCreate(android.os.Bundle savedInstanceState) {
    registerPlugin(JarvisAndroidPlugin.class);
    super.onCreate(savedInstanceState);
  }
}

import type { CapacitorConfig } from "@capacitor/cli";

/**
 * ScholarFlow is a static client. Capacitor wraps the Vite `dist` output.
 * No server URL is configured — the Android WebView loads bundled files only.
 */
const config: CapacitorConfig = {
  appId: "com.scholarflow.app",
  appName: "ScholarFlow",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;

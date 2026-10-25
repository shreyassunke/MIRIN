import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.mirin.ios",
  appName: "MIRIN",
  webDir: "dist",
  ios: {
    contentInset: "never",
    backgroundColor: "#0a0a0a",
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: "#0a0a0a",
      showSpinner: false,
    },
  },
};

export default config;

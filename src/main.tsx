import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./auth/AuthProvider";
import { AppearanceSync } from "./lib/appearance";
import { installSyncHooks } from "./lib/sync/hooks";
import { registerAppUpdate } from "./registerUpdate";
import { SyncProvider } from "./sync/SyncProvider";
import "./index.css";

installSyncHooks();
registerAppUpdate();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter useTransitions={false}>
      <AppearanceSync />
      <AuthProvider>
        <SyncProvider>
          <App />
        </SyncProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./auth/AuthProvider";
import { installSyncHooks } from "./lib/sync/hooks";
import { SyncProvider } from "./sync/SyncProvider";
import "./index.css";

installSyncHooks();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <SyncProvider>
          <App />
        </SyncProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);

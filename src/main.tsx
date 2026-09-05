
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import "./styles/index.css";
  import { registerServiceWorker } from "./lib/pwa";

  // Register PWA Service Worker for offline support and native app installation
  registerServiceWorker();

  createRoot(document.getElementById("root")!).render(<App />);
  
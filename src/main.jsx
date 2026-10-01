import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles/app.css";
import { registerSW } from "virtual:pwa-register";

function configureInstallSurface() {
  const manifest = document.querySelector('link[rel="manifest"]') || document.createElement("link");
  manifest.setAttribute("rel", "manifest");
  manifest.setAttribute("href", "/manifest.webmanifest");
  if (!manifest.parentNode) document.head.appendChild(manifest);

  const favicon = document.querySelector('link[rel="icon"]');
  if (favicon) favicon.setAttribute("href", "/icon.svg");

  const touchIcon = document.querySelector('link[rel="apple-touch-icon"]') || document.createElement("link");
  touchIcon.setAttribute("rel", "apple-touch-icon");
  touchIcon.setAttribute("href", "/icon-192.png");
  if (!touchIcon.parentNode) document.head.appendChild(touchIcon);

  const theme = document.querySelector('meta[name="theme-color"]');
  if (theme) theme.setAttribute("content", "#102a43");

  const description = document.querySelector('meta[name="description"]');
  if (description) description.setAttribute("content", "Control documental de movimientos bancarios y facturas electrónicas.");
  document.title = "Rafiki Movimientos y Facturas";
}

configureInstallSurface();
registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import EmployeePublicPage from "./pages/EmployeePublicPage.jsx";
import "./styles/app.css";
import { registerSW } from "virtual:pwa-register";

const employeeSurface = window.location.pathname.replace(/\/$/, "") === "/empleados";

function configureInstallSurface() {
  const manifest = document.querySelector('link[rel="manifest"]') || document.createElement("link");
  manifest.setAttribute("rel", "manifest");
  manifest.setAttribute("href", "/manifest.webmanifest");
  if (!manifest.parentNode) document.head.appendChild(manifest);

  const favicon = document.querySelector('link[rel="icon"]');
  if (favicon && employeeSurface) favicon.setAttribute("href", "/empleados-icon.svg");

  const touchIcon = document.querySelector('link[rel="apple-touch-icon"]') || document.createElement("link");
  touchIcon.setAttribute("rel", "apple-touch-icon");
  touchIcon.setAttribute("href", employeeSurface ? "/empleados-icon-192.png" : "/icon-192.png");
  if (!touchIcon.parentNode) document.head.appendChild(touchIcon);

  const theme = document.querySelector('meta[name="theme-color"]');
  if (theme) theme.setAttribute("content", "#102a43");

  const description = document.querySelector('meta[name="description"]');
  if (description && employeeSurface) description.setAttribute("content", "Consulta y confirmación de pagos recientes para empleados de Rafiki.");

  if (employeeSurface) {
    document.title = "Rafiki Empleados";
    document.documentElement.dataset.surface = "employees";
  }
}

configureInstallSurface();
registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {employeeSurface ? <EmployeePublicPage /> : <App />}
  </React.StrictMode>
);

import React, { useEffect, useState } from "react";
import AppShell from "./components/AppShell.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import MovementsPage from "./pages/MovementsPage.jsx";
import InvoicesPage from "./pages/InvoicesPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import { Alert } from "./components/Ui.jsx";
import { getCurrentProfile, getSession, onAuthStateChange, signOut } from "./services/authService.js";
import { syncGmailQuick, syncInvoicesRecent } from "./services/gmailIntegrationService.js";

const pages = {
  inicio: DashboardPage,
  movimientos: MovementsPage,
  facturas: InvoicesPage,
  configuracion: SettingsPage
};

function LoadingScreen() {
  return <div className="loading-screen"><div className="brand-mark large">R</div><span>Cargando aplicación...</span></div>;
}

export default function App() {
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState("");
  const [movementsAutoEnabled, setMovementsAutoEnabled] = useState(() => localStorage.getItem("rafiki_movements_auto_sync") !== "false");
  const [invoicesAutoEnabled, setInvoicesAutoEnabled] = useState(() => localStorage.getItem("rafiki_invoices_auto_sync") === "true");
  const [autoSync, setAutoSync] = useState({ movements: { active: false, lastRun: null, message: "" }, invoices: { active: false, lastRun: null, message: "" } });
  const [activePage, setActivePage] = useState(() => {
    const requested = window.location.hash.replace("#", "") || "inicio";
    return pages[requested] ? requested : "inicio";
  });

  useEffect(() => {
    let active = true;
    getSession().then((current) => { if (active) setSession(current); }).catch(() => { if (active) setSession(null); });
    const subscription = onAuthStateChange((current) => setSession(current));
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!session) {
      setProfile(null);
      return;
    }
    setProfileError("");
    getCurrentProfile()
      .then((data) => {
        if (!data) throw new Error("No se encontró el perfil del usuario. Ejecuta el SQL de instalación.");
        if (data.status !== "active") throw new Error("Este usuario está inactivo. Contacta al Administrador.");
        setProfile(data);
      })
      .catch((error) => setProfileError(error.message || "No se pudo cargar el perfil."));
  }, [session]);

  useEffect(() => {
    if (!session || !profile || profile.role !== "admin") return undefined;
    let disposed = false;
    let movementRunning = false;
    let invoiceRunning = false;
    const syncMovements = async () => {
      if (movementRunning || disposed || !navigator.onLine) return;
      movementRunning = true;
      setAutoSync((v) => ({ ...v, movements: { ...v.movements, active: true, message: "Sincronizando movimientos..." } }));
      try {
        const data = await syncGmailQuick(1);
        if (!disposed) {
          window.dispatchEvent(new CustomEvent("rafiki:movements-updated", { detail: data }));
          setAutoSync((v) => ({ ...v, movements: { active: false, lastRun: new Date(), message: `${data.movements_created || 0} nuevos` } }));
        }
      } catch { if (!disposed) setAutoSync((v) => ({ ...v, movements: { active: false, lastRun: new Date(), message: "Error de sincronización" } })); }
      finally { movementRunning = false; }
    };
    const syncInvoices = async () => {
      if (invoiceRunning || disposed || !navigator.onLine) return;
      invoiceRunning = true;
      setAutoSync((v) => ({ ...v, invoices: { ...v.invoices, active: true, message: "Sincronizando facturas..." } }));
      try {
        const data = await syncInvoicesRecent();
        if (!disposed) {
          window.dispatchEvent(new CustomEvent("rafiki:invoices-updated", { detail: data }));
          setAutoSync((v) => ({ ...v, invoices: { active: false, lastRun: new Date(), message: `${data.invoices_created || 0} nuevas` } }));
        }
      } catch { if (!disposed) setAutoSync((v) => ({ ...v, invoices: { active: false, lastRun: new Date(), message: "Error de sincronización" } })); }
      finally { invoiceRunning = false; }
    };
    if (movementsAutoEnabled) syncMovements();
    if (invoicesAutoEnabled) syncInvoices();
    const movementTimer = movementsAutoEnabled ? window.setInterval(syncMovements, 15000) : null;
    const invoiceTimer = invoicesAutoEnabled ? window.setInterval(syncInvoices, 60000) : null;
    return () => { disposed = true; window.clearInterval(movementTimer); window.clearInterval(invoiceTimer); };
  }, [session, profile, movementsAutoEnabled, invoicesAutoEnabled]);

  function toggleMovementsAutoSync() {
    setMovementsAutoEnabled((value) => { const next = !value; localStorage.setItem("rafiki_movements_auto_sync", String(next)); return next; });
  }

  function toggleInvoicesAutoSync() {
    setInvoicesAutoEnabled((value) => { const next = !value; localStorage.setItem("rafiki_invoices_auto_sync", String(next)); return next; });
  }

  function navigate(page) {
    const safePage = pages[page] ? page : "inicio";
    setActivePage(safePage);
    window.history.replaceState({}, "", `${window.location.pathname}${window.location.search}#${safePage}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function logout() {
    try { await signOut(); } catch { setSession(null); }
  }

  if (session === undefined) return <LoadingScreen />;
  if (!session) return <LoginPage />;
  if (!profile && !profileError) return <LoadingScreen />;
  if (profileError) return <div className="fatal-screen"><div className="fatal-card"><div className="brand-mark">R</div><h1>No se pudo abrir la aplicación</h1><Alert tone="danger">{profileError}</Alert><button className="primary-button" onClick={logout}>Cerrar sesión</button></div></div>;

  const Page = pages[activePage] || DashboardPage;
  return (
    <AppShell activePage={activePage} onNavigate={navigate} profile={profile} onLogout={logout} autoSync={{ movements: { ...autoSync.movements, enabled: movementsAutoEnabled }, invoices: { ...autoSync.invoices, enabled: invoicesAutoEnabled } }} onToggleMovements={toggleMovementsAutoSync} onToggleInvoices={toggleInvoicesAutoSync}>
      <Page profile={profile} onNavigate={navigate} />
    </AppShell>
  );
}

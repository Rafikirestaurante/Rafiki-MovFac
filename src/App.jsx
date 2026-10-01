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
  const [autoSync, setAutoSync] = useState({ active: false, lastRun: null, message: "" });
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
    if (!session || !profile || profile.role !== "admin") {
      setAutoSync({ active: false, lastRun: null, message: "" });
      return undefined;
    }
    let running = false;
    let disposed = false;
    const runAutomaticSync = async () => {
      if (running || disposed || !navigator.onLine) return;
      running = true;
      setAutoSync((current) => ({ ...current, active: true, message: "Revisando correos nuevos..." }));
      try {
        const [movements, invoices] = await Promise.all([syncGmailQuick(1), syncInvoicesRecent()]);
        if (!disposed) setAutoSync({ active: false, lastRun: new Date(), message: `${(movements.movements_created || 0) + (invoices.invoices_created || 0)} novedades registradas.` });
      } catch (error) {
        if (!disposed) setAutoSync({ active: false, lastRun: new Date(), message: "La revisión automática continuará en el próximo intervalo." });
      } finally { running = false; }
    };
    runAutomaticSync();
    const timer = window.setInterval(runAutomaticSync, 30000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [session, profile]);

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
    <AppShell activePage={activePage} onNavigate={navigate} profile={profile} onLogout={logout} autoSync={autoSync}>
      <Page profile={profile} onNavigate={navigate} />
    </AppShell>
  );
}

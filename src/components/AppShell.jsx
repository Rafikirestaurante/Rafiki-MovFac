import React, { useState } from "react";
import Icon from "./Icons.jsx";
import { Badge } from "./Ui.jsx";

const navigation = [
  { id: "inicio", label: "Inicio", icon: "home" },
  { id: "movimientos", label: "Movimientos", icon: "movements" },
  { id: "facturas", label: "Facturas", icon: "invoice" },
  { id: "configuracion", label: "Configuración", icon: "settings" }
];

export default function AppShell({ activePage, onNavigate, profile, onLogout, children, autoSync, onToggleMovements, onToggleInvoices }) {
  const [open, setOpen] = useState(false);
  const roleLabel = profile?.role === "admin" ? "Administrador" : "Revisor";

  function navigate(id) {
    onNavigate(id);
    setOpen(false);
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <div className="brand-block">
          <div className="brand-mark">R</div>
          <div>
            <strong>Rafiki</strong>
            <span>Movimientos y facturas</span>
          </div>
          <button className="icon-button close-sidebar" onClick={() => setOpen(false)} aria-label="Cerrar menú"><Icon name="close" /></button>
        </div>

        <div className="app-surface-tabs" role="tablist" aria-label="Vistas de Rafiki">
          <a className="app-surface-tab active" href="/" role="tab" aria-selected="true"><Icon name="home" size={16} /> Vista normal</a>
          <a className="app-surface-tab" href="/empleados" role="tab" aria-selected="false"><Icon name="users" size={16} /> Empleados</a>
        </div>

        <nav className="side-nav">
          {navigation.map((item) => (
            <button key={item.id} className={activePage === item.id ? "active" : ""} onClick={() => navigate(item.id)}>
              <Icon name={item.icon} size={19} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="profile-chip">
            <div className="avatar">{String(profile?.display_name || profile?.email || "U").slice(0, 1).toUpperCase()}</div>
            <div>
              <strong>{profile?.display_name || "Usuario"}</strong>
              <span>{profile?.email}</span>
              <Badge tone={profile?.role === "admin" ? "gold" : "blue"}>{roleLabel}</Badge>
            </div>
          </div>
          <button className="logout-button" onClick={onLogout}><Icon name="logout" size={18} /> Cerrar sesión</button>
        </div>
      </aside>

      {open ? <button className="sidebar-backdrop" onClick={() => setOpen(false)} aria-label="Cerrar menú" /> : null}

      <main className="main-panel">
        <div className="mobile-topbar">
          <button className="icon-button" onClick={() => setOpen(true)} aria-label="Abrir menú"><Icon name="menu" /></button>
          <div className="mobile-brand"><span>R</span> Rafiki Finanzas</div>
          <div className="avatar small">{String(profile?.display_name || profile?.email || "U").slice(0, 1).toUpperCase()}</div>
        </div>
        <div className="content-wrap"><div className="auto-sync-control-row"><div className={`auto-sync-control ${autoSync?.movements?.enabled ? "enabled" : "disabled"}`}><span className="sync-dot"></span><strong>Movimientos</strong><span>{autoSync?.movements?.active ? "Sincronizando..." : autoSync?.movements?.enabled ? "Cada 15 segundos" : "Desactivada"}</span><button onClick={onToggleMovements}>{autoSync?.movements?.enabled ? "Desactivar" : "Activar"}</button></div><div className={`auto-sync-control ${autoSync?.invoices?.enabled ? "enabled" : "disabled"}`}><span className="sync-dot"></span><strong>Facturas</strong><span>{autoSync?.invoices?.active ? "Sincronizando..." : autoSync?.invoices?.enabled ? "Cada 60 segundos" : "Desactivada"}</span><button onClick={onToggleInvoices}>{autoSync?.invoices?.enabled ? "Desactivar" : "Activar"}</button></div></div>{children}</div>
      </main>

      <nav className="bottom-nav">
        {navigation.map((item) => (
          <button key={item.id} className={activePage === item.id ? "active" : ""} onClick={() => navigate(item.id)}>
            <Icon name={item.icon} size={20} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

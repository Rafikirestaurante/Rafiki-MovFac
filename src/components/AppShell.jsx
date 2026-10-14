import React, { useState } from "react";
import Icon from "./Icons.jsx";
import { Badge } from "./Ui.jsx";
import MovementSyncInterval from "./MovementSyncInterval.jsx";

const navigation = [
  { id: "inicio", label: "Inicio", icon: "home" },
  { id: "movimientos", label: "Movimientos", icon: "movements" },
  { id: "facturas", label: "Facturas", icon: "invoice" },
  { id: "reportes", label: "Reportes", icon: "search" },
  { id: "configuracion", label: "Configuración", icon: "settings" }
];

export default function AppShell({ activePage, onNavigate, profile, onLogout, children, autoSync, onToggleMovements, onToggleInvoices, onMovementIntervalChange }) {
  const [open, setOpen] = useState(false);
  const roleLabel = profile?.role === "platform_admin" ? "Administrador de plataforma" : profile?.role === "workspace_owner" ? "Administrador del workspace" : "Revisor";

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

        <nav className="side-nav">
          {navigation.concat(profile?.role === "platform_admin" ? [{id:"usuarios",label:"Usuarios",icon:"users"}] : []).map((item) => (
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
              <Badge tone={profile?.role === "platform_admin" ? "gold" : "blue"}>{roleLabel}</Badge>
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
        <div className="content-wrap">
          <div className="auto-sync-control-row">
            {['movements','invoices'].map(module=>{
              const sync=autoSync?.[module]||{};
              const isPush=sync.mode==='push', checking=sync.mode==='checking';
              return <div key={module} className={`auto-sync-control ${sync.enabled?'enabled':'disabled'}`}>
                <span className="sync-dot"></span><strong>{module==='movements'?'Movimientos':'Facturas'}</strong>
                <span>{checking?'…':isPush?'Push':sync.active?'…':sync.enabled?(module==='invoices'||sync.intervalSeconds===60?'1 min':`${sync.intervalSeconds||10} s`):'Off'}</span>
                {module==='movements'&&!isPush&&!checking&&<MovementSyncInterval seconds={sync.intervalSeconds} onChange={onMovementIntervalChange}/>}
                <button onClick={isPush||checking?()=>navigate('configuracion'):module==='movements'?onToggleMovements:onToggleInvoices}>{isPush||checking?'Configurar':sync.enabled?'Desactivar':'Activar'}</button>
              </div>;
            })}
          </div>{children}
        </div>
      </main>

      <nav className="bottom-nav">
        {navigation.concat(profile?.role === "platform_admin" ? [{id:"usuarios",label:"Usuarios",icon:"users"}] : []).map((item) => (
          <button key={item.id} className={activePage === item.id ? "active" : ""} onClick={() => navigate(item.id)}>
            <Icon name={item.icon} size={20} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

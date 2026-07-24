import React, { useEffect, useMemo, useState } from "react";
import Icon from "../components/Icons.jsx";
import { Alert, Badge } from "../components/Ui.jsx";
import {
  clearEmployeeSession,
  confirmEmployeePayment,
  employeePublicLogin,
  getEmployeePublicMovements,
  getStoredEmployeeSession,
  syncEmployeePublicMovements
} from "../services/employeeAccessService.js";

const movementLabels = {
  income: "Pago recibido",
  transfer: "Transferencia enviada",
  card_purchase: "Compra con tarjeta",
  service_payment: "Pago de servicio",
  unknown: "Movimiento"
};

function cop(value) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatMoment(value) {
  if (!value) return "Fecha sin identificar";
  try {
    return new Intl.DateTimeFormat("es-CO", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "America/Bogota"
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

export default function EmployeePublicPage() {
  const [session, setSession] = useState(() => getStoredEmployeeSession());
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(Boolean(session));
  const [action, setAction] = useState("");
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState("info");
  const [confirming, setConfirming] = useState(null);
  const [employeeName, setEmployeeName] = useState("");
  const [note, setNote] = useState("");
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installed, setInstalled] = useState(() => window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true);

  const latest = useMemo(() => movements[0] || null, [movements]);

  async function load(currentSession = session, silent = false) {
    if (!currentSession?.access_token) return;
    if (!silent) setLoading(true);
    try {
      const data = await getEmployeePublicMovements(currentSession.access_token);
      setMovements(data.movements || []);
    } catch (error) {
      if (/sesión|venció|válida|desactivado/i.test(error.message || "")) {
        clearEmployeeSession();
        setSession(null);
      }
      setTone("danger");
      setMessage(error.message || "No se pudieron consultar los movimientos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    function captureInstall(event) {
      event.preventDefault();
      setInstallPrompt(event);
    }
    function markInstalled() {
      setInstalled(true);
      setInstallPrompt(null);
    }
    window.addEventListener("beforeinstallprompt", captureInstall);
    window.addEventListener("appinstalled", markInstalled);
    if (session) load(session);
    return () => {
      window.removeEventListener("beforeinstallprompt", captureInstall);
      window.removeEventListener("appinstalled", markInstalled);
    };
  }, []);

  async function installEmployeeApp() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice?.outcome === "accepted") setInstalled(true);
    setInstallPrompt(null);
  }

  async function login(event) {
    event.preventDefault();
    setAction("login");
    setMessage("");
    try {
      const nextSession = await employeePublicLogin(username, password);
      setSession(nextSession);
      setPassword("");
      setTone("success");
      setMessage("Acceso correcto. Ya puedes consultar los últimos movimientos.");
      await load(nextSession, true);
    } catch (error) {
      setTone("danger");
      setMessage(error.message || "No se pudo iniciar sesión.");
    } finally {
      setAction("");
    }
  }

  async function synchronize(hours = 1) {
    setAction(`sync-${hours}`);
    setMessage("");
    try {
      const data = await syncEmployeePublicMovements(session.access_token, hours);
      const usedHours = Number(data.quick_hours || hours);
      const limit = Number(data.quick_message_limit || (usedHours === 6 ? 120 : usedHours === 3 ? 60 : 20));
      setTone(data.errors_count || data.bancolombia_unidentified ? "warning" : "success");
      setMessage(`Búsqueda de ${usedHours} ${usedHours === 1 ? "hora" : "horas"} completada: ${data.bancolombia_emails || data.messages_scanned || 0} de hasta ${limit} alerta(s) de Bancolombia revisada(s), ${data.movements_created || 0} movimiento(s) nuevo(s), ${data.duplicates_ignored || data.movement_duplicates || 0} ya registrado(s) y ${data.bancolombia_unidentified || 0} alerta(s) guardada(s) para revisión.`);
      await load(session, true);
    } catch (error) {
      setTone("danger");
      setMessage(error.message || "No se pudo sincronizar.");
    } finally {
      setAction("");
    }
  }

  function openConfirmation(movement) {
    setConfirming(movement);
    setEmployeeName("");
    setNote("");
    setMessage("");
  }

  async function confirm(event) {
    event.preventDefault();
    setAction("confirm");
    try {
      await confirmEmployeePayment(session.access_token, confirming.id, employeeName, note);
      setConfirming(null);
      setTone("success");
      setMessage("La recepción del pago quedó confirmada correctamente.");
      await load(session, true);
    } catch (error) {
      setTone("danger");
      setMessage(error.message || "No se pudo guardar la confirmación.");
    } finally {
      setAction("");
    }
  }

  function logout() {
    clearEmployeeSession();
    setSession(null);
    setMovements([]);
    setMessage("");
  }

  if (!session) {
    return (
      <main className="employee-public-login">
        <section className="employee-login-card">
          <div className="employee-public-brand"><span>R</span><div><strong>Rafiki Empleados</strong><small>Consulta y confirmación de pagos</small></div></div>
          <span className="eyebrow">Acceso restringido</span>
          <h1>Últimos movimientos</h1>
          <p>Ingresa con el nombre y la contraseña compartidos por la administración.</p>
          {message ? <Alert tone={tone}>{message}</Alert> : null}
          <form className="login-form" onSubmit={login}>
            <label><span>Nombre de acceso</span><div className="input-with-icon"><Icon name="user" size={18} /><input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required /></div></label>
            <label><span>Contraseña</span><div className="input-with-icon"><Icon name="shield" size={18} /><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></div></label>
            <button className="primary-button full" disabled={action === "login"}>{action === "login" ? "Ingresando..." : "Ingresar"}</button>
          </form>
          <small className="employee-security-note">Este enlace no permite abrir el panel administrativo, Gmail, facturas ni movimientos anteriores.</small>
          {!installed ? (
            <div className="employee-install-box">
              <Icon name="install" size={20} />
              <div><strong>Instala Rafiki Empleados</strong><small>Ábrela como una aplicación independiente desde la pantalla de inicio.</small></div>
              {installPrompt ? <button type="button" className="secondary-button" onClick={installEmployeeApp}>Instalar</button> : <small className="employee-install-help">Usa el menú del navegador y selecciona “Agregar a pantalla de inicio”.</small>}
            </div>
          ) : <div className="employee-installed-badge"><Icon name="check" size={16} /> Aplicación instalada</div>}
        </section>
      </main>
    );
  }

  return (
    <main className="employee-public-page">
      <header className="employee-public-header">
        <div className="employee-public-brand"><span>R</span><div><strong>Rafiki Empleados</strong><small>Pagos recientes</small></div></div>
        <div className="employee-header-actions">
          {!installed && installPrompt ? <button className="secondary-button" onClick={installEmployeeApp}><Icon name="install" size={17} /> Instalar</button> : null}
          <button className="secondary-button" onClick={logout}><Icon name="logout" size={17} /> Salir</button>
        </div>
      </header>

      <section className="employee-public-content">
        <div className="employee-public-title">
          <div><span className="eyebrow">Vista limitada</span><h1>Últimos 5 movimientos</h1><p>Solo se muestran los registros más recientes. Los pagos recibidos pueden confirmarse una sola vez.</p></div>
        </div>

        <section className="employee-quick-sync-card">
          <div className="movement-sync-copy"><strong>Búsqueda Bancolombia</strong><small>Revisa exclusivamente las alertas recibidas durante la última 1, 3 o 6 horas exactas desde el momento del clic.</small></div>
          <div className="quick-sync-actions" aria-label="Ventana de búsqueda Bancolombia">
            <button className="primary-button" onClick={() => synchronize(1)} disabled={Boolean(action) || loading}><Icon name="refresh" size={18} /> {action === "sync-1" ? "Buscando..." : "Búsqueda rápida"}</button>
            <button className="secondary-button" onClick={() => synchronize(3)} disabled={Boolean(action) || loading}>{action === "sync-3" ? "Buscando..." : "3 horas"}</button>
            <button className="secondary-button" onClick={() => synchronize(6)} disabled={Boolean(action) || loading}>{action === "sync-6" ? "Buscando..." : "6 horas"}</button>
          </div>
        </section>

        {message ? <Alert tone={tone}>{message}</Alert> : null}
        {latest ? <div className="employee-latest-banner"><span>Último movimiento actualizado</span><strong>{formatMoment(latest.transaction_at)}</strong></div> : null}

        {loading ? <div className="employee-public-loading">Consultando movimientos...</div> : movements.length === 0 ? (
          <section className="employee-empty"><Icon name="movements" size={32} /><h2>No hay movimientos disponibles</h2><p>Usa Búsqueda rápida, 3 horas o 6 horas para consultar las alertas recientes de Bancolombia.</p></section>
        ) : (
          <section className="employee-movement-list">
            {movements.map((movement, index) => (
              <article className={`employee-movement-card ${index === 0 ? "is-latest" : ""}`} key={movement.id}>
                <div className="employee-movement-main">
                  <div className={`employee-movement-icon ${movement.movement_type === "income" ? "income" : "outgoing"}`}><Icon name="movements" size={20} /></div>
                  <div><div className="employee-movement-heading"><strong>{movementLabels[movement.movement_type] || "Movimiento"}</strong>{index === 0 ? <Badge tone="blue">Más reciente</Badge> : null}</div><span>{movement.detail || "Sin detalle"}</span><small>{formatMoment(movement.transaction_at)} · {movement.source === "bancolombia" ? "Bancolombia" : "Nequi"}</small></div>
                </div>
                <div className={`employee-movement-value ${movement.movement_type === "income" ? "income" : "outgoing"}`}>{movement.movement_type === "income" ? "+" : "−"}{cop(movement.amount_cop)}</div>
                <div className="employee-confirmation-area">
                  {movement.confirmed ? (
                    <div className="employee-confirmed"><Icon name="check" size={17} /><div><strong>Recepción confirmada</strong><small>Por {movement.confirmation?.employee_name || "empleado"} · {formatMoment(movement.confirmation?.confirmed_at)}</small>{movement.confirmation?.note ? <span>{movement.confirmation.note}</span> : null}</div></div>
                  ) : movement.can_confirm ? (
                    <button className="secondary-button" onClick={() => openConfirmation(movement)} disabled={Boolean(action)}>Confirmar recepción</button>
                  ) : (
                    <small className="employee-not-confirmable">Este tipo de movimiento es solo informativo.</small>
                  )}
                </div>
              </article>
            ))}
          </section>
        )}
        <p className="employee-public-footer-note">La búsqueda pública permite revisar 1, 3 o 6 horas exactas de alertas Bancolombia. Si una alerta no puede interpretarse, queda registrada para revisión administrativa.</p>
      </section>

      {confirming ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => action !== "confirm" && setConfirming(null)}>
          <section className="modal-card employee-confirm-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-icon employee-confirm-icon"><Icon name="check" size={25} /></div>
            <h2>Confirmar recepción del pago</h2>
            <p><strong>{confirming.detail || "Pago recibido"}</strong><br />{cop(confirming.amount_cop)} · {formatMoment(confirming.transaction_at)}</p>
            <form className="employee-confirm-form" onSubmit={confirm}>
              <label><span>Nombre de quien confirma</span><input value={employeeName} maxLength={80} onChange={(event) => setEmployeeName(event.target.value)} required autoFocus /></label>
              <label><span>Observación opcional</span><textarea value={note} maxLength={160} onChange={(event) => setNote(event.target.value)} placeholder="Ejemplo: corresponde a la mesa 3" /></label>
              <div className="button-row modal-actions"><button type="button" className="secondary-button" onClick={() => setConfirming(null)} disabled={action === "confirm"}>Cancelar</button><button className="primary-button" disabled={action === "confirm"}>{action === "confirm" ? "Guardando..." : "Confirmar pago"}</button></div>
            </form>
          </section>
        </div>
      ) : null}
    </main>
  );
}

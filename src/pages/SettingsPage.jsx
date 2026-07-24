import React, { useCallback, useEffect, useMemo, useState } from "react";
import Icon from "../components/Icons.jsx";
import { Alert, Badge, PageHeader } from "../components/Ui.jsx";
import {
  diagnoseGmailConnection,
  disconnectGmail,
  getGmailConnectionStatus,
  startGmailConnection,
  syncGmailNow,
  syncGmailQuick,
  getRecentSyncRuns,
  edgeErrorDetails
} from "../services/gmailIntegrationService.js";
import { getEmployeeAccessSettings, saveEmployeeAccessSettings } from "../services/employeeAccessService.js";
import { APP_PHASE, APP_PHASE_DESCRIPTION, APP_PHASE_TITLE, APP_VERSION } from "../config/appMetadata.js";

function formatDate(value) {
  if (!value) return "—";
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

export default function SettingsPage({ profile }) {
  const [status, setStatus] = useState({ configured: false, connection: null });
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState("");
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState("info");
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState(sevenDaysAgo);
  const [dateTo, setDateTo] = useState(today);
  const [lastSync, setLastSync] = useState(null);
  const [diagnostics, setDiagnostics] = useState(null);
  const [communicationIssues, setCommunicationIssues] = useState([]);
  const [employeeAccess, setEmployeeAccess] = useState({ configured: false, enabled: false, username: "empleados", password_configured: false, public_url: "" });
  const [employeeUsername, setEmployeeUsername] = useState("empleados");
  const [employeePassword, setEmployeePassword] = useState("");
  const [employeeEnabled, setEmployeeEnabled] = useState(false);
  const [employeeAction, setEmployeeAction] = useState("");
  const [employeeMessage, setEmployeeMessage] = useState("");
  const [employeeTone, setEmployeeTone] = useState("info");

  const isAdmin = profile?.role === "admin";
  const connection = status.connection;
  const statusUnavailable = Boolean(status.unavailable);
  const connected = Boolean(!statusUnavailable && status.configured && connection?.status === "connected");
  const canAttemptGmail = Boolean(!statusUnavailable && status.configured && connection?.status !== "disconnected");
  const visual = useMemo(() => {
    if (statusUnavailable) return { label: "No disponible", tone: "danger" };
    if (connected) return { label: "Conectado", tone: "success" };
    if (connection?.status === "error") return { label: "Requiere atención", tone: "danger" };
    return { label: "Sin conectar", tone: "neutral" };
  }, [connected, connection?.status, statusUnavailable]);

  const load = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const results = await Promise.allSettled([
      getGmailConnectionStatus(),
      getRecentSyncRuns(1),
      getEmployeeAccessSettings()
    ]);

    const issues = [];
    const [gmailResult, runsResult, publicResult] = results;

    if (gmailResult.status === "fulfilled") {
      setStatus({ ...gmailResult.value, unavailable: false, load_error: null });
    } else {
      const detail = edgeErrorDetails(gmailResult.reason, "gmail-connection-status");
      issues.push(detail);
      setStatus({ configured: false, connection: null, recent_errors: [], unavailable: true, load_error: detail });
    }

    if (runsResult.status === "fulfilled") {
      setLastSync(runsResult.value[0] || null);
    } else {
      issues.push({
        function_name: "Consulta de historial",
        category: "database",
        message: runsResult.reason?.message || "No se pudo consultar el historial.",
        original_message: runsResult.reason?.message || "No se pudo consultar el historial.",
        endpoint: "Supabase Data API",
        browser_origin: window.location.origin,
        online: navigator.onLine
      });
    }

    if (publicResult.status === "fulfilled") {
      const publicAccess = publicResult.value;
      setEmployeeAccess(publicAccess);
      setEmployeeUsername(publicAccess.username || "empleados");
      setEmployeeEnabled(Boolean(publicAccess.enabled));
    } else {
      issues.push(edgeErrorDetails(publicResult.reason, "employee-access-admin"));
    }

    setCommunicationIssues(issues);
    if (issues.length) {
      setTone("danger");
      setMessage(`Se detectaron ${issues.length} problema${issues.length === 1 ? "" : "s"} de comunicación. Abre el diagnóstico técnico para ver la función afectada y la corrección recomendada.`);
    }
    setLoading(false);
  }, [isAdmin]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get("gmail");
    const detail = params.get("gmail_detail") || "";
    if (result === "connected") {
      setTone("success");
      setMessage("La cuenta de Gmail quedó conectada correctamente.");
    } else if (result === "error") {
      setTone("danger");
      setMessage(detail || "Google no pudo completar la conexión.");
    }
    if (result) {
      params.delete("gmail");
      params.delete("gmail_detail");
      window.history.replaceState({}, "", `${window.location.pathname}${params.toString() ? `?${params}` : ""}${window.location.hash || "#configuracion"}`);
    }
    load();
  }, [load]);

  async function connect() {
    setAction("connect");
    setMessage("");
    try {
      const data = await startGmailConnection();
      if (!data.authorization_url) throw new Error("No se recibió la dirección de autorización de Google.");
      window.location.assign(data.authorization_url);
    } catch (error) {
      setTone("danger");
      setMessage(error.message || "No se pudo iniciar la conexión.");
      setAction("");
    }
  }

  async function test() {
    setAction("test");
    setMessage("");
    try {
      const data = await diagnoseGmailConnection();
      setDiagnostics(data);
      setTone(data.ok ? "success" : "danger");
      setMessage(data.ok
        ? `Conexión verificada correctamente con ${data.google_email || "Gmail"}.`
        : data.summary_error || "El verificador encontró problemas en la conexión.");
      await load();
    } catch (error) {
      const detail = edgeErrorDetails(error, "gmail-diagnostics");
      setCommunicationIssues((current) => [detail, ...current.filter((item) => item.function_name !== detail.function_name)]);
      setDiagnostics({
        ok: false,
        local_diagnostic: true,
        checked_at: new Date().toISOString(),
        summary_error: detail.message,
        checks: [
          {
            key: "browser-network",
            label: "Conexión del dispositivo",
            ok: Boolean(detail.online),
            message: detail.online ? "El navegador informa que tiene conexión a internet." : "El navegador informa que no tiene conexión a internet."
          },
          {
            key: "edge-transport",
            label: `Comunicación con ${detail.function_name}`,
            ok: false,
            message: detail.message,
            error: detail.original_message
          },
          {
            key: "browser-origin",
            label: "Origen de la aplicación",
            ok: false,
            message: `La aplicación se está abriendo desde ${detail.browser_origin || "un origen no identificado"}. Confirma que las Edge Functions fueron redesplegadas con la corrección CORS.`,
            error: detail.endpoint ? `Destino: ${detail.endpoint}` : "No fue posible construir la URL de la función."
          }
        ],
        recent_errors: [],
        unrecognized_alerts: []
      });
      setTone("danger");
      setMessage(detail.message);
    } finally {
      setAction("");
    }
  }

  async function synchronizeQuick() {
    setAction("quick-sync");
    setMessage("");
    try {
      const data = await syncGmailQuick();
      setTone(data.errors_count || data.bancolombia_unidentified ? "warning" : "success");
      setMessage(`Búsqueda rápida completada: ${data.messages_scanned || data.messages_found || 0} de hasta 20 alertas de Bancolombia revisadas durante la última hora, ${data.movements_created || 0} movimientos nuevos, ${data.duplicates_ignored || 0} ya registrados y ${data.bancolombia_unidentified || 0} con formato no reconocido.`);
      await load();
    } catch (error) {
      setTone("danger");
      setMessage(error.message || "No se pudo ejecutar la sincronización rápida.");
    } finally {
      setAction("");
    }
  }

  async function synchronize() {
    setAction("sync");
    setMessage("");
    try {
      const data = await syncGmailNow(dateFrom, dateTo);
      setTone(data.errors_count || data.bancolombia_unidentified ? "warning" : "success");
      setMessage(`Sincronización terminada: ${data.messages_found || 0} correos revisados, ${data.bancolombia_emails || 0} de Bancolombia y ${data.movements_created || 0} movimientos nuevos.`);
      await load();
    } catch (error) {
      setTone("danger");
      setMessage(error.message || "No se pudo sincronizar Gmail.");
    } finally {
      setAction("");
    }
  }

  async function savePublicEmployeeAccess() {
    setEmployeeAction("save");
    setEmployeeMessage("");
    try {
      const data = await saveEmployeeAccessSettings({ username: employeeUsername, password: employeePassword, enabled: employeeEnabled });
      setEmployeeAccess((current) => ({ ...current, ...data }));
      setEmployeePassword("");
      setEmployeeTone("success");
      setEmployeeMessage(`Acceso público ${data.enabled ? "activado" : "guardado como desactivado"}. Las sesiones anteriores fueron cerradas.`);
    } catch (error) {
      setEmployeeTone("danger");
      setEmployeeMessage(error.message || "No se pudo guardar el acceso para empleados.");
    } finally {
      setEmployeeAction("");
    }
  }

  async function copyEmployeeLink() {
    const link = employeeAccess.public_url || `${window.location.origin}/empleados`;
    try {
      await navigator.clipboard.writeText(link);
      setEmployeeTone("success");
      setEmployeeMessage("Enlace público copiado.");
    } catch {
      setEmployeeTone("warning");
      setEmployeeMessage(`Copia manualmente este enlace: ${link}`);
    }
  }

  async function disconnect() {
    setConfirmDisconnect(false);
    setAction("disconnect");
    setMessage("");
    try {
      const data = await disconnectGmail();
      setTone(data.warning ? "warning" : "success");
      setMessage(data.warning ? `La conexión se retiró. ${data.warning}` : "Gmail fue desconectado correctamente.");
      await load();
    } catch (error) {
      setTone("danger");
      setMessage(error.message || "No se pudo desconectar Gmail.");
    } finally {
      setAction("");
    }
  }

  return (
    <>
      <PageHeader eyebrow="Administración" title="Configuración" description="Conexiones, seguridad y estado técnico de la aplicación." />

      {!isAdmin ? <Alert tone="warning">Solo un Administrador puede configurar la conexión con Gmail.</Alert> : null}
      {message ? <Alert tone={tone}>{message}</Alert> : null}
      {communicationIssues.length ? (
        <details className="technical-errors communication-diagnostic" open>
          <summary>Diagnóstico técnico de comunicación ({communicationIssues.length})</summary>
          <p className="communication-diagnostic-intro">Estos errores ocurren antes de comprobar Gmail. Por eso no deben interpretarse automáticamente como “Gmail desconectado”.</p>
          <div>{communicationIssues.map((item, index) => (
            <article key={`${item.function_name}-${index}`}>
              <div><strong>{item.function_name}</strong><span>{item.category === "transport" ? "Comunicación/CORS" : item.category}</span></div>
              <p>{item.message}</p>
              <small>Navegador: {item.online ? "con conexión" : "sin conexión"} · Origen: {item.browser_origin || "—"}</small>
              {item.endpoint ? <small>Destino: {item.endpoint}</small> : null}
            </article>
          ))}</div>
          <Alert tone="warning">Después de instalar esta corrección, vuelve a desplegar todas las Edge Functions. El archivo compartido de CORS solo se actualiza dentro de cada función cuando esa función se redespliega.</Alert>
        </details>
      ) : null}

      <section className="settings-grid">
        <article className="panel-card gmail-card">
          <div className="panel-heading">
            <div className="gmail-heading"><div className="gmail-logo"><Icon name="mail" size={25} /></div><div><span className="eyebrow">Integración principal</span><h2>Gmail API</h2></div></div>
            <Badge tone={visual.tone}>{visual.label}</Badge>
          </div>
          <p className="panel-description">La aplicación solicitará acceso de solo lectura para analizar únicamente los correos definidos por las reglas documentales.</p>

          <div className="connection-details">
            <div><span>Cuenta autorizada</span><strong>{loading ? "Consultando..." : statusUnavailable ? "No se pudo consultar" : connection?.google_email || "Sin conectar"}</strong></div>
            <div><span>Fecha de conexión</span><strong>{formatDate(connection?.connected_at)}</strong></div>
            <div><span>Última prueba</span><strong>{formatDate(connection?.last_verified_at)}</strong></div>
            <div><span>Permiso</span><strong>Solo lectura</strong></div>
          </div>

          {statusUnavailable ? <Alert tone="danger"><strong>Estado no disponible:</strong> la aplicación no pudo comunicarse con la función que consulta Gmail. Esto no confirma que la cuenta esté desconectada.</Alert> : null}
          {connection?.last_error ? <Alert tone="danger"><strong>Último error registrado:</strong> {connection.last_error}</Alert> : null}
          {!diagnostics && connection?.status === "error" && (status.recent_errors || []).length ? (
            <details className="technical-errors connection-errors-visible">
              <summary>Ver errores recientes ({status.recent_errors.length})</summary>
              <div>{status.recent_errors.map((item) => (
                <article key={item.id}><div><strong>{item.source || "gmail"} · {item.stage}</strong><span>{formatDate(item.created_at)}</span></div><p>{item.error_message}</p>{item.sync_run_id ? <small>Ejecución #{item.sync_run_id}</small> : null}</article>
              ))}</div>
            </details>
          ) : null}

          <div className="button-row">
            {statusUnavailable ? (
              <button className="primary-button" onClick={test} disabled={!isAdmin || Boolean(action)}><Icon name="refresh" size={18} /> {action === "test" ? "Diagnosticando..." : "Diagnosticar comunicación"}</button>
            ) : !canAttemptGmail ? (
              <>
                <button className="primary-button" onClick={connect} disabled={!isAdmin || loading || Boolean(action)}><Icon name="mail" size={18} /> {action === "connect" ? "Abriendo Google..." : "Conectar Gmail"}</button>
                <button className="secondary-button" onClick={test} disabled={!isAdmin || Boolean(action)}><Icon name="refresh" size={18} /> {action === "test" ? "Verificando..." : "Verificar funciones"}</button>
              </>
            ) : (
              <>
                <button className="primary-button" onClick={test} disabled={!isAdmin || Boolean(action)}><Icon name="refresh" size={18} /> {action === "test" ? "Verificando..." : "Verificar conexión"}</button>
                {connection?.status === "error" ? <button className="secondary-button" onClick={connect} disabled={!isAdmin || Boolean(action)}><Icon name="mail" size={18} /> Reconectar Gmail</button> : null}
                <button className="danger-button" onClick={() => setConfirmDisconnect(true)} disabled={!isAdmin || Boolean(action)}>Desconectar</button>
              </>
            )}
            <button className="secondary-button" onClick={load} disabled={!isAdmin || loading || Boolean(action)}>Actualizar estado</button>
          </div>

          {diagnostics ? (
            <div className="gmail-diagnostics">
              <div className="diagnostic-heading"><strong>Resultado del verificador</strong><span>{formatDate(diagnostics.checked_at)}</span></div>
              <div className="diagnostic-checks">
                {(diagnostics.checks || []).map((check) => (
                  <div className={check.ok ? "diagnostic-ok" : "diagnostic-error"} key={check.key}>
                    <Icon name={check.ok ? "check" : "alert"} size={17} />
                    <div><strong>{check.label}</strong><span>{check.message}</span>{check.error ? <small>{check.error}</small> : null}</div>
                  </div>
                ))}
              </div>
              {(diagnostics.recent_errors || []).length ? (
                <details className="technical-errors">
                  <summary>Ver últimos errores técnicos ({diagnostics.recent_errors.length})</summary>
                  <div>{diagnostics.recent_errors.map((item) => (
                    <article key={item.id}><div><strong>{item.source || "gmail"} · {item.stage}</strong><span>{formatDate(item.created_at)}</span></div><p>{item.error_message}</p>{item.sync_run_id ? <small>Ejecución #{item.sync_run_id}</small> : null}</article>
                  ))}</div>
                </details>
              ) : <small className="diagnostic-empty">No hay errores técnicos recientes registrados.</small>}
              {(diagnostics.unrecognized_alerts || []).length ? (
                <details className="unrecognized-alerts">
                  <summary>Alertas Bancolombia detectadas sin registrar ({diagnostics.unrecognized_alerts.length})</summary>
                  <p>Estos correos sí llegaron y fueron encontrados, pero su formato no coincidió con el extractor actual.</p>
                  <div>{diagnostics.unrecognized_alerts.map((item) => (
                    <article key={item.id}><div><strong>{item.subject || "Sin asunto"}</strong><span>{formatDate(item.received_at)}</span></div><p>{item.snippet || "El correo no incluyó un fragmento visible."}</p></article>
                  ))}</div>
                </details>
              ) : null}
            </div>
          ) : null}
        </article>

        <article className="panel-card">
          <div className="panel-heading"><div><span className="eyebrow">Alcance</span><h2>Separación segura</h2></div><Icon name="shield" size={25} /></div>
          <div className="scope-list">
            <div><Icon name="check" size={17} /><span>No modifica Caja</span></div>
            <div><Icon name="check" size={17} /><span>No modifica Cartera</span></div>
            <div><Icon name="check" size={17} /><span>No crea gastos</span></div>
            <div><Icon name="check" size={17} /><span>No modifica pedidos</span></div>
            <div><Icon name="check" size={17} /><span>Base Supabase independiente</span></div>
          </div>
        </article>
      </section>

      <section className="panel-card sync-card">
        <div className="panel-heading">
          <div><span className="eyebrow">Sincronización Gmail</span><h2>Movimientos y facturas</h2></div>
          <Badge tone={lastSync?.status === "success" ? "success" : lastSync?.status === "error" ? "danger" : lastSync ? "warning" : "neutral"}>
            {lastSync ? (lastSync.status === "success" ? "Completada" : lastSync.status === "partial" ? "Con novedades" : lastSync.status === "running" ? "En curso" : "Fallida") : "Sin ejecuciones"}
          </Badge>
        </div>
        <p className="panel-description">Desde aquí se sincronizan movimientos de Bancolombia. La búsqueda y extracción de facturas se realiza desde el módulo Facturas.</p>
        <div className="quick-sync-panel">
          <div><span className="eyebrow">Recomendado</span><strong>Búsqueda rápida</strong><small>Revisa como máximo las 20 alertas más recientes de Bancolombia recibidas durante la última hora.</small></div>
          <button className="primary-button" onClick={synchronizeQuick} disabled={!isAdmin || !canAttemptGmail || Boolean(action)}><Icon name="refresh" size={18} /> {action === "quick-sync" ? "Buscando..." : "Búsqueda rápida"}</button>
        </div>
        <details className="range-sync-details">
          <summary>Sincronización por rango de fechas</summary>
          <p>Úsala cuando necesites consultar días anteriores o recuperar correos que no aparecieron en la búsqueda rápida.</p>
        <div className="sync-controls">
          <label><span>Desde</span><input type="date" value={dateFrom} max={dateTo} onChange={(event) => setDateFrom(event.target.value)} /></label>
          <label><span>Hasta</span><input type="date" value={dateTo} min={dateFrom} max={today} onChange={(event) => setDateTo(event.target.value)} /></label>
          <button className="primary-button" onClick={synchronize} disabled={!isAdmin || !canAttemptGmail || Boolean(action) || !dateFrom || !dateTo}>
            <Icon name="refresh" size={18} /> {action === "sync" ? "Sincronizando..." : "Sincronizar ahora"}
          </button>
        </div>
        </details>
        {lastSync ? <div className="sync-summary">
          <div><span>Última ejecución</span><strong>{formatDate(lastSync.started_at)}</strong></div>
          <div><span>Correos consultados</span><strong>{lastSync.messages_scanned || 0}</strong></div>
          <div><span>{lastSync.detail?.phase === "2D" ? "Adjuntos revisados" : "Correos Bancolombia"}</span><strong>{lastSync.detail?.phase === "2D" ? (lastSync.detail?.attachments_scanned || 0) : (lastSync.detail?.bancolombia_emails || 0)}</strong></div>
          <div><span>{lastSync.detail?.phase === "2D" ? "Facturas creadas" : "Movimientos creados"}</span><strong>{lastSync.detail?.phase === "2D" ? (lastSync.invoices_created || 0) : (lastSync.movements_created || 0)}</strong></div>
          <div><span>Ya registrados</span><strong>{lastSync.duplicates_ignored || 0}</strong></div>
          <div><span>Errores</span><strong>{lastSync.errors_count || 0}</strong></div>
        </div> : null}
        {statusUnavailable ? <Alert tone="danger">La sincronización está bloqueada porque no se pudo comprobar la comunicación con las Edge Functions. Ejecuta “Diagnosticar comunicación”.</Alert> : !canAttemptGmail ? <Alert tone="warning">Conecta Gmail antes de ejecutar una sincronización.</Alert> : null}
      </section>

      <section className="panel-card employee-access-settings-card">
        <div className="panel-heading">
          <div><span className="eyebrow">Acceso restringido</span><h2>Enlace público para empleados</h2></div>
          <Badge tone={employeeEnabled ? "success" : "neutral"}>{employeeEnabled ? "Activo" : "Desactivado"}</Badge>
        </div>
        <p className="panel-description">Permite consultar solamente los cinco movimientos más recientes, buscar alertas Bancolombia de la última 1, 3 o 6 horas, confirmar ingresos e instalar una PWA independiente para empleados.</p>
        {employeeMessage ? <Alert tone={employeeTone}>{employeeMessage}</Alert> : null}
        <div className="employee-access-form">
          <label><span>Nombre de acceso</span><input value={employeeUsername} maxLength={40} onChange={(event) => setEmployeeUsername(event.target.value.toLowerCase())} placeholder="empleados" disabled={!isAdmin || Boolean(employeeAction)} /></label>
          <label><span>{employeeAccess.password_configured ? "Nueva contraseña (opcional)" : "Contraseña"}</span><input type="password" value={employeePassword} maxLength={72} onChange={(event) => setEmployeePassword(event.target.value)} placeholder={employeeAccess.password_configured ? "Déjala vacía para conservar la actual" : "Mínimo 4 caracteres"} disabled={!isAdmin || Boolean(employeeAction)} /></label>
          <label className="employee-access-toggle"><input type="checkbox" checked={employeeEnabled} onChange={(event) => setEmployeeEnabled(event.target.checked)} disabled={!isAdmin || Boolean(employeeAction)} /><span>Habilitar acceso público</span></label>
        </div>
        <div className="employee-public-link-box"><span>Enlace para compartir</span><strong>{employeeAccess.public_url || `${window.location.origin}/empleados`}</strong></div>
        <div className="button-row">
          <button className="primary-button" onClick={savePublicEmployeeAccess} disabled={!isAdmin || Boolean(employeeAction) || !employeeUsername || (!employeeAccess.password_configured && employeePassword.length < 4)}><Icon name="shield" size={18} /> {employeeAction === "save" ? "Guardando..." : "Guardar acceso"}</button>
          <button className="secondary-button" onClick={copyEmployeeLink} disabled={!employeeAccess.public_url && !window.location.origin}><Icon name="check" size={18} /> Copiar enlace</button>
          <a className="secondary-button employee-link-button" href="/empleados" target="_blank" rel="noreferrer">Abrir vista pública</a>
        </div>
        <div className="employee-access-restrictions">
          <div><Icon name="check" size={16} /><span>Solo cinco movimientos</span></div>
          <div><Icon name="check" size={16} /><span>Sin acceso a Gmail ni facturas</span></div>
          <div><Icon name="check" size={16} /><span>Sesión temporal de 8 horas</span></div>
          <div><Icon name="check" size={16} /><span>PWA instalable e independiente</span></div>
        </div>
        <Alert tone="warning">El nombre y la contraseña son compartidos. Al cambiar cualquiera de los dos, todas las sesiones públicas abiertas se cierran automáticamente.</Alert>
      </section>

      {confirmDisconnect ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setConfirmDisconnect(false)}>
          <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="disconnect-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-icon danger"><Icon name="alert" size={25} /></div>
            <h2 id="disconnect-title">Desconectar Gmail</h2>
            <p>La aplicación dejará de tener acceso de lectura a la cuenta. Los registros documentales existentes no se eliminarán.</p>
            <div className="button-row modal-actions">
              <button className="secondary-button" onClick={() => setConfirmDisconnect(false)}>Cancelar</button>
              <button className="danger-button" onClick={disconnect}>Desconectar</button>
            </div>
          </section>
        </div>
      ) : null}

      <section className="panel-card phase-card">
        <div><span className="eyebrow">Versión {APP_VERSION}</span><h2>{APP_PHASE} — {APP_PHASE_TITLE}</h2><p>{APP_PHASE_DESCRIPTION}</p></div>
        <Badge tone="blue">{APP_PHASE}</Badge>
      </section>
    </>
  );
}

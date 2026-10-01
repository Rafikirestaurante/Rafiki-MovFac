import React, { useEffect, useMemo, useState } from "react";
import Icon from "../components/Icons.jsx";
import { Alert, EmptyState, PageHeader } from "../components/Ui.jsx";
import { syncGmailNow, syncGmailQuick } from "../services/gmailIntegrationService.js";
import { getFinancialMovements } from "../services/movementService.js";

const typeLabels = {
  income: "Ingreso",
  transfer: "Transferencia",
  card_purchase: "Compra con tarjeta",
  service_payment: "Pago de servicio",
  unknown: "Sin identificar"
};

const PAGE_SIZE = 50;

function cop(value) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function bogotaDay(offsetDays = 0) {
  const date = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function movementMoment(row) {
  return row.transaction_at || row.email_received_at || row.created_at || (row.transaction_date ? `${row.transaction_date}T12:00:00-05:00` : null);
}

function formatMoment(row) {
  const value = movementMoment(row);
  if (!value) return { date: "—", time: "—" };
  try {
    const parsed = new Date(value);
    return {
      date: new Intl.DateTimeFormat("es-CO", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "America/Bogota"
      }).format(parsed),
      time: new Intl.DateTimeFormat("es-CO", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "America/Bogota"
      }).format(parsed)
    };
  } catch {
    return { date: row.transaction_date || String(value), time: "—" };
  }
}

function MovementAmount({ row }) {
  const income = row.movement_type === "income";
  return <span className={`movement-amount ${income ? "income" : "expense"}`}>{income ? "+" : "−"}{cop(row.amount_cop)}</span>;
}

export default function MovementsPage({ profile, syncIndicator }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");
  const [source, setSource] = useState("all");
  const [dateFrom, setDateFrom] = useState(bogotaDay(-6));
  const [dateTo, setDateTo] = useState(bogotaDay());
  const [syncing, setSyncing] = useState(false);
  const [quickSyncHours, setQuickSyncHours] = useState(null);
  const [syncMessage, setSyncMessage] = useState("");
  const [syncTone, setSyncTone] = useState("info");
  const [page, setPage] = useState(1);

  const isAdmin = profile?.role === "admin";

  async function load() {
    setLoading(true);
    setError("");
    try {
      setRows(await getFinancialMovements());
    } catch (loadError) {
      setError(loadError.message || "No se pudieron cargar los movimientos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const refresh = () => load();
    window.addEventListener("rafiki:movements-updated", refresh);
    return () => window.removeEventListener("rafiki:movements-updated", refresh);
  }, []);

  async function synchronizeQuick(hours = 1) {
    setSyncing(true);
    setQuickSyncHours(hours);
    setSyncMessage("");
    try {
      const data = await syncGmailQuick(hours);
      const usedHours = Number(data.quick_hours || hours);
      const limit = Number(data.quick_message_limit || (usedHours === 6 ? 120 : usedHours === 3 ? 60 : 20));
      setSyncTone(data.errors_count || data.bancolombia_unidentified ? "warning" : "success");
      setSyncMessage(`Búsqueda de ${usedHours} ${usedHours === 1 ? "hora" : "horas"} completada: ${data.messages_scanned || data.messages_found || 0} de hasta ${limit} alertas de Bancolombia revisadas, ${data.movements_created || 0} movimientos nuevos, ${data.duplicates_ignored || 0} ya registrados y ${data.bancolombia_unidentified || 0} con formato no reconocido.`);
      await load();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (syncError) {
      setSyncTone("danger");
      setSyncMessage(syncError.message || "No se pudo ejecutar la búsqueda de Bancolombia.");
    } finally {
      setQuickSyncHours(null);
      setSyncing(false);
    }
  }

  async function synchronize() {
    setSyncing(true);
    setSyncMessage("");
    try {
      const data = await syncGmailNow(dateFrom, dateTo);
      setSyncTone(data.errors_count || data.bancolombia_unidentified ? "warning" : "success");
      setSyncMessage(`Sincronización terminada: ${data.messages_found || 0} correos consultados, ${data.bancolombia_emails || 0} de Bancolombia y ${data.movements_created || 0} movimientos nuevos.`);
      await load();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (syncError) {
      setSyncTone("danger");
      setSyncMessage(syncError.message || "No se pudo sincronizar Gmail.");
    } finally {
      setSyncing(false);
    }
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (date && row.transaction_date !== date) return false;
      if (source !== "all" && row.source !== source) return false;
      if (!term) return true;
      const moment = formatMoment(row);
      return [row.detail, row.reference_text, row.email_subject, row.amount_cop, typeLabels[row.movement_type], row.source, moment.date, moment.time]
        .some((value) => String(value || "").toLowerCase().includes(term));
    });
  }, [rows, search, date, source]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  useEffect(() => {
    setPage(1);
  }, [search, date, source]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const latestMovement = rows[0] || null;
  const latestMoment = latestMovement ? formatMoment(latestMovement) : null;
  const firstVisible = filtered.length ? (page - 1) * PAGE_SIZE + 1 : 0;
  const lastVisible = Math.min(page * PAGE_SIZE, filtered.length);

  return (
    <>
      <div className={`module-sync-indicator ${syncIndicator?.active ? "syncing" : syncIndicator ? "on" : "off"}`}><span className="sync-dot"></span><strong>Movimientos</strong><span>{syncIndicator?.active ? "Sincronizando..." : syncIndicator?.message || "Automática"}</span></div>
      <PageHeader
        eyebrow="Bancolombia y Nequi"
        title="Movimientos"
        description="Consulta los movimientos detectados en Gmail. El registro más reciente siempre aparece primero."
        action={<button className="secondary-button" onClick={load} disabled={loading || syncing}><Icon name="refresh" size={18} /> Actualizar</button>}
      />

      {error ? <Alert tone="danger">{error}</Alert> : null}
      {syncMessage ? <Alert tone={syncTone}>{syncMessage}</Alert> : null}

      <details className="movement-options">
        <summary>Opciones</summary>
        <div className="movement-options-grid">
          <details className="movement-option-group">
            <summary>Sincronización manual</summary>
            <div className="quick-sync-actions" aria-label="Ventana de búsqueda Bancolombia">
              <button className="primary-button" onClick={() => synchronizeQuick(1)} disabled={!isAdmin || syncing || loading}>
                <Icon name="refresh" size={17} /> {quickSyncHours === 1 ? "Buscando..." : "Búsqueda rápida"}
              </button>
              <button className="secondary-button" onClick={() => synchronizeQuick(3)} disabled={!isAdmin || syncing || loading}>{quickSyncHours === 3 ? "Buscando..." : "3 horas"}</button>
              <button className="secondary-button" onClick={() => synchronizeQuick(6)} disabled={!isAdmin || syncing || loading}>{quickSyncHours === 6 ? "Buscando..." : "6 horas"}</button>
            </div>
          </details>

          <details className="movement-option-group">
            <summary>Sincronización por rango de fechas</summary>
            <div className="movement-range-controls">
              <label><span>Desde</span><input type="date" value={dateFrom} max={dateTo} onChange={(event) => setDateFrom(event.target.value)} /></label>
              <label><span>Hasta</span><input type="date" value={dateTo} min={dateFrom} max={bogotaDay()} onChange={(event) => setDateTo(event.target.value)} /></label>
              <button className="primary-button" onClick={synchronize} disabled={!isAdmin || syncing || loading || !dateFrom || !dateTo}>
                <Icon name="refresh" size={17} /> {syncing ? "Sincronizando..." : "Sincronizar"}
              </button>
            </div>
          </details>
        </div>
      </details>
      {!isAdmin ? <Alert tone="warning">Solo el Administrador puede iniciar la sincronización. Los Revisores sí pueden consultar los movimientos.</Alert> : null}

      {latestMovement ? (
        <section className="latest-movement-card" aria-label="Último movimiento registrado">
          <div className="latest-movement-title">
            <div className="latest-icon"><Icon name="movements" size={22} /></div>
            <div><span className="eyebrow">Último movimiento</span><strong>{latestMovement.detail || "Sin detalle"}</strong><small>{typeLabels[latestMovement.movement_type] || latestMovement.movement_type} · {latestMovement.source === "bancolombia" ? "Bancolombia" : "Nequi"}</small></div>
          </div>
          <div className="latest-movement-date"><span>Fecha y hora</span><strong>{latestMoment.date}</strong><small>{latestMoment.time}</small></div>
          <MovementAmount row={latestMovement} />
        </section>
      ) : null}

      <section className="panel-card">
        <details className="movement-filter-options"><summary>Búsqueda y filtros</summary><div className="filter-bar movement-filters">
          <div className="search-box"><Icon name="search" size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar detalle, referencia, fecha, hora o valor" /></div>
          <label className="compact-filter"><span>Fecha</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
          <label className="compact-filter"><span>Origen</span><select value={source} onChange={(event) => setSource(event.target.value)}><option value="all">Todos</option><option value="bancolombia">Bancolombia</option><option value="nequi">Nequi</option></select></label>
          {(search || date || source !== "all") ? <button className="filter-button" onClick={() => { setSearch(""); setDate(""); setSource("all"); }}>Limpiar</button> : null}
        </div></details>

        {loading ? <div className="table-loading">Consultando movimientos...</div> : filtered.length === 0 ? (
          <EmptyState icon="movements" title={rows.length ? "No hay coincidencias" : "No hay movimientos documentados"} description={rows.length ? "Cambia o limpia los filtros para volver a ver los registros." : "Usa el botón Sincronizar ahora para consultar las alertas de Bancolombia."} />
        ) : (
          <>
            <div className="results-caption">
              <span>{filtered.length} movimiento{filtered.length === 1 ? "" : "s"} · {firstVisible}-{lastVisible}</span>
              {totalPages > 1 ? (
                <div className="pagination-controls" aria-label="Paginación de movimientos">
                  <button className="icon-button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} aria-label="Página anterior" title="Página anterior"><Icon name="chevron-left" size={18} /></button>
                  <span>Página {page} de {totalPages}</span>
                  <button className="icon-button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages} aria-label="Página siguiente" title="Página siguiente"><Icon name="chevron-right" size={18} /></button>
                </div>
              ) : null}
            </div>
            <div className="data-table-wrap">
              <table className="data-table movement-table">
                <thead><tr><th>Fecha y hora</th><th>Tipo y origen</th><th>Detalle</th><th>Referencia</th><th className="amount-column">Valor</th></tr></thead>
                <tbody>{paginated.map((row) => {
                  const moment = formatMoment(row);
                  return <tr key={row.id} className={row.id === latestMovement?.id ? "latest-row" : ""}>
                    <td data-label="Fecha y hora"><div className="movement-datetime"><strong>{moment.date}</strong><small>{moment.time}</small></div></td>
                    <td data-label="Tipo y origen"><div className="movement-kind"><strong>{typeLabels[row.movement_type] || row.movement_type}</strong><small>{row.source === "bancolombia" ? "Bancolombia" : "Nequi"}</small></div></td>
                    <td data-label="Detalle"><div className="movement-detail"><strong>{row.detail || "Sin detalle"}</strong><small>{row.email_subject || "Sin asunto"}</small></div></td>
                    <td data-label="Referencia">{row.reference_text || "—"}</td>
                    <td data-label="Valor"><MovementAmount row={row} /></td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </>
  );
}

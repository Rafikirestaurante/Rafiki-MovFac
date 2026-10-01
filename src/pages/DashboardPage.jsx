import React, { useEffect, useMemo, useState } from "react";
import { Alert, Badge, EmptyState, MetricCard, PageHeader } from "../components/Ui.jsx";
import Icon from "../components/Icons.jsx";
import { getDashboardMonthData } from "../services/dashboardService.js";
import {
  bogotaDateKey,
  buildMonthCalendar,
  formatDateKeyLabel,
  formatMonthLabel,
  monthKeyFromDateKey,
  shiftMonth
} from "../utils/calendar.js";

function cop(value) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatTime(value) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat("es-CO", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Bogota"
  }).format(parsed);
}

function activityMap(data) {
  const map = new Map();
  function row(dateKey) {
    if (!map.has(dateKey)) map.set(dateKey, { movements: 0, invoices: 0, alerts: 0 });
    return map.get(dateKey);
  }
  for (const movement of data.movements) row(movement.transaction_date).movements += 1;
  for (const invoice of data.invoices) if (invoice.date_key) row(invoice.date_key).invoices += 1;
  for (const alert of data.alerts) if (alert.date_key) row(alert.date_key).alerts += 1;
  return map;
}

export default function DashboardPage({ onNavigate }) {
  const todayKey = useMemo(() => bogotaDateKey(), []);
  const todayMonth = monthKeyFromDateKey(todayKey);
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [monthKey, setMonthKey] = useState(todayMonth);
  const [data, setData] = useState({ movements: [], invoices: [], alerts: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    getDashboardMonthData(monthKey)
      .then((next) => { if (active) setData(next); })
      .catch((loadError) => { if (active) setError(loadError.message || "No se pudo cargar la información del calendario."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [monthKey]);

  useEffect(() => {
    const refresh = () => {
      getDashboardMonthData(monthKey).then(setData).catch(() => {});
    };
    window.addEventListener("rafiki:data-updated", refresh);
    return () => window.removeEventListener("rafiki:data-updated", refresh);
  }, [monthKey]);

  const calendarDays = useMemo(() => buildMonthCalendar(monthKey), [monthKey]);
  const activity = useMemo(() => activityMap(data), [data]);
  const selectedMovements = useMemo(() => data.movements.filter((row) => row.transaction_date === selectedDate), [data.movements, selectedDate]);
  const selectedInvoices = useMemo(() => data.invoices.filter((row) => row.date_key === selectedDate), [data.invoices, selectedDate]);
  const selectedAlerts = useMemo(() => data.alerts.filter((row) => row.date_key === selectedDate), [data.alerts, selectedDate]);

  const summary = useMemo(() => selectedMovements.reduce((result, row) => {
    result.count += 1;
    if (row.movement_type === "income") result.income += Number(row.amount_cop || 0);
    else result.expense += Number(row.amount_cop || 0);
    return result;
  }, { count: 0, income: 0, expense: 0 }), [selectedMovements]);

  const invoiceValue = useMemo(() => selectedInvoices.reduce((sum, row) => sum + Number(row.total_cop || 0), 0), [selectedInvoices]);
  const selectedLabel = formatDateKeyLabel(selectedDate);

  function moveMonth(offset) {
    const nextMonth = shiftMonth(monthKey, offset);
    if (nextMonth > todayMonth) return;
    setMonthKey(nextMonth);
    setSelectedDate(nextMonth === todayMonth ? todayKey : `${nextMonth}-01`);
  }

  return (
    <>
      <PageHeader
        eyebrow="Resumen documental"
        title="Inicio"
        description={`Información correspondiente a ${selectedLabel}.`}
        action={<button className="secondary-button" onClick={() => onNavigate("movimientos")}><Icon name="refresh" size={18} /> Abrir movimientos</button>}
      />

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <section className="metrics-grid dashboard-day-metrics">
        <MetricCard label="Movimientos" value={String(summary.count)} hint="Fecha seleccionada" icon="movements" />
        <MetricCard label="Ingresos" value={cop(summary.income)} hint="Informativo · sin afectar Caja" icon="check" tone="positive" />
        <MetricCard label="Salidas" value={cop(summary.expense)} hint="Transferencias y compras" icon="movements" tone="warning" />
        <MetricCard label="Facturas" value={String(selectedInvoices.length)} hint={selectedInvoices.length ? cop(invoiceValue) : "Sin documentos ese día"} icon="invoice" tone="blue" />
      </section>

      <section className="dashboard-calendar-layout">
        <article className="panel-card dashboard-calendar-card">
          <div className="calendar-toolbar">
            <div>
              <span className="eyebrow">Consulta histórica</span>
              <h2>Calendario de actividad</h2>
            </div>
            <div className="calendar-navigation">
              <button type="button" className="calendar-nav-button" onClick={() => moveMonth(-1)} aria-label="Mes anterior">‹</button>
              <strong>{formatMonthLabel(monthKey)}</strong>
              <button type="button" className="calendar-nav-button" onClick={() => moveMonth(1)} disabled={monthKey >= todayMonth} aria-label="Mes siguiente">›</button>
            </div>
          </div>

          <div className="calendar-legend" aria-label="Leyenda del calendario">
            <span><i className="calendar-dot movement" /> Movimientos</span>
            <span><i className="calendar-dot invoice" /> Facturas</span>
            <span><i className="calendar-dot alert" /> Alerta por revisar</span>
          </div>

          <div className="activity-calendar" aria-busy={loading}>
            <div className="calendar-weekdays">{["L", "M", "X", "J", "V", "S", "D"].map((label) => <span key={label}>{label}</span>)}</div>
            <div className="calendar-grid">
              {calendarDays.map((day) => {
                const dayActivity = activity.get(day.dateKey) || { movements: 0, invoices: 0, alerts: 0 };
                const isFuture = day.dateKey > todayKey;
                const disabled = !day.inMonth || isFuture;
                return (
                  <button
                    type="button"
                    key={day.dateKey}
                    className={`calendar-day ${day.inMonth ? "" : "outside"} ${day.dateKey === selectedDate ? "selected" : ""} ${day.dateKey === todayKey ? "today" : ""}`}
                    disabled={disabled}
                    onClick={() => setSelectedDate(day.dateKey)}
                    aria-label={`${day.day} de ${formatMonthLabel(monthKey)}`}
                  >
                    <span className="calendar-day-number">{day.day}</span>
                    {day.inMonth && !isFuture ? (
                      <span className="calendar-day-activity">
                        {dayActivity.movements ? <small className="calendar-count movement">{dayActivity.movements}</small> : null}
                        {dayActivity.invoices ? <small className="calendar-count invoice">{dayActivity.invoices}</small> : null}
                        {dayActivity.alerts ? <small className="calendar-count alert">{dayActivity.alerts}</small> : null}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
          {loading ? <p className="calendar-loading">Cargando actividad del mes...</p> : null}
        </article>

        <article className="panel-card dashboard-day-detail">
          <div className="panel-heading">
            <div><span className="eyebrow">Detalle del día</span><h2>{selectedLabel}</h2></div>
            <Badge tone={selectedAlerts.length ? "warning" : summary.count || selectedInvoices.length ? "success" : "neutral"}>
              {selectedAlerts.length ? `${selectedAlerts.length} por revisar` : "Sin alertas pendientes"}
            </Badge>
          </div>

          <div className="day-detail-summary">
            <div><span>Movimientos</span><strong>{summary.count}</strong><small>{cop(summary.income - summary.expense)} balance informativo</small></div>
            <div><span>Facturas</span><strong>{selectedInvoices.length}</strong><small>{cop(invoiceValue)} en documentos</small></div>
            <div><span>Alertas no entendidas</span><strong>{selectedAlerts.length}</strong><small>Se conservan para revisión</small></div>
          </div>

          {!loading && !summary.count && !selectedInvoices.length && !selectedAlerts.length ? (
            <EmptyState icon="calendar" title="Sin actividad registrada" description="No hay movimientos, facturas ni alertas Bancolombia por revisar para esta fecha." />
          ) : null}

          {selectedMovements.length ? (
            <section className="day-detail-section">
              <div className="day-detail-heading"><strong>Movimientos</strong><button type="button" onClick={() => onNavigate("movimientos")}>Ver todos</button></div>
              <div className="day-detail-list">{selectedMovements.slice(0, 5).map((row) => (
                <div key={row.id} className="day-detail-row">
                  <div><strong>{row.detail || "Movimiento"}</strong><small>{formatTime(row.transaction_at || row.email_received_at)} · {row.source === "bancolombia" ? "Bancolombia" : "Nequi"}</small></div>
                  <span className={row.movement_type === "income" ? "positive-text" : "negative-text"}>{row.movement_type === "income" ? "+" : "−"}{cop(row.amount_cop)}</span>
                </div>
              ))}</div>
            </section>
          ) : null}

          {selectedInvoices.length ? (
            <section className="day-detail-section">
              <div className="day-detail-heading"><strong>Facturas</strong><button type="button" onClick={() => onNavigate("facturas")}>Ver todas</button></div>
              <div className="day-detail-list">{selectedInvoices.slice(0, 4).map((row) => (
                <div key={row.id} className="day-detail-row">
                  <div><strong>{row.supplier_name || "Proveedor pendiente"}</strong><small>{row.invoice_number || "Número pendiente"} · {String(row.source_file_type || "").toUpperCase()}</small></div>
                  <span>{cop(row.total_cop)}</span>
                </div>
              ))}</div>
            </section>
          ) : null}

          {selectedAlerts.length ? (
            <section className="day-detail-section unrecognized-section">
              <div className="day-detail-heading"><strong>Alertas Bancolombia no reconocidas</strong><Badge tone="warning">Revisar</Badge></div>
              <p className="day-detail-note">El correo quedó registrado, pero no se creó ningún movimiento porque su formato no coincide con una regla conocida.</p>
              <div className="day-detail-list">{selectedAlerts.slice(0, 5).map((row) => (
                <div key={row.id} className="day-detail-row alert-row">
                  <div><strong>{row.subject || "Alerta Bancolombia sin asunto"}</strong><small>{formatTime(row.internal_date)} · {row.snippet || row.raw_metadata?.error || "Formato no reconocido"}</small></div>
                  <Badge tone="warning">Guardada</Badge>
                </div>
              ))}</div>
            </section>
          ) : null}
        </article>
      </section>
    </>
  );
}

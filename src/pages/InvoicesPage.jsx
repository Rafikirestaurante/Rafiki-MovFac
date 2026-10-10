import React, { useEffect, useMemo, useState } from "react";
import Icon from "../components/Icons.jsx";
import { Alert, Badge, EmptyState, MetricCard, PageHeader } from "../components/Ui.jsx";
import { getElectronicInvoices, gmailMessageUrl } from "../services/invoiceService.js";
import { syncInvoicesRange, syncInvoicesRecent } from "../services/gmailIntegrationService.js";

function bogotaDay(offset = 0) {
  const date = new Date(Date.now() + offset * 86400000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
function cop(value) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(value || 0));
}
function formatDate(value) {
  if (!value) return "—";
  try { return new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Bogota" }).format(new Date(`${value}T12:00:00-05:00`)); }
  catch { return value; }
}
function formatReceived(value) {
  if (!value) return "—";
  try { return new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" }).format(new Date(value)); }
  catch { return value; }
}
const typeLabels = { invoice: "Factura", credit_note: "Nota crédito", debit_note: "Nota débito", attached_document: "Documento adjunto", unknown: "Documento" };

export default function InvoicesPage({ profile, syncIndicator }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState("info");
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [fileType, setFileType] = useState("all");
  const [dateFrom, setDateFrom] = useState(bogotaDay(-30));
  const [dateTo, setDateTo] = useState(bogotaDay());
  const isAdmin = profile?.role === "admin";

  async function load() {
    setLoading(true); setError("");
    try { setRows(await getElectronicInvoices()); }
    catch (loadError) { setError(loadError.message || "No se pudieron cargar las facturas."); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    load();
    const refresh = () => load();
    window.addEventListener("rafiki:invoices-updated", refresh);
    return () => window.removeEventListener("rafiki:invoices-updated", refresh);
  }, []);

  async function runRecent() {
    setSyncing(true); setMessage("");
    try {
      const data = await syncInvoicesRecent();
      setTone(data.errors_count || data.incomplete_documents ? "warning" : "success");
      setMessage(`Búsqueda terminada: ${data.messages_scanned || 0} correos revisados, ${data.attachments_scanned || 0} adjuntos, ${data.invoices_created || 0} facturas nuevas, ${data.invoices_updated || 0} actualizadas y ${data.incomplete_documents || 0} documentos incompletos.`);
      await load();
    } catch (syncError) { setTone("danger"); setMessage(syncError.message || "No se pudieron buscar facturas."); }
    finally { setSyncing(false); }
  }
  async function runRange() {
    setSyncing(true); setMessage("");
    try {
      const data = await syncInvoicesRange(dateFrom, dateTo);
      setTone(data.errors_count || data.incomplete_documents ? "warning" : "success");
      setMessage(`Búsqueda histórica terminada: ${data.messages_scanned || 0} correos revisados y ${data.invoices_created || 0} facturas nuevas.`);
      await load();
    } catch (syncError) { setTone("danger"); setMessage(syncError.message || "No se pudieron buscar facturas."); }
    finally { setSyncing(false); }
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (fileType !== "all" && row.source_file_type !== fileType) return false;
      if (!term) return true;
      return [row.supplier_name, row.supplier_tax_id, row.invoice_number, row.cufe, row.email_subject, row.attachment_name, row.total_cop]
        .some((value) => String(value || "").toLowerCase().includes(term));
    });
  }, [rows, search, fileType]);

  const month = bogotaDay().slice(0, 7);
  const monthRows = rows.filter((row) => String(row.invoice_date || "").startsWith(month));
  const totalMonth = monthRows.reduce((sum, row) => sum + Number(row.total_cop || 0), 0);
  const incomplete = rows.filter((row) => row.document_status === "incomplete").length;
  const latest = rows[0] || null;

  return (
    <>
      <div className={`module-sync-indicator ${syncIndicator?.active ? "syncing" : syncIndicator ? "on" : "off"}`}><span className="sync-dot"></span><strong>Facturas</strong><span>{syncIndicator?.active ? "Sincronizando..." : syncIndicator?.message || "Automática"}</span></div>
      <PageHeader eyebrow="Documentos electrónicos" title="Facturas" description="Consulta facturas recibidas en ZIP, XML y PDF. El XML es la fuente principal de extracción." action={<button className="secondary-button" onClick={load} disabled={loading || syncing}><Icon name="refresh" size={18} /> Actualizar</button>} />
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {message ? <Alert tone={tone}>{message}</Alert> : null}

      <section className="invoice-sync-card">
        <div><span className="eyebrow">Recomendado</span><strong>Buscar facturas recientes</strong><small>Revisa correos con ZIP, XML o PDF recibidos durante los últimos siete días.</small></div>
        <button className="primary-button" onClick={runRecent} disabled={!isAdmin || syncing || loading}><Icon name="refresh" size={18} /> {syncing ? "Buscando..." : "Buscar facturas"}</button>
      </section>

      <details className="movement-range-sync invoice-range-sync">
        <summary>Búsqueda histórica por fechas</summary>
        <section className="movement-sync-card">
          <div className="movement-sync-copy"><strong>Buscar facturas anteriores</strong><small>Consulta únicamente correos con archivos ZIP, XML o PDF.</small></div>
          <label><span>Desde</span><input type="date" value={dateFrom} max={dateTo} onChange={(event) => setDateFrom(event.target.value)} /></label>
          <label><span>Hasta</span><input type="date" value={dateTo} min={dateFrom} max={bogotaDay()} onChange={(event) => setDateTo(event.target.value)} /></label>
          <button className="primary-button" onClick={runRange} disabled={!isAdmin || syncing || !dateFrom || !dateTo}><Icon name="search" size={18} /> Buscar rango</button>
        </section>
      </details>
      {!isAdmin ? <Alert tone="warning">Solo el Administrador puede iniciar búsquedas. Los Revisores pueden consultar las facturas registradas.</Alert> : null}

      <section className="metrics-grid invoice-metrics">
        <MetricCard label="Facturas registradas" value={String(rows.length)} hint="Total disponible" icon="invoice" />
        <MetricCard label="Facturas del mes" value={String(monthRows.length)} hint="Fecha de emisión" icon="calendar" tone="blue" />
        <MetricCard label="Valor del mes" value={cop(totalMonth)} hint="Suma informativa" icon="mail" tone="positive" />
        <MetricCard label="Por completar" value={String(incomplete)} hint="Principalmente PDF sin XML" icon="alert" tone="warning" />
      </section>

      {latest ? <section className="latest-invoice-card"><div><span className="eyebrow">Última factura</span><strong>{latest.supplier_name || "Proveedor sin identificar"}</strong><small>{latest.invoice_number || "Número pendiente"} · recibida {formatReceived(latest.email_received_at)}</small></div><div><span>Fecha</span><strong>{formatDate(latest.invoice_date)}</strong></div><b>{cop(latest.total_cop)}</b></section> : null}

      <section className="panel-card">
        <div className="filter-bar invoice-filters">
          <div className="search-box"><Icon name="search" size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar proveedor, NIT, factura, CUFE o valor" /></div>
          <label className="compact-filter"><span>Archivo</span><select value={fileType} onChange={(event) => setFileType(event.target.value)}><option value="all">Todos</option><option value="zip">ZIP</option><option value="xml">XML</option><option value="pdf">PDF</option></select></label>
          {(search || fileType !== "all") ? <button className="filter-button" onClick={() => { setSearch(""); setFileType("all"); }}>Limpiar</button> : null}
        </div>

        {loading ? <div className="table-loading">Consultando facturas...</div> : filtered.length === 0 ? (
          <EmptyState icon="invoice" title={rows.length ? "No hay coincidencias" : "No hay facturas documentadas"} description={rows.length ? "Cambia o limpia los filtros." : "Usa Buscar facturas para consultar los correos con ZIP, XML o PDF."} />
        ) : <>
          <div className="results-caption">{filtered.length} documento{filtered.length === 1 ? "" : "s"} · los más recientes aparecen primero</div>
          <div className="data-table-wrap"><table className="data-table invoice-table"><thead><tr><th>Fecha</th><th>Proveedor</th><th>Documento</th><th>Archivo</th><th className="amount-column">Total</th><th></th></tr></thead><tbody>
            {filtered.map((row) => <tr key={row.id}>
              <td data-label="Fecha"><strong>{formatDate(row.invoice_date)}</strong><small className="cell-subtext">Recibida {formatReceived(row.email_received_at)}</small></td>
              <td data-label="Proveedor"><strong>{row.supplier_name || "Sin identificar"}</strong><small className="cell-subtext">NIT {row.supplier_tax_id || "—"}</small></td>
              <td data-label="Documento"><strong>{row.invoice_number || "Número pendiente"}</strong><small className="cell-subtext">{typeLabels[row.document_type] || "Documento"}{row.cufe ? ` · CUFE ${row.cufe.slice(0, 12)}…` : ""}</small></td>
              <td data-label="Archivo"><Badge tone={row.document_status === "incomplete" ? "warning" : "success"}>{String(row.source_file_type || "unknown").toUpperCase()}</Badge><small className="cell-subtext">{row.attachment_name || "Sin nombre"}</small></td>
              <td data-label="Total" className="amount-column"><strong>{cop(row.total_cop)}</strong></td>
              <td data-label="Correo">{gmailMessageUrl(row.gmail_message_id) ? <a className="invoice-mail-link" href={gmailMessageUrl(row.gmail_message_id)} target="_blank" rel="noreferrer"><Icon name="mail" size={16} /> Abrir correo</a> : "—"}</td>
            </tr>)}
          </tbody></table></div>
        </>}
      </section>
    </>
  );
}

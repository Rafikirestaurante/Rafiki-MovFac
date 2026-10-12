import React, { useState } from "react";
import { supabase } from "../supabaseClient.js";
import { APP_VERSION, APP_PHASE } from "../config/appMetadata.js";

function decode(value) {
  try { return JSON.parse(value); } catch { return { message: String(value || "Sin detalle") }; }
}
function explain(code) {
  return ({23505:"La base rechazó un duplicado. Revisar si la restricción es global o por workspace.",42703:"El código requiere una columna que falta en la base. Revisar migraciones.",42501:"Permiso insuficiente. Revisar sesión, rol y políticas RLS.",23502:"Falta un campo obligatorio al guardar.",23503:"La asociación con otro registro no existe.","57014":"La consulta fue cancelada por tiempo de espera."})[code] || "Error sin clasificación automática. Consultar el código y la etapa en los logs de Supabase.";
}
function safeMessage(value) {
  const error=decode(value);
  const code=String(error.code || "sin código");
  // Solo incluir mensaje principal: details puede contener valores financieros o correos.
  const message=String(error.message || "Sin mensaje").replace(/Bearer\s+\S+/gi,"[credencial omitida]").replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g,"[token omitido]").replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g,"[correo omitido]");
  return {code,message,explanation:explain(code)};
}
export default function SyncDiagnostic() {
 const [data,setData]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(""),[historical,setHistorical]=useState(false),[copied,setCopied]=useState(false);
 async function load(){setBusy(true);setError("");setCopied(false);try{const result=await supabase.rpc("workspace_sync_diagnostic");if(result.error)throw result.error;setData(result.data);}catch(e){setError(e.message || "No se pudo consultar el diagnóstico");}finally{setBusy(false);}}
 const latest=data?.runs?.[0];
 const errors=(data?.errors || []).filter(e=>historical || e.sync_run_id===latest?.id).map(e=>({id:e.id,run:e.sync_run_id,date:e.created_at,stage:e.stage,source:e.source,...safeMessage(e.error_message)}));
 async function copy(){try{await navigator.clipboard.writeText(JSON.stringify({version:APP_VERSION,phase:APP_PHASE,checked_at:data.checked_at,online:navigator.onLine,runs:data.runs,errors},null,2));setCopied(true);}catch{setError("El navegador no permitió copiar. Revisa el permiso del portapapeles.");}}
 return <details className="panel-card sync-diagnostic" open><summary>Diagnóstico avanzado de sincronización</summary><div style={{padding:12,fontSize:12}}><p>Versión {APP_VERSION} · {APP_PHASE}</p><p>Solo tu workspace. Consulta hasta 10 ejecuciones y 100 errores; no inicia sincronizaciones.</p><button className="secondary-button" disabled={busy} onClick={load}>{busy?"Consultando…":"Actualizar diagnóstico"}</button> <button className="secondary-button" disabled={!data||busy} onClick={copy}>{copied?"Reporte copiado":"Copiar diagnóstico"}</button>{error&&<p role="alert">{error}</p>}{data&&<><p>Versión {APP_VERSION} · {APP_PHASE} · Consulta: {new Date(data.checked_at).toLocaleString("es-CO")}</p>{!latest?<p>No hay ejecuciones asociadas a tu workspace.</p>:<><h3>Última ejecución #{latest.id} · {latest.status}</h3><p>Revisados: {latest.messages_scanned} · Nuevos: {latest.movements_created} · Facturas: {latest.invoices_created} · Duplicados: {latest.duplicates_ignored} · Errores: {latest.errors_count}</p><p>Duración: {latest.finished_at?Math.round((Date.parse(latest.finished_at)-Date.parse(latest.started_at))/1000)+" segundos":"En curso · iniciada "+new Date(latest.started_at).toLocaleString("es-CO")}</p></>}<label><input type="checkbox" checked={historical} onChange={e=>setHistorical(e.target.checked)}/> Incluir errores históricos</label>{errors.length===0?<p>No hay errores registrados en esta selección. Una caída antes del registro debe revisarse en los logs de Edge Functions.</p>:errors.map(e=><article key={e.id} style={{borderTop:"1px solid #ddd",padding:"8px 0"}}><strong>#{e.run} · {e.stage} · {e.code}</strong><p>{e.message}</p><p>{e.explanation}</p></article>)}<details><summary>Historial de ejecuciones</summary>{data.runs.map(r=><p key={r.id}>#{r.id} · {new Date(r.started_at).toLocaleString("es-CO")} · {r.status} · {r.errors_count} errores</p>)}</details></>}</div></details>;
}

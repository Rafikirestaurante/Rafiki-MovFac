import React,{useEffect,useState} from 'react';
import {getPendingSync,resumePendingSync,cancelPendingSync} from '../services/gmailIntegrationService.js';
export default function SyncRecovery() {
 const [job,setJob]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 async function load(clearError=true){if(clearError)setError('');try{setJob(await getPendingSync());}catch(e){setError(e.message);}}
 useEffect(()=>{let active=true;getPendingSync().then(data=>{if(active)setJob(data);}).catch(e=>{if(active)setError(e.message);});
 const progress=e=>{if(active){const d=e.detail;setJob(d.has_more?{id:d.sync_run_id,kind:d.function_name==='gmail-sync-invoices'?'invoices':'movements',processed:d.processed,messages_found:d.messages_found,bank_progress:d.bank_progress,busy:true}:null);}};
 window.addEventListener('rafiki:sync-progress',progress);return()=>{active=false;window.removeEventListener('rafiki:sync-progress',progress);};},[]);
 async function resume(){setBusy(true);setError('');setMessage('');try{const d=await resumePendingSync(job);setMessage(`Sincronización terminada: ${d.movements_created||0} movimientos nuevos y ${d.invoices_created||0} facturas nuevas.`);window.dispatchEvent(new CustomEvent(job.kind==='invoices'?'rafiki:invoices-updated':'rafiki:movements-updated',{detail:d}));}catch(e){setError(e.message);}finally{setBusy(false);await load(false);}}
 async function cancel(){if(!window.confirm('¿Cerrar esta búsqueda pendiente? Los movimientos y facturas ya registrados se conservan.'))return;setBusy(true);setError('');try{await cancelPendingSync(job.id);setJob(null);setMessage('Búsqueda cerrada. Puedes iniciar otra.');}catch(e){setError(e.message);}finally{setBusy(false);}}
 return <div className="panel-card sync-recovery"><strong>Avance de sincronización</strong><p>Si se interrumpe la conexión, puedes continuar desde el último correo guardado. Si cerraste una petición activa, espera hasta tres minutos y consulta de nuevo.</p>
 <button className="secondary-button" disabled={busy} onClick={load}>Consultar avance</button>
 {job?<><p>#{job.id} · {job.kind==='invoices'?'Facturas':'Movimientos'} · {job.processed||0} de {job.messages_found||0} correos.</p>{Object.entries(job.bank_progress||{}).map(([bank,p])=><p key={bank}>{bank}: {p.scanned} revisados · {p.unrecognized} sin regla · {p.errors} errores.</p>)}{job.last_error&&<p role="alert">{job.last_error}</p>}<button className="primary-button" disabled={busy||job.busy} onClick={resume}>{busy?'Continuando…':job.busy?'Lote en curso':'Continuar sincronización'}</button></>:<p>No hay sincronizaciones pendientes.</p>}
 {job&&<button className="secondary-button" disabled={busy||job.busy} onClick={cancel}>Cerrar búsqueda pendiente</button>}
 {error&&<p role="alert">{error}</p>}{message&&<p>{message}</p>}</div>;
}

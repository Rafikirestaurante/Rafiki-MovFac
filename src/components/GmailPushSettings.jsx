import React, {useEffect,useState} from 'react';
import {supabase} from '../supabaseClient.js';
import {Alert} from './Ui.jsx';
export default function GmailPushSettings() {
 const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[movements,setMovements]=useState(true),[invoices,setInvoices]=useState(false);
 async function request(action='status') {
  setBusy(true);setError('');
  try {
   const result=await supabase.functions.invoke('gmail-push-settings',{body:{action,movements,invoices}});
   if(result.error) {
    const detail=await result.error.context?.clone?.().json().catch(()=>null);
    throw new Error(detail?.error||result.error.message);
   }
   if(result.data?.error)throw new Error(result.data.error);
   setData(result.data);if(result.data.state){setMovements(result.data.state.movements);setInvoices(result.data.state.invoices);}
  }catch(e){setError(e.message||'No se pudo consultar la sincronización por avisos');}finally{setBusy(false);}
 }
 useEffect(()=>{request();},[]);
 const state=data?.state;
 return <article className="panel-card"><h3>Sincronización por avisos de Gmail</h3><p>Procesa correos nuevos en el servidor, incluso con la aplicación cerrada. Conserva la comprobación periódica como respaldo.</p>
  {error&&<Alert tone="warning">{error}</Alert>}
  {data&&!data.configured&&<Alert tone="info">La conexión con Google Cloud debe terminar de configurarse antes de activar esta opción.</Alert>}
  <div className="button-row"><label><input type="checkbox" checked={movements} disabled={busy||state?.enabled} onChange={e=>setMovements(e.target.checked)}/> Movimientos</label><label><input type="checkbox" checked={invoices} disabled={busy||state?.enabled} onChange={e=>setInvoices(e.target.checked)}/> Facturas</label></div>
  <p>Estado: <strong>{state?.enabled?'Activado':'Desactivado'}</strong></p>
  {state?.last_notification_at&&<p>Último aviso: {new Date(state.last_notification_at).toLocaleString('es-CO')}</p>}
  {state?.watch_expiration&&<p>Vigencia de la suscripción: {new Date(state.watch_expiration).toLocaleString('es-CO')}</p>}
  {state?.last_error&&<Alert tone="warning">{state.last_error}</Alert>}
  <div className="button-row"><button className="secondary-button" disabled={busy} onClick={()=>request()}>Actualizar estado</button><button className="primary-button" disabled={busy||(!state?.enabled&&(!data?.configured||(!movements&&!invoices)))} onClick={()=>request(state?.enabled?'disable':'enable')}>{busy?'Procesando…':state?.enabled?'Desactivar avisos':'Activar avisos'}</button></div>
 </article>;
}

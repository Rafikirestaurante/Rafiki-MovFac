import React, {useEffect,useState} from 'react';
import {Alert} from './Ui.jsx';
export default function GmailPushSettings({push}) {
 const {data,error,busy,request}=push||{};
 const [movements,setMovements]=useState(true),[invoices,setInvoices]=useState(false);
 useEffect(()=>{if(data?.state){setMovements(data.state.movements);setInvoices(data.state.invoices);}},[data]);
 const state=data?.state;
 return <article className="panel-card"><h3>Sincronización Push</h3><p>Procesa correos nuevos incluso con la aplicación cerrada. Al activar Push, la sincronización por tiempo se suspende para los módulos seleccionados. Al desactivarlo, se recupera la configuración anterior.</p>
  {error&&<Alert tone="warning">{error}</Alert>}
  {data&&!data.configured&&<Alert tone="info">La conexión con Google Cloud debe terminar de configurarse antes de activar esta opción.</Alert>}
  <div className="button-row"><label><input type="checkbox" checked={movements} disabled={busy||state?.enabled} onChange={e=>setMovements(e.target.checked)}/> Movimientos</label><label><input type="checkbox" checked={invoices} disabled={busy||state?.enabled} onChange={e=>setInvoices(e.target.checked)}/> Facturas</label></div>
  <p>Estado: <strong>{!data?'Comprobando':state?.enabled?'Activado':'Desactivado'}</strong></p>
  {state?.last_notification_at&&<p>Último aviso: {new Date(state.last_notification_at).toLocaleString('es-CO')}</p>}
  {state?.watch_expiration&&<p>Vigencia de la suscripción: {new Date(state.watch_expiration).toLocaleString('es-CO')}</p>}
  {state?.last_error&&<Alert tone="warning">{state.last_error}</Alert>}
  <div className="button-row"><button className="secondary-button" disabled={busy||!request} onClick={()=>request()}>Actualizar estado</button><button className="primary-button" disabled={busy||!request||(!state?.enabled&&(!data?.configured||(!movements&&!invoices)))} onClick={()=>request(state?.enabled?'disable':'enable',{movements,invoices})}>{busy?'Procesando…':state?.enabled?'Desactivar Push':'Activar Push'}</button></div>
 </article>;
}

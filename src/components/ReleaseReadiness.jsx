import React,{useState} from 'react';
import {supabase,supabaseConfigured} from '../supabaseClient.js';
import {APP_VERSION} from '../config/appMetadata.js';
const labels={APP_PUBLIC_URL:'Dirección de la aplicación',GOOGLE_GMAIL_REDIRECT_URI:'Retorno de Google',GMAIL_TOKEN_ENCRYPTION_KEY:'Formato de la clave de cifrado',BROWSER_ORIGIN:'Dirección del navegador autorizada',SUPABASE_URL:'Conexión del servidor',SUPABASE_SERVICE_ROLE_KEY:'Credencial del servidor presente',GOOGLE_GMAIL_CLIENT_ID:'Identificador Google presente',GOOGLE_GMAIL_CLIENT_SECRET:'Secreto Google presente',private_gmail_connections:'Credenciales privadas',private_gmail_oauth_states:'Autorizaciones temporales privadas',private_gmail_sync_jobs:'Avance de lotes privado',batch_claim:'Reserva de lotes solo en servidor',batch_save:'Guardado de lotes solo en servidor',report_session:'Reportes con la sesión del usuario',movement_dedup:'Control de movimientos duplicados'};
export default function ReleaseReadiness() {
 const [result,setResult]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function check(){setBusy(true);setError('');setResult(null);try{
  if(!supabaseConfigured || !supabase)throw new Error('Supabase no está configurado.');
  const outcomes=await Promise.allSettled([supabase.rpc('workspace_release_health'),supabase.functions.invoke('gmail-connection-status',{body:{mode:'release'}})]);
  const parse=(entry,name)=>{if(entry.status==='rejected')return {ok:false,checks:[],error:`${name}: no respondió.`};if(entry.value.error)return {ok:false,checks:[],error:`${name}: ${entry.value.error.message}`};return entry.value.data || {ok:false,checks:[]};};
  setResult({db:parse(outcomes[0],'Base de datos'),server:parse(outcomes[1],'Servidor')});
 }catch(e){setError(e.message);}finally{setBusy(false);}}
 const versionsMatch=result?.server.version===APP_VERSION && result?.db.schema_version===APP_VERSION;
 return <details className="panel-card sync-diagnostic"><summary>Preparación para producción</summary><div style={{padding:16}}><p>Comprueba la versión instalada y controles técnicos. No inicia sincronizaciones ni cambia datos.</p><button className="secondary-button" disabled={busy} onClick={check}>{busy?'Comprobando…':'Comprobar instalación'}</button>{error&&<p role="alert">{error}</p>}{result&&<>
 <p>Aplicación: {APP_VERSION} · Servidor: {result.server.version||'sin confirmar'} · Base: {result.db.schema_version||'sin confirmar'}</p>
 <p>{versionsMatch && result.db.ok && result.server.ok?'Controles técnicos consultados: correctos.':'Hay comprobaciones pendientes. Revisa el despliegue, los SQL y la configuración.'}</p>
 {[result.db,result.server].map((group,i)=><React.Fragment key={i}>{group.error&&<p role="alert">{group.error}</p>}<ul>{(group.checks||[]).map(c=><li key={c.key}>{c.ok?'✓':'Pendiente:'} {labels[c.key]||(c.key.startsWith('isolation_')?'Aislamiento: '+c.key.slice(10):c.key)}</li>)}</ul></React.Fragment>)}
 </>}<p>La verificación de Google, el respaldo con restauración probada y la prueba real con dos cuentas se validan por separado. Este panel no confirma esos pasos.</p></div></details>;
}

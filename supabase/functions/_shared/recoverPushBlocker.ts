import type {AdminContext} from './supabase.ts';

// Solo se recuperan búsquedas manuales del propietario y de módulos con Push activo.
// Nunca se sustituye su rango ni se adelanta el historial de la página Push.
export async function recoverPushBlocker(
 context:AdminContext, runId:number, enabled:{movements:boolean;invoices:boolean},
 handlers:Record<'movements'|'invoices',(request:Request,context:AdminContext)=>Promise<Response>>
) {
 const {data:job,error}=await context.client.from('gmail_sync_jobs')
  .select('run_id,kind,lease_until,request').eq('run_id',runId)
  .eq('workspace_id',context.workspaceId).eq('user_id',context.user.id).eq('completed',false).maybeSingle();
 if(error)throw new Error('No se pudo comprobar la búsqueda que bloquea Push.');
 if(!job)throw new Error('La búsqueda pendiente cambió; Push volverá a comprobarla.');
 const label=job.kind==='invoices'?'Facturas':'Movimientos';
 if(job.lease_until&&new Date(job.lease_until).getTime()>Date.now())throw new Error(`La búsqueda #${job.run_id} de ${label} está procesando un lote. Push espera su turno.`);
 if(!['movements','invoices'].includes(job.kind)||!enabled[job.kind as 'movements'|'invoices'])
  throw new Error(`La búsqueda #${job.run_id} de ${label} quedó pendiente. En Configuración, pulsa «Continuar sincronización» para terminarla. Push no la continúa porque ese módulo está desactivado.`);
 if(job.request?.source==='gmail-push')throw new Error(`El lote Push #${job.run_id} requiere recuperación. Consulta el avance en Configuración.`);
 const request=new Request('https://rafiki.internal/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({resume_run_id:job.run_id})});
 const response=await handlers[job.kind as 'movements'|'invoices'](request,context);
 const result=await response.json();
 if(!response.ok||result.error||result.recoverable)throw new Error(result.error||`No se pudo continuar la búsqueda #${job.run_id}.`);
 if(result.status==='partial')throw new Error(`La búsqueda #${job.run_id} terminó con errores. Consulta Diagnóstico avanzado.`);
 return {recovered_run_id:job.run_id,kind:job.kind,has_more:Boolean(result.has_more)};
}

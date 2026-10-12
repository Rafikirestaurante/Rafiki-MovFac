import {describe,it,expect,vi,beforeEach} from 'vitest';
const invoke=vi.hoisted(()=>vi.fn());
vi.mock('../src/supabaseClient.js',()=>({supabase:{functions:{invoke}},supabaseConfigured:true,supabaseUrl:'https://test'}));
import {runSyncBatches,isGmailSyncBusy} from '../src/services/gmailIntegrationService.js';
describe('Continuación de lotes',()=>{
 beforeEach(()=>{invoke.mockReset();});
 it('continúa con el mismo id y entrega totales finales',async()=>{invoke.mockResolvedValueOnce({data:{sync_run_id:33,has_more:true}}).mockResolvedValueOnce({data:{sync_run_id:33,has_more:false,movements_created:7}});expect(await runSyncBatches('gmail-sync-now',{mode:'quick'})).toMatchObject({movements_created:7});expect(invoke).toHaveBeenLastCalledWith('gmail-sync-now',{body:{resume_run_id:33}});expect(isGmailSyncBusy()).toBe(false);});
 it('no inicia otra sincronización local mientras espera',async()=>{let done;invoke.mockReturnValue(new Promise(resolve=>{done=resolve;}));const first=runSyncBatches('gmail-sync-now',{});expect(isGmailSyncBusy()).toBe(true);await expect(runSyncBatches('gmail-sync-invoices',{})).rejects.toThrow('en curso');done({data:{has_more:false}});await first;expect(isGmailSyncBusy()).toBe(false);});
 it('libera el bloqueo local al perder la respuesta',async()=>{invoke.mockRejectedValue(new Error('red'));await expect(runSyncBatches('gmail-sync-now',{})).rejects.toThrow('red');expect(isGmailSyncBusy()).toBe(false);});
});

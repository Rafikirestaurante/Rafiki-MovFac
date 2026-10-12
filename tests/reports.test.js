import {describe,it,expect,vi} from 'vitest';
const rpc=vi.hoisted(()=>vi.fn());
vi.mock('../src/supabaseClient.js',()=>({supabase:{rpc},supabaseConfigured:true}));
import {reportParameters,reportCsv,exportMovementReport} from '../src/services/reportService.js';
const filters={from:'2026-10-01',to:'2026-10-12',bank:'nequi',min:'1500',max:'2000',search:' Aracely '};
describe('Reportes',()=>{
 it('envía filtros al servidor sin permitir workspace del navegador',()=>{expect(reportParameters({...filters,workspace_id:'otro'})).toEqual({p_from:'2026-10-01',p_to:'2026-10-12',p_bank:'nequi',p_type:null,p_search:'Aracely',p_min:1500,p_max:2000,p_page:0,p_size:50});});
 it('rechaza rangos y valores inválidos',()=>{expect(()=>reportParameters({...filters,min:'3000'})).toThrow();expect(()=>reportParameters({...filters,min:'no'})).toThrow();expect(()=>reportParameters({...filters,from:'2026-11-01'})).toThrow();});
 it('protege fórmulas de CSV y conserva comillas y saltos',()=>{const csv=reportCsv([{detail:'=HYPERLINK("mal")\ntexto',amount_cop:1500}]);expect(csv).toContain('"\'=HYPERLINK(""mal"")\ntexto"');expect(csv).toContain('"1500"');});
 it('exporta todas las páginas',async()=>{rpc.mockReset();rpc.mockResolvedValueOnce({data:{total:201,rows:Array.from({length:200},(_,id)=>({id,detail:'Dato'}))}}).mockResolvedValueOnce({data:{total:201,rows:[{id:200,detail:'Último'}]}});expect(await exportMovementReport(filters)).toContain('Último');expect(rpc).toHaveBeenLastCalledWith('workspace_movement_report',expect.objectContaining({p_page:1,p_size:200}));});
 it('no exporta un resultado truncado ni datos que cambian',async()=>{rpc.mockReset();rpc.mockResolvedValueOnce({data:{total:10001,rows:[]}});await expect(exportMovementReport(filters)).rejects.toThrow('10.000');rpc.mockResolvedValueOnce({data:{total:2,rows:[{id:1}]}}).mockResolvedValueOnce({data:{total:3,rows:[{id:2}]}});await expect(exportMovementReport(filters)).rejects.toThrow('cambiaron');});
});

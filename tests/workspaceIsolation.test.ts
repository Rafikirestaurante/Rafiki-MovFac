import {describe,it,expect,vi,beforeAll} from "vitest";
const state=vi.hoisted(()=>{
 const fixtures={gmail_connections:[{workspace_id:"A",owner_user_id:"A",google_email:"a@example.test"},{workspace_id:"B",owner_user_id:"B",google_email:"b@example.test"}],processing_errors:[{workspace_id:"A",error_message:"error A"},{workspace_id:"B",error_message:"secreto B"}]};
 return {client:{from(table){let rows=fixtures[table]||[];const q={select(){return q;},eq(key,value){rows=rows.filter(row=>row[key]===value);return q;},order(){return q;},limit(n){rows=rows.slice(0,n);return q;},maybeSingle(){return Promise.resolve({data:rows[0]||null,error:null});},then(resolve){return Promise.resolve({data:rows,error:null}).then(resolve);}};return q;}}};
});
vi.mock("../supabase/functions/_shared/supabase.ts",()=>({requireAppAdmin:async request=>{const id=request.headers.get("authorization");if(!["A","B"].includes(id))throw new Error("Sesión inválida");return {client:state.client,workspaceId:id,user:{id}};}}));
let handler;
beforeAll(async()=>{vi.stubGlobal("Deno",{serve:fn=>{handler=fn;},env:{get:()=>""}});await import("../supabase/functions/gmail-connection-status/index.ts");});
describe("Aislamiento de estado Gmail con dos cuentas",()=>{
 for(const id of ["A","B"]){it(`solo entrega conexión y errores propios para ${id}`,async()=>{const response=await handler(new Request("https://test/status",{method:"POST",headers:{authorization:id}}));const data=await response.json();expect(response.status).toBe(200);expect(data.connection.google_email).toBe(`${id.toLowerCase()}@example.test`);expect(data.recent_errors).toHaveLength(1);expect(data.recent_errors[0].workspace_id).toBe(id);});}
 it("rechaza una sesión no autorizada",async()=>{const response=await handler(new Request("https://test/status",{method:"POST"}));expect(response.status).toBe(403);});
});

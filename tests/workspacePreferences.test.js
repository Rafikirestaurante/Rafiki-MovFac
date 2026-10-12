import {describe,it,expect,vi,beforeEach} from "vitest";
const rpc=vi.hoisted(()=>vi.fn());
vi.mock("../src/supabaseClient.js",()=>({supabase:{rpc}}));
import {loadWorkspaceBanks,saveWorkspaceBanks} from "../src/services/bankPreferences.js";
describe("Preferencias persistidas en workspace",()=>{
 beforeEach(()=>rpc.mockReset());
 it("lee preferencias de la sesión y guarda ambas opciones",async()=>{rpc.mockResolvedValueOnce({data:["nequi"],error:null}).mockResolvedValueOnce({error:null});expect(await loadWorkspaceBanks()).toEqual(["nequi"]);await saveWorkspaceBanks(["nequi","bancolombia"]);expect(rpc).toHaveBeenLastCalledWith("set_workspace_banks",{p_banks:["nequi","bancolombia"]});});
 it("un fallo al guardar no se presenta como éxito",async()=>{rpc.mockResolvedValue({error:{message:"permiso denegado"}});await expect(saveWorkspaceBanks(["nequi"])).rejects.toThrow("permiso denegado");});
});

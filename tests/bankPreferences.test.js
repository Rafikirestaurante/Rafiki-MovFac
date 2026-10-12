import {describe,it,expect,vi,afterEach} from "vitest";
import {getSelectedBanks,saveSelectedBanks} from "../src/services/bankPreferences.js";
describe("Preferencias por usuario",()=>{
 afterEach(()=>vi.unstubAllGlobals());
 it("separa usuarios y conserva la selección",()=>{
  const values=new Map();
  vi.stubGlobal("localStorage",{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)});
  saveSelectedBanks("usuario-a",["nequi"]);
  expect(getSelectedBanks("usuario-a")).toEqual(["nequi"]);
  expect(getSelectedBanks("usuario-b")).toEqual(["bancolombia"]);
  saveSelectedBanks("usuario-a",[]);
  expect(getSelectedBanks("usuario-a")).toEqual(["nequi"]);
 });
});

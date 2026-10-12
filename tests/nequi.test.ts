import {describe,it,expect} from "vitest";
import {extractNequiMovement} from "../supabase/functions/_shared/nequi.ts";
import {selectedBanks,bankQuery} from "../supabase/functions/_shared/banks.ts";
describe("Nequi y bancos",()=>{
  it("extrae ingreso Bre-B con monto colombiano y hora de la operación",()=>{
    expect(extractNequiMovement({subject:"¡Recibiste plata por Bre-B!",text:"¡Hola, MILENA MONRROY! Recibiste 1.500 de ARACELY MARIA VILLEGAS INSIGNARES el 12 de octubre de 2026 a las 2:49 p.m, desde el banco Bancolombia. Revisa el detalle en los movimientos de tu app.",receivedAt:"2026-10-12T19:50:00Z"})).toMatchObject({movement_type:"income",amount_cop:1500,detail:"ARACELY MARIA VILLEGAS INSIGNARES",transaction_date:"2026-10-12",transaction_at:"2026-10-12T19:49:00.000Z",source_metadata:{payment_kind:"Bre-B",origin_bank:"Bancolombia"}});
  });
  it("deja formatos desconocidos para revisión",()=>expect(extractNequiMovement({text:"Promoción Nequi",receivedAt:new Date()})).toBeNull());
  it("limita Gmail al banco elegido",()=>{
    expect(bankQuery(selectedBanks(["nequi"]))).toBe("{from:notificaciones@nequi.com.co}");
    expect(bankQuery(selectedBanks(["bancolombia"]))).not.toContain("nequi.com.co");
    expect(bankQuery(selectedBanks(["nequi","bancolombia"]))).toContain("ayn.notificacionesbancolombia.com");
    expect(()=>selectedBanks([])).toThrow();
    expect(()=>selectedBanks(["otro"])).toThrow();
  });
});

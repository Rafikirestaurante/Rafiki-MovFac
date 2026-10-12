import { describe, expect, it } from "vitest";
import {
  BANCOLOMBIA_SENDER_QUERY,
  extractBancolombiaMovement,
  extractTransactionDate,
  extractTransactionDateTime,
  htmlToText,
  isBancolombiaSender,
  normalizeCopAmount,
  senderEmail
} from "../supabase/functions/_shared/bancolombia.ts";

describe("Bancolombia parser", () => {
  it("busca ambos remitentes con una sola consulta OR", () => {
    expect(BANCOLOMBIA_SENDER_QUERY).toBe("{from:alertasynotificaciones@an.notificacionesbancolombia.com from:alertasynotificaciones@ayn.notificacionesbancolombia.com}");
  });
  it("acepta el nuevo remitente y rechaza dominios parecidos", () => {
    expect(isBancolombiaSender("Bancolombia <ALERTASYNOTIFICACIONES@AYN.NOTIFICACIONESBANCOLOMBIA.COM>")).toBe(true);
    expect(isBancolombiaSender("alertasynotificaciones@ayn.notificacionesbancolombia.com.ejemplo.com")).toBe(false);
    expect(isBancolombiaSender("otro@ayn.notificacionesbancolombia.com")).toBe(false);
  });
  it("normaliza remitentes con nombre visible", () => {
    const header = "Bancolombia <alertasynotificaciones@an.notificacionesbancolombia.com>";
    expect(senderEmail(header)).toBe("alertasynotificaciones@an.notificacionesbancolombia.com");
    expect(isBancolombiaSender(header)).toBe(true);
  });

  it("normaliza valores COP", () => {
    expect(normalizeCopAmount("$ 1.250.000")).toBe(1250000);
    expect(normalizeCopAmount("COP $1.250.000,00")).toBe(1250000);
    expect(normalizeCopAmount("$1,250,000.00")).toBe(1250000);
  });

  it("extrae un ingreso", () => {
    expect(extractBancolombiaMovement({
      subject: "Recibiste un pago",
      text: "Recibiste un pago de JUAN PEREZ por $ 85.000 el 16 de julio de 2026 a las 3:42 p. m. Referencia: AB123456",
      receivedAt: "2026-07-16T18:00:00Z"
    })).toMatchObject({
      movement_type: "income",
      transaction_date: "2026-07-16",
      transaction_at: "2026-07-16T20:42:00.000Z",
      detail: "JUAN PEREZ",
      amount_cop: 85000,
      reference_text: "AB123456"
    });
  });

  it("extrae pago PROVEEDOR de REDEBAN SA y prioriza la hora del movimiento", () => {
    expect(extractBancolombiaMovement({
      subject: "¡Listo! Todo salió bien con tus movimientos Bancolombia",
      text: "5:14 p. m. · ¡Listo! Todo salió bien con tus movimientos Bancolombia: Recibiste un pago PROVEEDOR de REDEBAN SA por $114109.00 en tu cuenta de Ahorros el 17/07/2026 a las 17:13.",
      receivedAt: "2026-07-17T22:14:00Z"
    })).toMatchObject({
      movement_type: "income",
      transaction_date: "2026-07-17",
      transaction_at: "2026-07-17T22:13:00.000Z",
      detail: "REDEBAN SA",
      amount_cop: 114109,
      extraction_confidence: "high",
      source_metadata: {
        payment_kind: "PROVEEDOR",
        payment_origin: "REDEBAN SA",
        account_type: "Ahorros",
        date_fallback_used: false,
        time_fallback_used: false,
        time_source: "email_content"
      }
    });
  });

  it("mantiene compatibilidad con ingresos sin tipo de pago", () => {
    expect(extractBancolombiaMovement({
      text: "Recibiste un pago de CLIENTE PRUEBA por $50.000 el 18/07/2026 a las 09:30.",
      receivedAt: "2026-07-18T14:31:00Z"
    })).toMatchObject({
      movement_type: "income",
      detail: "CLIENTE PRUEBA",
      amount_cop: 50000,
      source_metadata: { payment_kind: null, payment_origin: "CLIENTE PRUEBA" }
    });
  });

  it("extrae una transferencia", () => {
    expect(extractBancolombiaMovement({
      text: "Transferiste $120.000 desde tu cuenta *1234 a MARIA LOPEZ el 15/07/2026.",
      receivedAt: "2026-07-16T02:00:00Z"
    })).toMatchObject({ movement_type: "transfer", transaction_date: "2026-07-15", detail: "MARIA LOPEZ", amount_cop: 120000 });
  });

  it("extrae una compra", () => {
    expect(extractBancolombiaMovement({
      text: "Compraste $45.900 en SUPERMERCADO CENTRAL con tu tarjeta *7788 el 2026-07-14.",
      receivedAt: "2026-07-15T02:00:00Z"
    })).toMatchObject({ movement_type: "card_purchase", transaction_date: "2026-07-14", detail: "SUPERMERCADO CENTRAL", amount_cop: 45900 });
  });

  it("usa la fecha recibida como respaldo", () => {
    expect(extractTransactionDate("Sin fecha explícita", "2026-07-16T02:00:00Z")).toBe("2026-07-15");
  });


  it("extrae hora de 24 horas", () => {
    expect(extractTransactionDateTime("Movimiento del 16/07/2026 a las 08:05", "2026-07-16T18:30:00Z")).toEqual({
      transaction_date: "2026-07-16",
      transaction_at: "2026-07-16T13:05:00.000Z",
      time_fallback_used: false
    });
  });

  it("usa la hora de recepción como respaldo", () => {
    expect(extractTransactionDateTime("Movimiento del 16/07/2026", "2026-07-16T18:30:15Z")).toEqual({
      transaction_date: "2026-07-16",
      transaction_at: "2026-07-16T18:30:15.000Z",
      time_fallback_used: true
    });
  });

  it("convierte HTML básico", () => {
    expect(htmlToText("<p>Recibiste&nbsp;un pago</p><div>por $10.000</div>")).toBe("Recibiste un pago por $10.000");
  });
});

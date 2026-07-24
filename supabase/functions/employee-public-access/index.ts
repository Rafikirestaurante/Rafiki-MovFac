import { optionsResponse } from "../_shared/cors.ts";
import { jsonResponse, errorMessage } from "../_shared/http.ts";
import { adminClient } from "../_shared/supabase.ts";
import {
  clientKeyFromRequest,
  loadEmployeeAccessSettings,
  normalizeAccessUsername,
  requireEmployeeSession,
  signEmployeeSession,
  verifyPassword
} from "../_shared/employeeAccess.ts";

const allowedMovementTypes = new Set(["income", "transfer", "card_purchase", "service_payment", "unknown"]);

function cleanName(value: unknown): string {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 80);
}

function cleanNote(value: unknown): string {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 160);
}

async function latestFive(client: ReturnType<typeof adminClient>) {
  const { data, error } = await client.from("financial_movements")
    .select("id,source,movement_type,transaction_at,transaction_date,detail,amount_cop")
    .order("transaction_at", { ascending: false })
    .limit(5);
  if (error) throw new Error(`No se pudieron consultar los movimientos: ${error.message}`);
  const rows = data || [];
  const ids = rows.map((row) => row.id);
  let confirmations: Array<Record<string, unknown>> = [];
  if (ids.length) {
    const { data: confirmationRows, error: confirmationError } = await client.from("employee_payment_confirmations")
      .select("movement_id,employee_name,note,confirmed_at")
      .in("movement_id", ids);
    if (confirmationError) throw new Error(`No se pudieron consultar las confirmaciones: ${confirmationError.message}`);
    confirmations = confirmationRows || [];
  }
  const confirmationMap = new Map(confirmations.map((row) => [row.movement_id, row]));
  return rows.map((row) => {
    const confirmation = confirmationMap.get(row.id) || null;
    return {
      id: row.id,
      source: row.source,
      movement_type: allowedMovementTypes.has(row.movement_type) ? row.movement_type : "unknown",
      transaction_at: row.transaction_at,
      transaction_date: row.transaction_date,
      detail: row.detail,
      amount_cop: row.amount_cop,
      confirmed: Boolean(confirmation),
      confirmation: confirmation ? {
        employee_name: confirmation.employee_name,
        note: confirmation.note,
        confirmed_at: confirmation.confirmed_at
      } : null,
      can_confirm: row.movement_type === "income" && !confirmation
    };
  });
}

Deno.serve(async (request: Request) => {
  const preflight = optionsResponse(request);
  if (preflight) return preflight;
  if (request.method !== "POST") return jsonResponse(request, { error: "Método no permitido." }, 405);

  const client = adminClient();
  try {
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "");
    const clientKey = await clientKeyFromRequest(request);

    if (action === "login") {
      const username = normalizeAccessUsername(body.username);
      const password = String(body.password || "");
      const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { count: failedCount } = await client.from("employee_public_access_log")
        .select("id", { count: "exact", head: true })
        .eq("action", "login_failed")
        .eq("client_key", clientKey)
        .gte("created_at", cutoff);
      if ((failedCount || 0) >= 10) return jsonResponse(request, { error: "Se realizaron demasiados intentos. Espera 15 minutos e intenta nuevamente." }, 429);

      const settings = await loadEmployeeAccessSettings(client);
      const valid = Boolean(settings?.enabled && username === settings.username && password && await verifyPassword(password, settings));
      await client.from("employee_public_access_log").insert({
        action: valid ? "login_success" : "login_failed",
        success: valid,
        client_key: clientKey,
        access_username: username || null,
        detail: { phase: "2B.3.4" }
      });
      if (!valid || !settings) return jsonResponse(request, { error: "Nombre o contraseña incorrectos, o acceso desactivado." }, 401);

      const session = await signEmployeeSession(settings);
      return jsonResponse(request, {
        authenticated: true,
        access_token: session.token,
        expires_at: session.expires_at,
        username: settings.username,
        restrictions: { movement_limit: 5, quick_window_hours: [1, 3, 6], quick_message_limits: { 1: 20, 3: 60, 6: 120 }, confirm_income_only: true }
      });
    }

    const { session } = await requireEmployeeSession(request, client);

    if (action === "list") {
      const movements = await latestFive(client);
      await client.from("employee_public_access_log").insert({
        action: "list_movements",
        success: true,
        client_key: clientKey,
        access_username: session.username,
        detail: { count: movements.length, phase: "2B.3.4" }
      });
      return jsonResponse(request, { movements, limit: 5, username: session.username });
    }

    if (action === "confirm") {
      const movementId = String(body.movement_id || "").trim();
      const employeeName = cleanName(body.employee_name);
      const note = cleanNote(body.note);
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(movementId)) throw new Error("Movimiento inválido.");
      if (employeeName.length < 2) throw new Error("Escribe el nombre de la persona que confirma.");

      const movements = await latestFive(client);
      const movement = movements.find((row) => row.id === movementId);
      if (!movement) throw new Error("Solo se pueden confirmar movimientos visibles entre los últimos cinco.");
      if (movement.movement_type !== "income") throw new Error("Solo los ingresos pueden confirmarse como pagos recibidos.");
      if (movement.confirmed) return jsonResponse(request, { confirmed: true, already_confirmed: true, confirmation: movement.confirmation });

      const confirmedAt = new Date().toISOString();
      const { error: confirmationError } = await client.from("employee_payment_confirmations").insert({
        movement_id: movementId,
        employee_name: employeeName,
        note,
        access_username: session.username,
        confirmed_at: confirmedAt
      });
      if (confirmationError && confirmationError.code !== "23505") throw new Error(`No se pudo guardar la confirmación: ${confirmationError.message}`);

      if (!confirmationError) {
        await client.from("document_audit_log").insert({
          entity_type: "financial_movement",
          entity_id: movementId,
          action: "employee_public_confirmation",
          actor_email: `empleado-publico:${session.username}`,
          new_data: { employee_name: employeeName, note, confirmed_at: confirmedAt },
          detail: { phase: "2B.3.2", public_access: true, confirmation_stored_separately: true }
        });
      }

      await client.from("employee_public_access_log").insert({
        action: "confirm_payment",
        success: true,
        client_key: clientKey,
        access_username: session.username,
        movement_id: movementId,
        detail: { employee_name: employeeName, duplicate_request: Boolean(confirmationError), phase: "2B.3.4" }
      });
      return jsonResponse(request, { confirmed: true, already_confirmed: Boolean(confirmationError), confirmed_at: confirmedAt, employee_name: employeeName });
    }

    return jsonResponse(request, { error: "Acción no permitida." }, 400);
  } catch (error) {
    const message = errorMessage(error);
    const status = /sesión|desactivado|venció|válida/i.test(message) ? 401 : 400;
    return jsonResponse(request, { error: message }, status);
  }
});

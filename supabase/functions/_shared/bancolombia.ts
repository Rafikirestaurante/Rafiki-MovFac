export const BANCOLOMBIA_ALERT_EMAIL = "alertasynotificaciones@an.notificacionesbancolombia.com";
export const BANCOLOMBIA_ALERT_EMAILS = [
  BANCOLOMBIA_ALERT_EMAIL,
  "alertasynotificaciones@ayn.notificacionesbancolombia.com"
];
export const BANCOLOMBIA_SENDER_QUERY = `{${BANCOLOMBIA_ALERT_EMAILS.map(email => `from:${email}`).join(" ")}}`;
export const BANCOLOMBIA_EXTRACTOR_VERSION = "bancolombia-3A2-v3";

export type BancolombiaMovementType = "income" | "transfer" | "card_purchase";

export type BancolombiaExtraction = {
  movement_type: BancolombiaMovementType;
  transaction_date: string;
  transaction_at: string;
  detail: string;
  amount_cop: number;
  reference_text: string;
  extraction_confidence: "high" | "medium" | "low";
  source_metadata: Record<string, unknown>;
};

const MONTHS: Record<string, number> = {
  enero: 1, ene: 1, january: 1, jan: 1,
  febrero: 2, feb: 2, february: 2,
  marzo: 3, mar: 3, march: 3,
  abril: 4, abr: 4, april: 4, apr: 4,
  mayo: 5, may: 5,
  junio: 6, jun: 6, june: 6,
  julio: 7, jul: 7, july: 7,
  agosto: 8, ago: 8, august: 8, aug: 8,
  septiembre: 9, setiembre: 9, sep: 9, sept: 9, september: 9,
  octubre: 10, oct: 10, october: 10,
  noviembre: 11, nov: 11, november: 11,
  diciembre: 12, dic: 12, december: 12, dec: 12
};

function removeAccents(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function flattenText(value: unknown): string {
  return String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

export function senderEmail(value: unknown): string {
  const text = String(value || "").trim().toLowerCase();
  const angle = text.match(/<\s*([^<>\s]+@[^<>\s]+)\s*>/);
  if (angle) return angle[1];
  const plain = text.match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  return plain?.[0]?.toLowerCase() || "";
}

export function isBancolombiaSender(value: unknown): boolean {
  return BANCOLOMBIA_ALERT_EMAILS.includes(senderEmail(value));
}

function decodeHtmlEntity(entity: string): string {
  const named: Record<string, string> = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
    aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú",
    Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú",
    ntilde: "ñ", Ntilde: "Ñ"
  };
  if (entity.startsWith("#x") || entity.startsWith("#X")) {
    const code = Number.parseInt(entity.slice(2), 16);
    return Number.isFinite(code) ? String.fromCodePoint(code) : `&${entity};`;
  }
  if (entity.startsWith("#")) {
    const code = Number.parseInt(entity.slice(1), 10);
    return Number.isFinite(code) ? String.fromCodePoint(code) : `&${entity};`;
  }
  return named[entity] ?? `&${entity};`;
}

export function htmlToText(value: unknown): string {
  const html = String(value || "");
  return flattenText(
    html
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<(?:br|\/p|\/div|\/tr|\/li|\/h[1-6])\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&([a-zA-Z]+|#\d+|#x[0-9a-fA-F]+);/g, (_match, entity) => decodeHtmlEntity(entity))
  );
}

export function normalizeCopAmount(value: unknown): number | null {
  let text = String(value || "").trim();
  if (!text) return null;
  text = text.replace(/[^\d.,-]/g, "");
  if (!/\d/.test(text)) return null;

  const negative = text.startsWith("-");
  text = text.replace(/-/g, "");
  const lastDot = text.lastIndexOf(".");
  const lastComma = text.lastIndexOf(",");
  const lastSeparator = Math.max(lastDot, lastComma);
  let integerDigits = text.replace(/[.,]/g, "");
  let decimalDigits = "";

  if (lastSeparator >= 0) {
    const trailing = text.slice(lastSeparator + 1).replace(/\D/g, "");
    const separatorCount = (text.match(/[.,]/g) || []).length;
    const looksDecimal = trailing.length > 0 && trailing.length <= 2 && (
      (lastDot >= 0 && lastComma >= 0) ||
      separatorCount === 1 ||
      trailing.length !== 3
    );
    if (looksDecimal) {
      integerDigits = text.slice(0, lastSeparator).replace(/[.,]/g, "") || "0";
      decimalDigits = trailing.padEnd(2, "0").slice(0, 2);
    }
  }

  const integer = Number.parseInt(integerDigits || "0", 10);
  if (!Number.isSafeInteger(integer)) return null;
  const decimals = decimalDigits ? Number.parseInt(decimalDigits, 10) / 100 : 0;
  const amount = Math.round(integer + decimals);
  return negative ? -amount : amount;
}

function validIsoDate(year: number, month: number, day: number): string | null {
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function bogotaIsoDay(value: Date | string | number): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function hasExplicitTransactionDate(textValue: unknown): boolean {
  const text = removeAccents(flattenText(textValue)).toLowerCase();
  if (/\b20\d{2}[-/]([01]?\d)[-/]([0-3]?\d)\b/.test(text)) return true;
  if (/\b([0-3]?\d)[/-]([01]?\d)[/-](20\d{2})\b/.test(text)) return true;
  const named = text.match(/\b([0-3]?\d)\s+(?:de\s+)?([a-z]{3,10})\s+(?:de\s+)?(20\d{2})\b/);
  return Boolean(named && MONTHS[named[2]]);
}

export function extractTransactionDate(textValue: unknown, fallback: Date | string | number): string {
  const text = removeAccents(flattenText(textValue)).toLowerCase();

  const iso = text.match(/\b(20\d{2})[-/]([01]?\d)[-/]([0-3]?\d)\b/);
  if (iso) {
    const parsed = validIsoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    if (parsed) return parsed;
  }

  const numeric = text.match(/\b([0-3]?\d)[/-]([01]?\d)[/-](20\d{2})\b/);
  if (numeric) {
    const parsed = validIsoDate(Number(numeric[3]), Number(numeric[2]), Number(numeric[1]));
    if (parsed) return parsed;
  }

  const named = text.match(/\b([0-3]?\d)\s+(?:de\s+)?([a-z]{3,10})\s+(?:de\s+)?(20\d{2})\b/);
  if (named) {
    const month = MONTHS[named[2]];
    const parsed = month ? validIsoDate(Number(named[3]), month, Number(named[1])) : null;
    if (parsed) return parsed;
  }

  return bogotaIsoDay(fallback);
}

function bogotaClock(value: Date | string | number): { hour: number; minute: number; second: number } {
  const date = value instanceof Date ? value : new Date(value);
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(safeDate);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { hour: Number(map.hour || 0), minute: Number(map.minute || 0), second: Number(map.second || 0) };
}

export function extractTransactionDateTime(textValue: unknown, fallback: Date | string | number): {
  transaction_date: string;
  transaction_at: string;
  time_fallback_used: boolean;
} {
  const transactionDate = extractTransactionDate(textValue, fallback);
  const text = removeAccents(flattenText(textValue)).toLowerCase();
  const explicitTime = text.match(/(?:\ba\s+las?\s+|\bhora\s*:?\s*)([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?\s*(a\.?\s*m\.?|p\.?\s*m\.?)?/i);
  const time = explicitTime || text.match(/([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?\s*(a\.?\s*m\.?|p\.?\s*m\.?)?/i);
  const fallbackClock = bogotaClock(fallback);
  let hour = fallbackClock.hour;
  let minute = fallbackClock.minute;
  let second = fallbackClock.second;
  let timeFallbackUsed = true;

  if (time) {
    const parsedHour = Number(time[1]);
    const parsedMinute = Number(time[2]);
    const parsedSecond = Number(time[3] || 0);
    const meridiem = String(time[4] || "").replace(/[.\s]/g, "").toLowerCase();
    if ((!meridiem && parsedHour <= 23) || (meridiem && parsedHour >= 1 && parsedHour <= 12)) {
      hour = parsedHour;
      if (meridiem === "pm" && hour < 12) hour += 12;
      if (meridiem === "am" && hour === 12) hour = 0;
      minute = parsedMinute;
      second = parsedSecond;
      timeFallbackUsed = false;
    }
  }

  const localTimestamp = `${transactionDate}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}-05:00`;
  return {
    transaction_date: transactionDate,
    transaction_at: new Date(localTimestamp).toISOString(),
    time_fallback_used: timeFallbackUsed
  };
}

function cleanDetail(value: unknown): string {
  return flattenText(value)
    .replace(/^(?:a|de|en)\s+/i, "")
    .replace(/[.·|,-]+$/g, "")
    .trim()
    .slice(0, 250);
}

function extractReference(text: string): string {
  const patterns = [
    /(?:n[uú]mero\s+de\s+referencia|referencia|n[uú]mero\s+de\s+comprobante|comprobante|cus|c[oó]digo\s+de\s+la\s+transacci[oó]n)\s*[:#-]?\s*([a-z0-9-]{4,40})/i,
    /(?:transacci[oó]n|operaci[oó]n)\s*(?:n[uú]mero|nro\.?|no\.?)?\s*[:#-]?\s*([a-z0-9-]{4,40})/i
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim().slice(0, 80);
  }
  return "";
}

function extractAccountHint(text: string): string {
  const match = text.match(/\b(?:cuenta|tarjeta)\s+\*+\s*(\d{2,6})\b/i);
  return match ? `*${match[1]}` : "";
}

function amountFromPatterns(text: string, patterns: RegExp[]): number | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const amount = normalizeCopAmount(match[1]);
    if (amount !== null && amount >= 0) return amount;
  }
  return null;
}

function classify(text: string): BancolombiaMovementType | null {
  // Bancolombia puede insertar una etiqueta entre “pago” y “de”, por ejemplo:
  // “Recibiste un pago PROVEEDOR de REDEBAN SA por $114109.00”.
  if (/recibiste\s+un\s+pago(?:\s+[a-záéíóúñ0-9_-]+){0,3}\s+de\s+/i.test(text)) return "income";
  if (/compraste\b/i.test(text)) return "card_purchase";
  if (/transferiste\b/i.test(text)) return "transfer";
  return null;
}

export function extractBancolombiaMovement(input: {
  subject?: string;
  text?: string;
  snippet?: string;
  receivedAt: Date | string | number;
}): BancolombiaExtraction | null {
  const combined = flattenText([input.subject, input.text, input.snippet].filter(Boolean).join(" "));
  const type = classify(combined);
  if (!type) return null;

  let amount: number | null = null;
  let detail = "";
  let exactRule = false;

  let paymentKind = "";
  let paymentOrigin = "";
  let accountType = "";

  if (type === "income") {
    // Regla flexible:
    // - Recibiste un pago de JUAN PEREZ por $85.000
    // - Recibiste un pago PROVEEDOR de REDEBAN SA por $114109.00
    const exact = combined.match(/recibiste\s+un\s+pago(?:\s+([a-záéíóúñ0-9_-]+))?\s+de\s+(.+?)\s+por\s+(?:cop\s*)?\$?\s*([\d][\d.,]*)/i);
    if (exact) {
      paymentKind = cleanDetail(exact[1] || "").toUpperCase();
      paymentOrigin = cleanDetail(exact[2]);
      detail = paymentOrigin;
      amount = normalizeCopAmount(exact[3]);
      exactRule = true;
    }
    if (amount === null) amount = amountFromPatterns(combined, [
      /recibiste\s+un\s+pago[\s\S]{0,180}?(?:por|valor|monto)\s*:?[\s$]*(?:cop\s*)?([\d][\d.,]*)/i,
      /(?:valor|monto)\s*:?\s*(?:cop\s*)?\$?\s*([\d][\d.,]*)/i
    ]);
    if (!detail) {
      const fallback = combined.match(/recibiste\s+un\s+pago(?:\s+([a-záéíóúñ0-9_-]+))?\s+de\s+(.+?)(?:\s+por\s+|\s+el\s+|$)/i);
      paymentKind = cleanDetail(fallback?.[1] || "").toUpperCase();
      paymentOrigin = cleanDetail(fallback?.[2] || "");
      detail = paymentOrigin || "Ingreso recibido";
    }
    accountType = cleanDetail(combined.match(/en\s+tu\s+cuenta\s+de\s+([a-záéíóúñ ]+?)(?:\s+el\s+|[.,]|$)/i)?.[1] || "");
  }

  if (type === "transfer") {
    const exact = combined.match(/transferiste\s+(?:de\s+manera\s+exitosa\s+)?(?:por\s+)?(?:cop\s*)?\$?\s*([\d][\d.,]*)[\s\S]{0,180}?desde\s+tu\s+cuenta\s+\*+\d+\s+a\s+(.+?)(?:\s+el\s+\d|\s+fecha\s*:|[.!]|$)/i);
    if (exact) {
      amount = normalizeCopAmount(exact[1]);
      detail = cleanDetail(exact[2]);
      exactRule = true;
    }
    if (!detail) detail = cleanDetail(combined.match(/desde\s+tu\s+cuenta\s+\*+\d+\s+a\s+(.+?)(?:\s+el\s+\d|\s+por\s+(?:cop\s*)?\$|\s+fecha\s*:|[.!]|$)/i)?.[1] || "Transferencia realizada");
    if (amount === null) amount = amountFromPatterns(combined, [
      /transferiste\s+(?:de\s+manera\s+exitosa\s+)?(?:por\s+)?(?:cop\s*)?\$?\s*([\d][\d.,]*)/i,
      /(?:valor|monto|por)\s*:?\s*(?:cop\s*)?\$?\s*([\d][\d.,]*)/i
    ]);
  }

  if (type === "card_purchase") {
    const exact = combined.match(/compraste\s+(?:cop\s*)?\$?\s*([\d][\d.,]*)\s+en\s+(.+?)\s+con\s+tu/i);
    if (exact) {
      amount = normalizeCopAmount(exact[1]);
      detail = cleanDetail(exact[2]);
      exactRule = true;
    }
    if (!detail) detail = cleanDetail(combined.match(/compraste[\s\S]{0,80}?\s+en\s+(.+?)(?:\s+con\s+tu|\s+el\s+\d|[.!]|$)/i)?.[1] || "Compra con tarjeta");
    if (amount === null) amount = amountFromPatterns(combined, [
      /compraste\s+(?:cop\s*)?\$?\s*([\d][\d.,]*)/i,
      /(?:valor|monto)\s*:?\s*(?:cop\s*)?\$?\s*([\d][\d.,]*)/i
    ]);
  }

  if (amount === null || amount < 0) throw new Error("Se identificó una alerta de Bancolombia, pero no fue posible extraer un valor válido.");

  const transactionMoment = extractTransactionDateTime(combined, input.receivedAt);
  const referenceText = extractReference(combined);
  const accountHint = extractAccountHint(combined);
  const confidence: "high" | "medium" | "low" = exactRule && detail ? "high" : detail ? "medium" : "low";

  return {
    movement_type: type,
    transaction_date: transactionMoment.transaction_date,
    transaction_at: transactionMoment.transaction_at,
    detail,
    amount_cop: amount,
    reference_text: referenceText,
    extraction_confidence: confidence,
    source_metadata: {
      account_hint: accountHint,
      reference_found: Boolean(referenceText),
      date_fallback_used: !hasExplicitTransactionDate(combined),
      time_fallback_used: transactionMoment.time_fallback_used,
      time_source: transactionMoment.time_fallback_used ? "email_received_at" : "email_content",
      payment_kind: paymentKind || null,
      payment_origin: paymentOrigin || null,
      account_type: accountType || null,
      extractor_rule: `${BANCOLOMBIA_EXTRACTOR_VERSION}:${type}`
    }
  };
}


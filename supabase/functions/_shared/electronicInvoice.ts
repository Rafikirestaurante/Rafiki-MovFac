export const ELECTRONIC_INVOICE_EXTRACTOR_VERSION = "rafiki-mf-invoice-1.0.0";

export type ParsedElectronicInvoice = {
  document_type: "invoice" | "credit_note" | "debit_note" | "attached_document" | "unknown";
  invoice_date: string | null;
  due_date: string | null;
  supplier_name: string;
  supplier_tax_id: string;
  invoice_number: string;
  cufe: string;
  currency: string;
  subtotal_cop: number | null;
  tax_cop: number | null;
  total_cop: number | null;
  document_status: "pending" | "incomplete";
  extraction_confidence: "high" | "medium" | "low";
  source_metadata: Record<string, unknown>;
};

function clean(value: unknown): string {
  return String(value || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, " ").trim();
}

function tagValues(xml: string, name: string): string[] {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`<(?:[A-Za-z0-9_-]+:)?${escaped}\\b[^>]*>([\\s\\S]*?)<\\/(?:[A-Za-z0-9_-]+:)?${escaped}>`, "gi");
  return Array.from(xml.matchAll(regex)).map((match) => clean(match[1])).filter(Boolean);
}

function section(xml: string, name: string): string {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`<(?:[A-Za-z0-9_-]+:)?${escaped}\\b[^>]*>([\\s\\S]*?)<\\/(?:[A-Za-z0-9_-]+:)?${escaped}>`, "i").exec(xml)?.[1] || "";
}

function amount(value: string | undefined): number | null {
  if (!value) return null;
  const normalized = value.replace(/[^0-9,.-]/g, "").trim();
  if (!normalized) return null;
  let decimal = normalized;
  const commaCount = (decimal.match(/,/g) || []).length;
  const dotCount = (decimal.match(/\./g) || []).length;
  const lastComma = decimal.lastIndexOf(",");
  const lastDot = decimal.lastIndexOf(".");
  if (commaCount && dotCount) {
    decimal = lastComma > lastDot ? decimal.replace(/\./g, "").replace(",", ".") : decimal.replace(/,/g, "");
  } else if (commaCount) {
    const decimals = decimal.length - lastComma - 1;
    decimal = decimals === 2 ? decimal.replace(/,/g, ".") : decimal.replace(/,/g, "");
  } else if (dotCount) {
    const decimals = decimal.length - lastDot - 1;
    if (dotCount > 1 || decimals === 3) decimal = decimal.replace(/\./g, "");
  }
  const parsed = Number(decimal);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function dateValue(value: string | undefined): string | null {
  const match = String(value || "").match(/\d{4}-\d{2}-\d{2}/);
  return match?.[0] || null;
}

function embeddedInvoiceXml(xml: string): string {
  const cdata = Array.from(xml.matchAll(/<!\[CDATA\[([\s\S]*?)\]\]>/g)).map((m) => m[1]);
  for (const candidate of cdata) if (/<(?:\w+:)?(?:Invoice|CreditNote|DebitNote)\b/i.test(candidate)) return candidate;
  const unescaped = xml.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
  const match = unescaped.match(/<(?:\w+:)?(?:Invoice|CreditNote|DebitNote)\b[\s\S]*?<\/(?:\w+:)?(?:Invoice|CreditNote|DebitNote)>/i);
  return match?.[0] || "";
}

export function parseElectronicInvoiceXml(rawXml: string): ParsedElectronicInvoice | null {
  let xml = String(rawXml || "").replace(/^\uFEFF/, "").trim();
  if (!xml || !xml.includes("<")) return null;
  const rootMatch = xml.match(/<\??xml[^>]*>\s*<(?:[A-Za-z0-9_-]+:)?(Invoice|CreditNote|DebitNote|AttachedDocument)\b/i)
    || xml.match(/<(?:[A-Za-z0-9_-]+:)?(Invoice|CreditNote|DebitNote|AttachedDocument)\b/i);
  if (!rootMatch) return null;
  const root = rootMatch[1].toLowerCase();
  if (root === "attacheddocument") {
    const embedded = embeddedInvoiceXml(xml);
    if (embedded) {
      const parsed = parseElectronicInvoiceXml(embedded);
      if (parsed) return { ...parsed, source_metadata: { ...parsed.source_metadata, wrapped_in_attached_document: true } };
    }
  }

  const document_type = root === "invoice" ? "invoice" : root === "creditnote" ? "credit_note" : root === "debitnote" ? "debit_note" : "attached_document";
  const supplier = section(xml, "AccountingSupplierParty");
  const monetary = section(xml, "LegalMonetaryTotal");
  const taxSection = section(xml, "TaxTotal");
  const invoice_number = tagValues(xml, "ID")[0] || "";
  const supplier_name = tagValues(supplier, "RegistrationName")[0] || tagValues(supplier, "Name")[0] || "";
  const supplier_tax_id = tagValues(supplier, "CompanyID")[0] || "";
  const cufe = tagValues(xml, "UUID")[0] || "";
  const invoice_date = dateValue(tagValues(xml, "IssueDate")[0]);
  const due_date = dateValue(tagValues(xml, "DueDate")[0]);
  const currency = tagValues(xml, "DocumentCurrencyCode")[0] || "COP";
  const subtotal_cop = amount(tagValues(monetary, "LineExtensionAmount")[0]);
  const tax_cop = amount(tagValues(taxSection, "TaxAmount")[0]);
  const total_cop = amount(tagValues(monetary, "PayableAmount")[0] || tagValues(monetary, "TaxInclusiveAmount")[0]);
  const missing = [!supplier_name && "supplier_name", !invoice_number && "invoice_number", total_cop === null && "total_cop"].filter(Boolean);
  return {
    document_type,
    invoice_date,
    due_date,
    supplier_name,
    supplier_tax_id,
    invoice_number,
    cufe,
    currency,
    subtotal_cop,
    tax_cop,
    total_cop,
    document_status: missing.length ? "incomplete" : "pending",
    extraction_confidence: missing.length === 0 && (cufe || supplier_tax_id) ? "high" : missing.length <= 1 ? "medium" : "low",
    source_metadata: { missing_fields: missing, root_document: root }
  };
}

export function senderDisplayName(fromHeader: string): string {
  const value = String(fromHeader || "").trim();
  const before = value.includes("<") ? value.split("<")[0] : value.replace(/\S+@\S+/, "");
  return before.replace(/^['"]|['"]$/g, "").trim() || value.match(/[\w.+-]+@[\w.-]+/)?.[0] || "Proveedor sin identificar";
}

export function guessInvoiceFromEmail(input: { subject?: string; text?: string; filename?: string; from?: string; receivedAt?: string | Date }): ParsedElectronicInvoice {
  const haystack = `${input.subject || ""} ${input.filename || ""} ${input.text || ""}`.replace(/\s+/g, " ");
  const number = haystack.match(/(?:factura(?:\s+electr[oó]nica)?|invoice|documento)\s*(?:n(?:[úu]mero|ro)?\.?|no\.?|#)?\s*[:\-]?\s*([A-Z0-9][A-Z0-9-]{2,})/i)?.[1]
    || String(input.filename || "").match(/\b([A-Z]{1,8}-?\d{3,})\b/i)?.[1] || "";
  const totalText = haystack.match(/(?:valor\s+total|total\s+a\s+pagar|importe\s+total|por\s+valor\s+de)\s*[:$COP ]*([0-9][0-9.,]*)/i)?.[1];
  const total = amount(totalText);
  const received = new Date(input.receivedAt || Date.now());
  return {
    document_type: "invoice",
    invoice_date: Number.isNaN(received.getTime()) ? null : received.toISOString().slice(0, 10),
    due_date: null,
    supplier_name: senderDisplayName(input.from || ""),
    supplier_tax_id: "",
    invoice_number: number,
    cufe: "",
    currency: "COP",
    subtotal_cop: null,
    tax_cop: null,
    total_cop: total,
    document_status: "incomplete",
    extraction_confidence: number && total !== null ? "medium" : "low",
    source_metadata: { pdf_fallback: true, missing_fields: [!number && "invoice_number", total === null && "total_cop", "supplier_tax_id", "cufe"].filter(Boolean) }
  };
}


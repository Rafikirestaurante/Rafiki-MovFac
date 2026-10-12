import {supabase,supabaseConfigured} from '../supabaseClient.js';
export function reportParameters(filters,page=0,size=50) {
 if(!filters.from || !filters.to || filters.from>filters.to) throw new Error('Revisa las fechas del reporte.');
 const number=value=>value==='' || value==null ? null : Number(value);
 const min=number(filters.min),max=number(filters.max);
 if((min!==null && (!Number.isFinite(min)||min<0)) || (max!==null && (!Number.isFinite(max)||max<0)) || (min!==null && max!==null && min>max)) throw new Error('Revisa los valores mínimo y máximo.');
 return {p_from:filters.from,p_to:filters.to,p_bank:filters.bank||null,p_type:filters.type||null,p_search:filters.search?.trim()||'',p_min:min,p_max:max,p_page:page,p_size:size};
}
export async function getMovementReport(filters,page=0,size=50) {
 if(!supabaseConfigured || !supabase) throw new Error('Supabase todavía no está configurado.');
 const {data,error}=await supabase.rpc('workspace_movement_report',reportParameters(filters,page,size));
 if(error) throw new Error(error.message);
 return data;
}
export const movementLabels={income:'Ingreso',transfer:'Transferencia / pago QR',card_purchase:'Compra con tarjeta',service_payment:'Pago de servicio'};
export function reportCsv(rows) {
 const cell=value=>{let s=String(value??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
 return '\uFEFF'+[['Fecha','Banco','Tipo','Detalle','Valor COP','Referencia'],...rows.map(r=>[r.transaction_date,r.source,movementLabels[r.movement_type]||r.movement_type,r.detail,r.amount_cop,r.reference_text])].map(row=>row.map(cell).join(';')).join('\r\n');
}
export async function exportMovementReport(filters) {
 const first=await getMovementReport(filters,0,200);
 if(first.total>10000) throw new Error('La exportación admite hasta 10.000 movimientos. Reduce el rango de fechas o aplica más filtros.');
 const rows=[...first.rows];
 for(let page=1;rows.length<first.total;page++) {
  const next=await getMovementReport(filters,page,200);
  if(next.total!==first.total || !next.rows.length) throw new Error('Los datos cambiaron durante la exportación. Actualiza y vuelve a intentar.');
  rows.push(...next.rows);
 }
 if(new Set(rows.map(r=>r.id)).size!==rows.length) throw new Error('Los datos cambiaron durante la exportación. Vuelve a intentar.');
 return reportCsv(rows);
}

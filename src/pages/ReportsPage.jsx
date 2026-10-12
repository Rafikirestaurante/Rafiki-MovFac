import React,{useState} from 'react';
import {PageHeader,Alert,MetricCard} from '../components/Ui.jsx';
import {getMovementReport,exportMovementReport,movementLabels} from '../services/reportService.js';
const money=value=>new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(value||0);
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export default function ReportsPage() {
 const [filters,setFilters]=useState({from:today.slice(0,8)+'01',to:today,bank:'',type:'',search:'',min:'',max:''});
 const [applied,setApplied]=useState(null),[data,setData]=useState(null),[page,setPage]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const field=(key,value)=>setFilters(f=>({...f,[key]:value}));
 async function load(nextPage=0,nextFilters=filters) {
  setBusy(true);setError('');
  try {const result=await getMovementReport(nextFilters,nextPage);setData(result);setApplied({...nextFilters});setPage(nextPage);}
  catch(e){setError(e.message);}finally{setBusy(false);}
 }
 async function download() {
  setBusy(true);setError('');
  try {const csv=await exportMovementReport(applied);const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`rafiki-movimientos-${applied.from}-${applied.to}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  catch(e){setError(e.message);}finally{setBusy(false);}
 }
 return <><PageHeader title="Consultas y reportes" description="Consulta los movimientos registrados en tu workspace. Los totales incluyen todas las páginas del resultado."/>
 <form className="panel-card report-filters" onSubmit={e=>{e.preventDefault();load();}}>
 <label>Desde<input required type="date" value={filters.from} onChange={e=>field('from',e.target.value)}/></label>
 <label>Hasta<input required type="date" value={filters.to} onChange={e=>field('to',e.target.value)}/></label>
 <label>Banco<select value={filters.bank} onChange={e=>field('bank',e.target.value)}><option value="">Todos</option><option value="bancolombia">Bancolombia</option><option value="nequi">Nequi</option></select></label>
 <label>Tipo<select value={filters.type} onChange={e=>field('type',e.target.value)}><option value="">Todos</option>{Object.entries(movementLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
 <label>Detalle o referencia<input value={filters.search} onChange={e=>field('search',e.target.value)} placeholder="Buscar texto"/></label>
 <label>Valor mínimo<input type="number" min="0" step="any" value={filters.min} onChange={e=>field('min',e.target.value)}/></label>
 <label>Valor máximo<input type="number" min="0" step="any" value={filters.max} onChange={e=>field('max',e.target.value)}/></label>
 <button className="primary-button" disabled={busy}>{busy?'Consultando…':'Consultar'}</button></form>
 {error&&<Alert tone="danger">{error}</Alert>}
 {data&&<><p>Resultado del {applied.from} al {applied.to} · {data.total} movimientos. Exportar utiliza estos mismos filtros.</p>
 <div className="metrics-grid"><MetricCard label="Ingresos" value={money(data.income)} icon="movements"/><MetricCard label="Salidas" value={money(data.expense)} icon="movements"/><MetricCard label="Balance" value={money(data.balance)} icon="movements"/></div>
 <section className="panel-card report-result"><button className="secondary-button" disabled={busy||!data.total} onClick={download}>Exportar CSV</button>
 <p>{data.banks.map(b=>`${b.source}: ${b.count} movimientos · ingresos ${money(b.income)} · salidas ${money(b.expense)}`).join(' / ')}</p>
 <div className="table-wrap"><table><thead><tr>{['Fecha','Banco','Tipo','Detalle','Valor COP'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{data.rows.map(r=><tr key={r.id}><td>{r.transaction_date}</td><td>{r.source}</td><td>{movementLabels[r.movement_type]||r.movement_type}</td><td>{r.detail}</td><td>{money(r.amount_cop)}</td></tr>)}</tbody></table></div>
 {!data.total&&<p>No hay movimientos con estos filtros.</p>}
 <div className="report-pagination"><button disabled={busy||page===0} onClick={()=>load(page-1,applied)}>Anterior</button><span>Página {page+1} de {Math.max(1,Math.ceil(data.total/50))}</span><button disabled={busy||(page+1)*50>=data.total} onClick={()=>load(page+1,applied)}>Siguiente</button></div>
 </section></>}
 </>;
}

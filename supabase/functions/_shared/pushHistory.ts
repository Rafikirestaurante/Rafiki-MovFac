export function historyMessageIds(records: Array<{messagesAdded?:Array<{message?:{id?:string}}>}> = []): string[] {
 return [...new Set(records.flatMap(item=>(item.messagesAdded||[]).map(add=>add.message?.id).filter((id):id is string=>Boolean(id))))];
}
export function decodePushMessage(data: string): {emailAddress:string;historyId:string} {
 if(typeof data!=='string'||data.length>4096) throw new Error('Aviso Gmail inválido');
 const payload=JSON.parse(atob(data.replace(/-/g,'+').replace(/_/g,'/')));
 const historyId=typeof payload.historyId==='number'&&Number.isSafeInteger(payload.historyId)&&payload.historyId>=0?String(payload.historyId):payload.historyId;
 if(typeof payload.emailAddress!=='string'||!/^\S+@\S+\.\S+$/.test(payload.emailAddress)||typeof historyId!=='string'||!/^\d{1,30}$/.test(historyId)) throw new Error('Aviso Gmail inválido');
 return {emailAddress:payload.emailAddress.toLowerCase(),historyId};
}

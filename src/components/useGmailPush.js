import {useCallback, useEffect, useRef, useState} from 'react';
import {supabase} from '../supabaseClient.js';

export default function useGmailPush(userId, allowed) {
 const [result,setResult]=useState({userId:null,data:null,error:'',busy:false,changing:false});
 const generation=useRef(0), pending=useRef(false);
 const request=useCallback(async(action='status',selection={})=>{
  if(!userId||!allowed||pending.current)return;
  pending.current=true;
  const current=generation.current;
  setResult(v=>({...v,userId,busy:true,changing:action!=='status',error:''}));
  try {
   const response=await supabase.functions.invoke('gmail-push-settings',{body:{action,...selection}});
   if(response.error){
    let detail;
    try {detail=await response.error.context?.clone?.().json();}catch { /* Error de transporte. */ }
    throw new Error(detail?.error||response.error.message);
   }
   if(response.data?.error)throw new Error(response.data.error);
   if(current===generation.current)setResult({userId,data:response.data,error:'',busy:false,changing:false});
  }catch(e){
   // Un cambio puede haber llegado al servidor aunque su respuesta se pierda.
   // Se suspende el modo periódico hasta volver a comprobar el estado.
   if(current===generation.current)setResult({userId,data:null,error:e.message||'No se pudo comprobar el modo de sincronización.',busy:false,changing:false});
  }finally {if(current===generation.current)pending.current=false;}
 },[userId,allowed]);
 useEffect(()=>{
  generation.current+=1; pending.current=false;
  setResult({userId,data:null,error:'',busy:false,changing:false});
  if(!userId||!allowed)return undefined;
  request();
  const refresh=()=>request();
  const timer=window.setInterval(refresh,60000);
  window.addEventListener('focus',refresh);
  return ()=>{generation.current+=1;pending.current=false;window.clearInterval(timer);window.removeEventListener('focus',refresh);};
 },[userId,allowed,request]);
 return {...(result.userId===userId?result:{data:null,error:'',busy:false,changing:false}),request,ready:result.userId===userId&&Boolean(result.data)};
}

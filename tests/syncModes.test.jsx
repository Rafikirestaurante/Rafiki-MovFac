import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,it,expect} from 'vitest';
import {syncMode} from '../src/services/syncModes.js';
import AppShell from '../src/components/AppShell.jsx';

describe('Selección exclusiva de sincronización',()=>{
 it('Push suspende solo los módulos seleccionados y conserva la preferencia periódica',()=>{
  const state={enabled:true,movements:true,invoices:false};
  expect(syncMode(state,'movements',true,true)).toBe('push');
  expect(syncMode(state,'invoices',true,true)).toBe('periodic');
  expect(syncMode({...state,enabled:false},'movements',true,true)).toBe('periodic');
  expect(syncMode({...state,enabled:false},'movements',false,true)).toBe('off');
 });
 it('no inicia consultas periódicas con estado desconocido o durante un cambio de modo',()=>{
  expect(syncMode(null,'movements',true,false)).toBe('checking');
  expect(syncMode({enabled:false},'movements',true,true,true)).toBe('checking');
 });
 it('el indicador Push oculta el selector de intervalos y ofrece configurar',()=>{
  const html=renderToStaticMarkup(<AppShell profile={{role:'workspace_owner'}} autoSync={{movements:{enabled:true,mode:'push',intervalSeconds:30},invoices:{enabled:false,mode:'off'}}}/>);
  expect(html).toContain('Push');expect(html).toContain('Configurar');
  expect(html).not.toContain('Configurar tiempo de sincronización de movimientos');
  expect(html).not.toContain('30 s');
 });
 it('al volver al modo periódico muestra el intervalo guardado',()=>{
  const html=renderToStaticMarkup(<AppShell profile={{role:'workspace_owner'}} autoSync={{movements:{enabled:true,mode:'periodic',intervalSeconds:30},invoices:{enabled:false,mode:'off'}}}/>);
  expect(html).toContain('30 s');expect(html).toContain('Configurar tiempo de sincronización de movimientos');
 });
});

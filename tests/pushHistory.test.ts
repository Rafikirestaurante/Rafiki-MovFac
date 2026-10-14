import {describe,it,expect} from 'vitest';
import {historyMessageIds,decodePushMessage} from '../supabase/functions/_shared/pushHistory.ts';
describe('Avisos Gmail',()=>{
 it('deduplica solamente los mensajes añadidos y conserva sus identificadores',()=>{
  expect(historyMessageIds([{messagesAdded:[{message:{id:'a'}},{message:{id:'a'}}]},{messagesAdded:[{message:{id:'b'}}]},{}])).toEqual(['a','b']);
 });
 it('conserva historial mayor que el rango seguro de Number',()=>{
  expect(decodePushMessage(btoa(JSON.stringify({emailAddress:'A@EXAMPLE.TEST',historyId:'90071992547409930001'})))).toEqual({emailAddress:'a@example.test',historyId:'90071992547409930001'});
 });
 it('normaliza historial numérico seguro sin perder precisión',()=>{
  expect(decodePushMessage(btoa(JSON.stringify({emailAddress:'a@test.example',historyId:42})))).toEqual({emailAddress:'a@test.example',historyId:'42'});
 });
 it('rechaza el historial numérico impreciso y los cuerpos inválidos',()=>{
  for(const payload of [{emailAddress:'a@test.example',historyId:9007199254740992},{emailAddress:'a@test.example',historyId:-1},{emailAddress:'a@test.example',historyId:1.5},{emailAddress:'a@test.example',historyId:'1e5'},{emailAddress:'sin-correo',historyId:'42'}])expect(()=>decodePushMessage(btoa(JSON.stringify(payload)))).toThrow();
 });
});

import {describe,it,expect} from 'vitest';
import {historyMessageIds,decodePushMessage} from '../supabase/functions/_shared/pushHistory.ts';
describe('Avisos Gmail',()=>{
 it('deduplica solamente los mensajes añadidos y conserva sus identificadores',()=>{
  expect(historyMessageIds([{messagesAdded:[{message:{id:'a'}},{message:{id:'a'}}]},{messagesAdded:[{message:{id:'b'}}]},{}])).toEqual(['a','b']);
 });
 it('conserva historial mayor que el rango seguro de Number',()=>{
  expect(decodePushMessage(btoa(JSON.stringify({emailAddress:'A@EXAMPLE.TEST',historyId:'90071992547409930001'})))).toEqual({emailAddress:'a@example.test',historyId:'90071992547409930001'});
 });
 it('rechaza el historial numérico y los cuerpos inválidos',()=>{
  for(const payload of [{emailAddress:'a@test.example',historyId:42},{emailAddress:'a@test.example',historyId:'1e5'},{emailAddress:'sin-correo',historyId:'42'}])expect(()=>decodePushMessage(btoa(JSON.stringify(payload)))).toThrow();
 });
});

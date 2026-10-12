import {describe,it,expect,vi} from 'vitest';
import {revokeGoogleToken,refreshGoogleAccessToken} from '../supabase/functions/_shared/google.ts';
describe('Peticiones Google',()=>{
 it('revoca enviando el token en el cuerpo y con tiempo máximo',async()=>{const fetchMock=vi.fn(async()=>new Response(null,{status:200}));vi.stubGlobal('fetch',fetchMock);await revokeGoogleToken('private-token');const [url,options]=fetchMock.mock.calls[0];expect(url).not.toContain('private-token');expect(options.body.get('token')).toBe('private-token');expect(options.signal).toBeInstanceOf(AbortSignal);});
 it('no repite una autorización rechazada',async()=>{vi.stubGlobal('Deno',{env:{get:()=> 'configured'}});const fetchMock=vi.fn(async()=>Response.json({error:'invalid_grant'},{status:400}));vi.stubGlobal('fetch',fetchMock);await expect(refreshGoogleAccessToken('refresh')).rejects.toThrow('invalid_grant');expect(fetchMock).toHaveBeenCalledTimes(1);});
});

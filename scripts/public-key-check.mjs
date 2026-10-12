export function assertPublicKey(key='') {
 let privileged=key.startsWith('sb_secret_');
 try {privileged ||= JSON.parse(Buffer.from(key.split('.')[1]||'','base64url').toString()).role==='service_role';}catch{/* Publishable keys need not be JWTs. */}
 if(privileged)throw new Error('VITE_SUPABASE_ANON_KEY contiene una credencial privada; usa únicamente anon o publishable');
}

import { handleMovementSync } from '../_shared/handleMovementSync.ts';
Deno.serve(request => handleMovementSync(request));

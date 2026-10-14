import { handleInvoiceSync } from '../_shared/handleInvoiceSync.ts';
Deno.serve(request => handleInvoiceSync(request));

-- Ejecutar después de la migración de estado y de configurar las Edge Functions.
-- La clave permanece en Vault. Debe copiarse una vez a GMAIL_PUSH_WORKER_SECRET
-- en los secretos Edge; nunca al frontend, GitHub ni al chat.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;
do $$ begin
 if not exists(select 1 from vault.secrets where name='rafiki_push_worker_secret') then
  perform vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'rafiki_push_worker_secret','Rafiki push worker');
 end if;
end $$;
select cron.unschedule(jobid) from cron.job where jobname='rafiki-gmail-push';
select cron.schedule('rafiki-gmail-push','* * * * *', $job$
 select net.http_post(
  url := 'https://rqkhefontkypaxiiglbo.supabase.co/functions/v1/gmail-push-worker',
  headers := jsonb_build_object('Content-Type','application/json','x-rafiki-worker-secret',
   (select decrypted_secret from vault.decrypted_secrets where name='rafiki_push_worker_secret')),
  body := '{}'::jsonb, timeout_milliseconds := 10000
 );
$job$);

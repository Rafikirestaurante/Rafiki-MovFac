-- Rafiki MF — Fase 4A
-- Índices y metadatos para alertas Bancolombia no reconocidas.

begin;
create index if not exists gmail_sync_candidates_unrecognized_idx
  on public.gmail_sync_candidates (internal_date desc)
  where processing_status in ('ignored', 'error');

create index if not exists gmail_sync_candidates_source_review_idx
  on public.gmail_sync_candidates ((raw_metadata->>'source_detected'), ((raw_metadata->>'requires_review')));
commit;

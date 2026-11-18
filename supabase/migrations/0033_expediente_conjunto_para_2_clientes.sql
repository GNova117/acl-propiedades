-- ─────────────────────────────────────────────
-- Expediente conjunto para 2 clientes (2026-09-14)
-- Caso real: una pareja que junta su crédito INFONAVIT y aplica como
-- 2 acreditados — cada quien sigue siendo su propio registro en
-- `clients` (su propio perfilamiento, sus propios documentos, cada uno
-- con su propia clave de portal), pero se necesita verlos juntos en
-- una sola pantalla en vez de brincar entre dos fichas separadas.
-- `client_links` es una tabla de relación simple (un par por fila, no
-- se fusiona ningún dato) — mismo nivel de RLS que `clients` porque
-- expone qué 2 personas están vinculadas, que es información sensible
-- del mismo tipo que el resto del expediente del cliente.
-- (bloque re-ejecutable: puede copiarse y pegarse solo en el SQL Editor)
-- ─────────────────────────────────────────────

create table if not exists client_links (
  id uuid primary key default gen_random_uuid(),
  client_a_id uuid not null references clients(id) on delete cascade,
  client_b_id uuid not null references clients(id) on delete cascade,
  label text,
  created_at timestamptz not null default now(),
  check (client_a_id <> client_b_id)
);

create index if not exists idx_client_links_a on client_links(client_a_id);
create index if not exists idx_client_links_b on client_links(client_b_id);

alter table client_links enable row level security;

drop policy if exists "Rol con apartado clientes maneja client_links" on client_links;
create policy "Rol con apartado clientes maneja client_links" on client_links for all
  using (has_admin_section('clientes')) with check (has_admin_section('clientes'));


-- Estrutura inicial do catálogo no projeto Supabase novo.
-- As permissões administrativas dependem de app_metadata.role = 'admin'.

create table public.imoveis (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  titulo text not null,
  descricao text,
  tipo text not null,
  cidade text not null,
  bairro text,
  preco numeric not null check (preco >= 0),
  imagem_url text,
  finalidade text not null default 'Venda' check (finalidade in ('Venda', 'Aluguel')),
  quartos smallint not null default 0 check (quartos >= 0),
  banheiros smallint not null default 0 check (banheiros >= 0),
  vagas smallint not null default 0 check (vagas >= 0),
  area_m2 numeric not null default 0 check (area_m2 >= 0),
  imagens text[] not null default array[]::text[],
  destaque boolean not null default false,
  disponivel boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

grant select on public.imoveis to anon;
grant select, insert, update, delete on public.imoveis to authenticated;

alter table public.imoveis enable row level security;

create policy "anon leem imoveis disponiveis"
on public.imoveis for select to anon
using (disponivel = true);

create policy "autenticados leem catalogo ou admin"
on public.imoveis for select to authenticated
using (
  disponivel = true
  or ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
);

create policy "administradores inserem imoveis"
on public.imoveis for insert to authenticated
with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

create policy "administradores atualizam imoveis"
on public.imoveis for update to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

create policy "administradores excluem imoveis"
on public.imoveis for delete to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

-- Bucket público para exibição. Operações de escrita ficam restritas ao administrador.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'imoveis',
  'imoveis',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
);

create policy "administradores inserem imagens de imoveis"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'imoveis'
  and ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
);

create policy "administradores atualizam imagens de imoveis"
on storage.objects for update to authenticated
using (
  bucket_id = 'imoveis'
  and ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
)
with check (
  bucket_id = 'imoveis'
  and ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
);

create policy "administradores excluem imagens de imoveis"
on storage.objects for delete to authenticated
using (
  bucket_id = 'imoveis'
  and ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
);

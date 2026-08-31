-- Bucket público para fotos que precisam aparecer no catálogo.
-- Upload, alteração e exclusão ficam restritos a usuários administradores.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'imoveis',
  'imoveis',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "administradores inserem imagens de imoveis" on storage.objects;
drop policy if exists "administradores atualizam imagens de imoveis" on storage.objects;
drop policy if exists "administradores excluem imagens de imoveis" on storage.objects;

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

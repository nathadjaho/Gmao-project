-- =============================================================================
-- Phase 4 — Module Documents avec versionnage
-- =============================================================================
--
-- Modèle :
--   documents          = la fiche (nom, catégorie, échéance, archivage)
--                        + une copie de la version courante (chemin, type, taille,
--                        n° de version) pour que les listes restent une simple lecture.
--   document_versions  = l'historique, en AJOUT SEUL : une version n'est jamais
--                        modifiée ni supprimée. Restaurer = créer une nouvelle version
--                        qui pointe vers l'ancien fichier.
--
-- Règle d'or : on n'écrit JAMAIS directement dans ces tables depuis le client.
--   Toutes les écritures « fichier » passent par des fonctions SQL qui vérifient :
--   organisation, droits, et surtout que le fichier existe VRAIMENT dans Storage.
--   Le type MIME et la taille sont lus dans les métadonnées de Storage, pas
--   envoyés par le navigateur (on ne fait jamais confiance au client).
--
-- Flux d'envoi :
--   1. le navigateur génère document_id + version_id (UUID)
--   2. il envoie le fichier vers  documents/{org}/{document_id}/{version_id}/{nom}
--   3. il appelle create_document(...) ou add_document_version(...)
--   4. si l'appel échoue, il supprime le fichier qu'il vient d'envoyer
-- =============================================================================

-- 1. Historique des versions ---------------------------------------------------
create table public.document_versions (
  id                uuid primary key,
  organization_id   uuid not null default private.current_org_id(),
  document_id       uuid not null,
  version_number    integer not null check (version_number >= 1),
  storage_path      text not null,
  original_filename text not null check (length(trim(original_filename)) between 1 and 255),
  mime_type         text not null,
  size_bytes        bigint not null check (size_bytes > 0 and size_bytes <= 52428800),
  comment           text check (comment is null or length(comment) <= 500),
  uploaded_by       uuid references auth.users (id) default auth.uid(),
  created_at        timestamptz not null default now(),
  unique (document_id, version_number),
  -- Permet à l'API d'embarquer le nom de l'auteur (profiles) dans l'historique.
  constraint document_versions_uploader_profile_fk
    foreign key (uploaded_by) references public.profiles (id) on delete set null,
  foreign key (organization_id, document_id)
    references public.documents (organization_id, id) on delete cascade,
  constraint document_versions_path_in_doc
    check (storage_path like organization_id::text || '/' || document_id::text || '/%')
);
create index document_versions_doc_idx on public.document_versions (document_id, version_number desc);

alter table public.document_versions enable row level security;
create policy "doc-versions: org read" on public.document_versions for select to authenticated
  using (organization_id = private.current_org_id());
-- Aucune policy d'écriture : insertion uniquement via les fonctions ci-dessous.
revoke insert, update, delete on public.document_versions from authenticated, anon;

-- 2. Fiche document : version courante + recherche ------------------------------
alter table public.documents
  add column current_version   integer not null default 1,
  add column original_filename text,
  add column search_text       text generated always as (private.normalize_search(name)) stored;

-- Un chemin peut désormais être partagé par deux versions (restauration).
alter table public.documents drop constraint documents_storage_path_key;

drop index if exists public.documents_name_trgm_idx;
create index documents_search_trgm_idx on public.documents using gin (search_text extensions.gin_trgm_ops);
create index documents_org_recent_idx on public.documents (organization_id, updated_at desc) where deleted_at is null;

-- Écriture directe interdite (création via create_document) ; en mise à jour,
-- seules les colonnes « métier » sont modifiables par un admin (RLS existante).
drop policy if exists "documents: members insert" on public.documents;
revoke insert, update on public.documents from authenticated, anon;
grant update (name, category_id, expires_on, deleted_at) on public.documents to authenticated;

-- 3. Fonctions ----------------------------------------------------------------

-- Lit l'objet Storage correspondant au chemin (dans l'organisation de l'appelant)
-- et renvoie son type et sa taille. Échoue si le fichier n'existe pas.
create or replace function private.storage_file_info(p_path text, out mime_type text, out size_bytes bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  select coalesce(o.metadata ->> 'mimetype', 'application/octet-stream'),
         coalesce((o.metadata ->> 'size')::bigint, 0)
    into mime_type, size_bytes
  from storage.objects o
  where o.bucket_id = 'documents' and o.name = p_path;
  if not found then
    raise exception 'Fichier introuvable dans le stockage : %', p_path using errcode = 'no_data_found';
  end if;
end $$;
revoke all on function private.storage_file_info(text) from public, anon, authenticated;

-- Insère une version et recopie ses infos dans la fiche (point d'écriture unique).
create or replace function private.insert_version(
  p_document_id uuid, p_version_id uuid, p_path text, p_filename text, p_comment text
) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := private.current_org_id();
  v_next integer;
  v_file record;
begin
  if p_path not like v_org::text || '/' || p_document_id::text || '/%' then
    raise exception 'Chemin de fichier invalide' using errcode = 'check_violation';
  end if;
  select * into v_file from private.storage_file_info(p_path);

  -- Verrou sur la fiche AVANT de calculer le numéro : deux envois simultanés
  -- sont sérialisés et ne peuvent pas prendre le même numéro.
  perform 1 from public.documents where id = p_document_id and organization_id = v_org for update;
  if not found then
    raise exception 'Document introuvable' using errcode = 'no_data_found';
  end if;
  select coalesce(max(version_number), 0) + 1 into v_next
  from public.document_versions where document_id = p_document_id;

  insert into public.document_versions
    (id, organization_id, document_id, version_number, storage_path, original_filename,
     mime_type, size_bytes, comment, uploaded_by)
  values
    (p_version_id, v_org, p_document_id, v_next, p_path, trim(p_filename),
     v_file.mime_type, v_file.size_bytes, nullif(trim(p_comment), ''), auth.uid());

  update public.documents
     set storage_path = p_path, original_filename = trim(p_filename),
         mime_type = v_file.mime_type, size_bytes = v_file.size_bytes,
         current_version = v_next
   where id = p_document_id;
  return v_next;
end $$;
revoke all on function private.insert_version(uuid, uuid, text, text, text) from public, anon, authenticated;

-- Création : tout membre actif.
create or replace function private.create_document(
  p_id uuid, p_version_id uuid, p_name text, p_category_id uuid, p_expires_on date,
  p_storage_path text, p_filename text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := private.current_org_id();
  v_file record;
begin
  if v_org is null then
    raise exception 'Aucune organisation active' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.document_categories where id = p_category_id and organization_id = v_org) then
    raise exception 'Catégorie inconnue' using errcode = 'foreign_key_violation';
  end if;
  if p_storage_path not like v_org::text || '/' || p_id::text || '/%' then
    raise exception 'Chemin de fichier invalide' using errcode = 'check_violation';
  end if;
  select * into v_file from private.storage_file_info(p_storage_path);

  insert into public.documents
    (id, organization_id, category_id, name, storage_path, original_filename, mime_type, size_bytes,
     expires_on, current_version, uploaded_by)
  values
    (p_id, v_org, p_category_id, trim(p_name), p_storage_path, trim(p_filename), v_file.mime_type,
     v_file.size_bytes, p_expires_on, 1, auth.uid());

  perform private.insert_version(p_id, p_version_id, p_storage_path, p_filename, 'Version initiale');
  return p_id;
end $$;
revoke all on function private.create_document(uuid, uuid, text, uuid, date, text, text) from public, anon;
grant execute on function private.create_document(uuid, uuid, text, uuid, date, text, text) to authenticated;

-- Nouvelle version : admin uniquement (modifier un document = responsabilité de l'admin).
create or replace function private.add_document_version(
  p_document_id uuid, p_version_id uuid, p_storage_path text, p_filename text,
  p_comment text, p_expires_on date
) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_next integer;
begin
  if not private.is_admin() then
    raise exception 'Seul un administrateur peut publier une nouvelle version' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.documents
                 where id = p_document_id and organization_id = private.current_org_id() and deleted_at is null) then
    raise exception 'Document introuvable ou archivé' using errcode = 'no_data_found';
  end if;
  v_next := private.insert_version(p_document_id, p_version_id, p_storage_path, p_filename, p_comment);
  -- Un certificat renouvelé a souvent une nouvelle échéance.
  if p_expires_on is not null then
    update public.documents set expires_on = p_expires_on where id = p_document_id;
  end if;
  return v_next;
end $$;
revoke all on function private.add_document_version(uuid, uuid, text, text, text, date) from public, anon;
grant execute on function private.add_document_version(uuid, uuid, text, text, text, date) to authenticated;

-- Restauration : crée une NOUVELLE version pointant vers le fichier d'une ancienne.
-- L'historique n'est jamais réécrit : on voit « v4 = restauration de la v2 ».
create or replace function private.restore_document_version(p_version_id uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_old public.document_versions;
begin
  if not private.is_admin() then
    raise exception 'Seul un administrateur peut restaurer une version' using errcode = 'insufficient_privilege';
  end if;
  select * into v_old from public.document_versions
  where id = p_version_id and organization_id = private.current_org_id();
  if not found then
    raise exception 'Version introuvable' using errcode = 'no_data_found';
  end if;
  if exists (select 1 from public.documents where id = v_old.document_id and deleted_at is not null) then
    raise exception 'Document archivé' using errcode = 'check_violation';
  end if;
  return private.insert_version(v_old.document_id, gen_random_uuid(), v_old.storage_path,
                                v_old.original_filename, 'Restauration de la v' || v_old.version_number);
end $$;
revoke all on function private.restore_document_version(uuid) from public, anon;
grant execute on function private.restore_document_version(uuid) to authenticated;

-- Façades publiques (SECURITY INVOKER) : même patron que create_organization.
create or replace function public.create_document(
  p_id uuid, p_version_id uuid, p_name text, p_category_id uuid, p_expires_on date,
  p_storage_path text, p_filename text
) returns uuid language sql security invoker set search_path = '' as $$
  select private.create_document(p_id, p_version_id, p_name, p_category_id, p_expires_on, p_storage_path, p_filename)
$$;
create or replace function public.add_document_version(
  p_document_id uuid, p_version_id uuid, p_storage_path text, p_filename text,
  p_comment text default null, p_expires_on date default null
) returns integer language sql security invoker set search_path = '' as $$
  select private.add_document_version(p_document_id, p_version_id, p_storage_path, p_filename, p_comment, p_expires_on)
$$;
create or replace function public.restore_document_version(p_version_id uuid)
returns integer language sql security invoker set search_path = '' as $$
  select private.restore_document_version(p_version_id)
$$;
revoke all on function public.create_document(uuid, uuid, text, uuid, date, text, text) from public, anon;
revoke all on function public.add_document_version(uuid, uuid, text, text, text, date) from public, anon;
revoke all on function public.restore_document_version(uuid) from public, anon;
grant execute on function public.create_document(uuid, uuid, text, uuid, date, text, text) to authenticated;
grant execute on function public.add_document_version(uuid, uuid, text, text, text, date) to authenticated;
grant execute on function public.restore_document_version(uuid) to authenticated;

-- 4. Storage : nettoyage d'un envoi raté -----------------------------------------
-- Un utilisateur peut supprimer SON fichier tant qu'aucune version ne le référence
-- (cas : envoi réussi puis échec de create_document). Les fichiers enregistrés,
-- eux, ne sont jamais supprimés (traçabilité).
create or replace function private.storage_path_is_referenced(p_path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.document_versions where storage_path = p_path)
$$;
revoke all on function private.storage_path_is_referenced(text) from public, anon;
grant execute on function private.storage_path_is_referenced(text) to authenticated;

create policy "storage documents: own orphan delete" on storage.objects for delete to authenticated
  using (bucket_id = 'documents'
         and (storage.foldername(name))[1] = private.current_org_id()::text
         and owner = auth.uid()
         and not private.storage_path_is_referenced(name));

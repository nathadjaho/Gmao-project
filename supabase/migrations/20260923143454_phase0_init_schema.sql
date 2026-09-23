-- =============================================================================
-- Phase 0 — Schéma initial GMAO (MVP)
-- Référence : DATA_MODEL.md v2
--
-- Principes :
--   1. Multi-tenant : chaque table métier porte organization_id.
--   2. L'isolation est garantie PAR LA BASE (RLS), pas par le code applicatif.
--   3. Les FK composites (organization_id, x_id) empêchent de lier deux lignes
--      appartenant à deux organisations différentes.
--   4. Les règles métier critiques (transitions de statut, historique, audit)
--      vivent dans des triggers : le client parle directement à Supabase,
--      donc la base est la seule barrière fiable.
-- =============================================================================

create extension if not exists pg_trgm with schema extensions;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type public.app_role            as enum ('admin', 'manager', 'technician', 'viewer');
create type public.equipment_status    as enum ('in_service', 'broken_down', 'out_of_service');
create type public.intervention_type   as enum ('corrective', 'preventive');
create type public.intervention_priority as enum ('low', 'normal', 'high', 'urgent');
create type public.intervention_status as enum ('todo', 'in_progress', 'done', 'cancelled');
create type public.notification_type   as enum ('intervention_assigned', 'intervention_overdue', 'document_expiring');

-- -----------------------------------------------------------------------------
-- Utilitaire : updated_at automatique
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- =============================================================================
-- Tables
-- =============================================================================

create table public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) between 2 and 120),
  created_at timestamptz not null default now()
);

-- Profil public d'un utilisateur Supabase Auth (auth.users).
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Appartenance utilisateur ↔ organisation + rôle.
-- Séparé de profiles : un utilisateur peut éditer son nom, jamais son rôle.
-- UNIQUE(user_id) = une seule organisation par utilisateur au MVP ;
-- supprimer cette contrainte suffira pour passer au multi-organisations.
create table public.memberships (
  user_id         uuid not null references auth.users (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  role            public.app_role not null default 'viewer',
  created_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  primary key (user_id, organization_id),
  constraint memberships_one_org_per_user unique (user_id)
);

-- -----------------------------------------------------------------------------
-- Fonctions d'autorisation (utilisées par toutes les policies RLS)
-- SECURITY DEFINER : lisent memberships sans déclencher la RLS de memberships
-- (sinon récursion infinie). search_path figé = protection contre le hijacking.
-- -----------------------------------------------------------------------------
create or replace function public.current_org_id()
returns uuid language sql stable security definer set search_path = public as $$
  select organization_id from public.memberships
  where user_id = auth.uid() and deleted_at is null
  limit 1
$$;

create or replace function public.has_role(roles public.app_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships
    where user_id = auth.uid() and deleted_at is null and role = any (roles)
  )
$$;

-- Maintenant que current_org_id() existe, les tables métier peuvent l'utiliser en DEFAULT :
-- le client n'envoie jamais organization_id, la base le déduit de la session.

create table public.equipment (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations (id),
  code            text not null check (length(trim(code)) between 1 and 50),
  name            text not null check (length(trim(name)) between 1 and 200),
  category        text,
  location        text,
  status          public.equipment_status not null default 'in_service',
  criticality     smallint not null default 2 check (criticality between 1 and 3),
  commissioned_on date,
  created_by      uuid references auth.users (id) default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  constraint equipment_org_id_key unique (organization_id, id)
);
-- Code unique par organisation, parmi les équipements non supprimés.
create unique index equipment_org_code_uidx on public.equipment (organization_id, lower(code)) where deleted_at is null;

create table public.interventions (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null default public.current_org_id() references public.organizations (id),
  equipment_id     uuid not null,
  type             public.intervention_type not null default 'corrective',
  priority         public.intervention_priority not null default 'normal',
  status           public.intervention_status not null default 'todo',
  title            text not null check (length(trim(title)) between 1 and 200),
  description      text,
  assigned_to      uuid references auth.users (id),
  due_date         date,
  started_at       timestamptz,
  completed_at     timestamptz,
  -- Rapport de clôture (texte libre au MVP ; pièces détachées = entité en phase 2)
  work_performed   text,
  duration_minutes integer check (duration_minutes is null or duration_minutes >= 0),
  parts_used       text,
  created_by       uuid references auth.users (id) default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint interventions_org_id_key unique (organization_id, id),
  constraint interventions_equipment_fk foreign key (organization_id, equipment_id)
    references public.equipment (organization_id, id),
  constraint interventions_done_requires_report
    check (status <> 'done' or work_performed is not null)
);

-- Historique des changements de statut : alimenté UNIQUEMENT par trigger.
create table public.intervention_status_history (
  id              bigint generated always as identity primary key,
  organization_id uuid not null,
  intervention_id uuid not null,
  from_status     public.intervention_status,
  to_status       public.intervention_status not null,
  changed_by      uuid references auth.users (id),
  changed_at      timestamptz not null default now(),
  foreign key (organization_id, intervention_id)
    references public.interventions (organization_id, id) on delete cascade
);

-- Checklist optionnelle d'une intervention (l'UI actuelle en a une).
-- L'étape "active" n'est pas stockée : c'est la première non terminée (donnée dérivée).
create table public.intervention_steps (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id(),
  intervention_id uuid not null,
  position        integer not null check (position >= 0),
  title           text not null check (length(trim(title)) between 1 and 200),
  completed_by    uuid references auth.users (id),
  completed_at    timestamptz,
  unique (intervention_id, position),
  foreign key (organization_id, intervention_id)
    references public.interventions (organization_id, id) on delete cascade
);

create table public.document_categories (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations (id),
  name            text not null check (length(trim(name)) between 1 and 80),
  created_at      timestamptz not null default now(),
  constraint document_categories_org_id_key unique (organization_id, id),
  constraint document_categories_org_name_key unique (organization_id, name)
);

create table public.documents (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations (id),
  category_id     uuid not null,
  name            text not null check (length(trim(name)) between 1 and 255),
  -- Chemin dans le bucket Storage "documents" : {organization_id}/{document_id}/{fichier}
  storage_path    text not null unique,
  mime_type       text not null,
  size_bytes      bigint not null check (size_bytes > 0 and size_bytes <= 52428800), -- 50 Mo
  expires_on      date,
  uploaded_by     uuid references auth.users (id) default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  constraint documents_org_id_key unique (organization_id, id),
  constraint documents_category_fk foreign key (organization_id, category_id)
    references public.document_categories (organization_id, id),
  constraint documents_path_in_org check (storage_path like organization_id::text || '/%')
);

-- Liens N—N. Deux tables de jonction plutôt qu'une table polymorphe :
-- vraies FK, PK composites naturelles, aucune colonne nullable.
create table public.document_equipment (
  organization_id uuid not null default public.current_org_id(),
  document_id     uuid not null,
  equipment_id    uuid not null,
  created_at      timestamptz not null default now(),
  primary key (document_id, equipment_id),
  foreign key (organization_id, document_id)  references public.documents (organization_id, id) on delete cascade,
  foreign key (organization_id, equipment_id) references public.equipment (organization_id, id) on delete cascade
);

create table public.document_interventions (
  organization_id uuid not null default public.current_org_id(),
  document_id     uuid not null,
  intervention_id uuid not null,
  created_at      timestamptz not null default now(),
  primary key (document_id, intervention_id),
  foreign key (organization_id, document_id)     references public.documents (organization_id, id) on delete cascade,
  foreign key (organization_id, intervention_id) references public.interventions (organization_id, id) on delete cascade
);

create table public.notifications (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  type            public.notification_type not null,
  entity_type     text not null,
  entity_id       uuid not null,
  message         text not null,
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);

create table public.audit_log (
  id              bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid references auth.users (id),
  action          text not null check (action in ('insert', 'update', 'delete')),
  entity_type     text not null,
  entity_id       uuid not null,
  changes         jsonb,
  created_at      timestamptz not null default now()
);

-- =============================================================================
-- Index (les requêtes filtrent TOUJOURS par organization_id d'abord)
-- =============================================================================
create index equipment_org_status_idx        on public.equipment (organization_id, status) where deleted_at is null;
create index equipment_name_trgm_idx         on public.equipment using gin (name extensions.gin_trgm_ops);
create index equipment_code_trgm_idx         on public.equipment using gin (code extensions.gin_trgm_ops);
create index interventions_org_status_due_idx on public.interventions (organization_id, status, due_date);
create index interventions_equipment_idx     on public.interventions (equipment_id, created_at desc);
create index interventions_assigned_idx      on public.interventions (assigned_to) where status in ('todo', 'in_progress');
create index status_history_intervention_idx on public.intervention_status_history (intervention_id, changed_at);
create index documents_org_category_idx      on public.documents (organization_id, category_id) where deleted_at is null;
create index documents_expires_idx           on public.documents (organization_id, expires_on) where expires_on is not null and deleted_at is null;
create index documents_name_trgm_idx         on public.documents using gin (name extensions.gin_trgm_ops);
create index document_equipment_equipment_idx on public.document_equipment (equipment_id);
create index document_interventions_intervention_idx on public.document_interventions (intervention_id);
create index notifications_user_unread_idx   on public.notifications (user_id, created_at desc) where read_at is null;
create index audit_log_entity_idx            on public.audit_log (organization_id, entity_type, entity_id, created_at desc);

-- =============================================================================
-- Triggers métier
-- =============================================================================

create trigger profiles_updated_at      before update on public.profiles      for each row execute function public.set_updated_at();
create trigger equipment_updated_at     before update on public.equipment     for each row execute function public.set_updated_at();
create trigger interventions_updated_at before update on public.interventions for each row execute function public.set_updated_at();
create trigger documents_updated_at     before update on public.documents     for each row execute function public.set_updated_at();

-- Création automatique du profil à l'inscription.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Machine à états des interventions :
--   todo → in_progress → done
--   todo | in_progress → cancelled
--   done, cancelled = états terminaux
-- + horodatage automatique de started_at / completed_at.
create or replace function public.intervention_enforce_status()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.status not in ('todo', 'in_progress') then
      raise exception 'Une intervention doit être créée au statut todo ou in_progress (reçu : %)', new.status
        using errcode = 'check_violation';
    end if;
  elsif new.status is distinct from old.status then
    if not (
         (old.status = 'todo'        and new.status in ('in_progress', 'cancelled'))
      or (old.status = 'in_progress' and new.status in ('done', 'cancelled'))
    ) then
      raise exception 'Transition de statut interdite : % → %', old.status, new.status
        using errcode = 'check_violation';
    end if;
  elsif old.status in ('done', 'cancelled') then
    raise exception 'Intervention clôturée : modification interdite'
      using errcode = 'check_violation';
  end if;

  -- Un technicien (assigné) ne peut faire avancer que le statut et le rapport,
  -- pas réassigner, reprioriser ou renommer l'intervention.
  if tg_op = 'UPDATE' and auth.uid() is not null and not public.has_role('{admin,manager}') then
    if (new.type, new.priority, new.title, new.description, new.assigned_to, new.due_date)
       is distinct from
       (old.type, old.priority, old.title, old.description, old.assigned_to, old.due_date) then
      raise exception 'Un technicien ne peut modifier que le statut et le rapport de clôture'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  if new.status = 'in_progress' and new.started_at is null then
    new.started_at := now();
  end if;
  if new.status in ('done', 'cancelled') and new.completed_at is null then
    new.completed_at := now();
  end if;
  return new;
end $$;

create trigger interventions_enforce_status
  before insert or update on public.interventions
  for each row execute function public.intervention_enforce_status();

-- Historique des statuts (security definer : l'utilisateur ne peut pas écrire
-- directement dans la table d'historique, seul ce trigger le peut).
create or replace function public.intervention_log_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.intervention_status_history (organization_id, intervention_id, from_status, to_status, changed_by)
    values (new.organization_id, new.id, case when tg_op = 'UPDATE' then old.status end, new.status, auth.uid());
  end if;
  return new;
end $$;

create trigger interventions_log_status
  after insert or update on public.interventions
  for each row execute function public.intervention_log_status();

-- Notification in-app quand une intervention est assignée (ou réassignée).
create or replace function public.intervention_notify_assignee()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.assigned_to is not null
     and new.assigned_to is distinct from auth.uid()
     and (tg_op = 'INSERT' or new.assigned_to is distinct from old.assigned_to) then
    insert into public.notifications (organization_id, user_id, type, entity_type, entity_id, message)
    values (new.organization_id, new.assigned_to, 'intervention_assigned', 'intervention', new.id,
            'Nouvelle intervention assignée : ' || new.title);
  end if;
  return new;
end $$;

create trigger interventions_notify_assignee
  after insert or update of assigned_to on public.interventions
  for each row execute function public.intervention_notify_assignee();

-- Audit générique : qui a fait quoi, quand, avec le diff des colonnes modifiées.
create or replace function public.audit_row_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_changes jsonb;
begin
  if tg_op = 'UPDATE' then
    select jsonb_object_agg(n.key, jsonb_build_object('old', v_old -> n.key, 'new', n.value))
      into v_changes
      from jsonb_each(v_new) n
     where n.value is distinct from v_old -> n.key and n.key <> 'updated_at';
    if v_changes is null then return new; end if;
  else
    v_changes := v_row;
  end if;

  insert into public.audit_log (organization_id, user_id, action, entity_type, entity_id, changes)
  values ((v_row ->> 'organization_id')::uuid, auth.uid(), lower(tg_op), tg_table_name, (v_row ->> 'id')::uuid, v_changes);
  return coalesce(new, old);
end $$;

create trigger equipment_audit     after insert or update or delete on public.equipment     for each row execute function public.audit_row_change();
create trigger interventions_audit after insert or update or delete on public.interventions for each row execute function public.audit_row_change();
create trigger documents_audit     after insert or update or delete on public.documents     for each row execute function public.audit_row_change();

-- =============================================================================
-- Onboarding : créer son organisation (l'utilisateur en devient admin)
-- + catégories documentaires par défaut.
-- =============================================================================
create or replace function public.create_organization(org_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_org_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise' using errcode = 'insufficient_privilege';
  end if;
  if exists (select 1 from public.memberships where user_id = auth.uid()) then
    raise exception 'Cet utilisateur appartient déjà à une organisation' using errcode = 'unique_violation';
  end if;

  insert into public.organizations (name) values (org_name) returning id into v_org_id;
  insert into public.memberships (user_id, organization_id, role) values (auth.uid(), v_org_id, 'admin');
  insert into public.document_categories (organization_id, name)
  select v_org_id, unnest(array['Manuel', 'Procédure', 'Certificat', 'Rapport', 'Plan', 'Contrat']);
  return v_org_id;
end $$;

revoke all on function public.create_organization(text) from public, anon;
grant execute on function public.create_organization(text) to authenticated;

-- =============================================================================
-- Row Level Security
-- Règle : on lit tout ce qui appartient à son organisation ;
--         on écrit selon son rôle ; viewer = lecture seule.
-- =============================================================================
alter table public.organizations               enable row level security;
alter table public.profiles                    enable row level security;
alter table public.memberships                 enable row level security;
alter table public.equipment                   enable row level security;
alter table public.interventions               enable row level security;
alter table public.intervention_status_history enable row level security;
alter table public.intervention_steps          enable row level security;
alter table public.document_categories         enable row level security;
alter table public.documents                   enable row level security;
alter table public.document_equipment          enable row level security;
alter table public.document_interventions      enable row level security;
alter table public.notifications               enable row level security;
alter table public.audit_log                   enable row level security;

-- Organizations
create policy "org: members read"   on public.organizations for select to authenticated using (id = public.current_org_id());
create policy "org: admin updates"  on public.organizations for update to authenticated
  using (id = public.current_org_id() and public.has_role('{admin}')) with check (id = public.current_org_id());

-- Profiles : visibles par les collègues, éditables par soi-même.
create policy "profiles: self or same org read" on public.profiles for select to authenticated using (
  id = auth.uid()
  or exists (select 1 from public.memberships m where m.user_id = profiles.id and m.organization_id = public.current_org_id())
);
create policy "profiles: self update" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Memberships : lecture dans l'org ; gestion réservée à l'admin (invitations = étape suivante).
create policy "memberships: org read" on public.memberships for select to authenticated using (organization_id = public.current_org_id());
create policy "memberships: admin update" on public.memberships for update to authenticated
  using (organization_id = public.current_org_id() and public.has_role('{admin}'))
  with check (organization_id = public.current_org_id() and user_id <> auth.uid()); -- un admin ne modifie pas son propre rôle

-- Equipment (pas de DELETE : suppression logique via deleted_at)
create policy "equipment: org read" on public.equipment for select to authenticated using (organization_id = public.current_org_id());
create policy "equipment: managers insert" on public.equipment for insert to authenticated
  with check (organization_id = public.current_org_id() and public.has_role('{admin,manager}'));
create policy "equipment: managers update" on public.equipment for update to authenticated
  using (organization_id = public.current_org_id() and public.has_role('{admin,manager}'))
  with check (organization_id = public.current_org_id());

-- Interventions : créées par admin/manager ; mises à jour aussi par le technicien assigné.
create policy "interventions: org read" on public.interventions for select to authenticated using (organization_id = public.current_org_id());
create policy "interventions: managers insert" on public.interventions for insert to authenticated
  with check (organization_id = public.current_org_id() and public.has_role('{admin,manager}'));
create policy "interventions: managers or assignee update" on public.interventions for update to authenticated
  using (organization_id = public.current_org_id()
         and (public.has_role('{admin,manager}') or (assigned_to = auth.uid() and public.has_role('{technician}'))))
  with check (organization_id = public.current_org_id());

create policy "status history: org read" on public.intervention_status_history for select to authenticated
  using (organization_id = public.current_org_id());

-- Checklist : mêmes droits que l'intervention parente.
create policy "steps: org read" on public.intervention_steps for select to authenticated using (organization_id = public.current_org_id());
create policy "steps: managers write" on public.intervention_steps for all to authenticated
  using (organization_id = public.current_org_id() and public.has_role('{admin,manager}'))
  with check (organization_id = public.current_org_id() and public.has_role('{admin,manager}'));
create policy "steps: assignee completes" on public.intervention_steps for update to authenticated
  using (organization_id = public.current_org_id() and exists (
    select 1 from public.interventions i
    where i.id = intervention_steps.intervention_id and i.assigned_to = auth.uid() and i.status = 'in_progress'))
  with check (organization_id = public.current_org_id());

-- Catégories documentaires : gérées par l'admin.
create policy "categories: org read" on public.document_categories for select to authenticated using (organization_id = public.current_org_id());
create policy "categories: admin write" on public.document_categories for all to authenticated
  using (organization_id = public.current_org_id() and public.has_role('{admin}'))
  with check (organization_id = public.current_org_id() and public.has_role('{admin}'));

-- Documents : tout le monde sauf viewer peut déposer ; admin/manager modifient.
create policy "documents: org read" on public.documents for select to authenticated using (organization_id = public.current_org_id());
create policy "documents: contributors insert" on public.documents for insert to authenticated
  with check (organization_id = public.current_org_id() and public.has_role('{admin,manager,technician}'));
create policy "documents: managers update" on public.documents for update to authenticated
  using (organization_id = public.current_org_id() and public.has_role('{admin,manager}'))
  with check (organization_id = public.current_org_id());

create policy "doc-equipment: org read" on public.document_equipment for select to authenticated using (organization_id = public.current_org_id());
create policy "doc-equipment: contributors write" on public.document_equipment for all to authenticated
  using (organization_id = public.current_org_id() and public.has_role('{admin,manager,technician}'))
  with check (organization_id = public.current_org_id() and public.has_role('{admin,manager,technician}'));

create policy "doc-interventions: org read" on public.document_interventions for select to authenticated using (organization_id = public.current_org_id());
create policy "doc-interventions: contributors write" on public.document_interventions for all to authenticated
  using (organization_id = public.current_org_id() and public.has_role('{admin,manager,technician}'))
  with check (organization_id = public.current_org_id() and public.has_role('{admin,manager,technician}'));

-- Notifications : chacun ne voit et ne marque comme lues que les siennes.
create policy "notifications: own read" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "notifications: own mark read" on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Audit : lecture admin/manager ; aucune écriture directe (triggers uniquement).
create policy "audit: managers read" on public.audit_log for select to authenticated
  using (organization_id = public.current_org_id() and public.has_role('{admin,manager}'));

-- Colonnes que le technicien assigné ne doit pas pouvoir réécrire via l'API :
-- on restreint les privilèges UPDATE au niveau colonne pour le rôle authenticated.
revoke update on public.interventions from authenticated;
grant update (type, priority, status, title, description, assigned_to, due_date,
              work_performed, duration_minutes, parts_used)
  on public.interventions to authenticated;
revoke update on public.memberships from authenticated;
grant update (role, deleted_at) on public.memberships to authenticated;
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- =============================================================================
-- Storage : bucket privé "documents", chemins {organization_id}/{document_id}/{fichier}
-- Accès uniquement via URL signée, et seulement dans son organisation.
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 52428800, array[
  'application/pdf', 'image/png', 'image/jpeg', 'image/webp',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
])
on conflict (id) do nothing;

create policy "storage documents: org read" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = public.current_org_id()::text);
create policy "storage documents: contributors upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents'
              and (storage.foldername(name))[1] = public.current_org_id()::text
              and public.has_role('{admin,manager,technician}'));

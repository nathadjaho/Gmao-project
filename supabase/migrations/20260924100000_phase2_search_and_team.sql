-- =============================================================================
-- Phase 2 — Recherche robuste + gestion d'équipe
-- =============================================================================

-- 1. Recherche équipements : une colonne normalisée (minuscules, sans accents)
--    Le client normalise la saisie de la même façon → un seul filtre ILIKE,
--    insensible aux accents, couvrant code + nom + catégorie + localisation.
create extension if not exists unaccent with schema extensions;

-- unaccent() n'est pas IMMUTABLE (dépend d'un dictionnaire) : on l'enveloppe pour
-- pouvoir l'utiliser dans une colonne générée. Pattern standard PostgreSQL.
create or replace function private.normalize_search(v text)
returns text language sql immutable parallel safe set search_path = '' as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(v, '')))
$$;

alter table public.equipment
  add column search_text text generated always as (
    private.normalize_search(code || ' ' || name || ' ' || coalesce(category, '') || ' ' || coalesce(location, ''))
  ) stored;

drop index if exists public.equipment_name_trgm_idx;
drop index if exists public.equipment_code_trgm_idx;
create index equipment_search_trgm_idx on public.equipment using gin (search_text extensions.gin_trgm_ops);

-- 2. Équipe : email visible dans le profil (pour la page Équipe)
alter table public.profiles add column email text;
update public.profiles p set email = u.email from auth.users u where u.id = p.id;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), new.email);
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- memberships → profiles : permet à l'API d'embarquer le profil d'un membre
-- (select role, profiles(full_name, email)) en une seule requête.
alter table public.memberships
  add constraint memberships_user_profile_fk foreign key (user_id) references public.profiles (id) on delete cascade;

-- 3. Un membre désactivé ne peut plus être assigné à une intervention.
create or replace function private.assignee_must_be_active_member()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.assigned_to is not null
     and (tg_op = 'INSERT' or new.assigned_to is distinct from old.assigned_to)
     and not exists (
       select 1 from public.memberships m
       where m.user_id = new.assigned_to and m.organization_id = new.organization_id and m.deleted_at is null
     ) then
    raise exception 'La personne assignée doit être un membre actif de l''organisation'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger interventions_assignee_active
  before insert or update of assigned_to on public.interventions
  for each row execute function private.assignee_must_be_active_member();

-- 4. Liens vers profiles pour afficher des noms en une requête
--    (assigné d'une intervention, auteur d'un changement de statut).
--    Ces FK doublent celles vers auth.users, que l'API ne peut pas embarquer.
alter table public.interventions
  add constraint interventions_assignee_profile_fk foreign key (assigned_to) references public.profiles (id);
alter table public.intervention_status_history
  add constraint status_history_changed_by_profile_fk foreign key (changed_by) references public.profiles (id);

-- =============================================================================
-- Phase 6 — Profil (mot de passe provisoire), rattachement de compte, finitions
-- =============================================================================

-- 1. Mot de passe provisoire ----------------------------------------------------
-- Un compte créé par un admin (Edge Function create-member) a un mot de passe que
-- l'admin a vu. On le marque « à changer » ; l'application bloque l'accès tant que
-- l'utilisateur ne l'a pas remplacé.
--
-- Le drapeau n'est PAS modifiable par le client : il est levé par un trigger sur
-- auth.users quand le mot de passe change réellement (encrypted_password).
-- Impossible donc de « cocher la case » sans avoir changé de mot de passe.
alter table public.profiles
  add column must_change_password boolean not null default false;

create or replace function private.password_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.encrypted_password is distinct from old.encrypted_password then
    update public.profiles set must_change_password = false
    where id = new.id and must_change_password;
  end if;
  return new;
end $$;
revoke all on function private.password_changed() from public, anon, authenticated;

drop trigger if exists on_auth_user_password_changed on auth.users;
create trigger on_auth_user_password_changed
  after update of encrypted_password on auth.users
  for each row execute function private.password_changed();

-- 2. Profil : l'utilisateur ne modifie que son nom ---------------------------------
-- Avant : la policy « self update » autorisait toutes les colonnes, donc aussi
-- email (affiché dans l'équipe) et le nouveau drapeau. On restreint par colonne.
revoke update on public.profiles from authenticated, anon;
grant update (full_name) on public.profiles to authenticated;
alter table public.profiles
  add constraint profiles_full_name_length check (length(trim(full_name)) <= 100) not valid;

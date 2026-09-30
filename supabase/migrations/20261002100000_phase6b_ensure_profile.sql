-- Ajout d'un membre auto-réparant.
--
-- Symptôme : « Un compte existe avec cet email mais il est introuvable » dans
-- « Ajouter un membre ». Cause : la ligne public.profiles a été supprimée à la main
-- alors que le compte auth.users existe toujours (même cause que D15).
--
-- Correctif : l'Edge Function create-member appelle cette fonction avant de chercher
-- le profil ; elle le recrée depuis auth.users s'il manque (idempotent).
-- Appelable UNIQUEMENT avec la clé serveur (service_role) : un utilisateur ne doit pas
-- pouvoir sonder quels emails ont un compte.

create or replace function private.ensure_profile_by_email(p_email text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select u.id into v_id
  from auth.users u
  where lower(u.email) = lower(trim(p_email));

  if v_id is null then
    return null;
  end if;

  insert into public.profiles (id, full_name, email)
  select u.id, coalesce(u.raw_user_meta_data ->> 'full_name', ''), u.email
  from auth.users u
  where u.id = v_id
  on conflict (id) do nothing;

  return v_id;
end $$;

revoke all on function private.ensure_profile_by_email(text) from public, anon, authenticated;
grant usage on schema private to service_role; -- la façade SECURITY INVOKER s'exécute en service_role
grant execute on function private.ensure_profile_by_email(text) to service_role;

-- Façade exposée par l'API (le schéma private ne l'est pas).
create or replace function public.ensure_profile_by_email(p_email text)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.ensure_profile_by_email(p_email);
$$;

revoke all on function public.ensure_profile_by_email(text) from public, anon, authenticated;
grant execute on function public.ensure_profile_by_email(text) to service_role;

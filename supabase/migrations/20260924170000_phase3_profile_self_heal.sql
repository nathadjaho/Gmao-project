-- Correctif : profils manquants.
--
-- Symptôme : « insert or update on table "memberships" violates foreign key
-- constraint "memberships_user_profile_fk" » à la création d'organisation.
-- Cause : des lignes de public.profiles ont été supprimées (Table Editor) alors que
-- les comptes auth.users existent toujours. La suppression a aussi effacé les
-- memberships (ON DELETE CASCADE) → l'utilisateur repasse par l'onboarding, et
-- l'insertion de sa membership échoue faute de profil.
--
-- Correctif en deux temps :
--   1. recréer les profils manquants (idempotent, aucune donnée supprimée) ;
--   2. rendre l'onboarding auto-réparant : il garantit le profil avant la membership.

-- 1. Rattrapage
insert into public.profiles (id, full_name, email)
select u.id, coalesce(u.raw_user_meta_data ->> 'full_name', ''), u.email
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- 2. Onboarding auto-réparant
create or replace function private.create_organization(org_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise' using errcode = 'insufficient_privilege';
  end if;
  if exists (select 1 from public.memberships where user_id = auth.uid()) then
    raise exception 'Cet utilisateur appartient déjà à une organisation' using errcode = 'unique_violation';
  end if;

  -- Le profil est normalement créé par le trigger on_auth_user_created ;
  -- on le garantit ici pour ne jamais bloquer un utilisateur si la ligne a disparu.
  insert into public.profiles (id, full_name, email)
  select u.id, coalesce(u.raw_user_meta_data ->> 'full_name', ''), u.email
  from auth.users u
  where u.id = auth.uid()
  on conflict (id) do nothing;

  insert into public.organizations (name) values (org_name) returning id into v_org_id;
  insert into public.memberships (user_id, organization_id, role) values (auth.uid(), v_org_id, 'admin');
  insert into public.document_categories (organization_id, name)
  select v_org_id, unnest(array['Manuel', 'Procédure', 'Certificat', 'Rapport', 'Plan', 'Contrat']);
  return v_org_id;
end $$;

revoke all on function private.create_organization(text) from public, anon;
grant execute on function private.create_organization(text) to authenticated;

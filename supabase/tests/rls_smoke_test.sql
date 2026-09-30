-- Scénarios RLS / règles métier (Phase 1 : rôles admin + technician, verrouillage).
-- Usage local : psql -f supabase_shim.sql, puis toutes les migrations dans l'ordre, puis ce fichier.
-- Chaque ligne « ✔ » ou « ✘ » est une assertion ; toute ligne « ✘ » est un échec.
\set ON_ERROR_STOP 0
\set QUIET 1
\pset tuples_only on
\pset format unaligned

insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-00000000000a', 'alice@org1', '{"full_name":"Alice"}'),
 ('00000000-0000-0000-0000-00000000000b', 'bob@org2',   '{}'),
 ('00000000-0000-0000-0000-00000000000c', 'tech@org1',  '{}');

create function pg_temp.check(label text, ok boolean) returns text language sql as
  $$ select case when ok then '✔ ' else '✘ ' end || label $$;
create function pg_temp.fails(label text, stmt text) returns text language plpgsql as $$
begin
  execute stmt;
  return '✘ ' || label || ' (aurait dû échouer)';
exception when others then
  return '✔ ' || label || ' → ' || sqlerrm;
end $$;
grant execute on all functions in schema pg_temp to authenticated;

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select public.create_organization('Org One') \gset org1_
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select public.create_organization('Org Two') \gset org2_
reset role;
-- En attendant les invitations : ajout du technicien en superutilisateur.
insert into public.memberships (user_id, organization_id)
values ('00000000-0000-0000-0000-00000000000c', :'org1_create_organization');
set role authenticated;

\echo '--- Rôles'
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select pg_temp.check('rôle par défaut d''un nouveau membre = technician',
  (select role::text from public.memberships where user_id = '00000000-0000-0000-0000-00000000000c') = 'technician');
select pg_temp.check('le créateur de l''organisation est admin',
  (select role::text from public.memberships where user_id = '00000000-0000-0000-0000-00000000000a') = 'admin');

\echo '--- Alice (admin org1) crée un équipement et une intervention assignée au technicien'
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into public.equipment (code, name, criticality) values ('TR-4410', 'Turbine B', 3);
insert into public.interventions (equipment_id, title, assigned_to, due_date)
  select id, 'Inspection arbre', '00000000-0000-0000-0000-00000000000c', current_date + 1
  from public.equipment where code = 'TR-4410';
insert into public.intervention_steps (intervention_id, position, title)
  select id, 0, 'Consignation' from public.interventions;
select id as itv from public.interventions \gset
select id as cat from public.document_categories limit 1 \gset
select gen_random_uuid() as doc, gen_random_uuid() as ver \gset
insert into storage.objects (bucket_id, name)
  values ('documents', :'org1_create_organization' || '/' || :'doc' || '/' || :'ver' || '/r.pdf');
select public.create_document(:'doc', :'ver', 'Rapport', :'cat', null,
  :'org1_create_organization' || '/' || :'doc' || '/' || :'ver' || '/r.pdf', 'r.pdf');

\echo '--- Isolation entre organisations'
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select pg_temp.check('Bob (org2) ne voit rien de org1',
  (select count(*) from public.equipment) + (select count(*) from public.interventions) + (select count(*) from public.audit_log) = 0);
select pg_temp.fails('Bob ne peut pas insérer dans org1',
  format('insert into public.equipment (organization_id, code, name) values (%L, ''HACK'', ''x'')', :'org1_create_organization'));

\echo '--- Technicien'
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select pg_temp.fails('le technicien ne crée pas d''équipement',
  'insert into public.equipment (code, name) values (''T-1'', ''x'')');
select pg_temp.fails('le technicien ne crée pas d''intervention',
  format('insert into public.interventions (equipment_id, title) select id, ''x'' from public.equipment'));
select pg_temp.check('le technicien a reçu la notification d''assignation',
  (select count(*) from public.notifications where type = 'intervention_assigned') = 1);
select pg_temp.fails('le technicien ne change pas la priorité',
  'update public.interventions set priority = ''low''');
update public.interventions set status = 'in_progress';
update public.intervention_steps set completed_at = now();
select pg_temp.check('étape cochée, completed_by posé par la base',
  (select completed_by = '00000000-0000-0000-0000-00000000000c' from public.intervention_steps));
select pg_temp.fails('le technicien ne renomme pas une étape',
  'update public.intervention_steps set title = ''autre''');
select pg_temp.fails('le technicien ne peut pas annuler',
  format('select public.change_intervention_status(%L, ''cancelled'', ''plus besoin'')', :'itv'));
select pg_temp.fails('le technicien ne peut pas passer directement à terminé',
  'update public.interventions set status = ''done'', work_performed = ''x''');
select pg_temp.fails('soumission impossible sans rapport',
  'update public.interventions set status = ''submitted''');
update public.interventions set work_performed = 'Roulements remplacés', duration_minutes = 90;
select public.change_intervention_status(:'itv', 'submitted');
select pg_temp.check('intervention soumise, submitted_at posé',
  (select status = 'submitted' and submitted_at is not null from public.interventions));

\echo '--- Périmètre du technicien terminé dès la soumission'
update public.interventions set work_performed = 'modifié après coup'; -- filtré par RLS : 0 ligne
select pg_temp.check('le rapport soumis n''a pas bougé',
  (select work_performed = 'Roulements remplacés' from public.interventions));
update public.intervention_steps set completed_at = null; -- filtré par RLS : 0 ligne
select pg_temp.check('la checklist soumise reste cochée',
  (select completed_at is not null from public.intervention_steps));
select pg_temp.fails('le technicien ne peut plus lier de document',
  format('insert into public.document_interventions (document_id, intervention_id) values (%L, %L)', :'doc', :'itv'));
select pg_temp.fails('le technicien ne peut pas valider sa propre intervention',
  format('select public.change_intervention_status(%L, ''done'')', :'itv'));
select pg_temp.check('le technicien ne lit pas le journal d''audit', (select count(*) from public.audit_log) = 0);

\echo '--- Admin : vérification'
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select pg_temp.check('l''admin a reçu la notification « à valider »',
  (select count(*) from public.notifications where type = 'intervention_submitted') = 1);
select pg_temp.fails('admin : le contenu soumis est figé',
  'update public.interventions set title = ''x''');
select pg_temp.fails('admin : pas d''étape ajoutée à une intervention soumise',
  format('insert into public.intervention_steps (intervention_id, position, title) values (%L, 1, ''x'')', :'itv'));
select pg_temp.fails('admin : renvoi pour reprise sans motif',
  format('select public.change_intervention_status(%L, ''in_progress'')', :'itv'));
select public.change_intervention_status(:'itv', 'in_progress', 'Photo du rapport de mesure manquante');
select pg_temp.check('renvoyée : in_progress, submitted_at effacé',
  (select status = 'in_progress' and submitted_at is null from public.interventions));

\echo '--- Technicien : reprise puis nouvelle soumission'
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select pg_temp.check('le technicien a reçu la notification de renvoi avec le motif',
  (select message like '%Photo du rapport de mesure manquante%' from public.notifications where type = 'intervention_returned'));
update public.interventions set work_performed = 'Roulements remplacés, photo jointe';
select pg_temp.check('le technicien peut de nouveau compléter son rapport',
  (select work_performed like '%photo jointe' from public.interventions));
select public.change_intervention_status(:'itv', 'submitted');

\echo '--- Admin : validation, verrou, réouverture'
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select public.change_intervention_status(:'itv', 'done');
select pg_temp.check('validée : done, completed_at posé',
  (select status = 'done' and completed_at is not null from public.interventions));
select pg_temp.fails('admin : lier un document à une intervention terminée',
  format('insert into public.document_interventions (document_id, intervention_id) values (%L, %L)', :'doc', :'itv'));
select pg_temp.fails('admin : réouverture sans motif',
  format('select public.change_intervention_status(%L, ''in_progress'', '' '')', :'itv'));
select public.change_intervention_status(:'itv', 'in_progress', 'Mesure axe Y erronée');
select pg_temp.check('rouverte : in_progress, completed_at effacé',
  (select status = 'in_progress' and completed_at is null from public.interventions));
select pg_temp.check('historique complet et motivé',
  (select string_agg(to_status::text || coalesce('(' || reason || ')', ''), ' > ' order by id)
   from public.intervention_status_history)
  = 'todo > in_progress > submitted > in_progress(Photo du rapport de mesure manquante) > submitted > done > in_progress(Mesure axe Y erronée)');
select pg_temp.fails('admin : annulation sans motif',
  format('select public.change_intervention_status(%L, ''cancelled'')', :'itv'));
select public.change_intervention_status(:'itv', 'cancelled', 'Machine remplacée');
select pg_temp.check('annulée avec motif',
  (select status = 'cancelled' from public.interventions));

\echo '--- Divers'
select pg_temp.fails('un admin ne change pas son propre rôle',
  'update public.memberships set role = ''technician'' where user_id = auth.uid()');
update public.memberships set role = 'admin' where user_id = '00000000-0000-0000-0000-00000000000c';
select pg_temp.check('un admin peut promouvoir un membre',
  (select role::text from public.memberships where user_id = '00000000-0000-0000-0000-00000000000c') = 'admin');
select pg_temp.fails('chemin de document hors organisation',
  format('select public.create_document(gen_random_uuid(), gen_random_uuid(), ''x'', %L, null, %L, ''x.pdf'')',
         :'cat', :'org2_create_organization' || '/d/x.pdf'));
select pg_temp.fails('upload Storage dans une autre organisation',
  format('insert into storage.objects (bucket_id, name) values (''documents'', %L)', :'org2_create_organization' || '/x/f.pdf'));

\echo '--- Phase 2 : assignation'
select id as eq from public.equipment limit 1 \gset
select pg_temp.fails('assigner à quelqu''un hors de l''organisation',
  format('insert into public.interventions (equipment_id, title, assigned_to) values (%L, ''x'', %L)',
         :'eq', '00000000-0000-0000-0000-00000000000b'));

\echo '--- Phase 3 : tableau de bord'
select pg_temp.check('dashboard : compte le parc de son organisation',
  (public.dashboard_summary() -> 'equipment' ->> 'total')::int
  = (select count(*) from public.equipment where deleted_at is null));
select pg_temp.check('dashboard : intervention annulée non comptée comme ouverte',
  (public.dashboard_summary() -> 'interventions' ->> 'open')::int = 0);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select pg_temp.check('dashboard : org2 ne voit rien d''org1',
  (public.dashboard_summary() -> 'equipment' ->> 'total')::int = 0
  and (public.dashboard_summary() -> 'interventions' ->> 'done_30d')::int = 0);
reset role;
set role anon;
select pg_temp.fails('anonyme : dashboard refusé', 'select public.dashboard_summary()');
reset role;

\echo '--- Phase 4 : documents et versions'
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select pg_temp.check('document créé en v1 avec type et taille lus dans Storage',
  (select current_version = 1 and mime_type = 'application/pdf' and size_bytes = 1024 from public.documents where id = :'doc')
  and (select count(*) = 1 from public.document_versions where document_id = :'doc'));
select pg_temp.fails('écriture directe dans documents interdite',
  format('insert into public.documents (category_id, name, storage_path, mime_type, size_bytes) values (%L, ''x'', %L, ''application/pdf'', 1)',
         :'cat', :'org1_create_organization' || '/d/x.pdf'));
select pg_temp.fails('écriture directe dans document_versions interdite',
  format('insert into public.document_versions (id, document_id, version_number, storage_path, original_filename, mime_type, size_bytes) values (gen_random_uuid(), %L, 9, %L, ''x'', ''a'', 1)',
         :'doc', :'org1_create_organization' || '/' || :'doc' || '/x'));
select pg_temp.fails('le chemin de stockage ne se modifie pas à la main',
  format('update public.documents set storage_path = ''x'' where id = %L', :'doc'));
select pg_temp.fails('enregistrer un fichier absent de Storage',
  format('select public.add_document_version(%L, gen_random_uuid(), %L, ''f.pdf'')',
         :'doc', :'org1_create_organization' || '/' || :'doc' || '/fantome/f.pdf'));
select gen_random_uuid() as ver2 \gset
insert into storage.objects (bucket_id, name, metadata)
  values ('documents', :'org1_create_organization' || '/' || :'doc' || '/' || :'ver2' || '/r2.pdf',
          '{"mimetype":"application/pdf","size":2048}');
select public.add_document_version(:'doc', :'ver2',
  :'org1_create_organization' || '/' || :'doc' || '/' || :'ver2' || '/r2.pdf', 'r2.pdf', 'Mise à jour', current_date + 365);
select pg_temp.check('admin : v2 publiée, fiche à jour (taille, échéance)',
  (select current_version = 2 and size_bytes = 2048 and expires_on = current_date + 365 from public.documents where id = :'doc'));
select public.restore_document_version(:'ver');
select pg_temp.check('restauration = nouvelle v3 pointant vers le fichier de la v1',
  (select current_version = 3 and size_bytes = 1024 from public.documents where id = :'doc')
  and (select comment = 'Restauration de la v1' from public.document_versions where document_id = :'doc' and version_number = 3));
update public.documents set name = 'Rapport renommé' where id = :'doc';
select pg_temp.check('admin : renommer via colonne autorisée',
  (select name = 'Rapport renommé' from public.documents where id = :'doc'));
select pg_temp.fails('supprimer un fichier référencé par une version',
  format('do $x$ begin delete from storage.objects where name = %L; if not found then raise exception ''refusé''; end if; end $x$',
         :'org1_create_organization' || '/' || :'doc' || '/' || :'ver2' || '/r2.pdf'));
insert into storage.objects (bucket_id, name)
  values ('documents', :'org1_create_organization' || '/orphelin/x/o.pdf');
delete from storage.objects where name = :'org1_create_organization' || '/orphelin/x/o.pdf';
select pg_temp.check('supprimer son propre envoi orphelin',
  not exists (select 1 from storage.objects where name = :'org1_create_organization' || '/orphelin/x/o.pdf'));
-- Technicien : peut créer, pas versionner.
update public.memberships set role = 'technician' where user_id = '00000000-0000-0000-0000-00000000000c';
reset role;
update public.memberships set role = 'technician' where user_id = '00000000-0000-0000-0000-00000000000c';
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select gen_random_uuid() as doc3, gen_random_uuid() as ver3 \gset
insert into storage.objects (bucket_id, name)
  values ('documents', :'org1_create_organization' || '/' || :'doc3' || '/' || :'ver3' || '/photo.jpg');
select pg_temp.check('technicien : peut créer un document',
  public.create_document(:'doc3', :'ver3', 'Photo avant intervention', :'cat', null,
    :'org1_create_organization' || '/' || :'doc3' || '/' || :'ver3' || '/photo.jpg', 'photo.jpg') = :'doc3'::uuid);
select pg_temp.fails('technicien : ne peut pas publier de version',
  format('select public.add_document_version(%L, gen_random_uuid(), %L, ''p.jpg'')',
         :'doc3', :'org1_create_organization' || '/' || :'doc3' || '/' || :'ver3' || '/photo.jpg'));
select pg_temp.fails('technicien : ne peut pas renommer',
  format('do $x$ begin update public.documents set name = ''x'' where id = %L; if not found then raise exception ''refusé''; end if; end $x$', :'doc3'));
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select pg_temp.check('org2 ne voit ni documents ni versions d''org1',
  (select count(*) from public.documents) + (select count(*) from public.document_versions) = 0);
reset role;

\echo '--- Phase 5 : notifications quotidiennes'
reset role;
delete from public.notifications;
insert into public.interventions (organization_id, equipment_id, title, assigned_to, due_date)
  select organization_id, id, 'Graissage en retard', '00000000-0000-0000-0000-00000000000c', current_date - 3
  from public.equipment where code = 'TR-4410';
insert into public.interventions (organization_id, equipment_id, title, due_date)
  select organization_id, id, 'Retard sans assigné', current_date - 1
  from public.equipment where code = 'TR-4410';
update public.documents set expires_on = current_date + 10 where id = :'doc';
update public.documents set expires_on = current_date - 2 where id = :'doc3';
select private.generate_daily_notifications() as first_run \gset
select private.generate_daily_notifications() as second_run \gset
select pg_temp.check('job : alertes créées (technicien assigné + admin pour le non assigné + 2 docs)',
  :first_run = 4);
select pg_temp.check('job idempotent : 2e passage ne crée rien', :second_run = 0);
select pg_temp.check('document expiré : message « expiré »',
  exists (select 1 from public.notifications where entity_id = :'doc3' and message like 'Document expiré%'));
select pg_temp.check('le document expirant est à nouveau signalé le jour de son expiration',
  private.generate_daily_notifications(current_date + 11) >= 1);
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select pg_temp.check('technicien : ne voit que ses notifications',
  (select count(*) from public.notifications) = (select count(*) from public.notifications where user_id = auth.uid())
  and (select count(*) from public.notifications) >= 1);
select pg_temp.fails('technicien : ne peut pas modifier le message',
  'update public.notifications set message = ''x''');
update public.notifications set read_at = now() where read_at is null;
select pg_temp.check('technicien : marque ses notifications comme lues',
  not exists (select 1 from public.notifications where read_at is null));
select pg_temp.fails('un utilisateur ne peut pas lancer le job',
  'select private.generate_daily_notifications()');
reset role;

\echo '--- Phase 6 : profil et mot de passe provisoire'
reset role;
update public.profiles set must_change_password = true where id = '00000000-0000-0000-0000-00000000000c';
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
update public.profiles set full_name = 'Charles Tech' where id = auth.uid();
select pg_temp.check('profil : modifier son nom',
  (select full_name = 'Charles Tech' from public.profiles where id = auth.uid()));
select pg_temp.fails('profil : lever soi-même le drapeau « mot de passe à changer »',
  'update public.profiles set must_change_password = false where id = auth.uid()');
select pg_temp.fails('profil : modifier son email affiché',
  'update public.profiles set email = ''faux@x'' where id = auth.uid()');
select pg_temp.fails('profil : modifier le nom d''un autre',
  'do $x$ begin update public.profiles set full_name = ''x'' where id = ''00000000-0000-0000-0000-00000000000a''; if not found then raise exception ''refusé''; end if; end $x$');
reset role;
update auth.users set encrypted_password = 'nouveau-hash' where id = '00000000-0000-0000-0000-00000000000c';
select pg_temp.check('changer réellement de mot de passe lève le drapeau',
  (select not must_change_password from public.profiles where id = '00000000-0000-0000-0000-00000000000c'));

\echo '--- Phase 6b : ajout de membre auto-réparant'
reset role;
insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-00000000000d', 'nana@libre', '{"full_name":"Nana"}');
delete from public.profiles where id = '00000000-0000-0000-0000-00000000000d';
set role service_role;
select pg_temp.check('clé serveur : profil supprimé recréé depuis auth.users (email insensible à la casse)',
  public.ensure_profile_by_email('  NANA@Libre ') = '00000000-0000-0000-0000-00000000000d');
reset role;
select pg_temp.check('profil recréé avec le nom des métadonnées',
  (select full_name = 'Nana' and email = 'nana@libre' from public.profiles where id = '00000000-0000-0000-0000-00000000000d'));
set role service_role;
select pg_temp.check('clé serveur : 2e appel sans doublon',
  public.ensure_profile_by_email('nana@libre') = '00000000-0000-0000-0000-00000000000d');
select pg_temp.check('clé serveur : email inconnu → null',
  public.ensure_profile_by_email('personne@nulle.part') is null);
reset role;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select pg_temp.fails('un utilisateur (même admin) ne peut pas appeler ensure_profile_by_email',
  'select public.ensure_profile_by_email(''x@y.z'')');
reset role;
set role anon;
select pg_temp.fails('anonyme : ensure_profile_by_email refusé',
  'select public.ensure_profile_by_email(''x@y.z'')');
reset role;

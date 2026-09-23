-- Scénarios RLS / règles métier. Usage local : psql -f supabase_shim.sql puis la migration puis ce fichier.
\set ON_ERROR_STOP 0
\set QUIET 1
insert into auth.users (id,email,raw_user_meta_data) values
 ('00000000-0000-0000-0000-00000000000a','alice@org1','{"full_name":"Alice"}'),
 ('00000000-0000-0000-0000-00000000000b','bob@org2','{}'),
 ('00000000-0000-0000-0000-00000000000c','tech@org1','{}'),
 ('00000000-0000-0000-0000-00000000000d','viewer@org1','{}');
set role authenticated;
-- Alice creates org1, Bob creates org2
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select public.create_organization('Org One') \gset org1_
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select public.create_organization('Org Two') \gset org2_
reset role;
-- add tech & viewer to org1 (invitations not built yet → as superuser)
insert into memberships (user_id, organization_id, role)
select '00000000-0000-0000-0000-00000000000c'::uuid, id, 'technician'::app_role from organizations where name='Org One'
union all select '00000000-0000-0000-0000-00000000000d'::uuid, id, 'viewer'::app_role from organizations where name='Org One';
set role authenticated;

\echo '--- T1 Alice (admin org1) creates equipment + intervention assigned to tech'
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into equipment (code,name,criticality) values ('TR-4410','Turbine B',3);
insert into interventions (equipment_id,title,assigned_to,due_date)
 select id,'Inspection arbre','00000000-0000-0000-0000-00000000000c', current_date+1 from equipment where code='TR-4410';
select count(*) as alice_sees_equipment from equipment;

\echo '--- T2 Bob (org2) must see NOTHING of org1'
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select (select count(*) from equipment) eq, (select count(*) from interventions) itv, (select count(*) from audit_log) audit, (select count(*) from document_categories) cats;
\echo '--- T3 Bob tries to insert equipment forcing org1 id (expect RLS error)'
insert into equipment (organization_id,code,name) select id,'HACK','x' from organizations; -- sees only org2 → inserts in org2, fine
insert into equipment (organization_id,code,name) values (:'org1_create_organization','HACK','x');
\echo '--- T4 Bob tries to link org1 equipment to his intervention via composite FK (expect FK error)'
reset role;
select id as org1_eq from equipment where code='TR-4410' \gset
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
insert into interventions (equipment_id,title) values (:'org1_eq','cross-tenant');

\echo '--- T5 Viewer cannot write'
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
insert into equipment (code,name) values ('V-1','viewer eq');
update equipment set name='pwned'; select name from equipment where code='TR-4410';

\echo '--- T6 Tech: notification received, can start, cannot reassign, cannot skip to done w/o report'
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select type, message from notifications;
update interventions set priority='low';
update interventions set status='in_progress';
update interventions set status='done';
update interventions set status='done', work_performed='Roulements remplacés', duration_minutes=90;
select status, started_at is not null started, completed_at is not null completed from interventions;
\echo '--- T7 Done is terminal'
update interventions set status='in_progress';
\echo '--- T8 Status history & audit (as Alice)'
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select from_status, to_status, changed_by is not null by_user from intervention_status_history order by id;
select entity_type, action, count(*) from audit_log group by 1,2 order by 1,2;
\echo '--- T9 Tech cannot read audit log'
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select count(*) tech_audit_rows from audit_log;
\echo '--- T10 Alice cannot change own role; storage path isolation'
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
update memberships set role='viewer' where user_id=auth.uid();
insert into storage.objects (bucket_id,name) values ('documents', :'org2_create_organization' || '/x/file.pdf');
insert into storage.objects (bucket_id,name) values ('documents', :'org1_create_organization' || '/x/file.pdf');
select count(*) alice_objects from storage.objects;
\echo '--- T11 document path must be in own org'
insert into documents (category_id,name,storage_path,mime_type,size_bytes)
 select id,'Manuel',:'org2_create_organization'||'/d/m.pdf','application/pdf',1000 from document_categories limit 1;
insert into documents (category_id,name,storage_path,mime_type,size_bytes)
 select id,'Manuel',:'org1_create_organization'||'/d/m.pdf','application/pdf',1000 from document_categories limit 1;
select count(*) docs from documents;

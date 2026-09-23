# Modèle de données — MVP (v2)

> v2 du 2026-09-23 : fusion de `DATA_MODEL.md` v1 (juillet) et de `SCOPE.md`. En cas de divergence, **SCOPE.md fait foi**.
> Moteur retenu : **PostgreSQL via Supabase** (Auth + Storage + RLS).
> Implémentation : `supabase/migrations/ (3 migrations Phase 0 : init_schema, security_hardening, private_schema)`.

--------------------------------------------------

## Décisions structurantes

1. **Multi-tenant** : toute table métier porte `organization_id`. Oublier ce filtre = fuite de données entre clients.
2. **L'isolation est garantie par la base (RLS)**, pas par le code applicatif. Le client (navigateur) parle directement à Supabase : seule la base est une barrière fiable.
3. **`organization_id` n'est jamais envoyé par le client** : il a pour `DEFAULT private.current_org_id()`, déduit de la session.
4. **FK composites `(organization_id, x_id)`** : impossible de lier une intervention d'une organisation à l'équipement d'une autre, même en cas de bug applicatif.
5. **Règles métier critiques dans des triggers** : transitions de statut, historique, audit, notifications d'assignation.

--------------------------------------------------

## Ce qui a changé par rapport à la v1

| Sujet | v1 | v2 | Raison |
|---|---|---|---|
| Rôles | admin / superviseur / technicien / lecteur | `admin` / `manager` / `technician` / `viewer` | Alignement SCOPE, noms anglais dans le code |
| Utilisateur | table `User` avec `role` et `password_hash` | `auth.users` (Supabase) + `profiles` + `memberships(role)` | Supabase gère les mots de passe ; le rôle est séparé du profil pour qu'un utilisateur ne puisse pas s'auto-promouvoir |
| Statut équipement | operational / warning / critical / maintenance | `in_service` / `broken_down` / `out_of_service` | SCOPE. « Warning » (préventif échu, dérive) devient une **donnée dérivée**, pas un statut saisi |
| Équipement | code, nom, zone, criticité | + `category`, `location` (ex-zone), `commissioned_on` | SCOPE |
| Statut intervention | open / in_progress / closed | `todo` / `in_progress` / `done` / `cancelled` | SCOPE (ajout de l'annulation) |
| Intervention | titre + checklist | + `type`, `priority`, `description`, `due_date`, rapport de clôture | SCOPE |
| Historique des statuts | ❌ | `intervention_status_history` (trigger) | SCOPE — traçabilité |
| Checklist | `status` pending/active/done par étape | `completed_at` seulement ; l'étape « active » est dérivée | Ne pas stocker ce qui se calcule |
| Document | statut draft/valid/obsolete | supprimé ; `expires_on` ajouté | Workflow = phase 2 ; expiration = MVP (SCOPE) |
| Liens document | équipement seulement | `document_equipment` + `document_interventions` | SCOPE |
| Notifications | exclues | table `notifications` | SCOPE |

--------------------------------------------------

## Schéma

```
auth.users ─1:1─ profiles
     │
     └─1:1 (MVP)─ memberships ─N:1─ organizations
                   (role)              │
        ┌───────────────┬──────────────┼──────────────────┬──────────────┐
        ▼               ▼              ▼                  ▼              ▼
    equipment   document_categories  notifications    audit_log     (toutes les tables
        │               │            (user_id)       (générique)     portent organization_id)
        │1:N            │1:N
        ▼               ▼
  interventions ◄──N:N── documents ──N:N──► equipment
     │      │   (document_interventions)   (document_equipment)
     │1:N   │1:N
     ▼      ▼
  steps   status_history
```

--------------------------------------------------

## Entités

### organizations
`id` · `name` · `created_at`

### profiles
`id` (= auth.users.id) · `full_name` · timestamps. Créé automatiquement à l'inscription.

### memberships
`user_id` · `organization_id` · `role` (`app_role`) · `deleted_at`.
`UNIQUE(user_id)` = une organisation par utilisateur au MVP. Retirer la contrainte suffira pour le multi-organisations.

### equipment
| Champ | Type | Contrainte |
|---|---|---|
| code | text | unique par organisation (insensible à la casse, hors supprimés) |
| name | text | not null |
| category | text | nullable — texte libre au MVP |
| location | text | nullable — texte libre (hiérarchie Site/Zone = phase 2) |
| status | enum | `in_service` \| `broken_down` \| `out_of_service` |
| criticality | smallint | 1–3 |
| commissioned_on | date | nullable |
| deleted_at | timestamptz | suppression logique (pas de DELETE autorisé) |

### interventions
| Champ | Type | Contrainte |
|---|---|---|
| equipment_id | uuid | FK composite vers equipment |
| type | enum | `corrective` \| `preventive` |
| priority | enum | `low` \| `normal` \| `high` \| `urgent` |
| status | enum | `todo` → `in_progress` → `done` ; `cancelled` depuis todo/in_progress |
| title, description | text | |
| assigned_to | uuid | FK auth.users, nullable |
| due_date | date | nullable |
| started_at, completed_at | timestamptz | **renseignés par trigger** |
| work_performed, duration_minutes, parts_used | | rapport ; `work_performed` obligatoire pour passer à `done` |

### intervention_status_history
`from_status` · `to_status` · `changed_by` · `changed_at`. Écrite uniquement par trigger.

### intervention_steps
`position` · `title` · `completed_by` · `completed_at`. Optionnelle.

### document_categories
Table par organisation (6 catégories par défaut créées à l'onboarding : Manuel, Procédure, Certificat, Rapport, Plan, Contrat).

### documents
| Champ | Type | Contrainte |
|---|---|---|
| category_id | uuid | FK composite |
| name | text | |
| storage_path | text | `{organization_id}/{document_id}/{fichier}` — vérifié par CHECK |
| mime_type, size_bytes | | ≤ 50 Mo |
| expires_on | date | nullable (certificats, contrôles réglementaires) |
| deleted_at | timestamptz | suppression logique |

### document_equipment / document_interventions
Tables de jonction, PK composites. Deux tables plutôt qu'une table polymorphe `DocumentLink` : vraies FK, pas de colonnes nullables, pas de CHECK « exactement une des deux ».

### notifications
`user_id` · `type` (`intervention_assigned` \| `intervention_overdue` \| `document_expiring`) · `entity_type` · `entity_id` · `message` · `read_at`.

### audit_log
`user_id` · `action` (insert/update/delete) · `entity_type` · `entity_id` · `changes` (jsonb : ligne complète à la création, diff `{old,new}` à la modification). Alimenté par trigger sur equipment, interventions, documents.

--------------------------------------------------

## Permissions (RLS)

| | admin | manager | technician | viewer |
|---|---|---|---|---|
| Lire les données de son organisation | ✅ | ✅ | ✅ | ✅ |
| Créer / modifier équipements | ✅ | ✅ | ❌ | ❌ |
| Créer / assigner interventions | ✅ | ✅ | ❌ | ❌ |
| Faire avancer **son** intervention + rapport | ✅ | ✅ | ✅ (statut et rapport uniquement) | ❌ |
| Déposer des documents | ✅ | ✅ | ✅ | ❌ |
| Modifier documents | ✅ | ✅ | ❌ | ❌ |
| Gérer catégories, rôles | ✅ | ❌ | ❌ | ❌ |
| Lire le journal d'audit | ✅ | ✅ | ❌ | ❌ |
| Notifications | les siennes uniquement | | | |

Fichiers : bucket privé `documents`, accès par URL signée, policy Storage sur le premier segment du chemin (= `organization_id`).

--------------------------------------------------

## Index

Toujours préfixés par `organization_id` : `(organization_id, status)` équipements, `(organization_id, status, due_date)` interventions, `(organization_id, expires_on)` documents, `(user_id) WHERE read_at IS NULL` notifications. Recherche par nom/code : index trigram (`pg_trgm`) pour `ILIKE '%…%'`.

--------------------------------------------------

## Vérification

Testé sur PostgreSQL 16 avec un shim Supabase (11 scénarios) : isolation entre organisations, FK cross-tenant rejetée, viewer en lecture seule, technicien limité au statut/rapport, `done` impossible sans rapport, états terminaux, historique et audit automatiques, un admin ne peut pas changer son propre rôle, chemin Storage/document hors organisation rejeté.

--------------------------------------------------

## Pas encore couvert (étapes suivantes)

- **Invitations** : ajouter un utilisateur à une organisation existante (Edge Function + email).
- **Notifications « en retard » / « expire bientôt »** : job planifié quotidien (`pg_cron`).
- **Hiérarchie Site → Zone**, versionning, workflow de validation, pièces détachées : phase 2 (voir `ROADMAP.md`).

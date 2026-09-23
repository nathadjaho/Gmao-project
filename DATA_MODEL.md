# Modèle de données — MVP

> Modèle conceptuel/logique, indépendant du moteur de base de données (le choix du moteur — Postgres, SQLite/D1, etc. — est une décision séparée, pas encore prise).
> Périmètre : MVP tel que défini dans `ROADMAP.md` §3. Tout ce qui est volontairement exclu est listé en fin de document avec la raison.
> Dernière mise à jour : 2026-07-10.

--------------------------------------------------

## Décision structurante : multi-tenant

La plateforme héberge plusieurs entreprises clientes (organisations) sur une même instance. **Toute entité métier porte donc un `organization_id`**, et toute requête applicative doit filtrer par organisation — c'est la règle de sécurité n°1 de ce modèle : l'oubli d'un filtre `organization_id` est une fuite de données entre clients, pas un simple bug.

--------------------------------------------------

## Entités

### Organization
| Champ | Type | Contrainte |
|---|---|---|
| id | UUID | PK |
| name | text | not null |
| created_at | timestamp | not null |

### User
| Champ | Type | Contrainte |
|---|---|---|
| id | UUID | PK |
| organization_id | UUID | FK → Organization, not null |
| email | text | unique (global), not null |
| name | text | not null |
| role | enum | `admin` \| `superviseur` \| `technicien` \| `lecteur` |
| password_hash | text | nullable (selon fournisseur d'auth retenu) |
| created_at | timestamp | not null |
| deleted_at | timestamp | nullable (soft delete) |

### DocumentCategory
| Champ | Type | Contrainte |
|---|---|---|
| id | UUID | PK |
| organization_id | UUID | FK → Organization, not null |
| name | text | not null |
| | | unique (organization_id, name) |

### Document
| Champ | Type | Contrainte |
|---|---|---|
| id | UUID | PK |
| organization_id | UUID | FK → Organization, not null |
| category_id | UUID | FK → DocumentCategory, not null |
| name | text | not null |
| file_key | text | not null (pointeur vers le stockage objet) |
| file_type | text | not null |
| file_size | integer | not null |
| status | enum | `draft` \| `valid` \| `obsolete` |
| uploaded_by | UUID | FK → User, not null |
| created_at | timestamp | not null |
| updated_at | timestamp | not null |
| deleted_at | timestamp | nullable (soft delete) |

### DocumentEquipment (table de jonction N—N)
| Champ | Type | Contrainte |
|---|---|---|
| document_id | UUID | FK → Document |
| equipment_id | UUID | FK → Equipment |
| | | PK composite (document_id, equipment_id) |

Un document peut couvrir plusieurs équipements (ex : une procédure générique pour tous les compresseurs), un équipement peut avoir plusieurs documents. D'où la table de jonction plutôt qu'une FK directe.

### Equipment
| Champ | Type | Contrainte |
|---|---|---|
| id | UUID | PK |
| organization_id | UUID | FK → Organization, not null |
| code | text | not null, unique (organization_id, code) |
| name | text | not null |
| zone | text | nullable — texte libre pour le MVP (voir exclusions) |
| criticality | smallint | 1, 2 ou 3 |
| status | enum | `operational` \| `warning` \| `critical` \| `maintenance` |
| created_at | timestamp | not null |
| updated_at | timestamp | not null |
| deleted_at | timestamp | nullable (soft delete) |

### Intervention (ordre de travail)
| Champ | Type | Contrainte |
|---|---|---|
| id | UUID | PK |
| organization_id | UUID | FK → Organization, not null |
| equipment_id | UUID | FK → Equipment, not null |
| title | text | not null |
| status | enum | `open` \| `in_progress` \| `closed` |
| assigned_to | UUID | FK → User, nullable |
| started_at | timestamp | nullable |
| closed_at | timestamp | nullable |
| created_at | timestamp | not null |

### InterventionStep
| Champ | Type | Contrainte |
|---|---|---|
| id | UUID | PK |
| intervention_id | UUID | FK → Intervention, not null |
| position | integer | not null (ordre d'affichage) |
| title | text | not null |
| status | enum | `pending` \| `active` \| `done` |
| completed_by | UUID | FK → User, nullable |
| completed_at | timestamp | nullable |

### AuditLog
| Champ | Type | Contrainte |
|---|---|---|
| id | UUID | PK |
| organization_id | UUID | FK → Organization, not null |
| user_id | UUID | FK → User, nullable (nullable si action système) |
| action | text | ex: `created`, `updated`, `deleted`, `signed` |
| entity_type | text | ex: `document`, `equipment`, `intervention` |
| entity_id | UUID | not null |
| metadata | json | nullable (diff avant/après, contexte) |
| created_at | timestamp | not null |

--------------------------------------------------

## Cardinalités — résumé

- Organization 1—N { User, Equipment, DocumentCategory, Document, Intervention, AuditLog }
- DocumentCategory 1—N Document
- Document N—N Equipment (via DocumentEquipment)
- Equipment 1—N Intervention
- Intervention 1—N InterventionStep
- User 1—N Intervention (assigned_to), 1—N Document (uploaded_by), 1—N InterventionStep (completed_by), 1—N AuditLog

--------------------------------------------------

## Choix de conception et justifications

- **Clés primaires en UUID plutôt qu'en entier auto-incrémenté.** En multi-tenant, des IDs séquentiels globaux permettent de deviner le volume de données d'un client (`/equipment/1248` laisse deviner qu'il y a ~1248 équipements) et facilitent l'énumération d'IDs d'un autre tenant (IDOR). Les UUID évitent ces deux problèmes et simplifient une future fusion/export de données entre environnements.
- **Soft delete (`deleted_at`) plutôt que suppression physique** sur les entités métier (User, Document, Equipment). La traçabilité et l'historique sont un pilier explicite de la vision produit (`CLAUDE.md` — "Base de données : Historique, Audit, Versionning") : une suppression physique casse l'audit trail et les références passées (ex: un `AuditLog` qui pointe vers un équipement supprimé). Ce n'est pas de la sur-ingénierie : c'est une exigence du produit, pas une anticipation spéculative.
- **`role` en enum sur `User` plutôt qu'un système de permissions à table séparée.** Le MVP (`ROADMAP.md` §3) demande des "permissions minimales" — un rôle par utilisateur suffit. Un vrai moteur RBAC (permissions fines par site/catégorie) est explicitement en backlog §4 ; l'introduire maintenant serait une abstraction prématurée sans cas d'usage validé (YAGNI).
- **`DocumentCategory` en table plutôt qu'en enum figé.** Contrairement au rôle utilisateur, la catégorisation documentaire est cœur de valeur produit (c'est un GED) et varie probablement d'une entreprise à l'autre — le coût de la modéliser en table est minime (une table, une FK) pour un vrai gain de flexibilité dès le MVP.
- **`zone` en simple champ texte sur `Equipment`, pas de hiérarchie Site/Zone/Ligne normalisée.** La UI actuelle affiche déjà des zones (`"Atelier B · Ligne 4"`) mais toujours comme texte. Normaliser cette hiérarchie est utile (filtres, permissions par site) mais n'est pas requis par le MVP — c'est en backlog §4 ("Arborescence de parc"). Le champ texte est un chemin de migration simple : on pourra l'remplacer par une FK vers une table `Zone` sans perdre de données, une fois le besoin confirmé.
- **`AuditLog` générique (`entity_type` + `entity_id`) plutôt qu'une table de log par entité.** Évite de dupliquer la même structure 5 fois ; `entity_type`/`entity_id` est un compromis classique quand le besoin (tracer *toute* action sur *toute* entité) est transverse dès le départ.

--------------------------------------------------

## Volontairement exclu du MVP (voir `ROADMAP.md` §4 backlog)

- Hiérarchie Site → Zone → Ligne normalisée (actuellement : simple texte)
- Versionning de documents (numéro de révision, historique des versions, rollback)
- Workflow de validation multi-niveaux (brouillon → relecture → approuvé)
- Signature électronique
- RBAC fin (permissions par site/catégorie, délégation temporaire)
- Table de notifications dédiée (règles, canaux)
- Modèles de checklist réutilisables (pour l'instant, les étapes d'intervention sont propres à chaque intervention)

Ces exclusions ne sont pas des oublis — les ajouter maintenant demanderait de modéliser des cas d'usage qu'on n'a pas encore validés avec un vrai utilisateur. Elles seront ajoutées quand leur phase respective (`ROADMAP.md` §5) démarrera.

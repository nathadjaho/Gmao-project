# ROADMAP — GMAO / GED

> Document vivant. À revoir à chaque changement de périmètre majeur, pas à chaque sprint.
> Dernière mise à jour : 2026-07-09.

--------------------------------------------------

## 1. Vision produit

Construire la source unique de vérité documentaire d'une entreprise industrielle : centraliser procédures, manuels, plans, certificats, rapports, documents qualité/HSE et documentation de maintenance, avec organisation, recherche, versionning, validation, permissions et traçabilité.

**Positionnement** : la simplicité d'usage d'un outil grand public, la rigueur d'un GED/GMAO d'entreprise. On ne rivalise pas avec SAP PM ou GLPI sur la couverture fonctionnelle jour 1 — on rivalise sur la vitesse à laquelle un technicien trouve le bon document ou clôture une intervention.

**Utilisateurs cibles** :
- Technicien / opérateur terrain (consulte des documents, exécute des interventions guidées)
- Superviseur / responsable maintenance (supervise le parc, valide, arbitre les priorités)
- Référent qualité / HSE (dépose, versionne, fait valider la documentation réglementaire)
- Administrateur (gère utilisateurs, permissions, structure documentaire)

--------------------------------------------------

## 2. État actuel (baseline au 2026-07-09)

Scaffold frontend généré par Lovable, aucune persistance réelle :

- Stack : TanStack Start (React 19) + TanStack Router/Query + Tailwind v4 + shadcn/ui, déploiement Cloudflare Workers.
- 5 écrans stubés avec **données 100 % mockées en dur dans les composants** : Dashboard, Documents, Équipements (liste + fiche détail), Intervention (checklist), Notifications.
- Aucun backend, aucune base de données, aucune authentification, aucun stockage de fichiers.
- React Query et zod sont installés mais non utilisés (aucun appel réseau, aucune validation de formulaire).
- Aucun test, aucune CI.

Cette base sert de **maquette haute-fidélité** : elle valide déjà le design system et les parcours UX. L'essentiel du travail à venir est de la brancher sur du réel.

--------------------------------------------------

## 3. MVP (Minimum Viable Product)

Objectif du MVP : qu'une entreprise puisse utiliser la plateforme avec **ses vraies données** pour au moins un cas d'usage complet (déposer un document, l'associer à un équipement, le retrouver, exécuter une intervention tracée). Pas de fonctionnalité avancée — juste du réel plutôt que du mocké.

- [ ] **Authentification & autorisation** : login, sessions, rôles de base (admin / superviseur / technicien / lecteur)
- [ ] **Modèle de données réel** : équipements, documents, interventions, utilisateurs, avec relations (voir schéma à définir séparément)
- [ ] **Stockage de fichiers réel** : upload/téléchargement de documents (PDF, DWG, images), pas de placeholders
- [ ] **CRUD équipements** : créer/modifier/lister/consulter une fiche équipement réelle
- [ ] **CRUD documents** : upload, catégorisation, association à un ou plusieurs équipements, téléchargement
- [ ] **Interventions réelles** : checklist dynamique (pas hardcodée), horodatage des étapes, clôture
- [ ] **Recherche basique** : par nom, catégorie, équipement lié (pas encore plein texte)
- [ ] **Permissions minimales** : qui peut voir/modifier/valider quoi, selon le rôle
- [ ] **Historique minimal** : qui a fait quoi et quand sur un document/une intervention (audit trail basique)

Tant que ces points ne sont pas faits, toute fonctionnalité de la section 4 est prématurée (YAGNI).

--------------------------------------------------

## 4. Backlog (post-MVP, par domaine)

### Documents
- Versionning (historique des révisions, comparaison, rollback)
- Workflow de validation multi-niveaux (brouillon → relecture → approuvé)
- Statuts de cycle de vie (en vigueur / obsolète / archivé)
- Signature électronique
- Recherche plein texte (contenu des PDF, pas seulement les métadonnées)
- OCR sur documents scannés

### Équipements
- Arborescence de parc (site → zone → ligne → équipement)
- Historique de maintenance complet par équipement
- Import/export en masse (CSV réel, pas juste le bouton)
- Codes-barres / QR codes pour accès terrain rapide

### Interventions
- Modèles de checklist réutilisables par type d'équipement/intervention
- Pièces jointes (photos, mesures) persistées et liées à l'étape
- Verrouillage anti-fraude après signature (déjà esquissé en UI, à rendre réel)
- Planification préventive (génération automatique d'OT selon échéancier)

### Utilisateurs & permissions
- Rôles fins par périmètre (site, zone, catégorie documentaire)
- Délégation temporaire de droits
- Journalisation complète des accès

### Notifications
- Notifications temps réel (pas juste une liste statique)
- Canaux : in-app, email, push
- Règles de notification configurables par rôle/événement

### Recherche & IA documentaire
- Recherche plein texte multi-critères
- Classification automatique des documents déposés
- Extraction d'informations clés (dates de validité, références normatives, etc.)

### Reporting
- Tableaux de bord configurables (au-delà des KPIs fixes actuels)
- Export de rapports (PDF/Excel)

### Intégrations
- API publique
- Connecteurs ERP / GMAO / CRM tiers

--------------------------------------------------

## 5. Priorités (séquencement proposé)

| Phase | Contenu | Objectif |
|---|---|---|
| **Phase 0 — Fondations** | Auth, schéma de base de données, stockage de fichiers | Sortir du tout-mocké |
| **Phase 1 — MVP** | CRUD réel équipements/documents/interventions, permissions minimales, historique basique | Premier usage réel en entreprise pilote |
| **Phase 2 — Workflow documentaire** | Versionning, validation multi-niveaux, statuts de cycle de vie | Répondre aux exigences qualité/HSE |
| **Phase 3 — Recherche avancée** | Recherche plein texte, OCR | Réduire le temps de recherche documentaire |
| **Phase 4 — IA documentaire** | Classification automatique, extraction d'informations | Réduire l'effort de saisie manuelle |
| **Phase 5 — Écosystème** | Signature électronique, API publique, intégrations ERP/GMAO/CRM | Ouvrir la plateforme vers l'extérieur |

Une phase ne démarre pas tant que la précédente n'a pas de valeur livrée et utilisée — pas de travail en parallèle sur plusieurs phases par anticipation (YAGNI).

--------------------------------------------------

## 6. Fonctionnalités futures (vision long terme, non séquencées)

Reprises telles quelles de la vision produit — à replacer dans une phase (section 5) seulement quand elles deviennent pertinentes :

- GED complète
- Workflow documentaire avancé
- Validation multi-niveaux
- Signature électronique
- Versionning avancé
- OCR
- Recherche plein texte
- IA documentaire
- Classification automatique
- Extraction d'informations
- Moteur de recherche documentaire
- Tableaux de bord avancés
- Notifications multi-canal
- API publique
- Intégrations ERP / GMAO / CRM

--------------------------------------------------

## 7. Dette technique (anticipée)

Le projet est trop jeune pour avoir de la vraie dette accumulée — mais l'état actuel contient des choix qui **deviendront** de la dette s'ils ne sont pas corrigés avant d'empiler des fonctionnalités dessus :

- **Données hardcodées dans les composants de route** : aucune séparation données/UI. À extraire vers une couche de données (React Query + API) dès la Phase 0, avant d'ajouter le moindre CRUD réel.
- **React Query installé mais inutilisé** : aucun appel réseau n'existe encore. Le brancher dès les premières API réelles pour éviter du fetch ad hoc dispersé dans les composants.
- **Aucune authentification** : toutes les routes sont actuellement publiques côté client. Il faudra un guard de route + vérification serveur (pas de confiance au client) avant d'exposer la moindre donnée réelle.
- **zod installé mais inutilisé** : aucune validation de formulaire. À mettre en place dès le premier formulaire réel (ajout équipement, upload document) pour éviter de la validation ad hoc dupliquée.
- **Aucun test, aucune CI** : acceptable pour une maquette, plus pour du code qui gère des permissions et du versionning documentaire. À introduire avant la Phase 2 (workflow de validation), où les bugs de logique métier coûtent cher.
- **Nom de produit "ForgeOS GMAO"** utilisé dans les titres de page (`<title>`) : à confirmer si c'est le nom définitif du produit ou un placeholder généré par Lovable, avant de le propager plus loin (metadata, emails, etc.).

--------------------------------------------------

## 8. Comment utiliser ce document

- La section 3 (MVP) est la seule qui doit guider le travail à court terme.
- La section 4 (Backlog) est une réserve d'idées, pas un engagement.
- La section 5 (Priorités) se met à jour à chaque fin de phase, pas à chaque tâche.
- La section 7 (Dette technique) se relit avant chaque nouvelle phase pour décider ce qui doit être corrigé avant d'avancer.

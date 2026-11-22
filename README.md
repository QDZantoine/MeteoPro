# MétéoPro

API météo, fil rouge de la formation **REST API : bonnes pratiques et sécurité** (M2i, SEC-RESTAPI).

Choix techniques : Node.js exécute directement le TypeScript (pas de compilation, pas de `tsx`), les tests utilisent le lanceur intégré `node --test`, et le projet n'a que **2 dépendances d'exécution** (`express`, `zod`) et **3 de développement** (`typescript`, `@types/express`, `@types/node`, pour la vérification des types). Aucun Docker, Python ni pnpm requis.

## Installer le poste (VM Windows)

PowerShell lancé en administrateur, depuis le dossier du projet :

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\scripts\install-windows.ps1     # Node.js LTS, VS Code, Git, Insomnia, puis npm install
.\scripts\verifier-poste.ps1
```

Option `-Zap` : ajoute OWASP ZAP (facultatif, TP 4). Copier `.env.example` en `.env` : il est lu au démarrage.
Dans PowerShell, `curl` est un alias d'`Invoke-WebRequest` : utiliser `curl.exe`.

## Commandes

| Commande | Rôle |
| --- | --- |
| `npm run dev` | API sur http://localhost:3000, redémarre à chaque modification |
| `npm test` | Tests (`node --test`) |
| `npm run typecheck` | TypeScript strict (`tsc`, sans génération de fichiers) |
| `npm run audit-api` | API volontairement vulnérable du TP 4 sur http://localhost:5000 |

Outils ponctuels lancés avec `npx`, sans les ajouter au projet : `npx @stoplight/spectral-cli lint openapi.yaml` (TP 3), `npx @stoplight/prism-cli mock openapi.yaml` (bonus).

Contraintes du TypeScript natif (vérifiées par `tsc` grâce à `erasableSyntaxOnly`) : imports avec l'extension `.ts`, `import type` pour les types, pas d'`enum` ni de propriétés déclarées dans les paramètres du constructeur.

## Branches

| Branche | Contenu |
| --- | --- |
| `start` | Squelette du TP 2 et API d'audit du TP 4 |
| `j1-solution` | Corrigé du jour 1 : routes, validation, erreurs RFC 9457, pagination, OpenAPI, Scalar |
| `main` | Corrigé du jour 3 : API sécurisée (OIDC, JWT, permissions, BOLA, rate limiting, logs, révocation) |

## TP 2 : créer l'API MétéoPro

Fourni : Express 5, TypeScript strict, le gestionnaire d'erreurs RFC 9457 (`src/shared/errors.ts`), la route `/health` et ses tests.

À faire :

1. `GET /v1/cities/{cityId}/forecast` : prévisions d'une ville de `data/cities.json`, à partir de l'API Open-Meteo (sans clé). Valider la réponse d'Open-Meteo avant de la renvoyer.
2. CRUD `/v1/alerts` : `POST`, `GET` (liste), `GET /{id}`, `PATCH /{id}`, `DELETE /{id}`, stockage en mémoire.
3. Validation des entrées avec Zod : `cityId` connu, `threshold` entier entre -50 et 60, `unit` parmi `celsius` et `fahrenheit`. Les champs inconnus sont refusés (422).
4. Pagination par curseur sur la liste : `limit` (1 à 100, 20 par défaut) et `cursor` opaque.
5. DTO de sortie : ne jamais renvoyer l'entité stockée telle quelle.
6. Au moins 3 tests : création (201 + `Location`), validation (422), ressource absente (404).

Réseau de salle filtré : `METEO_OFFLINE=true` dans `.env` renvoie des prévisions d'exemple.

## TP 4 : auditer une API vulnérable

`npm run audit-api` démarre `audit/server.ts` sur le port 5000 : une petite API de gestion de comptes et de stations météo qui contient volontairement des failles du Top 10 OWASP API 2023. Comptes : `alice` / `alice2024`, `bob` / `bob2024`. **Ne pas lire le code source avant la fin de l'audit** : le TP se fait en boîte noire, avec Insomnia ou `curl.exe`.

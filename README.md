# Frontend-Studio
# Frontend Studio — Complete Build Guide

> A beginner-friendly, production-oriented guide to centralizing frontend templates in one gallery using **Next.js for the platform UI**, **Express for the API**, and **MongoDB for application data**.
>
> The project is divided into two phases:
>
> - **Phase 1 — Manual template management:** an admin registers templates, organizes their source folders, chooses approved build settings, runs builds, reviews previews, and publishes. No AI key or model is required.
> - **Phase 2 — Optional local AI assistant:** a self-hosted model analyzes templates and suggests metadata/configuration. Manual management remains available permanently.

This README is both the architecture document and the implementation checklist. Build the sections in order; do not implement the whole platform at once.

---

## Contents

1. [What are we building?](#1-what-are-we-building)
2. [Repository we are centralizing](#2-repository-we-are-centralizing)
3. [Technology choices](#3-technology-choices)
4. [How the system works](#4-how-the-system-works)
5. [The two phases](#5-the-two-phases)
6. [Folder structure, file by file](#6-folder-structure-file-by-file)
7. [Database design](#7-database-design)
8. [API design](#8-api-design)
9. [Packages and their purpose](#9-packages-and-their-purpose)
10. [Local development setup](#10-local-development-setup)
11. [Phase 1 implementation plan](#11-phase-1-implementation-plan)
12. [Docker: where and why](#12-docker-where-and-why)
13. [Building and previewing templates](#13-building-and-previewing-templates)
14. [Phase 2: local AI without a paid API key](#14-phase-2-local-ai-without-a-paid-api-key)
15. [Performance and database optimization](#15-performance-and-database-optimization)
16. [Security requirements](#16-security-requirements)
17. [Testing strategy](#17-testing-strategy)
18. [Deployment and operations](#18-deployment-and-operations)
19. [Completion checklists](#19-completion-checklists)
20. [Beginner glossary](#20-beginner-glossary)
21. [Official references](#21-official-references)

---

## 1. What are we building?

We are building a private **Frontend Studio** platform with a public template gallery and a protected admin portal.

### Public gallery

Visitors can:

- Browse published templates.
- Search by name, category, framework, and tags.
- Open a template's description and screenshots.
- Open a live preview of a published template.
- See only published templates. Drafts and failed builds must never appear publicly.

### Admin portal

An authenticated administrator can:

- Create a template record and a managed folder for its source.
- Manually import a template from the existing GitHub repository or an archive.
- Enter the title, description, category, tags, framework and approved build profile.
- Start a validation/build job.
- Inspect progress, sanitized logs, validation results and screenshots.
- Publish a successful version, unpublish it, or roll back to an earlier version.
- See who made important changes and when.

### What “manual” means in Phase 1

**Manual does not mean the admin should type any server path or arbitrary shell command.** The admin controls the import and supplies metadata/build settings; the application creates a safe managed version folder based on a server-generated template ID.

If you specifically want the administrator to create the original folder manually during the first phase, support this workflow: the admin/developer manually creates or copies the template folder inside a configured staging/source library, then imports it through a controlled CLI command or an admin UI that exposes only approved source-folder choices. The platform copies the source into its own versioned workspace. Do not accept an arbitrary absolute filesystem path from a browser. A later portal flow can create the metadata/workspace folder for the admin while keeping the source selection/manual configuration step unchanged.

A normal Phase 1 workflow is:

1. Admin clicks **Create template** and enters metadata.
2. Express validates the form and generates a safe slug, for example `ai-agency`.
3. The backend creates a template record and a managed workspace under the configured storage root.
4. The admin copies the chosen source folder from the existing repository or uses the approved archive-import flow.
5. The admin reviews the project and selects a supported build profile.
6. The admin starts a build. The API creates a job; a background worker processes it.
7. A restricted build runner executes the approved profile in an isolated environment.
8. The admin reviews the preview and publishes the successful version.

Phase 1 needs **no AI API key and no model**.

### Important distinction

The platform itself uses Next.js. That does **not** mean every imported template is a Next.js app. Your source templates may use different tools. Inventory each one before choosing a build profile.

### Initial scope

Start with known templates that can be built to static HTML/CSS/JS output. Add server-rendered templates (for example, a Next.js project requiring a persistent server) only after dedicated runtime isolation and preview routing are designed.

Do not build a public service that executes arbitrary uploaded code. Template imports should be admin-only until the security model is proven.

---

## 2. Repository we are centralizing

Existing source repository:

**https://github.com/mannrandhawa004/frontend_designs**

The repository's visible root currently contains these folders:

- `3D_sphere_ball`
- `ai_agency`
- `design_1`
- `pixel_ai`
- `real_state_design`

It also contains `.gitignore`. These names do not tell us what framework each project uses. Inspect each folder instead of assuming that all templates have the same structure.

### 2.1 Clone and inspect the repository

```bash
git clone https://github.com/mannrandhawa004/frontend_designs.git
cd frontend_designs

# List files without including installed node_modules.
find . -maxdepth 4 -type f -not -path '*/node_modules/*' | sort

# Find every package manifest.
find . -name package.json -not -path '*/node_modules/*' -print
```

For each folder, record:

- Whether `package.json` exists.
- Framework (Vite, Next.js, plain HTML, or another framework).
- Package manager and lockfile (`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`).
- Build script and output directory (`dist`, `out`, etc.).
- Required environment-variable **names** (never write secret values in the inventory).
- Whether the template can be static or needs a running server.
- Whether client-side routes need a fallback rule.
- Whether there is a README and license/ownership information.

Do not delete a template's lockfile just to make all templates look alike. A lockfile belongs to its own project and is used for reproducible dependency installation.

### 2.2 Keep the source library and platform logically separate

Treat these as separate concerns:

- `frontend_designs`: the original source library.
- `frontend-studio`: the platform that manages catalog records, versions, builds, previews and publication.

The platform should store provenance such as repository URL, branch, commit SHA and original relative folder. It must not depend on a developer's absolute local path such as `/home/person/Desktop/...`.

For initial migration, a trusted admin/developer can clone the repository and import one folder at a time. Later, add a controlled Git import workflow. Do not let arbitrary public users submit arbitrary Git URLs; unrestricted fetching can create SSRF and untrusted-code risks.

### 2.3 Make an inventory before importing

Create `docs/template-inventory.md` with these columns:

| Field | Why it matters |
|---|---|
| Original folder | Relates the imported record to the source repository |
| Display name and description | Gallery metadata |
| Framework/profile | Determines the approved build pipeline |
| Package manager and lockfile | Makes dependency installation reproducible |
| Build output folder | Tells the preview publisher which assets to publish |
| Static or server runtime | Determines how preview isolation must work |
| Environment-variable names | Shows configuration requirements without exposing secrets |
| Import status | Tracks migration progress |

Do not guess framework/build settings from folder names.

---

## 3. Technology choices

Use one monorepo managed by npm workspaces. A monorepo means related applications live in one Git repository but remain separate packages.

| Part | Technology | Purpose |
|---|---|---|
| Web UI | Next.js App Router + React + TypeScript | Public gallery and protected admin pages |
| API | Node.js + Express + TypeScript | Authentication, templates, versions, jobs and publication endpoints |
| Database | MongoDB + Mongoose | Structured metadata and relationships |
| Validation | Zod | Runtime validation of HTTP inputs and shared data shapes |
| Background jobs | BullMQ + Redis | Runs lengthy work away from HTTP request handling |
| Build isolation | Docker runner on a separated builder environment | Executes dependency installation/build in disposable containers |
| File storage | Local managed folder for development; durable volume/object storage in production | Source snapshots, build artifacts, screenshots, logs |
| Logging | Pino + pino-http | Structured service logs |
| API tests | Vitest + Supertest | Unit and HTTP integration tests |
| Browser tests | Playwright | Checks real pages and captures screenshots |
| CI | GitHub Actions | Tests/lint/build on pushes and pull requests |
| Local AI in Phase 2 | Ollama or another local inference server | Optional local model, without a paid model API |

### Why Next.js?

You want to learn Next.js. Its App Router provides file-system routing, layouts, loading/error boundaries, Server Components and route metadata. It fits a public catalog and admin interface.

### Why use Express as well?

The project intentionally separates the web UI from its management API. Express owns the business rules and can later be used by the Next.js app, a CLI or automation tools. Avoid implementing the same database logic separately in Next.js Route Handlers and Express. Express is the authoritative API.

### Why MongoDB?

The core records are metadata and references to source/artifact files. Mongoose adds schemas, validation and indexes. Do not store ZIP files, entire source trees or build outputs inside MongoDB documents; store their logical storage keys and metadata.

### Runtime baseline

As of October 2026, Node.js 24 is an Active LTS line. Use a currently supported Node.js LTS release compatible with the installed Next.js version. Pin the major version in `.nvmrc`, `engines` and Docker images. Avoid unpinned `node:latest` in production. Re-check the official release schedule when starting or upgrading the project.

---

## 4. How the system works

### 4.1 Logical architecture

```text
Browser (HTTPS)
      |
      v
Reverse proxy / ingress
      |                                  \
      | /                                  \ /api/v1/*
      v                                      v
Next.js web app                         Express API
(public + admin UI)                          |
                                             | validates request and permissions
                                             | reads/writes metadata
                                             | creates an import/build job
                                             v
                                       MongoDB + Redis
                                             |
                                      BullMQ background job
                                             |
                                             v
                                       Worker/orchestrator
                                             |
                                 restricted build specification
                                             v
                                      Isolated runner
                                             |
                                  build artifacts, logs, result
                                             v
                                  Storage + preview publisher
                                             |
                                             v
                                  Published gallery template
```

MongoDB stores structured metadata. Redis holds queue state. Source files, output assets, screenshots and logs live in storage. The runner is isolated because dependency lifecycle scripts and template code can execute commands. Even code from a personal repository must be treated carefully.

### 4.2 Example: publish one template manually

1. Admin opens `/admin/templates/new`.
2. The Next.js form sends validated metadata to `POST /api/v1/admin/templates`.
3. Express authenticates the admin, validates the request and generates a safe slug.
4. Express writes a `templates` record and a `templateVersions` record (or creates the initial version in a dedicated import service).
5. Source files are copied/uploaded to a server-generated workspace such as `storage/templates/<template-id>/versions/1/source/`.
6. The admin selects an approved build profile.
7. `POST /api/v1/admin/templates/:id/versions/:versionId/build` creates a job and returns `202 Accepted` with a job ID.
8. BullMQ queues the work in Redis. The request does not wait for dependency installation or compilation.
9. A worker claims the job and updates its stage/status.
10. A runner executes the approved profile inside a disposable, restricted container.
11. The runner saves output and logs, then exits. Browser checks/screenshots may run afterward.
12. The worker updates the job result. The admin reviews the preview.
13. Only a successful, reviewed version may be published.
14. The publish operation changes the template's current published-version pointer. Previous versions remain available for rollback.
15. The public gallery queries only published records and displays their published snapshot/preview URL.

### 4.3 Why builds are asynchronous

A build can take minutes or fail. Do not keep an HTTP request open for its entire duration.

- API validates and queues the job.
- Worker processes the job in the background.
- Admin UI polls `GET /api/v1/admin/jobs/:jobId` while it is active. Server-Sent Events or WebSockets can be added later.
- Jobs must be idempotent: a retry must not publish duplicate/conflicting versions if a worker crashes.

---

## 5. The two phases

The final system supports both workflows. Phase 2 adds local AI; it does not remove manual control.

## Phase 1 — Manual template management

**Goal:** complete the end-to-end process without an AI API key or local model.

The admin manually decides:

- Which source folder to create/copy into the approved staging area and which source files to include.
- Template name, description, category and tags.
- Which folder/archive is being imported.
- Which supported framework/build profile applies.
- Whether to retry a failed build.
- Whether to publish a successful version.

The admin is responsible for source organization/configuration decisions in Phase 1. The app may still create a safe internal copy, queue a build and publish artifacts using deterministic non-AI code. In Phase 2, local AI can suggest the metadata/profile and prepare an import plan, but trusted backend code—not the model itself—creates the actual directories and launches validated operations. This keeps the manual process and the AI-assisted process compatible.

Regular code performs deterministic tasks:

- Create a folder from a server-generated ID/slug.
- Validate inputs, resolve paths safely and check resource limits.
- Save metadata in MongoDB.
- Create jobs in BullMQ.
- Execute an allowlisted build profile in an isolated runner.
- Save artifacts/logs outside MongoDB.
- Generate a preview URL and screenshots when supported.
- Publish a version and update the gallery.

### Phase 1 screens

1. `/` — public home/gallery.
2. `/templates` — catalog with search and filters.
3. `/templates/[slug]` — public detail page.
4. `/admin/login` — sign-in.
5. `/admin` — overview and recent jobs.
6. `/admin/templates` — inventory including drafts/failed items.
7. `/admin/templates/new` — create template/metadata.
8. `/admin/templates/[templateId]` — metadata, version and build-profile review.
9. `/admin/jobs/[jobId]` — progress, safe logs and error messages.

### Phase 1 completion requirement

An authenticated admin can import one known-safe static/Vite template from the current repository, build it in isolation, inspect a working preview, publish it, see it in the public gallery, and roll back to a prior version. A failed update must not replace a working published release.

## Phase 2 — Optional local AI automation

AI may:

- Suggest the title, summary, tags and category.
- Analyze `package.json`, lockfile names, README and a bounded source-file manifest.
- Suggest a supported framework/build profile.
- Explain a failure using sanitized build logs.
- Propose a source patch for human review.
- Summarize the differences between two versions.

### Phase 2 flow

1. Admin chooses **Analyze with local AI**.
2. Worker collects a bounded, read-only set of files and safe logs.
3. An AI adapter sends the data to a local inference service.
4. The model returns structured JSON, not shell commands.
5. Zod validates the output, then deterministic code checks it against an allowlist.
6. Admin reviews/edits and approves or rejects the proposal.
7. The normal deterministic build pipeline runs.
8. If the local AI service is offline or disabled, manual mode still works.

For a no-paid-key design, use a self-hosted/local model service (for example, Ollama) on your workstation or your own server. **Local AI is not resource-free**: the model uses RAM/CPU/GPU and needs updates/monitoring. Start small and measure resource use. Do not send source code to an external AI API unless you explicitly add an opt-in provider later.

A suitable setting is `AI_MODE=disabled` in Phase 1 and `AI_MODE=local` when Phase 2 is enabled. Manual mode must not depend on AI availability.

---

---

## 6. Folder structure, file by file

This is the target layout for the whole system. Build it incrementally; you do not need every file on day one.

```text
frontend-studio/
├── apps/
│   └── web/                                  # Next.js public gallery and admin UI
│       ├── public/                           # Logo, icons, safe static assets
│       ├── src/app/
│       │   ├── layout.tsx                    # Root HTML layout/providers
│       │   ├── globals.css                   # Global styles/design tokens
│       │   ├── page.tsx                      # Public landing page/gallery
│       │   ├── not-found.tsx                 # Friendly 404 page
│       │   ├── error.tsx                     # UI error boundary
│       │   ├── loading.tsx                   # Default loading UI
│       │   ├── templates/page.tsx            # Searchable template catalog
│       │   ├── templates/[slug]/page.tsx     # Public template details
│       │   └── admin/
│       │       ├── login/page.tsx            # Admin sign-in form
│       │       ├── layout.tsx                # Admin navigation/layout
│       │       ├── page.tsx                  # Dashboard/recent jobs
│       │       ├── templates/page.tsx        # Admin template inventory
│       │       ├── templates/new/page.tsx    # Create/import form
│       │       ├── templates/[templateId]/page.tsx # Edit/review one template
│       │       └── jobs/[jobId]/page.tsx     # Job progress/logs page
│       ├── src/components/
│       │   ├── site-header.tsx               # Shared public header
│       │   ├── template-card.tsx             # Catalog card component
│       │   ├── template-filters.tsx          # Search/category controls
│       │   ├── template-form.tsx              # Admin create/edit form
│       │   ├── job-status.tsx                 # Build stage indicator
│       │   └── confirm-dialog.tsx             # Confirm sensitive actions
│       ├── src/lib/
│       │   ├── api-client.ts                  # Browser-side calls to Express
│       │   ├── api-server.ts                  # Server-side calls to Express
│       │   ├── auth.ts                        # Helpers for current session
│       │   └── format.ts                      # Date/status/size formatting
│       ├── next.config.ts                     # Next config/optional API rewrite
│       ├── package.json                       # Web dependencies/scripts
│       ├── tsconfig.json                      # TypeScript configuration
│       └── Dockerfile                         # Production web image
│
├── services/
│   ├── api/                                   # Express API/business logic
│   │   ├── src/
│   │   │   ├── app.ts                         # Configure middleware/routes
│   │   │   ├── server.ts                      # Listen, handle shutdown
│   │   │   ├── config/env.ts                  # Validate environment at startup
│   │   │   ├── config/database.ts             # Mongoose connection
│   │   │   ├── middleware/
│   │   │   │   ├── require-auth.ts             # Require an admin session
│   │   │   │   ├── require-role.ts             # Enforce role/permission
│   │   │   │   ├── validate-request.ts         # Zod request validation
│   │   │   │   ├── not-found.ts                # Unknown API route handler
│   │   │   │   └── error-handler.ts             # Safe, centralized errors
│   │   │   ├── modules/
│   │   │   │   ├── auth/                       # Login/logout/session logic
│   │   │   │   ├── templates/                  # Template metadata CRUD
│   │   │   │   ├── versions/                   # Versions/build/publish/rollback
│   │   │   │   ├── jobs/                       # Job state/log endpoints
│   │   │   │   ├── uploads/                    # Archive intake/validation
│   │   │   │   └── audit/                      # Admin audit events
│   │   │   ├── queues/template-jobs.ts          # Enqueues jobs, does not build
│   │   │   └── utils/
│   │   │       ├── slug.ts                     # Safe slug generation
│   │   │       └── pagination.ts                # Bounded page/cursor helpers
│   │   ├── tests/                              # API tests
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── Dockerfile
│   │
│   ├── worker/                                 # Background job orchestration
│   │   ├── src/index.ts                        # Start workers/handle shutdown
│   │   ├── src/config.ts                       # Concurrency/timeouts settings
│   │   ├── src/processors/validate-source.ts   # Verify source/profile
│   │   ├── src/processors/build-template.ts    # Request a sandboxed build
│   │   ├── src/processors/create-preview.ts    # Preview metadata/screenshots
│   │   ├── src/processors/publish-version.ts   # Publish approved artifacts
│   │   ├── src/services/job-state.ts           # Valid job state transitions
│   │   ├── src/services/artifact-storage.ts    # Storage adapter
│   │   ├── src/services/runner-client.ts       # Calls the restricted runner
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── Dockerfile
│   │
│   └── runner/                                 # Controlled disposable build runner
│       ├── src/index.ts                        # Accept validated job specification
│       ├── src/profiles.ts                     # Code-owned build allowlist
│       ├── src/run-container.ts                # Create/stop/delete build container
│       ├── src/resource-limits.ts              # CPU/RAM/pids/timeout policies
│       ├── package.json
│       ├── tsconfig.json
│       └── Dockerfile
│
├── packages/contracts/
│   ├── src/template.ts                        # Shared API/request Zod schemas
│   ├── src/version.ts                         # Shared version types
│   ├── src/job.ts                             # Shared job statuses/types
│   ├── src/index.ts                           # Public contract exports
│   ├── package.json
│   └── tsconfig.json
│
├── packages/database/                         # Shared persistence layer for API + worker
│   ├── src/connect.ts                         # Connect/disconnect Mongoose cleanly
│   ├── src/models/User.ts                     # User schema/indexes
│   ├── src/models/Template.ts                 # Catalog schema/indexes
│   ├── src/models/TemplateVersion.ts           # Immutable version schema/indexes
│   ├── src/models/ImportJob.ts                 # Job schema/indexes
│   ├── src/models/AuditLog.ts                  # Audit schema/indexes
│   ├── src/index.ts                           # Export models/connection helpers
│   ├── package.json
│   └── tsconfig.json
│
├── storage/                                   # Local development only; Git-ignored
│   ├── templates/                             # Source snapshots, keyed by template ID
│   ├── artifacts/                             # Local build outputs
│   ├── screenshots/                           # Preview screenshots
│   └── logs/                                  # Bounded/sanitized local logs
│
├── infra/
│   ├── docker/compose.dev.yml                 # Local MongoDB and Redis
│   ├── docker/compose.prod.yml                # App services if using Compose
│   ├── docker/Dockerfile.template-runner      # Build image for templates
│   ├── docker/.dockerignore                   # Excludes secrets/storage/node_modules
│   └── proxy/Caddyfile                        # Example reverse proxy/TLS routing
│
├── scripts/
│   ├── seed-admin.ts                          # Controlled admin bootstrap
│   ├── inventory-templates.mjs                # Find source projects/manifests
│   ├── import-existing-template.mjs            # Controlled local source import
│   └── check-env.mjs                          # Environment sanity check
│
├── docs/
│   ├── architecture.md                        # Architecture decisions/diagrams
│   ├── template-inventory.md                  # Facts about existing templates
│   ├── runbooks.md                            # Build failure/restore operations
│   └── threat-model.md                        # Security threats and controls
│
├── .github/workflows/ci.yml                   # Automated checks on GitHub
├── .env.example                               # Variable names; never real secrets
├── .gitignore                                 # Ignores secrets and generated data
├── .nvmrc                                     # Chosen Node.js major version
├── package.json                               # npm workspaces and root scripts
├── package-lock.json                          # Reproducible dependency lockfile
└── README.md                                  # This guide
```

### Typical files inside an API module

For example, `services/api/src/modules/templates/` should contain files like these:

| File | Responsibility |
|---|---|
| `template.routes.ts` | Declares HTTP methods/paths and attaches middleware. |
| `template.controller.ts` | Reads validated parameters/body, calls a service, and returns an HTTP response. |
| `template.service.ts` | Implements business rules and database operations. |
| `template.schemas.ts` | Zod schemas for request inputs and permitted metadata. |
| `template.service.test.ts` | Tests the business rules. |

Use the same pattern where it fits: `auth.routes.ts`, `auth.controller.ts`, `auth.service.ts`, `auth.schemas.ts`; `version.routes.ts`, `version.controller.ts`, `version.service.ts`; `job.routes.ts`, `job.controller.ts`, `job.service.ts`; and corresponding upload/audit modules. Avoid one huge file that handles every route, database query, and build operation.

### Folder rules

- Never commit `node_modules`, `.env`, session secrets, uploaded ZIPs, private source archives, raw build logs or generated artifacts.
- Do not place imported source into `apps/web/src`. Template source is content managed by the platform, not part of the Next.js application itself.
- Do not accept an absolute filesystem path from the browser. Generate the workspace name on the server and verify every resolved path stays beneath the configured storage root.
- In production, use durable storage (object storage or a dedicated persistent volume). Back it up and test restoring it.
- The runner should not be bundled into the Express API process.

---

## 7. Database design

MongoDB stores metadata and pointers. It must not store full ZIP files or entire build directories as documents.

### 7.1 Relationships

```text
User (admin)
  | createdBy
  v
Template 1 --------------------- * TemplateVersion
  | currentVersionId                    |
  |                                     | templateId
  |                                     v
  |                                ImportJob *
  |
  +-- AuditLog records reference actor/resource IDs

Session records are managed by the session store, not embedded in User.
```

A **template** is the long-lived catalog item, such as “AI Agency.” A **version** is one immutable source/build snapshot. A **job** is one attempt to validate, build, test, preview, or publish a version.

### 7.2 `users`

Example (store a password hash, never the original password):

```json
{
  "email": "admin@example.com",
  "passwordHash": "<password-hash>",
  "role": "admin",
  "isActive": true,
  "lastLoginAt": "2026-10-01T09:30:00.000Z",
  "createdAt": "2026-09-01T09:00:00.000Z",
  "updatedAt": "2026-10-01T09:30:00.000Z"
}
```

Indexes:

- Unique normalized `email`.
- Additional indexes only when real queries need them.

For a single-admin starter, use a controlled bootstrap script. Never expose a public “create first admin” endpoint. Add MFA and stronger identity management before opening admin access more broadly.

### 7.3 `templates`

This is the catalog record:

```json
{
  "name": "AI Agency",
  "slug": "ai-agency",
  "description": "A modern agency website template.",
  "category": "Agency",
  "tags": ["react", "landing-page", "agency"],
  "publicationStatus": "draft",
  "sourceMode": "manual",
  "sourceRepository": {
    "url": "https://github.com/mannrandhawa004/frontend_designs",
    "branch": "main",
    "commitSha": null,
    "relativePath": "ai_agency"
  },
  "currentVersionId": null,
  "publishedSnapshot": null,
  "createdBy": "<user-id>",
  "createdAt": "2026-10-01T09:00:00.000Z",
  "updatedAt": "2026-10-01T09:00:00.000Z"
}
```

Use separate publication status and build status. Recommended publication state: `draft`, `published`, `archived`. Build status belongs to a version/job. That way, a failed new build does not hide or damage the currently published version.

`publishedSnapshot` is an optional, compact set of fields used by gallery cards, updated only when publishing:

```json
{
  "publishedSnapshot": {
    "versionNumber": 3,
    "thumbnailKey": "screenshots/<template-id>/v3/card.webp",
    "previewUrl": "https://previews.example.com/ai-agency/v3/",
    "framework": "vite-react-static",
    "publishedAt": "2026-10-01T11:00:00.000Z"
  }
}
```

Generate `previewUrl` on the server/publisher. Do not accept arbitrary preview URLs from public requests.

Indexes:

- Unique `{ slug: 1 }`.
- `{ publicationStatus: 1, updatedAt: -1 }` for the public catalog.
- `{ publicationStatus: 1, category: 1, updatedAt: -1 }` if category-filtered browsing is common.
- Add a tags index only if tag filters are actually used.

### 7.4 `templateVersions`

Every imported/build release gets a separate record:

```json
{
  "templateId": "<template-id>",
  "versionNumber": 1,
  "sourceStorageKey": "templates/<template-id>/versions/1/source/",
  "artifactStorageKey": null,
  "thumbnailStorageKey": null,
  "frameworkProfile": "vite-react-static",
  "packageManager": "npm",
  "lockfileName": "package-lock.json",
  "installProfile": "npm-ci-approved",
  "buildProfile": "vite-build",
  "outputDirectory": "dist",
  "runtimeType": "static",
  "sourceChecksum": "sha256:<digest>",
  "buildStatus": "not_started",
  "createdBy": "<user-id>",
  "createdAt": "2026-10-01T09:30:00.000Z",
  "updatedAt": "2026-10-01T09:30:00.000Z"
}
```

Important rules:

- Do **not** save unrestricted commands written by an admin and execute them directly. Store an allowlisted `buildProfile` ID that maps to code-owned behavior.
- `sourceStorageKey` and `artifactStorageKey` are logical storage keys, not absolute host paths.
- Once approved/published, a version is immutable. Changes create another version.
- Record the source commit SHA and checksum when available so builds can be reproduced.

Indexes:

- Unique compound `{ templateId: 1, versionNumber: 1 }`.
- `{ templateId: 1, createdAt: -1 }` for version history.

### 7.5 `importJobs`

Tracks work processed by the background worker:

```json
{
  "templateId": "<template-id>",
  "versionId": "<version-id>",
  "jobType": "build",
  "processingMode": "manual",
  "status": "queued",
  "stage": "waiting_for_worker",
  "attempt": 0,
  "idempotencyKey": "build:<version-id>:<source-checksum>",
  "logStorageKey": null,
  "result": null,
  "errorCode": null,
  "safeErrorMessage": null,
  "requestedBy": "<user-id>",
  "startedAt": null,
  "finishedAt": null,
  "createdAt": "2026-10-01T09:31:00.000Z",
  "updatedAt": "2026-10-01T09:31:00.000Z"
}
```

Possible statuses: `queued`, `running`, `succeeded`, `failed`, `cancelled`.

Possible stages: `validating`, `preparing`, `installing`, `building`, `testing`, `screenshots`, `publishing`, `complete`.

Store logs in local storage/object storage, with a logical key in MongoDB. Apply size limits, retention rules and secret redaction. Show authorized admins a bounded log tail rather than loading an unlimited file into the browser.

Indexes:

- `{ status: 1, createdAt: 1 }` for worker/dashboard queries.
- `{ templateId: 1, createdAt: -1 }` for one template's job history.
- A unique idempotency index only where the key is truly unique for the required operation.
- Use TTL cleanup only for temporary records after defining retention. Do not automatically delete audit history with a TTL index.

### 7.6 `auditLogs`

Append a record for sensitive operations:

```json
{
  "actorId": "<user-id>",
  "action": "template.publish",
  "resourceType": "template",
  "resourceId": "<template-id>",
  "requestId": "<request-id>",
  "details": { "versionNumber": 3 },
  "createdAt": "2026-10-01T11:00:00.000Z"
}
```

Never log passwords, session IDs, cookie values, AI keys, or full environment variable values. Useful indexes include `{ createdAt: -1 }` and `{ resourceType: 1, resourceId: 1, createdAt: -1 }` if used by audit screens.

### 7.7 Sessions

Use server-side sessions stored with `connect-mongo` or a supported session store. The browser receives an opaque cookie with `HttpOnly`, `Secure` in production HTTPS, and a suitable `SameSite` policy. Do not store long-lived credentials in `localStorage`.

### 7.8 Database optimization checklist

1. Design around real queries: public gallery, admin inventory, version history, job history.
2. Add unique indexes for slug, normalized email and the template/version pair.
3. Use projections and Mongoose `.lean()` on read-only list queries.
4. Paginate and enforce a maximum page size; prefer cursor pagination for large histories.
5. Keep binaries, source files, build outputs and raw logs outside MongoDB.
6. Keep version history in its own collection instead of growing one template document without bound.
7. Use a small published snapshot if it avoids expensive reads on every public card.
8. Avoid indexing every field. Indexes consume memory/disk and add write cost; use `explain()` to verify index usefulness.
9. Validate at the request boundary as well as in the Mongoose schema.
10. Use transactions only when several writes truly must commit together and the MongoDB deployment supports them. An unpublished version can safely exist by itself; publish by atomically updating one template document's current-version pointer after validation.
11. Configure connection-pool sizes/timeouts deliberately, then monitor slow queries.
12. Back up MongoDB and test restoration before relying on backups.

---

## 8. API design

Prefix endpoints with `/api/v1`. Use a consistent response format and centralized error handling.

### Health endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/v1/health/live` | No | Confirms the process is running |
| `GET` | `/api/v1/health/ready` | Internal/controlled | Confirms required dependencies are available |

Liveness should not fail merely because MongoDB is temporarily unavailable. Readiness should reflect whether the service can safely accept requests.

### Authentication

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/v1/auth/login` | No, rate-limited | Verify credentials and create session |
| `POST` | `/api/v1/auth/logout` | Session | Destroy session and clear cookie |
| `GET` | `/api/v1/auth/me` | Session | Return minimal current-user information |

### Public templates

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/templates` | Paginated published templates; supports `q`, `category`, `tag`, `framework`, `cursor`, `limit` |
| `GET` | `/api/v1/templates/:slug` | Public details for one published template |

Public APIs must filter on `publicationStatus: "published"` in the database. Never fetch every template and rely on the frontend to hide drafts.

### Admin templates and versions

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/admin/templates` | List all templates, including drafts |
| `POST` | `/api/v1/admin/templates` | Create a template record and managed workspace |
| `GET` | `/api/v1/admin/templates/:id` | Get permitted details for one template |
| `PATCH` | `/api/v1/admin/templates/:id` | Edit validated metadata |
| `POST` | `/api/v1/admin/templates/:id/versions` | Create a new version/import record |
| `GET` | `/api/v1/admin/templates/:id/versions` | List version history |
| `POST` | `/api/v1/admin/templates/:id/versions/:versionId/build` | Queue a build and return `202 Accepted` with a job ID |
| `POST` | `/api/v1/admin/templates/:id/versions/:versionId/publish` | Publish a successful, reviewed version |
| `POST` | `/api/v1/admin/templates/:id/rollback` | Restore a previously verified version |
| `POST` | `/api/v1/admin/templates/:id/archive` | Archive/hide a template without deleting history immediately |

### Jobs

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/admin/jobs/:jobId` | Status, stage, timestamps and safe error summary |
| `GET` | `/api/v1/admin/jobs/:jobId/logs` | Authorized, bounded log tail or short-lived storage URL |
| `POST` | `/api/v1/admin/jobs/:jobId/cancel` | Request cancellation if the stage supports it |

### API conventions

- Validate route parameters, query parameters and request bodies using Zod.
- Use stable error codes, for example `VALIDATION_ERROR`, `NOT_FOUND`, `FORBIDDEN`, and `BUILD_PROFILE_UNSUPPORTED`.
- Do not return stack traces, internal server paths, secret values or raw runner exceptions.
- Use correct status codes: `201 Created`, `202 Accepted`, `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`, `409 Conflict`, and `500 Internal Server Error`.
- Every admin API route checks authorization server-side. Hiding a button in Next.js is not authorization.
- Add request IDs so API logs, worker logs and audit events can be correlated.
- Prefer explicit route handlers and service functions instead of putting database logic in the route file.

---

## 9. Packages and their purpose

Install packages in the workspace where they are used. This list is a planned dependency set; add packages as their functionality is implemented rather than installing every optional tool on day one.

### 9.1 Root workspace

The root `package.json` should define npm workspaces such as:

```json
{
  "name": "frontend-studio",
  "private": true,
  "workspaces": [
    "apps/web",
    "services/api",
    "services/worker",
    "services/runner",
    "packages/contracts",
    "packages/database"
  ],
  "scripts": {
    "dev": "concurrently --kill-others-on-fail --names web,api,worker \"npm run dev -w @studio/web\" \"npm run dev -w @studio/api\" \"npm run dev -w @studio/worker\"",
    "build": "npm run build --workspaces --if-present",
    "lint": "npm run lint --workspaces --if-present",
    "test": "npm run test --workspaces --if-present"
  },
  "devDependencies": {
    "concurrently": "^9.0.0",
    "prettier": "^3.0.0",
    "typescript": "^5.0.0"
  }
}
```

Treat this as a starting example. Use the actual versions generated by the current toolchain, commit `package-lock.json`, and do not update version ranges blindly in production. Add `services/runner` to root scripts only if its development command is intended to run locally.

Give each workspace the package name that root scripts use:

| Folder | `package.json` name |
|---|---|
| `apps/web` | `@studio/web` |
| `services/api` | `@studio/api` |
| `services/worker` | `@studio/worker` |
| `services/runner` | `@studio/runner` |
| `packages/contracts` | `@studio/contracts` |
| `packages/database` | `@studio/database` |

Each workspace should set `"private": true`, a project version such as `"1.0.0"`, and `"type": "module"` if its TypeScript/build configuration emits ES modules. A workspace package should declare dependencies on shared packages using a local workspace-compatible version (for example `"@studio/contracts": "1.0.0"` when that workspace has version `1.0.0`). Run `npm install` from the root to update the lockfile after changing dependencies.

Suggested scripts: `apps/web` uses `next dev`, `next build`, and `next start`; `services/api` and `services/worker` can use `tsx watch src/server.ts`/`tsx watch src/index.ts` for development and `tsc` plus Node.js for production. The runner should have a separate restricted start/deploy command and should not automatically start as a public web service. Ensure root script names match the package names and scripts you actually created.

What the root packages do:

- **npm workspaces:** install and link the project's packages from the root.
- **concurrently:** run several development servers in one terminal.
- **TypeScript:** static type checking/build tooling shared across workspaces.
- **Prettier:** formats files consistently.

### 9.2 Create the Next.js app

From the repository root, create the web workspace with the official Next.js generator. Check the flags supported by the installed generator if the CLI changes:

```bash
npx create-next-app@latest apps/web --typescript --eslint --app --src-dir --use-npm --import-alias "@/*"
```

Review `apps/web/package.json` after generation and set its name to `@studio/web` so the root workspace script can target it. If you start from an existing workspace, avoid generating a second nested package accidentally.

Core web dependencies:

| Package | Why |
|---|---|
| `next` | Next.js runtime/build system |
| `react`, `react-dom` | UI framework and browser renderer |
| `zod` | Validates browser form payloads before sending them; API must validate again |
| `lucide-react` | Optional consistent icon set |
| `react-hook-form` | Optional form-state helper when forms become complex |
| `@hookform/resolvers` | Optional integration between React Hook Form and Zod |

Core TypeScript/dev tooling is normally installed/configured by `create-next-app`: TypeScript, ESLint, Next.js ESLint configuration and React/Node type packages.

For the first version, use CSS Modules or the generated global CSS. Tailwind is optional; don't add a styling framework unless you intend to use it.

### 9.3 Express API dependencies

In `services/api`:

```bash
npm install express zod helmet cors express-rate-limit pino pino-http dotenv express-session connect-mongo bcryptjs --workspace=@studio/api
npm install @studio/database@1.0.0 @studio/contracts@1.0.0 --workspace=@studio/api
npm install -D typescript tsx @types/node @types/express @types/cors @types/express-session vitest supertest @types/supertest --workspace=@studio/api
```

Run these commands from the repository root after the `@studio/api`, `@studio/database`, and `@studio/contracts` package manifests exist. Mongoose is owned by the shared database workspace to avoid maintaining duplicate schema/configuration packages.

| Package | What it does |
|---|---|
| `express` | HTTP server, routes and middleware |
| `mongoose` | MongoDB models, schemas, validation, queries and indexes |
| `zod` | Validates external input at runtime |
| `helmet` | Sets useful HTTP security headers |
| `cors` | Allows the dev web origin to call the API; production can use same-origin proxying |
| `express-rate-limit` | Limits repeated requests, especially login attempts |
| `pino`, `pino-http` | Structured logs and request logging |
| `dotenv` | Loads local `.env` variables during development |
| `express-session` | Server-side session middleware |
| `connect-mongo` | Stores sessions in MongoDB instead of process memory |
| `bcryptjs` | Password hashing/verification in JavaScript; use an appropriate cost and benchmark it |
| `tsx` | Runs TypeScript in development without a separate manual compile step |
| `vitest` | Unit/integration test runner |
| `supertest` | Sends HTTP requests to the Express app in tests |
| `@types/*` | Type declarations for TypeScript where needed |

Security note: `MemoryStore` from `express-session` is not suitable for production. Configure a persistent session store, secure cookies, login throttling, appropriate CSRF/origin protection for cookie-authenticated state-changing routes, and session rotation on login.

### 9.4 Worker dependencies

In `services/worker`:

```bash
npm install bullmq ioredis zod pino dotenv --workspace=@studio/worker
npm install @studio/database@1.0.0 @studio/contracts@1.0.0 --workspace=@studio/worker
npm install -D typescript tsx @types/node vitest --workspace=@studio/worker
```

Run from the repository root after workspace manifests exist. The worker imports shared Mongoose models/connection from `@studio/database`; do not copy the schema definitions into the worker.

| Package | What it does |
|---|---|
| `bullmq` | Adds jobs to Redis-backed queues and processes them with workers |
| `ioredis` | Redis connection client used by BullMQ/configuration |
| `mongoose` | Lets the worker update job/version records using the same models or a shared model package |
| `zod` | Validates job payloads before processing |
| `pino` | Structured worker logs |
| `tsx` | Development execution of TypeScript |

BullMQ is useful because builds may run for a long time, should retry safely, and should not block the API event loop. Jobs should contain IDs and approved profile names—not uploaded source code or credentials.

### 9.5 Shared contracts

In `packages/contracts`:

```bash
npm install zod
npm install -D typescript
```

Put reusable request/response schemas and types here. For example, `TemplatePublicSchema` should expose only public fields; it should not include private storage keys, logs or environment information.

### 9.6 Shared database package

Keep Mongoose models and connection helpers in `packages/database`, imported by both Express and the worker. This avoids maintaining separate versions of the same schema. First create `packages/database/package.json` with `"name": "@studio/database"` and `"version": "1.0.0"`, then install the dependency:

```bash
npm install mongoose --workspace=@studio/database
npm install -D typescript --workspace=@studio/database
```

Name the shared contract workspace `@studio/contracts` and install its schema dependency with `npm install zod --workspace=@studio/contracts`. Add `@studio/database@1.0.0` and `@studio/contracts@1.0.0` to the API/worker packages after their manifests exist. Keep request/response Zod schemas in `@studio/contracts`; database schemas and transport contracts solve different problems. Add `@studio/contracts` to the web package only when the web app needs shared request types/schemas.

### 9.7 Build-runner dependencies

If you self-host a runner that creates isolated build containers through the Docker API, it can use a client library such as `dockerode`:

```bash
npm install dockerode --workspace=@studio/runner
npm install -D typescript tsx @types/node @types/dockerode --workspace=@studio/runner
```

Only use this in the dedicated runner environment. Access to a Docker daemon is highly privileged; do not install runner control code inside the public API and give it the host Docker socket. In production, run this on a separated builder host or use a restricted remote build service. Confirm library/type compatibility with the Node.js and Docker versions you pin.

### 9.8 Optional uploads in Phase 1

If the admin uploads ZIP files through the portal, add a streaming/disk-based multipart handler (for example, `multer`) with strict limits, generated names and safe temporary storage. Do not use unbounded in-memory upload storage. Verify ZIP contents with a safe archive library and your own traversal/size checks. You can initially import trusted source folders from disk and add the upload UI after the build pipeline works.

### 9.9 Test and security tools

- `vitest`: unit and service tests.
- `supertest`: API integration tests.
- `@playwright/test`: browser acceptance tests and screenshot automation.
- `npm audit` or your CI platform's dependency scanning: find known vulnerable packages. Review advisories and lockfile updates; don't blindly use `--force` to resolve dependency conflicts.
- `prettier`: formatting.

Do not add a dependency if built-in functionality or a smaller existing package is sufficient. Recheck current official docs before upgrading major versions.

---

## 10. Local development setup

### 10.1 Prerequisites

Install:

- Git.
- Node.js LTS compatible with the current Next.js version.
- npm (included with Node.js).
- Docker Engine/Desktop and Docker Compose plugin.
- A code editor.

You can use MongoDB Atlas for a managed development database or run MongoDB in Docker. For repeatable local development, this guide uses Docker for MongoDB and Redis while running Node.js apps on your machine.

### 10.2 Create the repository

```bash
mkdir frontend-studio
cd frontend-studio
git init
npm init -y
mkdir -p apps services/api services/worker services/runner packages/contracts packages/database infra/docker infra/proxy scripts docs storage/templates storage/artifacts storage/screenshots storage/logs
```

Create the root `package.json` workspace definition before using workspace installs. Generate `apps/web` with the Next.js CLI. Create the API, worker, runner and shared-contract packages with their own `package.json` files as you reach those steps.

### 10.3 Pin your Node version

Check your versions:

```bash
node --version
npm --version
docker --version
docker compose version
```

Choose a currently supported LTS major and add it to `.nvmrc`, for example:

```text
24
```

Make the same major version consistent in local development, CI and Docker build/runtime images. If the official Next.js system-requirements page or a package requires a newer minimum, obey that minimum.

### 10.4 Example development Compose file

Create `infra/docker/compose.dev.yml` for infrastructure only. Keep application code running locally at first; this makes logs easier for a beginner to understand.

```yaml
services:
  mongodb:
    image: mongo:8
    restart: unless-stopped
    environment:
      MONGO_INITDB_ROOT_USERNAME: ${MONGO_ROOT_USER}
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_ROOT_PASSWORD}
      MONGO_INITDB_DATABASE: frontend_studio
    ports:
      - "127.0.0.1:27017:27017"
    volumes:
      - mongodb_data:/data/db
    healthcheck:
      test: ["CMD", "mongosh", "--quiet", "--eval", "db.adminCommand('ping').ok"]
      interval: 10s
      timeout: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: ["redis-server", "--appendonly", "yes"]
    ports:
      - "127.0.0.1:6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 10

volumes:
  mongodb_data:
  redis_data:
```

This file is a development example, not a full production database setup. In this local-only example, the app URI uses the MongoDB root account created by Compose. That is acceptable only for a private throwaway development database. Before production, create a separate least-privilege database user scoped to `frontend_studio`, use a secrets manager, private networking, backups, monitoring and a tested update strategy. Pin image versions/digests after verification rather than assuming floating tags are immutable.

Create a root `.env` for Compose values and ignore it in Git. For example:

```dotenv
MONGO_ROOT_USER=studio_root
MONGO_ROOT_PASSWORD=replace-with-a-long-random-secret
```

Start infrastructure:

```bash
docker compose --env-file .env -f infra/docker/compose.dev.yml up -d

docker compose -f infra/docker/compose.dev.yml ps

docker compose -f infra/docker/compose.dev.yml logs -f mongodb redis
```

Stop it without deleting data:

```bash
docker compose -f infra/docker/compose.dev.yml down
```

To delete the local database and Redis volumes too (destructive):

```bash
docker compose -f infra/docker/compose.dev.yml down -v
```

Before installing or committing the project, make sure the root `.gitignore` contains at least:

```gitignore
node_modules/
**/node_modules/
.env
.env.*
!.env.example
.next/
dist/
out/
coverage/
*.log
storage/**
!storage/.gitkeep
.DS_Store

# Local model/download cache (if a model is stored under this project)
models/
ollama/
```

Review ignores carefully if you intentionally keep a tiny fixture in `storage/` for tests. Do not commit real source imports, output artifacts or model weights by accident.

### 10.5 Environment variables

Create `.env.example` with variable **names and harmless examples only**. Create local environment files that are not committed: root `.env` for Compose, `services/api/.env` for API development, `services/worker/.env` for the worker, and `apps/web/.env.local` for Next.js. A workspace process may have its own directory as the current working directory; do not assume `dotenv` automatically finds the root `.env`. Set an explicit path or keep service-specific files. In production, inject variables from the secret/configuration manager. Validate required variables when each process starts so failures happen early.

Example API environment:

```dotenv
NODE_ENV=development
API_PORT=4000
MONGODB_URI=mongodb://studio_root:replace-with-a-long-random-secret@127.0.0.1:27017/frontend_studio?authSource=admin
REDIS_URL=redis://127.0.0.1:6379
WEB_ORIGIN=http://localhost:3000
SESSION_SECRET=replace-with-at-least-32-random-bytes
SESSION_NAME=studio.sid
SESSION_MAX_AGE_MS=28800000
STORAGE_ROOT=../../storage
AI_MODE=disabled
```

Do not use the MongoDB root user as the application's normal DB account in production. Create a least-privilege database user scoped to the application database. The above URI is only a placeholder; configure the username, password and auth database to match your local Mongo setup. In production use strong secrets and private networking.

The relative `STORAGE_ROOT` above assumes the API starts with `services/api` as its working directory. Resolve it to an absolute path at startup and verify it; for the worker, configure the same managed storage through a shared durable volume or object-storage adapter. Do not let each process interpret the same relative path from a different current directory.

Example web environment (in `apps/web/.env.local`):

```dotenv
NODE_ENV=development
API_INTERNAL_URL=http://localhost:4000
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api/v1
```

Anything prefixed `NEXT_PUBLIC_` is exposed to the browser bundle. Never put secrets in `NEXT_PUBLIC_*`. In production, a same-origin reverse proxy can route `/api/v1/*` to Express and the browser can use relative URLs; server-side Next.js fetches can use a private internal URL.

### 10.6 Start the services

Each package must have its own `dev` script. Example local ports:

- Next.js: `http://localhost:3000`
- Express: `http://localhost:4000`
- MongoDB: `127.0.0.1:27017`
- Redis: `127.0.0.1:6379`

Start them with root scripts after creating the workspace package files:

```bash
npm install
npm run dev
```

You can also start each package separately during debugging:

```bash
npm run dev --workspace=@studio/web
npm run dev --workspace=@studio/api
npm run dev --workspace=@studio/worker
```

Avoid starting multiple copies of the worker unintentionally. A worker can claim jobs from the same queue as another worker, which is fine in a designed deployment but can confuse local debugging.

---

## 11. Phase 1 implementation plan

Work in milestones. Each milestone should run and be testable before you begin the next one.

### Milestone 0 — Audit your current templates

**Files:** `docs/template-inventory.md`, `scripts/inventory-templates.mjs`.

1. Clone `frontend_designs`.
2. Find all `package.json` and lockfiles.
3. Run each trusted project locally, one at a time, to determine its actual start/build behavior.
4. Record whether it is static or requires a server.
5. Start with one simple static-compatible template, not all five.

**Done when:** you know the framework, lockfile, build profile, output folder and runtime needs for the first template.

### Milestone 1 — Create the workspace and web application

**Files:** root `package.json`, `apps/web/package.json`, `apps/web/src/app/layout.tsx`, `apps/web/src/app/page.tsx`, `apps/web/src/app/globals.css`.

1. Initialize npm workspaces.
2. Generate Next.js with TypeScript and App Router.
3. Build a simple gallery with a hard-coded array of sample templates.
4. Add the admin route shells (don't protect them only with frontend conditionals; API auth comes in Milestone 3).
5. Add formatting/lint commands.

**Done when:** `npm run dev --workspace=@studio/web` opens the website on localhost and the main routes render.

### Milestone 2 — Build the Express skeleton and database connection

**Files:** `services/api/src/app.ts`, `server.ts`, `config/env.ts`, plus `packages/database/src/connect.ts` and `packages/database/src/models/*`.

1. Implement validated environment loading.
2. Create the Express app independently from the listener so tests can import it.
3. Connect to MongoDB using Mongoose.
4. Add `/api/v1/health/live` and `/api/v1/health/ready`.
5. Add centralized request validation and safe error handling.
6. Add Pino request logs with request IDs.
7. Create the initial Mongoose schemas and indexes.

**Done when:** API health reports liveness and readiness correctly, and a small integration test can connect to a test database.

### Milestone 3 — Admin authentication

**Files:** `modules/auth/*`, `middleware/require-auth.ts`, `scripts/seed-admin.ts`.

1. Seed one admin from environment-provided values in a one-time CLI/script.
2. Normalize email consistently and hash the password with an approved password-hashing package.
3. Implement login/logout/current-user routes.
4. Store sessions in MongoDB rather than Express's development MemoryStore.
5. Configure cookie flags, session rotation on login, login rate limiting, CSRF/origin protection for cookie-authenticated writes, and generic login error messages.
6. Add admin layout and login UI in Next.js.
7. Test that anonymous and non-admin users cannot call admin endpoints.

**Done when:** login works, session persists as intended, logout invalidates it, and protected API routes return 401/403 correctly.

### Milestone 4 — Template CRUD and public catalog

**Files:** `services/api/src/modules/templates/*`, `packages/database/src/models/Template.ts`, and Next.js template pages/components.

Implement in this order:

1. `POST /api/v1/admin/templates` validates metadata, generates slug, creates the draft record.
2. `GET /api/v1/admin/templates` returns a paginated admin inventory.
3. `GET /api/v1/admin/templates/:id` and `PATCH` return/update allowed metadata.
4. `GET /api/v1/templates` returns only published templates.
5. `GET /api/v1/templates/:slug` returns only a published item.
6. Connect the Next.js gallery to the Express API, with loading, empty and error states.
7. Add server-side authentication checks for admin pages as a user-experience layer; Express remains the final enforcement point.

**Done when:** create/edit/list works, and draft templates cannot be read through the public API.

### Milestone 5 — Safe template workspace and source import

**Files:** `modules/uploads/*`, `scripts/import-existing-template.mjs`, `storage/` adapter, `docs/template-inventory.md`.

1. Configure `STORAGE_ROOT` on the server, not from the request.
2. Generate an internal template ID, then create a path under the managed storage root. Use the ID as the filesystem component; keep slug as presentation metadata.
3. Allow a trusted admin to choose from an allowlisted source folder in the checked-out repository, or add a ZIP upload flow with strict limits.
4. Copy the source to a new immutable version directory. Exclude `.git`, `node_modules`, local `.env`, caches, and previous build output unless explicitly necessary.
5. Write source origin, commit SHA (if available), file counts, byte size and checksum to the version record.
6. Validate the folder structure and supported build profile.
7. Reject an unknown framework rather than running a guessed command.

**Path safety idea:** resolve the candidate path and verify that it remains under the resolved storage root with the correct path separator. Do not rely only on string prefix checks. Treat symlinks and archive path entries carefully.

**Done when:** one source folder creates a new version folder without overwriting the original repository or another template.

### Milestone 6 — Queue, worker and isolated build runner

**Files:** `modules/versions/*`, `queues/template-jobs.ts`, `services/worker/*`, `services/runner/*`.

1. Add Redis and BullMQ.
2. Create the `importJobs` database record before/when enqueueing, with a stable request/job ID and a clear state machine.
3. API returns `202 Accepted` and the job ID.
4. Worker claims jobs and updates states/stages.
5. Runner accepts only an authenticated, schema-validated job spec: version ID, approved profile ID, storage keys and resource limits.
6. Runner creates a disposable container; no production secrets or database credentials are passed to it.
7. Store bounded logs and output under job/version-specific storage keys.
8. Apply a deadline, CPU/memory/pid limits and a maximum output/file-size limit.
9. Use bounded retries with backoff; don't retry a deterministic invalid-input failure endlessly.
10. Add cancellation and stale-job recovery.

**Done when:** a job transitions to success/failure and the admin can see its result without the API request waiting for the build.

### Milestone 7 — Preview, screenshots, publish and rollback

**Files:** `processors/create-preview.ts`, `processors/publish-version.ts`, `modules/versions/*`, `modules/jobs/*`.

1. Confirm that the build output is within the expected output directory and contains an index page where appropriate.
2. Serve the preview from an isolated origin or a dedicated preview host.
3. Use Playwright to load the preview, capture a thumbnail, and check for obvious navigation/runtime errors.
4. The admin reviews the screenshot and build report.
5. Publish only a successful, reviewed version.
6. Update `currentVersionId` and `publishedSnapshot` in the template document as the final atomic publication pointer change.
7. Keep old artifacts during a defined retention window so rollback works.
8. Rollback changes the pointer to a previously verified version; it should not rebuild old source unnecessarily.

**Done when:** public listing points to the newly published version and a previous version can be restored without data loss.

### Milestone 8 — Test and harden the flow

Test these scenarios:

- Missing or invalid form fields.
- Duplicate slug.
- Unsupported framework/build profile.
- Missing `package.json` when the profile requires it.
- Dependency installation fails.
- Build exits non-zero.
- Worker restarts while a job is running.
- The same job is delivered twice.
- Admin session expires.
- Public user tries to access a draft or job logs.
- New build fails after an older version is published.
- Rollback to previous release.
- ZIP contains `../`, absolute paths, symlinks, huge files or thousands of entries.
- Preview opens with a fresh browser context and cannot read platform admin cookies.

**Phase 1 is complete only when the full workflow works end-to-end, not just when the UI looks finished.**

---

## 12. Docker: where and why

Docker is useful here, but use it for the right components.

### 12.1 Use Docker for

1. **Local MongoDB and Redis:** easy to start, stop and reproduce for development.
2. **Production application packaging:** build repeatable images for Next.js, Express and worker services.
3. **Template build isolation:** run each template's dependency installation/build in a disposable container with resource and filesystem limits.
4. **CI builds:** test the same pinned runtime environment used in deployment.

### 12.2 Do not use Docker to replace every development command immediately

For a beginner-friendly local loop, run the Next.js/Express/worker development processes with npm on the host and run MongoDB/Redis with Docker Compose. Later, package all app services into containers for production.

### 12.3 Build runner is a security boundary

An imported project may contain `postinstall` scripts or build scripts that execute arbitrary code. That code must not run inside the main API container or share its credentials/filesystem.

The secure production arrangement is:

- Web and API containers do not have Docker-daemon access.
- The general background worker validates/enqueues/coordinates work.
- A restricted build service uses a dedicated builder host/VM or separately administered build environment.
- A disposable child container handles the template build.
- Only input source and output directories needed for that job are mounted/shared.
- The job container gets no production `.env`, MongoDB credentials, session key, cloud credentials or host directories.

**Do not mount `/var/run/docker.sock` into the public web app or Express API.** Access to a host Docker daemon is effectively highly privileged. If you use a local Docker socket for learning on a disposable development machine, understand that it is not a production security boundary. For production, use a separated builder host/remote builder with a restricted authenticated interface.

### 12.4 Container restrictions for each template build

Implement and test these controls in the runner:

- Run as a non-root user where feasible.
- Set CPU, memory, process-count, execution-time and output-size limits.
- Drop unnecessary Linux capabilities; never run a template container as `--privileged`.
- Use a read-only source mount when practical and a dedicated writable output/temp location.
- Keep build containers separate from MongoDB, Redis and the production web/API network.
- During dependency installation, allow only the required registry/network access where feasible. Disable network during later build/test stages if the profile permits it.
- Do not forward environment variables wholesale from the runner host.
- Kill timed-out jobs and remove containers/temporary files after completion.
- Record the image/profile version used for reproducibility.

### 12.5 Multi-stage images

Use multi-stage Dockerfiles for the Next.js/API/worker runtime images: install/build dependencies in a builder stage, then copy only needed production output into a smaller runtime stage. Smaller images generally reduce transfer time and unnecessary packages. Use pinned base image versions and scan them in CI.

### 12.6 Docker Compose

- `compose.dev.yml`: local MongoDB and Redis; optionally app services when the workflow is stable.
- `compose.prod.yml`: production application services if running Compose on a single host, with production environment and no source-code bind mounts.
- Do not expose MongoDB/Redis ports publicly. Bind them to localhost in development and use private networks in production.
- Use persistent volumes for database data and durable storage for source/artifact data.
- Configure health checks and restart policies.
- Store production secrets in the deployment platform's secret manager or a controlled secrets file with restrictive permissions—not in Git.

Docker is an important part of this project because it provides **repeatable packaging for the app** and **isolation for template code**. These are separate uses, and the runner must be more isolated than the rest of the stack.

---

## 13. Building and previewing templates

The catalog can support many project types, but the build/preview engine must know exactly what each type requires.

### 13.1 Start with a small supported matrix

| Profile | Output | Initial support |
|---|---|---|
| `static-html` | HTML/CSS/JS folder | Good first profile |
| `vite-react-static` | Usually `dist/` | Good first profile |
| `next-static-export` | `out/` when the project supports `output: "export"` | Add after testing export behavior |
| `next-server` | Node.js server at runtime | Defer until dedicated per-template runtime deployment exists |
| Unknown/custom | Unknown | Reject or require engineering review |

A Next.js static export cannot use every Next.js server feature. A server-rendered Next.js app is not just a folder of static files. Never silently treat every `package.json` as a Vite project.

### 13.2 Build profiles are code, not free-form commands

An approved profile defines:

- Expected project files.
- Allowed package manager and lockfile.
- Install procedure.
- Build operation.
- Expected output path.
- Required environment-variable names and validation.
- Resource/time limits.
- Post-build checks.

The admin selects `vite-react-static`, for example, but cannot submit a request containing an arbitrary `command` string and have the runner execute it. The API maps profile IDs to code-owned behavior and rejects unknown IDs.

Do not assume `npm ci --ignore-scripts` works for every project; some build tools need lifecycle scripts. If scripts are required, run them only inside the isolated sandbox with no production secrets, never directly on the API host.

### 13.3 Source and artifact layout

Development example:

```text
storage/
└── templates/
    └── <template-id>/
        └── versions/
            ├── 1/
            │   ├── source/       # Imported source snapshot
            │   ├── output/       # Build output for this version
            │   ├── logs/         # Bounded build logs
            │   └── preview/      # Screenshots and test results
            └── 2/
                └── ...
```

This is a logical layout. In production, these may be object-storage keys rather than directories on the API host. Keep each version's output immutable. Never build a new release on top of the currently published output directory.

### 13.4 Preview origin

Prefer a separate preview origin such as:

`https://<template-id>-v<version>.preview.example.com/`

Do not serve arbitrary uploaded JavaScript under the same origin as the admin app (for example, `studio.example.com/templates/slug/`). Scripts running on the same origin can create session/cookie/security problems. Use a separate origin and host-only admin cookies. Preview iframes may also need a restrictive `sandbox` attribute and suitable Content Security Policy.

If using static preview hosting, serve only approved build artifacts, not source archives or logs. If a template needs a backend/server runtime, deploy it as a separate isolated runtime with strict network rules or mark it unsupported until that capability exists.

### 13.5 Cache behavior

- Cache versioned/hashed assets for a long time with immutable cache headers.
- Keep HTML/entry documents shorter-lived or revalidate them.
- Version thumbnails/URLs so a new upload does not display an old screenshot.
- Keep previous published artifacts through a defined rollback retention window.

---

## 14. Phase 2: local AI without a paid API key

Do not add this in Phase 1. First make the manual import/build/publish process reliable.

### 14.1 Suggested integration structure

Add these files for Phase 2:

```text
services/worker/src/ai/
├── ai-provider.ts          # Provider interface; avoids hard-coding one model
├── ollama-provider.ts      # Calls the configured local inference endpoint
├── analyze-template.ts     # Builds bounded inputs and validates the response
├── prompts.ts              # Versioned/reviewed prompts
└── schemas.ts              # Zod schema for model proposals
```

The rest of the system uses an interface, not a specific vendor. The manual workflow never requires importing the AI module.

### 14.2 Local inference configuration

Example variables (model name is a placeholder):

```dotenv
AI_MODE=disabled
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=<model-installed-on-your-machine>
AI_REQUEST_TIMEOUT_MS=60000
AI_MAX_INPUT_BYTES=100000
AI_MAX_OUTPUT_TOKENS=2000
```

Choose a model that exists on your local model host and fits your actual hardware. Do not commit secrets or prompts that contain sensitive source data.

If the worker runs in Docker while Ollama runs on the host, `127.0.0.1` inside the worker container points to the worker container, not the host. Use a correctly configured host gateway or a private Docker network. Never expose the Ollama endpoint to the public internet.

### 14.3 Never let the model run arbitrary commands

A model may propose structured metadata such as:

```json
{
  "displayName": "AI Agency",
  "category": "Agency",
  "tags": ["landing page", "agency"],
  "frameworkProfileSuggestion": "vite-react-static",
  "confidence": 0.88,
  "notes": ["A package lockfile was detected"]
}
```

Your application validates the result and the admin approves it. It does not execute a model-generated `command` string. The suggested profile must match the program's allowlist. Low-confidence or contradictory results require manual review.

### 14.4 Protect the AI context

Template READMEs, source comments and logs are untrusted. They may contain prompt-injection instructions. Treat the model response as untrusted too.

- Pass only the files needed for the requested task.
- Exclude `.env`, private keys, tokens, credentials, `node_modules`, `.git`, binaries and oversized files.
- Limit input bytes, file count, output tokens and execution time.
- Do not include secrets or unrelated user data in prompts.
- Validate response structure with Zod and profile choices with an allowlist.
- Record model version, prompt version, input checksum and outcome summary for reproducibility. Avoid unnecessarily retaining full source prompts.
- Require human approval before applying patches or publishing a first-time template.
- Always provide a manual path when the local model is unavailable.

### 14.5 What if AI is offline?

When `AI_MODE=disabled` or the model endpoint is down:

- Gallery browsing still works.
- Admin template CRUD still works.
- Manual profile selection and builds still work.
- Only AI analysis/repair buttons are disabled.
- An AI job can fail with a clear recoverable status, but it must not block the manual build queue.

---

## 15. Performance and database optimization

Optimize after correctness and security. Start simple and scale the part that actually becomes a bottleneck.

### Gallery

- Fetch only published records and only the fields needed for cards.
- Paginate results and enforce a maximum page size.
- Use thumbnails rather than large preview assets in the grid.
- Use Next.js Server Components for data that does not need browser interaction; add Client Components only for interactive controls/forms.
- Lazy-load below-the-fold images and provide responsive dimensions.
- Use loading, empty, and error states.
- Cache public read-only catalog data when appropriate, but never place personalized admin data in a shared public cache.

### API

- Validate input before making database queries.
- Use projections and `.lean()` for read-only Mongoose queries.
- Use pagination and indexes.
- Keep builds out of HTTP request handlers.
- Add per-route rate limits and upload size/concurrency limits.
- Avoid N+1 lookups for card/version data; use a compact published snapshot or a deliberate aggregate query.

### Build pipeline

- Limit concurrency based on actual RAM/CPU; several package installs can overwhelm a small server.
- Set per-job deadlines, disk quotas, maximum output sizes and cleanup rules.
- Cache package downloads in a controlled cache. Do not blindly share writable `node_modules` between unrelated projects.
- Build only the changed template/version.
- Include source checksum, lockfile checksum, profile version and runner image version in cache keys.
- Remove temporary containers and files after jobs complete.

### Database

- Create indexes based on real query patterns.
- Use `explain()` to inspect slow queries and index use.
- Bound all dashboard/history queries.
- Store bulky logs outside MongoDB.
- Tune MongoDB pools after measuring rather than guessing.

### Scale in the correct order

1. One Next.js service, one Express API, one worker, MongoDB and Redis.
2. Add limits, logs, health checks and backups.
3. Add separate build runners when volume requires them.
4. Add object storage/CDN when local artifact storage or bandwidth becomes insufficient.
5. Add workers only after jobs are idempotent and concurrency is measured.
6. Consider advanced orchestration only when there is a measurable need. Kubernetes is not required for the first release.

---

## 16. Security requirements

This platform runs code from template projects. Package installation and builds may execute scripts, so security is a core requirement.

### Authentication and authorization

- Use strong password hashing, server-side sessions and HTTPS.
- Set `HttpOnly`, `Secure` in HTTPS production, and an appropriate `SameSite` cookie value.
- Rotate session IDs after login and invalidate sessions on logout.
- Rate-limit login attempts and use generic login error messages.
- Add CSRF/origin protections suitable for cookie-authenticated state-changing routes.
- Protect every admin API route server-side; frontend hiding is not authorization.
- Never commit default admin passwords or session secrets.

### Archive and source validation

If ZIP uploads are accepted:

- Allow only expected archive types; inspect file content instead of trusting browser MIME headers alone.
- Enforce compressed byte size, maximum file count, per-file size and total uncompressed size.
- Reject path traversal (`../`), absolute paths and entries that resolve outside the workspace.
- Treat symlinks carefully; the simplest MVP can reject them.
- Reject nested archives or deeply nested directory structures unless there is a specific need.
- Generate destination names server-side.
- Store original archives outside the public web root.
- Protect against disk exhaustion and ZIP bombs.

### Template build isolation

- Never execute template code inside the web/API process.
- Never pass production secrets into build containers.
- Never mount the entire application filesystem into a template container.
- Avoid root and privileged containers.
- Apply CPU/RAM/process/disk/time limits and clean up after every job.
- Restrict egress so build code cannot reach private services/cloud metadata endpoints.
- Use least-privilege access to input/output storage.
- Make publishing a separate authorized step after successful build/tests.

### Data and operations

- Keep `.env`, uploaded source, private logs and local model files out of Git.
- Redact credentials from logs.
- Validate AI output as untrusted input.
- Scan dependencies and maintain updates.
- Configure a restrictive Content Security Policy where feasible.
- Configure TLS, request-body limits and rate limits at both proxy/application layers.
- Back up MongoDB and artifacts; test restoration.
- Audit create/update/build/publish/unpublish/rollback/archive actions.

See the OWASP File Upload Cheat Sheet and Express production security guide in [Official references](#21-official-references).

---

## 17. Testing strategy

Tests are part of the implementation, not a final polish step.

### Unit tests

Test:

- Slug normalization and collision handling.
- Safe workspace-path resolution.
- Allowed job-state transitions.
- Build-profile lookup/allowlist.
- Pagination and query parsing.
- Zod input schemas.
- AI proposal validation in Phase 2.

### API integration tests

Use a disposable test database and test environment variables. Test:

- Login success/failure and session invalidation.
- Admin versus anonymous authorization.
- Creating/editing template metadata.
- Duplicate-slug conflict.
- Public API never returns drafts.
- Unsupported build profile is rejected.
- Build request queues a job and returns promptly.
- Public users cannot read job logs.
- Failed update leaves the currently published pointer unchanged.
- Publish/rollback updates only the intended pointer.

### Worker/runner tests

Test:

- A small known fixture builds successfully with an approved profile.
- Invalid input is rejected before executing source code.
- Timeouts terminate a job.
- Output cannot escape the job output location.
- Repeated job delivery is idempotent.
- Failures record a safe error code/message.
- Temporary containers and files are cleaned up.
- No secrets are forwarded into build containers.

### Browser acceptance tests

Use Playwright to verify:

- Gallery renders and searches.
- Categories filter correctly.
- Visitors cannot access admin data.
- Admin can create/review a template.
- Job status appears in the dashboard.
- Successful templates show screenshot/preview links.
- Failed builds show safe error details.
- Mobile layout and keyboard controls work.

### CI workflow

On every pull request:

1. Run `npm ci` using the committed root lockfile.
2. Run formatting checks.
3. Run linting.
4. Run TypeScript checks.
5. Run unit and API tests.
6. Run production builds.
7. Scan dependencies and container images.

Deploy only from trusted branches/tags after checks pass. Inject secrets from the CI/deployment secret store, not from files committed to the repository.

---

## 18. Deployment and operations

### 18.1 Recommended production layout

```text
Internet
  |
HTTPS reverse proxy / ingress
  |-- /            -> Next.js web container
  |-- /api/v1/*    -> Express API container
  |
Private application network
  |-- MongoDB (managed database or private service)
  |-- Redis (private service)
  |-- Worker (no public ingress)

Separate builder environment / VM
  |-- Restricted runner controller
  |-- One disposable build container per job
  |-- Limited access to the job's source/output storage

Durable storage / object storage
  |-- source snapshots
  |-- build artifacts
  |-- screenshots
  |-- bounded logs
```

Prefer one public origin with path routing: `/` for Next.js and `/api/v1/*` for Express. This simplifies browser cookies and CORS. Next.js server-side fetches can use a private internal API URL. If web and API are on different origins, configure CORS and cookie credentials carefully.

### 18.2 Production requirements

- HTTPS and a maintained reverse proxy/ingress.
- Non-root runtime containers and pinned image versions.
- No source-code bind mounts in production app containers.
- MongoDB/Redis on private networks, never exposed to the public internet.
- Durable database/source/artifact storage and verified backups.
- Health checks, readiness probes and graceful shutdown.
- Structured logs with request/job IDs and redaction.
- Alerts for repeated job failures, queue backlog, storage exhaustion, and CPU/RAM pressure.
- Dependency patching and a documented rollback procedure.
- Rate limits and body-size limits at both proxy and application layers.

### 18.3 Next.js production

Use the official Next.js deployment guide. A Node.js server or Docker deployment supports the full Next.js feature set; static export has feature limitations. A multi-stage image and Next.js standalone output can reduce runtime image contents. Check the current official documentation for exact settings because Next.js evolves.

### 18.4 Express production

- Do not return stack traces to clients.
- Configure `trust proxy` to match your real proxy topology.
- Set body-size limits, CORS rules, security headers and rate limits.
- Handle SIGTERM/SIGINT: stop accepting new requests, close the HTTP server and release DB/Redis connections.
- Keep routes lightweight and use workers for long jobs.

### 18.5 Release and rollback

1. Build app images/artifacts in CI.
2. Run tests and scans.
3. Deploy to staging and run smoke tests.
4. Verify backup state before risky schema changes.
5. Deploy the application version.
6. Verify health/readiness and the key end-to-end workflow.
7. Keep the previous app image available for rollback.
8. For template releases, update the current-version pointer only after the new artifact passes review.

Do not call the platform production-ready until authentication, queue reliability, runner isolation, backups, monitoring and recovery have been tested on the actual target host.

---

## 19. Completion checklists

### Phase 1 — Manual system

- [ ] Existing template folders are inventoried; framework/runtime is verified, not guessed.
- [ ] Next.js public gallery and admin routes render.
- [ ] Express API validates configuration and starts cleanly.
- [ ] MongoDB connection and schemas work.
- [ ] Admin bootstrap/login/logout/session protection works.
- [ ] Public API returns published templates only.
- [ ] Admin can create a template record.
- [ ] Backend creates a managed workspace without accepting arbitrary paths.
- [ ] Trusted source folder/archive is copied into a versioned snapshot.
- [ ] Only approved build profiles run.
- [ ] API queues builds instead of running them inside HTTP handlers.
- [ ] Worker/runner produces a success/failure result and safe logs.
- [ ] Builds are isolated from API/database secrets.
- [ ] Preview/screenshot can be reviewed.
- [ ] Publishing only occurs after successful validation/review.
- [ ] Rollback works and old artifacts are retained.
- [ ] Unit/API/browser tests pass.
- [ ] Backup/restore and deployment/rollback runbooks exist.

### Phase 2 — Optional local AI

- [ ] `AI_MODE=disabled` works and is the default.
- [ ] Local inference is private and not exposed to the internet.
- [ ] AI inputs exclude secrets, binaries and unbounded file/logs.
- [ ] AI output is validated using a strict schema.
- [ ] AI suggests allowlisted profile IDs; it cannot execute arbitrary commands.
- [ ] Admin can edit, approve or reject the proposal.
- [ ] Manual workflow still works when AI is offline.
- [ ] Timeouts and resource limits are enforced.
- [ ] Model resource use and latency are measured on actual hardware.

---

## 20. Beginner glossary

| Term | Plain-English meaning |
|---|---|
| API | A defined way for one application to ask another for data or actions. |
| App Router | Next.js file-based routing system built around the `app` directory. |
| Artifact | Output produced by a build, such as static HTML/CSS/JS. |
| Build profile | A code-defined, allowlisted recipe for building a known project type. |
| Container | An isolated process environment packaged with needed dependencies. |
| Docker image | A reusable template used to start a container. |
| Docker Compose | A tool/configuration for starting related containers and services. |
| Idempotent job | A job that can be retried without producing inconsistent duplicate effects. |
| Index | A database structure that speeds up selected queries at a storage/write cost. |
| Lockfile | A file recording exact dependency versions for reproducible installs. |
| Monorepo | One repository containing several applications/packages. |
| MongoDB document | One record in a collection, similar to a JSON object. |
| Mongoose model | A code interface for validating/querying a MongoDB collection. |
| Object storage | File/blob storage accessed by keys rather than database fields. |
| Preview origin | A separate domain/origin used to display a built template safely. |
| Queue | A list of work waiting to be processed in the background. |
| Redis | A data store used here for queue coordination. |
| Rollback | Restoring a known-good version. |
| Schema | Rules for the shape and validation of data. |
| Session cookie | Browser cookie referring to server-managed login state. |
| Static site | A site served as files without a per-request server runtime. |
| SSR | Server-side rendering; the app needs a server at runtime. |
| Worker | Background process that takes work from a queue. |

---

## 21. Official references

Read official documentation while setting up/upgrading packages because requirements and configuration details can change.

### Next.js and Node.js

- [Next.js App Router getting started](https://nextjs.org/docs/app/getting-started)
- [Next.js installation and system requirements](https://nextjs.org/docs/app/getting-started/installation)
- [Next.js project structure](https://nextjs.org/docs/app/getting-started/project-structure)
- [Next.js deployment](https://nextjs.org/docs/app/getting-started/deploying)
- [Next.js self-hosting](https://nextjs.org/docs/app/guides/self-hosting)
- [Next.js standalone output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)
- [Node.js release schedule](https://github.com/nodejs/Release)

### Express, MongoDB and Mongoose

- [Express production security best practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Express production performance best practices](https://expressjs.com/en/advanced/best-practice-performance.html)
- [Mongoose schemas](https://mongoosejs.com/docs/guide.html)
- [Mongoose validation](https://mongoosejs.com/docs/validation.html)
- [Mongoose indexes](https://mongoosejs.com/docs/guide.html#indexes)
- [MongoDB schema design process](https://www.mongodb.com/docs/manual/data-modeling/schema-design-process/)
- [MongoDB indexes](https://www.mongodb.com/docs/manual/indexes/)

### Docker and queues

- [Docker multi-stage builds](https://docs.docker.com/get-started/docker-concepts/building-images/multi-stage-builds/)
- [Docker Compose in production](https://docs.docker.com/compose/how-tos/production/)
- [BullMQ introduction](https://docs.bullmq.io/guide/introduction)
- [BullMQ queues](https://docs.bullmq.io/guide/queues/)

### Security and local AI

- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [Ollama documentation](https://docs.ollama.com/)

### Original source library

- [mannrandhawa004/frontend_designs](https://github.com/mannrandhawa004/frontend_designs)

---

## Final recommendation

Build **Phase 1 first**. Prove one complete manual workflow: create a record → create a safe version folder → validate → build in isolation → preview → publish → rollback. Then import the other templates one at a time.

Only after the manual workflow is reliable should you add local AI. Keep AI optional and require strict schema validation and human approval. The model must not become the authority that executes commands or decides publication.

This guide describes a production-oriented design; it does not make the implementation production-ready by itself. Authentication, job reliability, runner isolation, backups, monitoring, restore and rollback must be implemented and verified before exposing the service publicly.

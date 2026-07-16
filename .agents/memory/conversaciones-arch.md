---
name: CONVERSACIONES architecture decisions
description: Key implementation decisions for the CONVERSACIONES BI chat platform MVP
---

# CONVERSACIONES Architecture Decisions

## Auth (MVP)
Cookie-based session using `cookie-parser`. Cookie name `userId` (plain integer, httpOnly). No JWT/Clerk yet. `RequireAuth` component reads session via `useGetSession()` and redirects to `/` if null. Migrating to real auth only requires replacing the user-selection screen.

**Why:** User explicitly chose MVP simplicity — select user from list, no passwords.

## File Upload
`POST /api/folders/:folderId/upload` is NOT in the OpenAPI spec (removed to avoid Orval codegen issues with `multipart/form-data` + `File`/`Blob` types). Frontend calls it with plain `fetch` + `FormData`. Backend uses `multer` with `memoryStorage`.

**Why:** Orval generates `zod.instanceof(File)` which doesn't work in Node/lib context, causing TS errors and name collisions.

## Excel Parsing
`xlsx` package used server-side in `artifacts/api-server/src/lib/excel-parser.ts`. Parses first sheet, detects column types (number/date/category/percentage/text), auto-detects metrics/dimensions from keyword matching, infers period and brand from filename + first rows. Stores up to 1000 rows in `data_rows` table.

**Why:** MVP scope — full data warehousing out of scope.

## DB Schema
Tables: `users`, `folders`, `folder_permissions`, `data_files`, `file_columns`, `data_rows`, `knowledge_concepts`, `concept_mappings`, `conversations_table` (renamed from `conversations` to avoid collision with old template), `messages_table`. All in `lib/db/src/schema/`.

**Important:** The Anthropic AI template copies a `lib/db/src/schema/messages.ts` that conflicts with the app schema — it was deleted. Watch for this if re-running the template copy.

## AI Integration
Anthropic Claude (claude-sonnet-4-6) via Replit AI Integrations. System prompt positions Claude as "Gerente de Control de Gestión" for automotive dealerships. Returns structured JSON with `answer`, `chart`, `kpis`, `insights` keys when data supports visualization.

## Codegen
`lib/api-spec/openapi.yaml` is the source of truth. Run `pnpm --filter @workspace/api-spec run codegen` to regenerate. After adding new tables to DB schema, run `pnpm run typecheck:libs` before `pnpm --filter @workspace/api-server run typecheck`.

## Seed Data
4 users (admin + 3 analysts), 6 folders (Patentamientos, Operaciones, Facturación, Taller, Finanzas, Stock), folder permissions per role, 8 knowledge concepts for automotive domain.

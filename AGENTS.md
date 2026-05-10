# ⚠️ CRITICAL NON-NEGOTIABLE INSTRUCTION
YOU MUST READ THIS ENTIRE AGENTS.md FILE IN FULL BEFORE YOU DO ANYTHING ELSE.
YOU MUST FOLLOW EVERY SINGLE RULE IN THIS FILE EXACTLY. NO EXCEPTIONS.
IF YOU SKIP ANY RULE OR STEP YOU HAVE FAILED THE TASK.
READ EVERY LINE. DO NOT SKIM. DO NOT USE CACHED VERSIONS.


# AGENTS.md — Behavioral Rules for All AI Agents

---

## 1. 📋 Standard Workflow (ALWAYS FOLLOW THIS ORDER)

1. Read AGENTS.md → Read ram.md → Read rom.md
2. List implementation steps BEFORE writing any code
3. Implement one sub-task at a time — no more than one file group per commit
4. Verify ALL acceptance criteria
5. Update ram.md
6. Generate completion report

---

## 2. ✅ Task Completion Checklist (NON-NEGOTIABLE)

**A task is NOT complete until ALL of the following pass. No exceptions. No shortcuts.**

Before declaring ANY sub-task done:
1. Run targeted lint/test on affected files only
2. TypeScript compiles with 0 errors on affected files (tsc --noEmit)
3. All existing functionality still works
4. Authentication/authorization tested
5. Error cases handled
6. No debug logs/console.log remaining
7. Documentation updated

**Before marking any task/PR as complete, you MUST run and pass ALL of:**

| Check | Command | Must Return |
|-------|---------|-------------|
| Backend typecheck | `cd backend && pnpm typecheck` | Exit 0 |
| Frontend typecheck | `cd frontend && pnpm typecheck` | Exit 0 |
| Backend lint | `cd backend && pnpm lint` | 0 errors, 0 warnings |
| Frontend lint | `cd frontend && pnpm lint` | 0 errors, 0 warnings |
| Backend build | `cd backend && pnpm build` | Exit 0 |
| Frontend build | `cd frontend && pnpm build` | Exit 0 |
| Backend tests | `cd backend && pnpm test` | All passing |

**If any check fails, the task is NOT complete. Fix the failure before declaring done.**

### 2.1 🚫 Completion Gate (NON-NEGOTIABLE)

The following are HARD BLOCKS. You may NOT claim a task is complete if:
- `pnpm lint` has ANY errors or warnings (backend or frontend)
- `pnpm typecheck` (tsc --noEmit) has ANY errors (backend or frontend)
- `pnpm build` fails (backend or frontend)
- `pnpm test` has ANY failures

**No task is ever "done enough" with failing CI. Zero tolerance.**

---

## 3. 📐 Project Rules

- NEVER add new npm packages without approval
- Follow existing patterns unless they conflict with a rule in this file
- Admin endpoints go in `/backend/src/routes/admin.ts`
- All write operations require audit logging
- Never commit .env files or secrets
- Commit message format: `[MXX.X] Description`

### 3.0 🔄 Commit & Documentation Sync (NON-NEGOTIABLE)

After EVERY significant implementation (any task that creates or modifies
more than trivial code):

1. **Commit** — Stage ALL changes with `git add .` and commit with proper format
2. **Push** — `git push` to origin immediately after commit
3. **Documentation sync** — ALL documentation files MUST be updated to match
   the current state of the codebase before the task is considered complete:
   - `ram.md` — Current task status, completed items, next steps
   - `docs/milestones.md` — Checkbox status for all affected milestone items
   - `docs/rom.md` — Any resolved issues, new architectural decisions
   - `docs/product_spec.md` — Feature additions, API changes
   - `docs/plans.md` — Implementation details if applicable

**This is a mandatory step. A task is NOT complete until code is committed,
pushed, and ALL documentation reflects reality.**

### 3.0b 🚫 BANNED: `sed` Edits (NON-NEGOTIABLE)

The `sed` command is PERMANENTLY BANNED for editing source code files.
It is error-prone, strips context, and causes invisible corruption (e.g.,
replacing text inside import statements, string literals, or comments).

- NEVER use `sed -i` on TypeScript, JavaScript, JSX, TSX, JSON, YAML, or HTML files
- NEVER use `sed` for bulk find-and-replace operations on source code
- Use the dedicated `Edit` tool (with exact oldString/newString context) instead
- The `sed` command may ONLY be used for one-off diagnostic grep pipelines
  that do NOT modify files

**Violation consequence**: Any file touched by `sed` MUST be reverted and
reconstructed using the `Edit` tool with proper contextual matches.

### 3.0c 🚫 BANNED: Glow / Neon / Glowing Styles (NON-NEGOTIABLE)

Agents MUST NEVER suggest, propose, or implement any CSS style involving
glow effects, neon colors, or glowing aesthetics unless the user explicitly
permits it in writing. This includes but is not limited to:

- `box-shadow` with spread/blur creating glow halos
- `text-shadow` with bright colors for neon text effects
- `filter: drop-shadow()` for glow
- `backdrop-filter` combined with bright backgrounds for glassmorphism glow
- `animation` with pulsing/glowing keyframes
- Any CSS that produces a luminous, radiant, or fluorescent visual effect

**This rule exists because glow/neon is a design choice, not a default.
It must never appear in any implementation without explicit approval.**

---

## 3.1 🏭 Enterprise-Grade Implementation Standards (NON-NEGOTIABLE)

This is NOT a side project, prototype, or hobby codebase. Every
implementation must meet production-grade standards. The following
are MANDATORY for every change:

### Dependency Management
- Every package used MUST be declared in `package.json` (dependencies or devDependencies).
  - No phantom dependencies. No "it works on my machine."
- After ANY change to `package.json`, the lockfile MUST be regenerated
  via `pnpm install --no-frozen-lockfile` and committed.
- `pnpm install --frozen-lockfile` MUST succeed in CI.

### CI/CD Integrity
- CI MUST call npm scripts (`pnpm test`, `pnpm lint`), never raw binaries (`pnpm vitest run`).
- No `|| true`, `|| exit 0`, `--if-present`, or any construct that
  silently suppresses failures. If a step is required, it MUST fail on error.
  If a step is optional, it MUST NOT be in CI.
- Build, lint, typecheck, and test steps MUST all pass. Zero tolerance
  for ignored failures.
- `tsc --noEmit` (typecheck) runs BEFORE build. Type errors are build errors.

### Code Quality Gates (Pre-Commit)
1. `pnpm lint` — 0 errors, 0 warnings
2. `pnpm typecheck` (`tsc --noEmit`) — 0 errors
3. `pnpm build` — 0 errors
4. `pnpm test` — all tests pass (when test infrastructure is available)
5. **No ternary-as-statement** — NEVER write `condition ? expr1 : expr2;` as a statement. Always use `if/else` for side effects. The ternary operator is for EXPRESSIONS returning a value, not for standalone side effects.

### No Workarounds
- Never suppress errors with `|| true`, `try {} catch {}`, `as any`,
  `@ts-ignore`, or `@ts-expect-error` (use only when genuinely unavoidable
  with a comment explaining why).
- Never leave dead code, commented-out blocks, or TODO stubs in production paths.
- Never commit code that you know is broken with the intent to "fix later."
  If it's broken, fix it before committing.

### 3.2 🔒 TypeScript Governance (NON-NEGOTIABLE)

These rules prevent type errors from entering the codebase. Every violation
below is a compile error in production builds.

#### Type Widening Prevention
- ALL constant objects used as type annotations (config, mappings, enums, error codes)
  MUST use `as const` on the object literal. This prevents TypeScript from widening
  `'text'` to `string` and causing incompatibility with library types.
  ```typescript
  // ❌ BAD — TypeScript widens 'text' to string
  const MAPPINGS = { title: { type: 'text', analyzer: 'english' } };
  // ✅ GOOD — literal types preserved
  const MAPPINGS = { title: { type: 'text' as const, analyzer: 'english' as const } };
  ```

#### Library Type Extensions
- ALL extensions to external library types (Express `Request`, JWT payload,
  Mongoose `Document`) MUST live in `backend/src/types/` as `.d.ts` declaration files.
- NEVER cast `req.user` with `as any` or `as unknown as ...`. Extend the type once
  and all route files pick it up automatically.
- Required declaration files at minimum:
  - `types/express.d.ts` — `Request.user`, `Request.admin`, `Request.fingerprint`
  - `types/jwt.d.ts` — JWT payload claims (`id`, `username`, `token_version`)
  - `types/mongoose.d.ts` — Custom document fields not in the schema interface

#### Redis Client API
- Redis `set()` MUST use the options-object form: `redis.set(key, val, { EX: ttl })`.
- NEVER use the positional form: `redis.set(key, val, 'EX', ttl)` — deprecated and
  breaks strict TypeScript overload resolution.

#### Duplicate Imports
- NEVER import the same module twice in the same file. This is trivially caught
  by `tsc --noEmit` and indicates sloppy editing.

#### Mongoose Lean Types
- When using `.lean()` on Mongoose queries, use the `Lean<T>` helper from
  `backend/src/types/mongoose.ts` instead of `Record<string, unknown>`.
- `.lean()` strips Mongoose document methods — raw casting to `as Record<string, unknown>`
  loses all type safety and hides real property access errors.

#### Dynamic Property Access
- When building MongoDB query objects dynamically (`query.created_at.$gte`), type the
  intermediate object as `Record<string, unknown>` and narrow at the field level,
  or use a typed builder pattern. Never use `as Record<string, unknown>` on a
  known-typed object to bypass an assignability error.

#### Zero-Error Incremental Policy
- Every commit MUST NOT introduce NEW `tsc --noEmit` errors.
- Fixing pre-existing type errors: fix ALL errors in one file per commit. Do not
  scatter fixes across files.
- The total error count must monotonically decrease — it can never go up.
- Pre-commit hook: `tsc --noEmit` must have 0 new errors vs the previous baseline.

### Infrastructure as Code
- Docker Compose, Dockerfile, CI configs, and nginx templates are production
  artifacts. They must be secure, pinned to versions, and follow least-privilege.
- No default passwords, no disabled security, no root containers.
- **Docker staleness is FORBIDDEN.** If the dev container's source code is out of
  sync with the host (stale image), it MUST be repaired immediately via rebuild:
  `docker compose build app && docker compose up -d app`. A stale container
  produces false test/lint/typecheck results and hides real bugs.
  Verify sync with: `docker exec yotop10_dev diff /app/backend/package.json /root/yotop10/backend/package.json`

### Testing
- Every pure function in `lib/` MUST have a corresponding `*.test.ts` file.
- Tests are NOT optional. A feature without tests is not complete.
- Test infrastructure (vitest configs, setup files, CI integration) must be
  fully wired BEFORE declaring a phase complete.

---

## 4. ⚠️ Priority Enforcement

- You MAY NOT start new tasks outside what is listed in ram.md
- You MAY fix bugs discovered incidentally if they directly block the current task
- Document any incidental fixes in the completion report
- Hard-block execution on non-priority tasks unless ram.md is updated first

---

## 5. 🚨 Error Procedures

1. If you break existing functionality: STOP, fix it immediately
2. If a fix requires more than 3 unsuccessful iterations, stop and request
   manual architectural guidance
3. Never guess requirements: Ask clarifying questions
4. Never silently ignore errors or work around problems

---

## 6. 📢 Communication & Checkpoint Rules

- **Synchronous Checkpoints**: STOP execution after every sub-task.
  Provide a status report and wait for "Go" before proceeding.
- **Zero-Silence Policy**: Every report must include specific files
  modified and remaining items in the sub-task queue.
- **Verification-Locked Reporting**: A sub-task is not "Done" until
  targeted lint/test passes. Include terminal output as evidence.
- Completion reports must list exactly what was implemented.

**Status report format (use this exact structure every time):**
- Task: [what was just completed]
- Evidence: [paste lint/test terminal output]
- Files changed: [explicit list]
- Next: [what comes next]
- Blockers: [anything unclear or unresolved]

---

## 7. 📝 Documentation Rules

- Update ram.md IMMEDIATELY when a task completes
- Update rom.md status tables when milestones change
- Never leave documentation out of sync with code

All new endpoints must document:
- HTTP method + full path
- Auth requirement (public / user / admin)
- Request body schema (link to the Zod schema file)
- Response shape
- All error cases and their HTTP status codes

---

## 8. 🔒 Defensive Schema Validation (MANDATORY)

- ALL API request bodies, query params, and environment variables
  MUST be validated with Zod
- No unvalidated data may ever touch the database or business logic
- All validation schemas live in `/backend/src/schemas/`
- Schemas must be exported and reused — never duplicate a schema inline
- Invalid inputs must return 400 with clear error messages
- Never trust client-side validation alone

---

## 9. 📦 Lockfile Governance

You MAY NOT modify `pnpm-lock.yaml` under ANY circumstances unless:
1. You are explicitly instructed to install a new package
2. You have received approval for the specific package
3. You document the exact version change and reason

- Never run `pnpm install` without explicit instruction
- Never commit lockfile changes unless they are intentional and documented

---

## 10. 🤫 Secret Masking Pre-Commit Check

BEFORE EVERY COMMIT you MUST:
1. Scan all modified files for hardcoded keys, passwords, API tokens,
   or internal IPs
2. Verify `.env` is NOT in the changeset
3. Verify no production credentials are present in any file
4. Verify no secrets appear in log output or error messages being added
5. If you find secrets, remove them immediately and abort the commit

---

## 11. ↩️ Atomic Rollback Strategy

- Every sub-task must be a single, clean, atomic git commit
- Rollback plan for any change is: `git revert <commit-hash>`
- All changes must be revertible with a single git command

**Exception**: Database migrations that delete data or drop columns
must include a documented rollback migration file before execution.
The rollback migration must be written and reviewed BEFORE the
forward migration runs.

---

## 12. ⚡ Idempotency Requirements

Idempotency is MANDATORY ONLY for:
- Database migrations
- Background job processors
- Trust score calculations and updates
- All financial/credit operations

Simple operations (log appending, one-time notifications) are exempt.

---

## 13. 🗺️ Dependency Blast Radius Mapping

BEFORE modifying any core utility or shared function:
1. Use grep / find references tooling to locate all usages
2. Provide count of affected files and summary of usage patterns
3. Document high-level blast radius of the change
4. If blast radius exceeds 10 files, STOP and request architectural
   guidance before proceeding
5. Confirm you understand side effects before proceeding

Do not provide an exhaustive list of every affected file.

---

## 14. 🔄 State Recovery Protocol

If context window resets or state is lost:
1. Re-read AGENTS.md in full before doing anything else
2. Run `git status` and `git diff` to see what was already done
3. Read current task from ram.md
4. EXPLICITLY STATE: "Recovered state. Completed X, working on Y next"
5. Never rely on chat history as source of truth
6. Never restart work from scratch without confirming existing changes
7. ALWAYS use `git add .` when staging changes. Never specify individual files.

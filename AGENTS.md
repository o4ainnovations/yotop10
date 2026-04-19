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

## 2. ✅ Task Completion Checklist

Before declaring ANY sub-task done:
1. Run targeted lint/test on affected files only
2. TypeScript compiles with 0 errors on affected files (tsc --noEmit)
3. All existing functionality still works
4. Authentication/authorization tested
5. Error cases handled
6. No debug logs/console.log remaining
7. Documentation updated

Before milestone completion:
1. Run full `pnpm build` with 0 errors
2. Run full `pnpm lint` with 0 warnings

---

## 3. 📐 Project Rules

- NEVER add new npm packages without approval
- Follow existing patterns unless they conflict with a rule in this file
- Admin endpoints go in `/backend/src/routes/admin.ts`
- All write operations require audit logging
- Never commit .env files or secrets
- Commit message format: `[MXX.X] Description`

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

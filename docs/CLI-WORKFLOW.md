# Internal development workflow

This file records the optional workflow used with Codex CLI during development. It is not required to run MeQ and should not be treated as product documentation.

AI tools were used to inspect files, propose changes, edit code, and run checks. The developer reviewed the resulting diffs and test output. `AGENTS.md`, the requirements, migrations, source code, and tests remain the repository references for application behavior.

## Working on a change

1. Read `AGENTS.md` and the relevant file under `docs/requirements/`.
2. Check the current branch and working tree before editing.
3. Limit the task to one behavior or documentation change.
4. Review the diff, including any generated files.
5. Run the checks required by `AGENTS.md`.
6. Test user-facing behavior before committing.

Useful commands:

```bash
git status
git diff
npm run typecheck
npm run lint
npm run build
npm run test:unit
```

Database changes also require the local Supabase tests:

```bash
npx supabase start
npm run test:db
```

AI-generated suggestions are not a substitute for checking transaction boundaries, RLS policies, authorization, multi-user behavior, or the non-negotiable business rules in `AGENTS.md`.

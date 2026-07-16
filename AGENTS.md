# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Commands

```bash
npm ci --legacy-peer-deps  # reproducible install from package-lock.json (same as CI and Docker)
npm install --legacy-peer-deps # use when intentionally changing dependencies
npm start            # dev server with hot reload at localhost:8080 (build/dev-server.js)
npm run build        # app build + standalone style bundle + initial bundle-size check
npm run check-bundle-size
npm run lint         # ESLint for JS/Vue plus Stylelint for SCSS/Vue styles
npm run unit         # jest --config test/unit/jest.conf.js --runInBand
npm run unit-with-coverage
npm test             # lint + unit (also runs as preversion hook)
```

Run a single test file: `npx jest --config test/unit/jest.conf.js --runInBand test/unit/specs/<path>.spec.js`

Version bump commands (`npm run patch|minor|major`) run `npm version`, which triggers `preversion` (full test suite) and `postversion` (push to origin master with tags + `npm publish`) — these have real side effects (git push, npm publish).

## Architecture

StackEdit is a client-heavy Vue 3 / Vuex 4 Markdown editor built with Webpack 5 and Babel 7. Most components still use the Options API, but they run natively on Vue 3 without the migration build. A thin Express 4 server handles backend-only concerns. Node.js 22+ and npm 10+ are required.

### Client vs server split

- `src/` — the Vue app and almost all application logic. The production build is an offline-first PWA generated with Workbox; `src/index.js` registers updates and requires native IndexedDB support.
- `server/` — a small Express app (`server/index.js`) mounted by `build/dev-server.js` in development and served standalone in production. It handles GitHub OAuth token exchange (`github.js`), optional user/PayPal sponsorship information backed by S3 (`user.js`), PDF export through wkhtmltopdf (`pdf.js`), and Pandoc export (`pandoc.js`). Configuration comes from environment variables centralized in `server/conf.js` (`values` stays server-side; `publicValues` is returned by `GET /conf`).
- Export endpoints share bounded input/concurrency middleware (`exportSecurity.js`), document and remote-resource validation (`exportDocumentPolicy.js`), and converter lifecycle/timeout handling (`exportProcess.js`). Remote export resources are allowlisted by `EXPORT_REMOTE_HOSTS`, and private/reserved network addresses are always rejected.
- Nearly all real work — editing, sync, conflict resolution, rendering — happens client-side; the server has no database and holds no document data.

### Vuex store (`src/store/`)

One module per concern, assembled in `src/store/index.js`: `content`, `contentState`, `contextMenu`, `data`, `discussion`, `explorer`, `file`, `findReplace`, `folder`, `layout`, `modal`, `notification`, `queue`, `syncedContent`, `userInfo`, `workspace`, plus two locations modules built from a shared factory (`locationTemplate`) for `publishLocation` and `syncLocation`.

Key root getters compute derived indexes across modules and are load-bearing for understanding how the file tree relates to sync backends:
- `allItemsById` — merges items from every module listed in `constants.types` into one lookup.
- `pathsByItemId` / `itemsByPath` — walk the `explorer` tree to compute human-readable paths per item.
- `gitPathsByItemId` / `itemIdsByGitPath` / `itemsByGitPath` — map items to the on-disk paths used when a workspace is backed by a git-like provider (GitHub/GitLab/Gist workspaces): files become `<path>.md`, data items become `.stackedit-data/<id>.json`, sync/publish locations are serialized+base64-encoded into the filename itself (`<path>.<encoded>.sync`/`.publish`).

Store runs in Vuex `strict` mode outside production and logs mutations via `vuex/dist/logger` in dev.

### Sync/provider architecture (`src/services/`)

This is the most important subsystem to understand before changing sync behavior:

- `workspaceSvc.js` — manages the current **workspace** (a "workspace" = a syncable root, e.g. the local browser workspace or a GitHub/GitLab/Google Drive-backed workspace).
- `syncSvc.js` — the core sync engine: reconciles local content against remote provider state, handles conflicts.
- `localDbSvc.js` — persistence to native IndexedDB plus the `sync()` entry point called after service-worker updates.
- `gitWorkspaceSvc.js` — workspace variant specifically for git-backed providers, works with the `gitPathsByItemId` getters above.
- `src/services/providers/` — one file per external backend (Dropbox, GitHub, GitHub-as-workspace, GitLab, GitLab-as-workspace, Google Drive, Google Drive AppData, Google Drive-as-workspace, Gist, CouchDB-as-workspace, Blogger, Blogger Page, WordPress, Zendesk). Providers split into **content providers** (used for one-off sync/publish targets) vs **workspace providers** (the whole workspace lives in that backend). `common/` and `helpers/` hold shared provider logic (e.g. OAuth dance helpers).
- `extensionSvc.js` + `src/extensions/` — pluggable Markdown rendering extensions (emoji, ABC notation via `abcjs`, KaTeX math, Mermaid diagrams, core markdown-it config). Extensions register into the markdown-it pipeline; `markdownGrammarSvc.js` and `markdownConversionSvc.js` handle grammar highlighting and format conversion (e.g. via `turndown` for HTML→Markdown).
- `editorSvc.js` + `src/services/editor/` — wraps the custom in-house **cledit** editor (`src/services/editor/cledit/`, `src/libs/pagedown.js`), a from-scratch contenteditable-based Markdown editor core (not CodeMirror/Monaco) with its own undo manager, selection manager, keystroke handling, and highlighter. `sectionUtils.js` handles splitting content into parsed sections for incremental re-render.
- `exportSvc.js` / `publishSvc.js` — export/publish flows that call into the server's `/pdfExport` and `/pandocExport` endpoints or directly into content providers.

### Components (`src/components/`)

Flat-ish structure, one `.vue` file per major UI piece (`Editor.vue`, `Preview.vue`, `Explorer.vue`, `ExplorerNode.vue` for the recursive file tree, `Layout.vue`, `SideBar.vue`, `StatusBar.vue`, `Toc.vue`, `Tour.vue`, etc.), with `menus/`, `modals/`, `gutters/`, and `common/` subfolders for grouped pieces. `modals/providers/` holds the per-provider auth/config dialogs matching `services/providers/`.

### Build system specifics

- Webpack 5 is split by environment across `build/webpack.base.conf.js`, `.dev.conf.js`, and `.prod.conf.js`. `build/webpack.style.conf.js` produces the standalone `/style.css` bundle, which the server caches separately from hashed `/static` assets.
- Workbox's `GenerateSW` plugin creates `dist/sw.js`. Initial JavaScript and CSS budgets are enforced by `build/check-bundle-size.js` after production builds.
- Prism uses its core package plus explicit language imports in `src/services/prismLanguages.js`; there is no generated `node_modules/prismjs/prism.js` or Gulp postinstall step.
- `NODE_ENV`, `VERSION`, and selected OAuth client IDs are injected as Webpack globals rather than read from `process.env` by browser code.
- `browserslist` targets `> 1%, last 2 versions, not ie <= 10`.

# Behavioral guidelines to reduce coding mistakes.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## GitHub PR workflow with 1Password

The `origin` remote uses the `github.com-private` SSH host alias and its private GitHub key is provided by the 1Password SSH agent.

1. Run `ssh -T github.com-private` in a real TTY before the first push and approve the 1Password/Touch ID prompt. GitHub's successful authentication message exits with status 1 because shell access is disabled; treat that message as success.
2. Run `git push -u origin <branch>` in a TTY as well. Non-interactive SSH calls can find the public key but hang or fail when 1Password signs it.
3. Create the PR with `gh pr create --repo simonbinom/stackedit --base master --head <branch> ...`.
4. Verify the result with `gh pr view <number> --repo simonbinom/stackedit --json url,state,isDraft,title,headRefName,baseRefName`.

Do not start by debugging or replacing credentials when the agent has no identities in a non-interactive check; try the TTY authentication flow first.

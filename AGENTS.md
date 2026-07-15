# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # also runs `gulp build-prism` via postinstall (builds prismjs/prism.js from selected components)
npm start            # dev server with hot reload at localhost:8080 (build/dev-server.js)
npm run build        # production build: build/build.js, then webpack for style (build-style)
npm run lint         # eslint --ext .js,.vue src server
npm run unit         # jest --config test/unit/jest.conf.js --runInBand
npm run unit-with-coverage
npm test             # lint + unit (also runs as preversion hook)
```

Run a single test file: `npx jest --config test/unit/jest.conf.js --runInBand test/unit/specs/components/<Name>.spec.js`

Version bump commands (`npm run patch|minor|major`) run `npm version`, which triggers `preversion` (full test suite) and `postversion` (push to origin master with tags + `npm publish`) — these have real side effects (git push, npm publish).

## Architecture

StackEdit is a client-heavy Vue 2 / Vuex 3 Markdown editor (webpack 2, Babel with `stage-2`/`env` presets — pre-ES-modules-native tooling). There's also a thin Express server for a few backend-only concerns.

### Client vs server split

- `src/` — the entire Vue app; this is where almost all logic lives. Built as a static bundle (offline-first PWA via `offline-plugin`, service worker install/update flow in `src/index.js`).
- `server/` — a small Express app (`server/index.js`) mounted by `build/dev-server.js` in dev and served standalone in production. It exists only for things the browser can't do itself: GitHub OAuth token exchange (`github.js`), user/PayPal sponsorship info backed by an S3-ish user bucket (`user.js`), server-side PDF export via wkhtmltopdf (`pdf.js`), and Pandoc export (`pandoc.js`). Config/secrets (OAuth client IDs/secrets, API keys, PayPal receiver) come from env vars, centralized in `server/conf.js` (`values` = private, `publicValues` = what's exposed to the client via `GET /conf`).
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
- `localDbSvc.js` — persistence to IndexedDB (via `indexeddbshim` for browsers lacking native support) plus the `sync()` entry point called after service-worker updates.
- `gitWorkspaceSvc.js` — workspace variant specifically for git-backed providers, works with the `gitPathsByItemId` getters above.
- `src/services/providers/` — one file per external backend (Dropbox, GitHub, GitHub-as-workspace, GitLab, GitLab-as-workspace, Google Drive, Google Drive AppData, Google Drive-as-workspace, Gist, CouchDB-as-workspace, Blogger, Blogger Page, WordPress, Zendesk). Providers split into **content providers** (used for one-off sync/publish targets) vs **workspace providers** (the whole workspace lives in that backend). `common/` and `helpers/` hold shared provider logic (e.g. OAuth dance helpers).
- `extensionSvc.js` + `src/extensions/` — pluggable Markdown rendering extensions (emoji, ABC notation via `abcjs`, KaTeX math, Mermaid diagrams, core markdown-it config). Extensions register into the markdown-it pipeline; `markdownGrammarSvc.js` and `markdownConversionSvc.js` handle grammar highlighting and format conversion (e.g. via `turndown` for HTML→Markdown).
- `editorSvc.js` + `src/services/editor/` — wraps the custom in-house **cledit** editor (`src/services/editor/cledit/`, `src/libs/pagedown.js`), a from-scratch contenteditable-based Markdown editor core (not CodeMirror/Monaco) with its own undo manager, selection manager, keystroke handling, and highlighter. `sectionUtils.js` handles splitting content into parsed sections for incremental re-render.
- `exportSvc.js` / `publishSvc.js` — export/publish flows that call into the server's `/pdfExport` and `/pandocExport` endpoints or directly into content providers.

### Components (`src/components/`)

Flat-ish structure, one `.vue` file per major UI piece (`Editor.vue`, `Preview.vue`, `Explorer.vue`, `ExplorerNode.vue` for the recursive file tree, `Layout.vue`, `SideBar.vue`, `StatusBar.vue`, `Toc.vue`, `Tour.vue`, etc.), with `menus/`, `modals/`, `gutters/`, and `common/` subfolders for grouped pieces. `modals/providers/` holds the per-provider auth/config dialogs matching `services/providers/`.

### Build system specifics

- Webpack 2, split by env: `build/webpack.base.conf.js`, `.dev.conf.js`, `.prod.conf.js`, plus a separate `build/webpack.style.conf.js` just for CSS (`npm run build-style`), because the app ships `style.css` separately from the JS bundle (see `server/index.js` serving `/style.css` with its own cache header, distinct from `/static`).
- `prismjs` syntax highlighting is not used off-the-shelf: `postinstall` runs `gulp build-prism` (see `gulpfile.js`) to concatenate a curated subset of Prism language components into a single `prism.js` inside `node_modules/prismjs`, which the rest of the build then imports. If Prism-related code/highlighting seems broken after a fresh `npm install`, check this step ran.
- `NODE_ENV` and `VERSION` are injected as webpack globals/ESLint globals (see `.eslintrc.js`), not read from `process.env` in client code.
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
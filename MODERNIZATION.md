# StackEdit — Modernisierungs-Review

Stand: 15. Juli 2026 · Methode: Code-Inspektion + `npm audit` gegen die bestehende `package-lock.json`

## Executive Summary

StackEdit läuft technisch noch auf dem Stand von ca. 2017–2018: Vue 2.5, Webpack 2, Babel 6, ESLint 4,
Jest 23, Node-Engine `>=8.0.0`. Die App funktioniert, aber der gesamte Werkzeuggürtel ist End-of-Life
oder kurz davor, und `npm audit` gegen die aktuelle Lockfile meldet **288 Schwachstellen** in
Abhängigkeiten (77 kritisch, 96 hoch, 102 mittel, 13 niedrig).

Die gute Nachricht: Der Kern der App — der selbstgebaute `cledit`-Editor, die Vuex-Datenmodelle, die
Sync-Provider — ist weitgehend Framework-agnostisch aufgebaut. Das Risiko konzentriert sich auf drei
klar abgrenzbare Baustellen: Toolchain, Framework-Major-Version und ein paar unmaintainte
Server-Pakete.

## 1. Sicherheitslage (`npm audit`)

Ein Großteil der 77 kritischen Treffer steckt in **Build-Zeit-Werkzeugen** (babel-core 6, webpack 2,
jest 23) — die landen nie im ausgelieferten Bundle, sind aber ein Zeichen dafür, dass seit Jahren nicht
mehr aktualisiert wurde. Die folgenden Pakete laufen tatsächlich im Browser oder auf dem Server und
sollten priorisiert werden:

| Paket | Wo | Schwere | Befund |
|---|---|---|---|
| `vue` | Client (Kern) | kritisch | ReDoS in `parseHTML` — behoben erst mit Vue 3 |
| `vue-template-compiler` | Build → Client | mittel | XSS-Lücke im Template-Compiler |
| `handlebars` | Client (Runtime-Dep) | kritisch | Mehrere RCE-Advisories in der 4.0.x-Reihe |
| `request` | Server (`user.js`) | kritisch | Paket selbst seit 2020 deprecated, keine Fixes mehr geplant |
| `elliptic` | transitiv (crypto) | kritisch | Signatur-Fälschung in älteren Versionen |
| `lodash` | transitiv, weit verbreitet | kritisch | Prototype Pollution, mehrfach |
| `xml2js` | transitiv (Font-Loader) | mittel | Prototype Pollution |
| `ws` | Dev-Server | hoch | ReDoS / Memory-Exhaustion — nur im Dev-Server relevant |
| `underscore` | transitiv | kritisch | Arbitrary Code Execution über Template-Funktion |

> **Fund am Rande:** `vue-loader@15.4.0` ist im Lockfile gegen `webpack@2.7.0` installiert — vue-loader
> 15 setzt aber offiziell Webpack ≥4 voraus. Ein frischer `npm install` heute ist damit nicht mehr
> garantiert reproduzierbar. Das sollte vor jeder weiteren Änderung als erstes verifiziert werden.

## 2. Core Framework

Vue 2 wurde am 31. Dezember 2023 End-of-Life gesetzt (nur noch kommerzieller Extended-Support). Die
aktuell eingesetzte Version 2.5.17 stammt sogar aus der Zeit *vor* Vue 2.6/2.7 und verpasst damit auch
reguläre Bugfixes der 2.x-Reihe.

| Paket | Version | Ziel | Hinweis |
|---|---|---|---|
| `vue` | 2.5.17 → 3.5.x | Major | Empfohlener Zwischenschritt: erst auf `2.7.16` (letzte 2.x, bringt Composition API als Migrationsbrücke), danach auf 3.x |
| `vuex` | 3.0.1 → 4.x / Pinia | Major | Vuex 4 ist der direkte Nachfolger für Vue 3, wird von Vue-Core aber nicht mehr weiterentwickelt — für eine Migration dieser Größenordnung lohnt sich der direkte Umstieg auf **Pinia** (offiziell empfohlen) |
| `vue-template-compiler` | 2.5.17 → entfällt | Ablösung | Wird durch `@vue/compiler-sfc` ersetzt (Teil des Vue-3-Tool-Umbaus) |

Praktisch betrifft die Migration vor allem: entfernte globale API (`Vue.use`/`Vue.filter`), entfernte
Filter-Syntax, geänderte `v-model`-Defaults, funktionale Komponenten-Syntax. Die Store-Getter in
`src/store/index.js` (`gitPathsByItemId` etc.) sind reine Funktionen ohne Vue-2-Spezifika und
übertragen sich 1:1.

## 3. Build-Tooling

Bestes Aufwand/Nutzen-Verhältnis: keine App-Logik betroffen, nur Konfiguration — aber Voraussetzung
für alles Weitere.

| Werkzeug | Version | Aktuell | Hinweis |
|---|---|---|---|
| `webpack` | 2.7.0 | 5.108.x | Alternative: kompletter Umstieg auf **Vite** — passt natürlich zu Vue 3 und macht den separaten `webpack.style.conf.js`-Baustein überflüssig |
| `babel-core` | 6.26.3 | `@babel/core` 7/8 | `preset-env` + `stage-2` sind Babel-6-Konzepte; Stage-Presets gibt es in Babel 7+ nicht mehr (einzelne `proposal-*`-Plugins) |
| `node-sass` | 4.14.1 | `sass` (dart-sass) | node-sass ist als Paket komplett deprecated; 4.x baut auf aktuellem Node ohne Nacharbeit oft gar nicht mehr |
| `eslint` | 4.19.1 | 9 – 10 | `eslint-config-airbnb-base` ist seit Jahren nicht mehr aktiv gepflegt; Flat-Config-Umstellung nötig |
| `jest` | 23.5.0 | 30.x | `vue-jest@1` / `babel-jest` müssen im selben Zug mit |
| `stylelint` | 9.x | 16.x | Config-Format hat sich mehrfach geändert |

> **Eigenheit im Build:** `postinstall` ruft `gulp build-prism` auf und konkateniert eine handverlesene
> Liste von Prism-Sprachkomponenten direkt in `node_modules/prismjs/prism.js` hinein (siehe
> `gulpfile.js`). Funktioniert, ist aber fragil (überlebt kein `npm ci` ohne den Postinstall-Hook) —
> bei der Tooling-Erneuerung auf einen regulären Bundler-Import umstellen.

## 4. Laufzeit-Abhängigkeiten

### Client

| Paket | Version | Aktuell | Hinweis |
|---|---|---|---|
| `markdown-it` | 8.4.1 | 14.x | 6 Majors Rückstand; alle `markdown-it-*`-Plugins mitziehen und gegen neue Version testen |
| `katex` | 0.13.0 | 0.17.x | Rendering-Fixes, kleinere API-Änderungen in `katexExtension.js` prüfen |
| `mermaid` | 8.9.2 | 11.x | Größter Sprung hier — Mermaid 10/11 haben die Rendering-Engine überarbeitet; bestehende Diagramme in Testdokumenten gegenprüfen |
| `prismjs` | 1.6.0 | 1.30.x | Koppelt an den Gulp-Concat-Sonderweg oben |
| `indexeddbshim` | 3.6.2 | — | Shim für Browser ohne native IndexedDB — 2026 praktisch kein Zielbrowser mehr betroffen; Kandidat zum ersatzlosen Entfernen |

### Server (`server/user.js`, `server/github.js`)

| Paket | Version | Ersatz | Hinweis |
|---|---|---|---|
| `request` | 2.88.0 | nativer `fetch` | Seit 2020 offiziell deprecated; wird hier nur für den PayPal-IPN-Verify-Call verwendet — kleiner, klar abgegrenzter Umbau |
| `aws-sdk` | 2.1380.0 (v2) | `@aws-sdk/client-s3` (v3) | v2 ist im Wartungsmodus; nur `getObject`/`putObject` auf einem S3-Bucket im Einsatz — überschaubarer Umbau auf den modularen v3-Client |
| `google-id-token-verifier` | 0.2.3 | `google-auth-library` | Kaum noch gepflegtes Nischenpaket für einen einzelnen Aufruf (`verifier.verify`) — durch Googles offizielle Bibliothek ersetzen |

## 5. Server & Infrastruktur

| Bereich | Ist-Zustand | Hinweis |
|---|---|---|
| Node-Engine | `>=8.0.0` in `package.json` | Node 8 ist seit Dezember 2019 EOL; Feld auf eine aktuelle LTS (20/22) anheben |
| CI | Travis CI, Node 12 | Travis' kostenloses OSS-Angebot ist eingestellt; Umzug auf GitHub Actions fällig, unabhängig von allem anderen hier |
| Express | 4.16.3 | Kein EOL, aber deutlich hinter aktuellem 4.21.x / 5.x zurück — unkritisches, risikoarmes Update |
| Docker-Basis-Image | `benweet/stackedit-base`, ungepinnt | Kein Digest-Pin, Herkunft/Wartungsstatus des Basis-Images nicht aus dem Repo ersichtlich — vor Modernisierung klären oder auf offizielles `node:<lts>-slim` umstellen |
| Lockfile | lockfileVersion 1 (npm 5/6) | Mit aktuellem npm neu erzeugen (lockfileVersion 3) für reproduzierbare, audit-fähige Installationen |

## 6. Priorisierter Fahrplan

Reihenfolge ist bewusst so gewählt, dass jede Phase auf der vorigen aufbaut und das Risiko erst am
Ende (Framework-Wechsel) ansteigt.

### Phase 1 — Sofortmaßnahmen
*Risiko: sehr niedrig · kein Framework-Code betroffen*

- Lockfile neu erzeugen und den Webpack/vue-loader-Mismatch verifizieren, bevor irgendetwas anderes angefasst wird
- `npm audit fix` ohne `--force` für die risikofreien Patches
- Node-Engine-Feld anheben, lokale Dev-Umgebung auf aktuelle LTS umstellen
- CI von Travis auf GitHub Actions migrieren
- Docker-Basis-Image pinnen bzw. Herkunft klären

### Phase 2 — Toolchain-Fundament
*Risiko: niedrig · reine Build-Konfiguration*

- Babel 6 → 7/8 (Presets/Plugins auf Proposal-Syntax umstellen)
- ESLint 4 → 9/10 mit Flat Config, Airbnb-Ersatz evaluieren
- Jest 23 → 30 inkl. `vue-jest`/`babel-jest`
- node-sass → sass (dart-sass), stylelint 9 → 16

### Phase 3 — Build-System
*Risiko: mittel · Build-Output muss 1:1 validiert werden*

- Webpack 2 → 5, oder Umstieg auf Vite (empfohlen im Zuge der Vue-3-Migration)
- Separaten `style.css`-Build-Pfad neu bewerten
- Prism-Gulp-Sonderweg durch regulären Bundler-Import ersetzen

### Phase 4 — Framework-Migration
*Risiko: hoch, aber größter Hebel · Vue 2 ist EOL*

- Zwischenschritt Vue 2.5 → 2.7.16 (Composition API als Brücke, Options-API-Komponenten bleiben unverändert lauffähig)
- Vue 3 + Vuex 4 oder direkt Pinia
- Modal-/Menü-Komponenten und Provider-Dialoge (`src/components/modals/providers`) einzeln durchtesten — dort steckt die meiste Options-API-Fläche

### Phase 5 — Laufzeit-Deps & Server-Härtung
*Risiko: niedrig-mittel · klar abgegrenzte Angriffsfläche*

- `request` → `fetch`, `aws-sdk` v2 → v3, `google-id-token-verifier` → `google-auth-library`
- markdown-it, KaTeX, Mermaid auf aktuelle Versionen (Mermaid-Diagramme in Testdokumenten gegenprüfen)
- Abschließend erneutes `npm audit` zur Erfolgskontrolle

## 7. Risiken & Besonderheiten

- **Der cledit-Editor ist der Migration eher gleichgültig.** `src/services/editor/cledit` ist ein
  selbstgebauter, contenteditable-basierter Editor-Kern ohne Vue-Abhängigkeit (kein
  CodeMirror/Monaco-Wrapper, keine Vue-Reaktivität im Kern) — das Risiko der Vue-3-Migration
  konzentriert sich also nicht auf den Editor, sondern auf die ca. 15 Sync-Provider-Module und ihre
  Modal-Dialoge.
- **Provider-Fläche ist groß und regressionsanfällig.** GitHub, GitLab, Google Drive (3 Varianten),
  Dropbox, WordPress, Zendesk, Blogger (2 Varianten), CouchDB — jeder mit eigener OAuth-Integration.
  Jede Abhängigkeits- oder Framework-Änderung, die diese Module berührt, sollte pro Provider gegen
  einen echten Account getestet werden; Sync-Konflikte sind das am schwersten automatisiert zu
  testende Verhalten der App.
- **Reihenfolge einhalten.** Der Webpack/vue-loader-Mismatch (siehe Abschnitt 1) bedeutet, dass der
  aktuelle Zustand schon fragil ist. Vor jeder inhaltlichen Änderung zuerst einen reproduzierbaren,
  sauberen `npm install` herstellen — sonst lässt sich nicht zuverlässig sagen, ob ein späterer Fehler
  von der Modernisierung oder vom bereits kaputten Ist-Zustand kommt.

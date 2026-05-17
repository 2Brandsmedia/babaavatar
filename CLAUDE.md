# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Was das Projekt ist

**BabaAvatar** — eine VTuber-Desktop-App. Die Webcam trackt Gesicht/Oberkörper/Hände des Users, ein VRM-Avatar (3D-Charakter) wird live animiert und in einem separaten Fenster auf grünem Hintergrund gerendert. Über OBS Window Capture + Chroma-Key landet der Avatar transparent im Twitch-Stream.

Eingebauter Browser für die wichtigsten freien VRM-Quellen (VRoid Hub, Booth, Open Source Avatars, Niconi Solid, Live3D). `.vrm`-Downloads werden automatisch in die lokale Library importiert, Lizenz wird ausgelesen und als Ampel angezeigt. VRoid Hub zusätzlich via OAuth-API.

Entwicklung läuft auf **macOS**, Build-Ziele sind **macOS (.dmg) und Windows (.exe)** — derselbe Code, beide Plattformen.

Vollständiger Architektur-Plan: `/Users/fuerte/.claude/plans/willst-du-dich-vorher-silly-rabbit.md`.

## Befehle

```bash
npm install              # Dependencies (~780 Packages)

npm run dev              # Electron + Vite mit HMR — startet Control + Output Window
npm run typecheck        # tsc für node- (main/preload) und web-Config (renderer)
npm run lint             # ESLint, 0 Warnings erforderlich
npm run format           # Prettier

npm run build            # typecheck + electron-vite Production-Build
npm run build:mac        # → dist/BabaAvatar-<version>.dmg
npm run build:win        # → dist/BabaAvatar Setup <version>.exe (NSIS, Cross-Build vom Mac geht)
npm run preview          # baut + startet die Production-App lokal
```

VRoid OAuth ist optional und braucht zwei Env-Variablen vor `npm run dev`:
```bash
VROID_CLIENT_ID=… VROID_CLIENT_SECRET=… npm run dev
```
Anwendungs-Registrierung unter https://hub.vroid.com/oauth/applications.

Tests sind noch nicht eingerichtet. Wenn welche entstehen, dann unter `src/**/__tests__/` mit Vitest.

## Architektur — drei Prozesse

| Prozess | Zweck | Liegt in |
|---|---|---|
| **Main** (Node.js) | App-Lifecycle, Window-Erzeugung, BrowserView für Avatar-Browser, Download-Hook (`.vrm`), IPC-Router, globalShortcut, electron-store, VRoid OAuth, VRM-Lizenz-Parser, strukturiertes Logging | `src/main/` |
| **Preload** (Bridge) | `contextBridge` mit typed API. Setzt `window.api` für den Renderer | `src/preload/` |
| **Renderer × 2** (Chromium) | Control-Window (Library/Browser/Tracking/Kalibrierung/Hotkeys/Settings) + Output-Window (Avatar auf grün) | `src/renderer/` |

### Zwei-Fenster-Modell

- **Control Window** (`src/main/windows.ts` → `createControlWindow`): 1280×800. Alle Einstellungen, Avatar-Bibliothek, Avatar-Browser, Kalibrierung, Webcam-Preview, Performance-Profiler.
- **Output Window** (`createOutputWindow`): Frameless, resizable, nur Avatar auf grünem Hintergrund (`#00B140`, einstellbar). Für OBS Window Capture + Chroma-Key.
- Beide kommunizieren über **`BroadcastChannel`** (`src/renderer/src/lib/broadcast/`) — kein IPC-Round-Trip durch den Main-Prozess pro Frame:
  - `pose-channel.ts` — Tracking-Pose-Stream (60 Hz)
  - `avatar-channel.ts` — aktiver Avatar + Asset-URL

### Tracking-Pipeline (Hot Path, Ziel 60 FPS auf RTX 4090)

```
Webcam (getUserMedia, src/renderer/src/lib/tracking/use-webcam.ts)
   └─► MediaPipe Tasks Vision (mediapipe-setup.ts)
         ├─ FaceLandmarker  (52 BlendShapes + Iris)
         ├─ PoseLandmarker  (33 Punkte, Oberkörper)
         └─ HandLandmarker  (21 × 2 Hände)
   └─► Kalidokit-Mapping (rigging.ts) → PoseFrame
   └─► OneEuroFilter (smoother.ts) ← gegen Jitter
   └─► useTracking-Hook → BroadcastChannel publish
   └─► Output-Window AvatarStage → applyPoseToVrm() → Three.js RAF

parallel:
Mikrofon → AudioWorklet → Meyda Formant-Analyse → Phoneme (A/I/U/E/O) → VRM-Mund
```

MediaPipe nutzt GPU via WebGL (`delegate: 'GPU'`). WASM-Module und Modelle werden zur Laufzeit von der Google-CDN nachgeladen (`tasks-vision@0.10.18`). Falls Offline-Distribution gewünscht, müssen WASM + `.task`-Files in `resources/` gebundlet und der `WASM_URL` umgestellt werden.

### Avatar-Lifecycle

1. User droppt `.vrm` per Drag&Drop, klickt "Import" oder lädt im Avatar-Browser herunter.
2. **Browser-Downloads**: `src/main/download-handler.ts` fängt jeden `.vrm`-Download per `session.on('will-download')` und schreibt nach `app.getPath('userData')/avatars/`.
3. **VRM-Lizenz-Parser**: `src/main/vrm-license.ts` macht **Magic-Number-Check** (glTF-Header `0x46546c67`) und liest die Lizenz-Metadata (VRM 0.x `meta` oder VRM 1.0 `extensions.VRMC_vrm.meta`) → `VrmLicense` mit Level `open` | `restricted` | `forbidden`.
4. **Thumbnail**: `src/renderer/src/lib/avatar/thumbnail.ts` rendert ein 256×256-Vorschaubild via Three.js und cached es als Data-URL im AvatarRecord.
5. Avatar wird in `electron-store` (`babaavatar-library.json` im userData) persistent registriert.
6. Bei Aktivierung: Avatar-Channel publiziert die Asset-URL → Output-Window lädt VRM via `babaavatar-asset://avatar/<id>` (Custom-Protokoll in `src/main/asset-protocol.ts`).

### Lizenz-Ampel (Pflicht)

In `src/renderer/src/components/avatar-library/LicenseBadge.tsx`:
- **Grün** (`level: 'open'`): Streaming + kommerzielle Nutzung explizit erlaubt
- **Gelb** (`level: 'restricted'`): nur persönlich oder unklar
- **Rot** (`level: 'forbidden'`): Autor erlaubt keine fremde Nutzung

Logik in `src/main/vrm-license.ts` → `classifyLevel()`.

### Custom-Protokoll für Asset-Loading

`babaavatar-asset://avatar/<id>` (`src/main/asset-protocol.ts`):
- Wird vor `app.whenReady` als `secure` + `stream`-fähig registriert
- Renderer lädt VRM via normale `fetch` → Main liefert per `net.fetch(pathToFileURL(...))` aus
- CSP der HTMLs erlaubt `babaavatar-asset:` in `default-src`/`img-src`/`connect-src`

### VRoid Hub OAuth-Flow

`src/main/vroid-api.ts`:
1. Custom-Protokoll `babaavatar://oauth-callback` registriert
2. Authorization-Code-Flow mit PKCE (S256)
3. Token-Tausch gegen `developer.vroid.com` API
4. Token via `safeStorage.encryptString` verschlüsselt in `electron-store` (`vroidAccessTokenEncrypted`)
5. API-Calls: `GET /api/character_models` → S3-presigned URL → Direkt-Download

Login ist **optional**. Ohne `VROID_CLIENT_ID`/`VROID_CLIENT_SECRET` zeigt `VroidLoginButton` einen Hinweis.

## Pfad-Aliase

| Alias | Pfad | Sichtbar in |
|---|---|---|
| `@shared/*` | `src/shared/*` | Main, Preload, Renderer |
| `@renderer/*` | `src/renderer/src/*` | Renderer |

`@shared/*` ist die **Single Source of Truth** für Types, Konstanten und IPC-Channels.

## IPC-Konventionen

- Alle Channel-Namen kommen aus `src/shared/ipc-channels.ts` (`IPC.AVATAR_LIST` etc.). Strings nicht inline schreiben.
- Renderer ruft Main über `window.api.<methodName>(...)` auf (Typed-Wrapper im Preload).
- Main → Renderer: `webContents.send(channel, payload)`, im Renderer abonnieren mit `window.api.on(channel, callback)`.
- **Pose-Frames laufen nicht über IPC**, sondern direkt via `BroadcastChannel` zwischen Control- und Output-Renderer (Performance, 60 Hz).

## Verzeichnisstruktur (wichtigste Module)

```
src/main/
├── index.ts              # App-Lifecycle, Single-Instance, Protocol-Handler
├── windows.ts            # Control + Output Window, Always-on-Top Toggle
├── ipc.ts                # IPC-Handler-Registry (alle Channels)
├── settings.ts           # electron-store Wrapper + safeStorage für VRoid-Token
├── avatars.ts            # Avatar-Dateisystem-CRUD (importFromBuffer, delete, list)
├── vrm-license.ts        # Magic-Number-Check + VRM 0.x/1.0 Lizenz-Parser
├── browser-view.ts       # WebContentsView für Avatar-Quellen + Tab-Switching
├── download-handler.ts   # session.on('will-download') → .vrm-Interception
├── profiles.ts           # Filesystem-CRUD für AvatarProfile (Kalibrierung)
├── hotkeys.ts            # globalShortcut Manager
├── vroid-api.ts          # OAuth + Pixiv-API-Client
├── asset-protocol.ts     # babaavatar-asset:// Protokoll für Avatar-Dateien
└── logger.ts             # Strukturiertes JSON-Logging in userData/logs/

src/shared/
├── constants.ts          # APP_NAME, Window-Defaults, AVATAR_BROWSER_SOURCES
├── ipc-channels.ts       # IPC-Channel-Konstanten
├── types.ts              # Single Source of Truth (PoseFrame, AvatarRecord, etc.)
└── curated-avatars.json  # Sofort-Start-Liste (CC0/MIT-VRMs)

src/renderer/src/
├── App.tsx               # Layout + Section-Routing
├── output.tsx            # Output-Window Entry
├── lib/
│   ├── tracking/         # MediaPipe-Setup, Rigging, One-Euro Smoother, Hooks
│   ├── avatar/           # VRM-Loader, Controller, Thumbnail, Idle-Animationen
│   ├── audio/            # Mikrofon, Meyda, Phoneme-Mapper, Lipsync-Hook
│   ├── three/            # Scene-Setup, Lighting, Renderer-Config
│   ├── broadcast/        # pose-channel + avatar-channel (BroadcastChannel)
│   └── ipc/              # api.ts (Typed Wrapper für window.api)
├── store/                # Zustand-Stores (settings, avatars)
├── components/
│   ├── ControlLayout.tsx
│   ├── Sidebar.tsx
│   ├── CreditsModal.tsx          # 2Brands-Branding-Modal
│   ├── avatar-library/           # Library, Card (memo!), DropZone, Import, LicenseBadge
│   ├── avatar-browser/           # AvatarBrowser, SourceTabs, Toolbar, DownloadQueue, CuratedList
│   ├── webcam-preview/           # WebcamPreview, TrackingOverlay
│   ├── calibration/              # 10-Schritt-Wizard
│   ├── hotkeys/                  # HotkeyManager (Strg+1..5 → Expressions)
│   ├── settings/                 # SettingsPanel mit Tracking/Background/Output/Performance Tabs
│   └── profiler/                 # PerformanceProfiler (FPS, JS-Heap)
└── output/               # OutputApp, AvatarStage (Three.js RAF-Loop)
```

## Profi-Code-Regeln (Pflicht)

- **Kein `any`** — `unknown` + Type Guards oder echte Types. ESLint: `@typescript-eslint/no-explicit-any: error`.
- **`noUncheckedIndexedAccess`** ist an — Array-Zugriffe sind `T | undefined`. Immer prüfen.
- **Komponenten in `.map()` brauchen `React.memo`**, sonst re-rendert die ganze Liste beim Parent-Update. Bereits durchgezogen in `AvatarCard`, `DownloadRow`, `HotkeyRow`, `SourceTabs`-Buttons.
- **`Map` statt `Array.find()` in Loops** — bei `.find()` innerhalb von `.map()` ist die Komplexität O(n²); vorher eine Map bauen.
- **Magic-Number-Check** bei jedem File-Upload (nicht MIME-Type vertrauen). VRM ist GLB → erste 4 Bytes `0x46546c67`.
- **Strukturiertes Logging** via `src/main/logger.ts` — `createLogger('module-name')`, JSON-Output, schreibt nach `userData/logs/babaavatar-YYYY-MM-DD.log`. Niemals `console.error(err)` mit Stack-Traces.
- **UI-Texte auf Deutsch**, echte Umlaute (ä/ö/ü/ß).
- **Komponenten max. 200 Zeilen**, sonst aufsplitten. Routes max. 150 Zeilen — Business-Logik in Service-Dateien.
- **Optimistic Updates mit Rollback** — siehe `useSettingsStore.update()` für das Muster.

## Datenspeicherung

| Datei / Ordner | Inhalt |
|---|---|
| `userData/config/babaavatar-settings.json` | App-Settings via `electron-store` |
| `userData/config/babaavatar-library.json` | Avatar-Records (Library) |
| `userData/avatars/<uuid>-<name>.vrm` | Importierte VRM-Dateien |
| `userData/profiles/<avatar-id>.json` | Kalibrierungs-Profile pro Avatar |
| `userData/downloads/` | Temporäre Download-Puffer für Avatar-Browser |
| `userData/logs/babaavatar-<datum>.log` | Strukturiertes JSON-Log |

## Plattform-Hinweise

- **Cross-Build vom Mac**: `npm run build:win` funktioniert. Ohne Code-Signing zeigt Windows einen SmartScreen-Hinweis beim ersten Start ("Trotzdem ausführen" reicht für privaten Gebrauch).
- **Mac-Spezialität**: `app.quit()` wird auf `darwin` nicht ausgeführt (Standard-Electron-Convention).
- **Single-Instance-Lock** in `src/main/index.ts` — zweite Instanz fokussiert die laufende.
- **GPU-Erwartung**: Ziel ist eine RTX 4090. Auf schwächeren GPUs `cameraFps` in den Settings auf 30 setzen.

## Aktueller Status (2026-05-16)

**Alle 13 Phasen implementiert** und Build läuft sauber durch:

1. ✅ Foundation
2. ✅ Window-System (Control + Output, IPC, BroadcastChannel)
3. ✅ VRM-Pipeline (Three.js + @pixiv/three-vrm + Idle-Animationen)
4. ✅ Webcam + MediaPipe (FaceLandmarker, PoseLandmarker, HandLandmarker)
5. ✅ Rigging (Kalidokit-Mapping + One-Euro-Filter)
6. ✅ Audio-Lipsync (Meyda Formanten → Phonemes A/I/U/E/O)
7. ✅ Avatar-Bibliothek (CRUD, Drag&Drop, Magic-Number-Check, VRM-Lizenz-Parser, Thumbnails)
8. ✅ Eingebauter Avatar-Browser (BrowserView + Source-Tabs + Download-Hook + Kuratierte Liste)
9. ✅ VRoid Hub OAuth (PKCE-Flow, safeStorage, optional)
10. ✅ Kalibrierungs-Wizard (10 Schritte, Profile-Persistence)
11. ✅ Hotkeys + Expressions (globalShortcut, Strg+1..5)
12. ✅ Settings + Profiler (Tracking/Background/Output/Performance Tabs)
13. ✅ Polish + Build (Icon, electron-builder Konfig, Credits-Modal, CLAUDE.md, changelog)

**Was getestet ist**: `npm run typecheck` und `npm run build` laufen ohne Fehler. Bundle-Größen: Main 32 kB, Preload 3.7 kB, Renderer Control 281 kB, Output 1.47 MB (Three.js + VRM).

**Was noch fehlt** (V2-Backlog):
- Twitch-Chat-Integration, OSC-Output, Spout/NDI (V1: nur Chroma-Key)
- Hintergrund-Bilder/Videos
- Auto-Updater
- Code-Signing für Windows-Production-Builds
- iPhone-FaceID-Companion
- Echte MediaPipe-Frame-Capture in den Kalibrierungs-Schritten (aktuell als Stubs mit "Wert übernehmen"-Buttons — die echte Pipeline wäre, im Wizard direkt auf den `pose-channel` zu abonnieren und den letzten Wert pro Step zu speichern)
- Echtes Hand-Gesten-Triggering für Expressions (Hand-Landmarks sind erfasst, aber die Geste→Expression-Mapping-Logik fehlt noch)

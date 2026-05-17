import { app, safeStorage, BrowserWindow, shell, WebContentsView, session, globalShortcut, ipcMain, protocol, net, dialog } from "electron";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import Store from "electron-store";
import fs from "node:fs";
import fs$1 from "node:fs/promises";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import __cjs_mod__ from "node:module";
const __filename = import.meta.filename;
const __dirname = import.meta.dirname;
const require2 = __cjs_mod__.createRequire(import.meta.url);
const DEFAULT_CHROMA_COLOR = "#00B140";
const DEFAULT_CONTROL_WINDOW = {
  width: 1280,
  height: 800,
  minWidth: 1024,
  minHeight: 640
};
const DEFAULT_OUTPUT_WINDOW = {
  width: 1080,
  height: 1080,
  minWidth: 480,
  minHeight: 480
};
const DEFAULT_TRACKING_SETTINGS = {
  cameraFps: 60,
  smoothingFactor: 0.5,
  blinkThreshold: 0.4,
  mouthSensitivity: 1,
  idleAnimationEnabled: true,
  autoBlinkEnabled: true,
  mirrorMode: true
};
let logFilePath = null;
let logStream = null;
function ensureLogFile() {
  if (!app.isReady()) return null;
  if (logStream) return logStream;
  const logsDir = path.join(app.getPath("userData"), "logs");
  fs.mkdirSync(logsDir, { recursive: true });
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  logFilePath = path.join(logsDir, `babaavatar-${today}.log`);
  logStream = fs.createWriteStream(logFilePath, { flags: "a" });
  return logStream;
}
function write(level, module, message, data) {
  const payload = {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    level,
    module,
    message,
    ...data !== void 0 ? { data } : {}
  };
  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
  const stream = ensureLogFile();
  if (stream) stream.write(`${line}
`);
}
function createLogger(moduleName) {
  return {
    debug: (message, data) => write("debug", moduleName, message, data),
    info: (message, data) => write("info", moduleName, message, data),
    warn: (message, data) => write("warn", moduleName, message, data),
    error: (message, error, data) => {
      const errorPayload = error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : { value: String(error) };
      write("error", moduleName, message, { ...data, error: errorPayload });
    }
  };
}
function closeLogger() {
  if (logStream) {
    logStream.end();
    logStream = null;
  }
}
const log$c = createLogger("settings");
const defaults = {
  selectedCameraId: null,
  selectedMicrophoneId: null,
  activeAvatarId: null,
  cameraFps: DEFAULT_TRACKING_SETTINGS.cameraFps,
  smoothingFactor: DEFAULT_TRACKING_SETTINGS.smoothingFactor,
  blinkThreshold: DEFAULT_TRACKING_SETTINGS.blinkThreshold,
  mouthSensitivity: DEFAULT_TRACKING_SETTINGS.mouthSensitivity,
  idleAnimationEnabled: DEFAULT_TRACKING_SETTINGS.idleAnimationEnabled,
  autoBlinkEnabled: DEFAULT_TRACKING_SETTINGS.autoBlinkEnabled,
  mirrorMode: DEFAULT_TRACKING_SETTINGS.mirrorMode,
  chromaColor: DEFAULT_CHROMA_COLOR,
  outputAlwaysOnTop: false,
  uiTheme: "dark",
  vroidAccessToken: null,
  firstStartDone: false,
  cameraZoom: 1,
  cameraOffsetX: 0,
  cameraOffsetY: 0,
  autoZoomEnabled: false,
  autoZoomRefDistance: 60,
  autoZoomMin: 0.5,
  autoZoomMax: 2.5
};
const store$1 = new Store({
  name: "babaavatar-settings",
  defaults: { ...defaults, vroidAccessTokenEncrypted: null }
});
function getAll() {
  const raw = store$1.store;
  return {
    selectedCameraId: raw.selectedCameraId,
    selectedMicrophoneId: raw.selectedMicrophoneId,
    activeAvatarId: raw.activeAvatarId,
    cameraFps: raw.cameraFps,
    smoothingFactor: raw.smoothingFactor,
    blinkThreshold: raw.blinkThreshold,
    mouthSensitivity: raw.mouthSensitivity,
    idleAnimationEnabled: raw.idleAnimationEnabled,
    autoBlinkEnabled: raw.autoBlinkEnabled,
    mirrorMode: raw.mirrorMode,
    chromaColor: raw.chromaColor,
    outputAlwaysOnTop: raw.outputAlwaysOnTop,
    uiTheme: raw.uiTheme,
    vroidAccessToken: decryptToken(raw.vroidAccessTokenEncrypted),
    firstStartDone: raw.firstStartDone,
    cameraZoom: raw.cameraZoom ?? defaults.cameraZoom,
    cameraOffsetX: raw.cameraOffsetX ?? defaults.cameraOffsetX,
    cameraOffsetY: raw.cameraOffsetY ?? defaults.cameraOffsetY,
    autoZoomEnabled: raw.autoZoomEnabled ?? defaults.autoZoomEnabled,
    autoZoomRefDistance: raw.autoZoomRefDistance ?? defaults.autoZoomRefDistance,
    autoZoomMin: raw.autoZoomMin ?? defaults.autoZoomMin,
    autoZoomMax: raw.autoZoomMax ?? defaults.autoZoomMax
  };
}
function get(key) {
  return getAll()[key];
}
function set(key, value) {
  if (key === "vroidAccessToken") {
    const token = value;
    store$1.set("vroidAccessTokenEncrypted", encryptToken(token));
    return;
  }
  store$1.set(key, value);
}
function encryptToken(token) {
  if (!token) return null;
  if (!safeStorage.isEncryptionAvailable()) {
    log$c.warn("safeStorage nicht verfügbar — Token wird nicht persistent gespeichert");
    return null;
  }
  return safeStorage.encryptString(token).toString("base64");
}
function decryptToken(encrypted) {
  if (!encrypted) return null;
  if (!safeStorage.isEncryptionAvailable()) return null;
  try {
    return safeStorage.decryptString(Buffer.from(encrypted, "base64"));
  } catch (err) {
    log$c.error("Token-Entschlüsselung fehlgeschlagen", err);
    return null;
  }
}
const __filename$2 = fileURLToPath(import.meta.url);
const __dirname$2 = path.dirname(__filename$2);
const PRELOAD = path.join(__dirname$2, "../preload/index.mjs");
const isDev = !!process.env["ELECTRON_RENDERER_URL"];
const log$b = createLogger("windows");
let refs = { controlWindow: null, outputWindow: null };
function setWindowRefs(next) {
  refs = next;
}
function createControlWindow() {
  const window = new BrowserWindow({
    width: DEFAULT_CONTROL_WINDOW.width,
    height: DEFAULT_CONTROL_WINDOW.height,
    minWidth: DEFAULT_CONTROL_WINDOW.minWidth,
    minHeight: DEFAULT_CONTROL_WINDOW.minHeight,
    title: "BabaAvatar – Steuerung",
    backgroundColor: "#0f0f12",
    show: false,
    webPreferences: {
      preload: PRELOAD,
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  window.on("ready-to-show", () => window.show());
  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  attachRendererDiagnostics(window, "control");
  if (isDev && process.env["ELECTRON_RENDERER_URL"]) {
    window.loadURL(process.env["ELECTRON_RENDERER_URL"]);
    window.webContents.openDevTools({ mode: "detach" });
  } else {
    window.loadFile(path.join(__dirname$2, "../renderer/index.html"));
  }
  log$b.info("Control-Window erstellt");
  return window;
}
function attachRendererDiagnostics(window, label) {
  window.webContents.on("console-message", (_event, level, message, line, source) => {
    log$b.info(`[renderer:${label}] console`, { level, message, line, source });
  });
  window.webContents.on("did-fail-load", (_event, errorCode, errorDescription, url) => {
    log$b.error(`[renderer:${label}] did-fail-load`, void 0, { errorCode, errorDescription, url });
  });
  window.webContents.on("render-process-gone", (_event, details) => {
    log$b.error(`[renderer:${label}] render-process-gone`, void 0, {
      reason: details.reason,
      exitCode: details.exitCode
    });
  });
}
function createOutputWindow() {
  const initialAlwaysOnTop = get("outputAlwaysOnTop");
  const initialChroma = get("chromaColor") || DEFAULT_CHROMA_COLOR;
  const window = new BrowserWindow({
    width: DEFAULT_OUTPUT_WINDOW.width,
    height: DEFAULT_OUTPUT_WINDOW.height,
    minWidth: DEFAULT_OUTPUT_WINDOW.minWidth,
    minHeight: DEFAULT_OUTPUT_WINDOW.minHeight,
    title: "BabaAvatar – Output",
    backgroundColor: initialChroma,
    frame: false,
    alwaysOnTop: initialAlwaysOnTop,
    show: false,
    webPreferences: {
      preload: PRELOAD,
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  window.on("ready-to-show", () => window.show());
  attachRendererDiagnostics(window, "output");
  if (isDev && process.env["ELECTRON_RENDERER_URL"]) {
    window.loadURL(`${process.env["ELECTRON_RENDERER_URL"]}/output.html`);
    window.webContents.openDevTools({ mode: "detach" });
  } else {
    window.loadFile(path.join(__dirname$2, "../renderer/output.html"));
  }
  log$b.info("Output-Window erstellt", { alwaysOnTop: initialAlwaysOnTop });
  return window;
}
function toggleOutputAlwaysOnTop(value) {
  refs.outputWindow?.setAlwaysOnTop(value);
  set("outputAlwaysOnTop", value);
  log$b.info("Output Always-on-Top umgeschaltet", { value });
}
function openOutputWindow() {
  if (!refs.outputWindow || refs.outputWindow.isDestroyed()) {
    const next = createOutputWindow();
    refs = { ...refs, outputWindow: next };
    return;
  }
  refs.outputWindow.show();
}
function closeOutputWindow() {
  refs.outputWindow?.hide();
}
const IPC = {
  // Avatar-Management
  AVATAR_LIST: "avatar:list",
  AVATAR_IMPORT_FILE: "avatar:import-file",
  AVATAR_DELETE: "avatar:delete",
  AVATAR_READ_LICENSE: "avatar:read-license",
  AVATAR_OPEN_FOLDER: "avatar:open-folder",
  AVATAR_ADDED: "avatar:added",
  // Settings
  SETTINGS_GET: "settings:get",
  SETTINGS_SET: "settings:set",
  SETTINGS_GET_ALL: "settings:get-all",
  // Profile (pro Avatar)
  PROFILE_GET: "profile:get",
  PROFILE_SET: "profile:set",
  // Output-Fenster
  OUTPUT_OPEN: "output:open",
  OUTPUT_CLOSE: "output:close",
  OUTPUT_TOGGLE_ALWAYS_ON_TOP: "output:always-on-top",
  // Avatar-Browser
  BROWSER_NAVIGATE: "browser:navigate",
  BROWSER_BACK: "browser:back",
  BROWSER_FORWARD: "browser:forward",
  BROWSER_RELOAD: "browser:reload",
  BROWSER_SHOW: "browser:show",
  BROWSER_HIDE: "browser:hide",
  BROWSER_SET_BOUNDS: "browser:set-bounds",
  // Downloads
  DOWNLOAD_PROGRESS: "download:progress",
  DOWNLOAD_DONE: "download:done",
  // VRoid Hub OAuth
  VROID_LOGIN: "vroid:login",
  VROID_LOGOUT: "vroid:logout",
  VROID_AUTH_STATE: "vroid:auth-state",
  VROID_LIST_CHARACTERS: "vroid:list-characters",
  VROID_IMPORT_CHARACTER: "vroid:import-character",
  // Hotkeys
  HOTKEY_REGISTER: "hotkey:register",
  HOTKEY_UNREGISTER: "hotkey:unregister",
  HOTKEY_TRIGGERED: "hotkey:triggered",
  // Kuratierte Liste
  CURATED_LIST: "curated:list",
  CURATED_DOWNLOAD: "curated:download"
};
const log$a = createLogger("vrm-license");
const GLB_MAGIC = 1179937895;
const JSON_CHUNK_TYPE = 1313821514;
async function readVrmLicense(filePath) {
  const buffer = await fs$1.readFile(filePath);
  return parseVrmLicense(buffer);
}
function parseVrmLicense(buffer) {
  if (buffer.byteLength < 20) {
    log$a.warn("Datei zu klein für GLB-Container");
    return null;
  }
  const magic = buffer.readUInt32LE(0);
  if (magic !== GLB_MAGIC) {
    log$a.warn("Magic-Number stimmt nicht (kein gültiges glTF/VRM)", { magic: magic.toString(16) });
    return null;
  }
  const jsonChunkLength = buffer.readUInt32LE(12);
  const jsonChunkType = buffer.readUInt32LE(16);
  if (jsonChunkType !== JSON_CHUNK_TYPE) {
    log$a.warn("Erster Chunk ist kein JSON");
    return null;
  }
  const jsonStart = 20;
  const jsonEnd = jsonStart + jsonChunkLength;
  if (jsonEnd > buffer.byteLength) {
    log$a.warn("JSON-Chunk reicht über Buffer hinaus");
    return null;
  }
  const jsonText = buffer.subarray(jsonStart, jsonEnd).toString("utf-8");
  let json;
  try {
    json = JSON.parse(jsonText);
  } catch (err) {
    log$a.error("VRM-JSON-Parsing fehlgeschlagen", err);
    return null;
  }
  return extractLicense(json);
}
function extractLicense(json) {
  if (!isGltfRoot(json)) return null;
  const ext = json.extensions ?? {};
  if (ext.VRMC_vrm?.meta) {
    return convertVrmOne(ext.VRMC_vrm.meta);
  }
  if (ext.VRM?.meta) {
    return convertVrmZero(ext.VRM.meta);
  }
  return null;
}
function convertVrmZero(meta) {
  const notes = [];
  const allowed = meta.allowedUserName ?? null;
  const commercial = meta.commercialUssageName ?? null;
  const violent = meta.violentUssageName ?? null;
  const sexual = meta.sexualUssageName ?? null;
  const licenseName = meta.licenseName ?? null;
  if (allowed === "OnlyAuthor") notes.push("Nur der Autor darf diesen Avatar nutzen.");
  if (commercial === "Disallow") notes.push("Kommerzielle Nutzung nicht erlaubt.");
  if (violent === "Disallow") notes.push("Darstellung von Gewalt nicht erlaubt.");
  if (sexual === "Disallow") notes.push("Darstellung sexueller Inhalte nicht erlaubt.");
  if (licenseName === "Redistribution_Prohibited") notes.push("Weitergabe verboten.");
  return {
    level: classifyLevel({ allowed, commercial, licenseName, vrmOne: false }),
    allowedUser: allowed,
    commercialUse: commercial,
    violentUse: violent,
    sexualUse: sexual,
    licenseName,
    otherPermissionUrl: meta.otherPermissionUrl ?? null,
    author: meta.author ?? null,
    title: meta.title ?? null,
    version: meta.version ?? null,
    notesForUser: notes
  };
}
function convertVrmOne(meta) {
  const notes = [];
  const allowed = meta.avatarPermission ?? null;
  const commercial = meta.commercialUsage ?? null;
  const violent = meta.violentUsage === true ? "Allow" : meta.violentUsage === false ? "Disallow" : null;
  const sexual = meta.sexualUsage === true ? "Allow" : meta.sexualUsage === false ? "Disallow" : null;
  const licenseName = meta.licenseUrl ?? null;
  if (allowed === "onlyAuthor") notes.push("Nur der Autor darf diesen Avatar nutzen.");
  if (commercial === "personalNonProfit") notes.push("Nur für persönliche, nicht-kommerzielle Nutzung.");
  if (violent === "Disallow") notes.push("Darstellung von Gewalt nicht erlaubt.");
  if (sexual === "Disallow") notes.push("Darstellung sexueller Inhalte nicht erlaubt.");
  return {
    level: classifyLevel({ allowed, commercial, licenseName, vrmOne: true }),
    allowedUser: allowed,
    commercialUse: commercial,
    violentUse: violent,
    sexualUse: sexual,
    licenseName,
    otherPermissionUrl: meta.otherLicenseUrl ?? null,
    author: meta.authors?.[0] ?? null,
    title: meta.name ?? null,
    version: meta.version ?? null,
    notesForUser: notes
  };
}
function classifyLevel(input) {
  if (input.licenseName === "Redistribution_Prohibited") return "forbidden";
  if (input.allowed === "OnlyAuthor" || input.allowed === "onlyAuthor") return "forbidden";
  if (input.vrmOne) {
    if (input.commercial === "allow" || input.commercial === "personalProfit") return "open";
    if (input.commercial === "personalNonProfit") return "restricted";
    return "restricted";
  }
  if (input.commercial === "Allow") return "open";
  if (input.commercial === "Disallow") return "restricted";
  return "restricted";
}
function isGltfRoot(value) {
  return typeof value === "object" && value !== null;
}
const log$9 = createLogger("avatars");
const store = new Store({
  name: "babaavatar-library",
  defaults: { avatars: [] }
});
function avatarsDir() {
  return path.join(app.getPath("userData"), "avatars");
}
async function ensureAvatarsDir() {
  await fs$1.mkdir(avatarsDir(), { recursive: true });
}
function listAvatars() {
  return store.get("avatars", []);
}
async function importAvatarFromPath(filePath, options = {}) {
  await ensureAvatarsDir();
  const stats = await fs$1.stat(filePath);
  if (!stats.isFile()) throw new Error("Pfad ist keine Datei");
  const buffer = await fs$1.readFile(filePath);
  return importAvatarFromBuffer(buffer, path.basename(filePath), options);
}
async function importAvatarFromBuffer(buffer, originalFileName, options = {}) {
  await ensureAvatarsDir();
  if (!isLikelyVrm(buffer)) {
    throw new Error("Datei ist kein gültiges VRM-Modell (Magic-Number-Check fehlgeschlagen)");
  }
  const id = crypto.randomUUID();
  const fileName = sanitizeFileName(originalFileName, id);
  const filePath = path.join(avatarsDir(), fileName);
  await fs$1.writeFile(filePath, buffer);
  let license = null;
  try {
    license = await readVrmLicense(filePath);
  } catch (err) {
    log$9.warn("Lizenz-Parsing fehlgeschlagen", { err: String(err) });
  }
  const record = {
    id,
    fileName,
    filePath,
    thumbnailDataUrl: options.thumbnailDataUrl ?? null,
    license,
    addedAt: Date.now(),
    sourceUrl: options.sourceUrl ?? null,
    displayName: options.displayName ?? license?.title ?? path.parse(fileName).name
  };
  const current = listAvatars();
  store.set("avatars", [...current, record]);
  log$9.info("Avatar importiert", { id, displayName: record.displayName });
  return record;
}
async function deleteAvatar(id) {
  const all = listAvatars();
  const record = all.find((a) => a.id === id);
  if (!record) return;
  try {
    await fs$1.unlink(record.filePath);
  } catch (err) {
    log$9.warn("VRM-Datei konnte nicht gelöscht werden", { id, err: String(err) });
  }
  store.set(
    "avatars",
    all.filter((a) => a.id !== id)
  );
  log$9.info("Avatar gelöscht", { id });
}
function openAvatarsFolder() {
  shell.openPath(avatarsDir());
}
function isLikelyVrm(buffer) {
  if (buffer.byteLength < 12) return false;
  return buffer.readUInt32LE(0) === 1179937895;
}
function sanitizeFileName(input, id) {
  const base = input.replace(/[^a-zA-Z0-9_.-]/g, "_").toLowerCase();
  if (base.endsWith(".vrm")) return `${id}-${base}`;
  return `${id}-${base}.vrm`;
}
const log$8 = createLogger("browser-view");
let view = null;
let host = null;
function setBrowserHost(context) {
  host = context;
}
function ensureView() {
  if (view && !view.webContents.isDestroyed()) return view;
  view = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  view.setBackgroundColor("#1c1c22");
  log$8.info("BrowserView erstellt");
  return view;
}
function navigateBrowser(url) {
  const next = ensureView();
  if (!host) {
    log$8.warn("Kein Host-Window registriert");
    return;
  }
  next.webContents.loadURL(url).catch((err) => {
    log$8.error("Navigation fehlgeschlagen", err, { url });
  });
}
function showBrowser(bounds) {
  if (!host) return;
  const next = ensureView();
  if (!host.parentWindow.contentView.children.includes(next)) {
    host.parentWindow.contentView.addChildView(next);
  }
  next.setBounds(bounds);
  next.setVisible(true);
}
function hideBrowser() {
  if (!view) return;
  view.setVisible(false);
}
function setBrowserBounds(bounds) {
  if (!view) return;
  view.setBounds(bounds);
}
function browserBack() {
  if (view?.webContents.navigationHistory.canGoBack()) {
    view.webContents.navigationHistory.goBack();
  }
}
function browserForward() {
  if (view?.webContents.navigationHistory.canGoForward()) {
    view.webContents.navigationHistory.goForward();
  }
}
function browserReload() {
  view?.webContents.reload();
}
const log$7 = createLogger("download-handler");
let broadcast = () => void 0;
function setDownloadBroadcast(fn) {
  broadcast = fn;
}
function registerDownloadHandler() {
  session.defaultSession.on("will-download", handleDownload);
  log$7.info("Download-Handler registriert");
}
function handleDownload(_event, item, _webContents) {
  const filename = item.getFilename();
  if (!filename.toLowerCase().endsWith(".vrm")) return;
  const url = item.getURL();
  const tempDir = path.join(app.getPath("userData"), "downloads");
  void fs$1.mkdir(tempDir, { recursive: true });
  const tempPath = path.join(tempDir, filename);
  item.setSavePath(tempPath);
  log$7.info("VRM-Download gestartet", { filename, url });
  const id = `${Date.now()}-${filename}`;
  item.on("updated", (_e, state) => {
    const progress = {
      id,
      filename,
      receivedBytes: item.getReceivedBytes(),
      totalBytes: item.getTotalBytes(),
      state: state === "progressing" ? "progressing" : "interrupted"
    };
    broadcast(IPC.DOWNLOAD_PROGRESS, progress);
  });
  item.once("done", async (_e, state) => {
    const totalBytes = item.getTotalBytes();
    const receivedBytes = item.getReceivedBytes();
    const done = {
      id,
      filename,
      receivedBytes,
      totalBytes,
      state: state === "completed" ? "completed" : state
    };
    broadcast(IPC.DOWNLOAD_PROGRESS, done);
    if (state !== "completed") {
      log$7.warn("VRM-Download nicht abgeschlossen", { filename, state });
      return;
    }
    try {
      const record = await importAvatarFromPath(tempPath, { sourceUrl: url });
      broadcast(IPC.DOWNLOAD_DONE, { id, filename, avatar: record });
      await fs$1.unlink(tempPath).catch(() => void 0);
      log$7.info("VRM importiert", { id: record.id });
    } catch (err) {
      log$7.error("Import nach Download fehlgeschlagen", err, { filename });
    }
  });
}
const log$6 = createLogger("vroid-api");
const PROTOCOL = "babaavatar";
const AUTHORIZATION_URL = "https://hub.vroid.com/oauth/authorize";
const TOKEN_URL = "https://hub.vroid.com/oauth/token";
const API_BASE = "https://hub.vroid.com/api";
const CLIENT_ID = process.env["VROID_CLIENT_ID"] ?? "";
const CLIENT_SECRET = process.env["VROID_CLIENT_SECRET"] ?? "";
const REDIRECT_URI = `${PROTOCOL}://oauth-callback`;
let pending = null;
function isVroidConfigured() {
  return Boolean(CLIENT_ID && CLIENT_SECRET);
}
function registerVroidProtocol() {
  if (process.defaultApp && process.argv.length >= 2 && process.argv[1]) {
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [process.argv[1]]);
  } else {
    app.setAsDefaultProtocolClient(PROTOCOL);
  }
  log$6.info("VRoid OAuth Protokoll registriert");
}
function handleOpenUrl(url) {
  if (!url.startsWith(`${PROTOCOL}://oauth-callback`)) return;
  if (!pending) {
    log$6.warn("OAuth-Callback ohne pending Auth empfangen");
    return;
  }
  const parsed = new URL(url);
  const code = parsed.searchParams.get("code");
  const returnedState = parsed.searchParams.get("state");
  if (!code || returnedState !== pending.state) {
    pending.reject(new Error("OAuth-Callback ungültig"));
    pending = null;
    return;
  }
  const verifier = pending.codeVerifier;
  exchangeCodeForToken(code, verifier).then((token) => {
    pending?.resolve(token);
    pending = null;
  }).catch((err) => {
    pending?.reject(err);
    pending = null;
  });
}
function startOAuthFlow() {
  if (!isVroidConfigured()) {
    return Promise.reject(
      new Error(
        "VRoid Hub Client-ID/Secret nicht konfiguriert. Setze VROID_CLIENT_ID und VROID_CLIENT_SECRET als Env-Variablen."
      )
    );
  }
  return new Promise((resolve, reject) => {
    if (pending) {
      pending.reject(new Error("Vorherige Anmeldung abgebrochen"));
    }
    const codeVerifier = base64UrlEncode(crypto.randomBytes(32));
    const challenge = base64UrlEncode(
      crypto.createHash("sha256").update(codeVerifier).digest()
    );
    const state = base64UrlEncode(crypto.randomBytes(16));
    pending = { codeVerifier, state, resolve, reject };
    const url = new URL(AUTHORIZATION_URL);
    url.searchParams.set("client_id", CLIENT_ID);
    url.searchParams.set("redirect_uri", REDIRECT_URI);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "default");
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", challenge);
    url.searchParams.set("code_challenge_method", "S256");
    void shell.openExternal(url.toString());
  });
}
async function listCharacters() {
  const token = get("vroidAccessToken");
  if (!token) throw new Error("Kein VRoid Hub Access Token vorhanden");
  const response = await fetch(`${API_BASE}/character_models`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Api-Version": "11"
    }
  });
  if (!response.ok) throw new Error(`API-Fehler: ${response.status}`);
  const json = await response.json();
  return json.data ?? [];
}
function logout() {
  set("vroidAccessToken", null);
  log$6.info("VRoid Logout");
}
async function exchangeCodeForToken(code, verifier) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code_verifier: verifier
  });
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  if (!response.ok) throw new Error(`Token-Tausch fehlgeschlagen: ${response.status}`);
  const json = await response.json();
  if (!json.access_token) throw new Error("Token fehlt in Antwort");
  set("vroidAccessToken", json.access_token);
  return json.access_token;
}
function base64UrlEncode(buffer) {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function focusControlForCallback() {
  const wins = BrowserWindow.getAllWindows();
  const main = wins[0];
  if (main && !main.isDestroyed()) {
    if (main.isMinimized()) main.restore();
    main.focus();
  }
}
const log$5 = createLogger("profiles");
function profilesDir() {
  return path.join(app.getPath("userData"), "profiles");
}
function profilePath(avatarId) {
  return path.join(profilesDir(), `${avatarId}.json`);
}
const defaultProfile = (avatarId) => ({
  avatarId,
  calibration: {
    neutralPose: null,
    mouthOpenMax: null,
    mouthClosedMin: null,
    eyeOpenMax: null,
    eyeClosedMin: null,
    browUpMax: null,
    browDownMin: null,
    smileMax: null
  },
  cameraPosition: { x: 0, y: 1.4, z: 1.6 },
  cameraFov: 30,
  avatarScale: 1,
  hotkeys: []
});
async function getProfile(avatarId) {
  try {
    const buffer = await fs$1.readFile(profilePath(avatarId), "utf-8");
    const parsed = JSON.parse(buffer);
    return parsed;
  } catch (err) {
    if (err.code === "ENOENT") {
      return defaultProfile(avatarId);
    }
    log$5.warn("Profil-Lesen fehlgeschlagen", { avatarId, err: String(err) });
    return defaultProfile(avatarId);
  }
}
async function setProfile(profile) {
  await fs$1.mkdir(profilesDir(), { recursive: true });
  await fs$1.writeFile(profilePath(profile.avatarId), JSON.stringify(profile, null, 2));
  log$5.info("Profil gespeichert", { avatarId: profile.avatarId });
  return profile;
}
const log$4 = createLogger("hotkeys");
const registered = /* @__PURE__ */ new Map();
let trigger = () => void 0;
function setHotkeyTrigger(fn) {
  trigger = fn;
}
function registerHotkey(hotkey) {
  unregisterHotkey(hotkey.id);
  const success = globalShortcut.register(hotkey.accelerator, () => trigger(hotkey));
  if (!success) {
    log$4.warn("globalShortcut konnte nicht registriert werden", { accelerator: hotkey.accelerator });
    return false;
  }
  registered.set(hotkey.id, hotkey);
  log$4.info("Hotkey registriert", { id: hotkey.id, accelerator: hotkey.accelerator });
  return true;
}
function unregisterHotkey(id) {
  const existing = registered.get(id);
  if (!existing) return;
  globalShortcut.unregister(existing.accelerator);
  registered.delete(id);
}
function unregisterAll() {
  globalShortcut.unregisterAll();
  registered.clear();
}
const log$3 = createLogger("ipc");
let ctx = null;
function registerIpcHandlers(context) {
  ctx = context;
  setDownloadBroadcast((channel, payload) => {
    ctx?.controlWindow.webContents.send(channel, payload);
  });
  setHotkeyTrigger((hotkey) => {
    ctx?.controlWindow.webContents.send(IPC.HOTKEY_TRIGGERED, hotkey);
    ctx?.outputWindow.webContents.send(IPC.HOTKEY_TRIGGERED, hotkey);
  });
  registerSettingsHandlers();
  registerOutputHandlers();
  registerAvatarHandlers();
  registerBrowserHandlers();
  registerVroidHandlers();
  registerProfileHandlers();
  registerHotkeyHandlers();
  log$3.info("IPC-Handler registriert");
}
function registerHotkeyHandlers() {
  ipcMain.handle(
    IPC.HOTKEY_REGISTER,
    (_e, hotkey) => registerHotkey(hotkey)
  );
  ipcMain.handle(IPC.HOTKEY_UNREGISTER, (_e, id) => {
    unregisterHotkey(id);
  });
  ipcMain.handle(
    IPC.CURATED_DOWNLOAD,
    async (_e, payload) => {
      const response = await fetch(payload.url, {
        redirect: "follow",
        headers: { "User-Agent": "BabaAvatar/0.1.0" }
      });
      if (!response.ok) {
        throw new Error(`Download fehlgeschlagen: ${response.status} ${response.statusText}`);
      }
      const buffer = await response.arrayBuffer();
      const urlPath = new URL(payload.url).pathname;
      const lastSegment = urlPath.split("/").pop() ?? "avatar.vrm";
      return { buffer, fileName: lastSegment };
    }
  );
}
function registerProfileHandlers() {
  ipcMain.handle(IPC.PROFILE_GET, (_e, avatarId) => getProfile(avatarId));
  ipcMain.handle(IPC.PROFILE_SET, (_e, profile) => setProfile(profile));
}
function broadcastAvatarAdded(record) {
  ctx?.controlWindow.webContents.send(IPC.AVATAR_ADDED, record);
  ctx?.outputWindow.webContents.send(IPC.AVATAR_ADDED, record);
}
function registerSettingsHandlers() {
  ipcMain.handle(IPC.SETTINGS_GET_ALL, () => getAll());
  ipcMain.handle(IPC.SETTINGS_GET, (_e, key) => get(key));
  ipcMain.handle(
    IPC.SETTINGS_SET,
    (_e, key, value) => {
      set(key, value);
      return getAll();
    }
  );
}
function registerOutputHandlers() {
  ipcMain.handle(IPC.OUTPUT_OPEN, () => {
    openOutputWindow();
  });
  ipcMain.handle(IPC.OUTPUT_CLOSE, () => {
    closeOutputWindow();
  });
  ipcMain.handle(IPC.OUTPUT_TOGGLE_ALWAYS_ON_TOP, (_e, value) => {
    toggleOutputAlwaysOnTop(value);
  });
}
function registerAvatarHandlers() {
  ipcMain.handle(IPC.AVATAR_LIST, () => listAvatars());
  ipcMain.handle(
    IPC.AVATAR_IMPORT_FILE,
    async (_e, payload) => {
      const buffer = Buffer.from(payload.buffer);
      const record = await importAvatarFromBuffer(buffer, payload.fileName, {
        thumbnailDataUrl: payload.thumbnailDataUrl,
        sourceUrl: payload.sourceUrl,
        displayName: payload.displayName
      });
      broadcastAvatarAdded(record);
      return record;
    }
  );
  ipcMain.handle(IPC.AVATAR_DELETE, async (_e, id) => {
    await deleteAvatar(id);
  });
  ipcMain.handle(
    IPC.AVATAR_READ_LICENSE,
    async (_e, filePath) => readVrmLicense(filePath)
  );
  ipcMain.handle(IPC.AVATAR_OPEN_FOLDER, () => {
    openAvatarsFolder();
  });
}
function registerBrowserHandlers() {
  ipcMain.handle(IPC.BROWSER_NAVIGATE, (_e, url) => {
    navigateBrowser(url);
  });
  ipcMain.handle(
    IPC.BROWSER_SHOW,
    (_e, bounds) => {
      showBrowser(bounds);
    }
  );
  ipcMain.handle(IPC.BROWSER_HIDE, () => {
    hideBrowser();
  });
  ipcMain.handle(
    IPC.BROWSER_SET_BOUNDS,
    (_e, bounds) => {
      setBrowserBounds(bounds);
    }
  );
  ipcMain.handle(IPC.BROWSER_BACK, () => browserBack());
  ipcMain.handle(IPC.BROWSER_FORWARD, () => browserForward());
  ipcMain.handle(IPC.BROWSER_RELOAD, () => browserReload());
}
function registerVroidHandlers() {
  ipcMain.handle(IPC.VROID_AUTH_STATE, () => {
    return {
      configured: isVroidConfigured(),
      authenticated: Boolean(get("vroidAccessToken"))
    };
  });
  ipcMain.handle(IPC.VROID_LOGIN, async () => {
    await startOAuthFlow();
    return { authenticated: true };
  });
  ipcMain.handle(IPC.VROID_LOGOUT, () => {
    logout();
  });
  ipcMain.handle(IPC.VROID_LIST_CHARACTERS, () => listCharacters());
}
const log$2 = createLogger("asset-protocol");
const ASSET_PROTOCOL = "babaavatar-asset";
function registerAssetProtocolPrivileges() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: ASSET_PROTOCOL,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        bypassCSP: false,
        stream: true
      }
    }
  ]);
}
function registerAssetProtocol() {
  protocol.handle(ASSET_PROTOCOL, async (request) => {
    const url = new URL(request.url);
    if (url.host !== "avatar") {
      return new Response("Not Found", { status: 404 });
    }
    const id = url.pathname.replace(/^\//, "");
    const avatar = listAvatars().find((a) => a.id === id);
    if (!avatar) {
      log$2.warn("Asset-Request für unbekannte Avatar-ID", { id });
      return new Response("Avatar nicht gefunden", { status: 404 });
    }
    try {
      return await net.fetch(pathToFileURL(avatar.filePath).toString());
    } catch (err) {
      log$2.error("Asset-Auslieferung fehlgeschlagen", err, { id });
      return new Response("Fehler beim Laden", { status: 500 });
    }
  });
  log$2.info("Asset-Protokoll registriert", { scheme: ASSET_PROTOCOL });
}
const require$1 = createRequire(import.meta.url);
const electronUpdaterPkg = require$1("electron-updater");
const { autoUpdater } = electronUpdaterPkg;
const log$1 = createLogger("auto-updater");
function initAutoUpdater({ controlWindow: controlWindow2 }) {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on("checking-for-update", () => {
    log$1.info("Suche nach Update");
  });
  autoUpdater.on("update-available", (info) => {
    log$1.info("Update verfügbar", { version: info.version });
    if (controlWindow2 && !controlWindow2.isDestroyed()) {
      controlWindow2.webContents.send("updater:available", { version: info.version });
    }
  });
  autoUpdater.on("update-not-available", () => {
    log$1.info("Keine neue Version");
  });
  autoUpdater.on("error", (err) => {
    log$1.error("Updater-Fehler", err);
  });
  autoUpdater.on("download-progress", (progress) => {
    if (controlWindow2 && !controlWindow2.isDestroyed()) {
      controlWindow2.webContents.send("updater:progress", {
        percent: progress.percent,
        bytesPerSecond: progress.bytesPerSecond
      });
    }
  });
  autoUpdater.on("update-downloaded", (info) => {
    log$1.info("Update heruntergeladen", { version: info.version });
    if (controlWindow2 && !controlWindow2.isDestroyed()) {
      controlWindow2.webContents.send("updater:downloaded", { version: info.version });
    }
    void dialog.showMessageBox(controlWindow2 ?? void 0, {
      type: "info",
      buttons: ["Jetzt neu starten", "Später"],
      defaultId: 0,
      title: "Update bereit",
      message: `BabaAvatar ${info.version} ist heruntergeladen.`,
      detail: "Soll die App jetzt neu gestartet werden, um das Update zu installieren?"
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });
  void autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    log$1.error("checkForUpdatesAndNotify fehlgeschlagen", err);
  });
}
const __filename$1 = fileURLToPath(import.meta.url);
const __dirname$1 = path.dirname(__filename$1);
process.env["APP_ROOT"] = path.join(__dirname$1, "..", "..");
const log = createLogger("main");
const singleInstanceLock = app.requestSingleInstanceLock();
if (!singleInstanceLock) {
  app.quit();
  process.exit(0);
}
app.setName("BabaAvatar");
registerAssetProtocolPrivileges();
registerVroidProtocol();
app.on("open-url", (event, url) => {
  event.preventDefault();
  focusControlForCallback();
  handleOpenUrl(url);
});
let controlWindow = null;
let outputWindow = null;
function bootstrap() {
  log.info("Starte BabaAvatar", { platform: process.platform, version: app.getVersion() });
  controlWindow = createControlWindow();
  outputWindow = createOutputWindow();
  setWindowRefs({ controlWindow, outputWindow });
  setBrowserHost({ parentWindow: controlWindow });
  registerIpcHandlers({ controlWindow, outputWindow });
  registerDownloadHandler();
  if (!process.env["ELECTRON_RENDERER_URL"]) {
    initAutoUpdater({ controlWindow });
  }
}
app.whenReady().then(() => {
  registerAssetProtocol();
  bootstrap();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      bootstrap();
    }
  });
});
app.on("second-instance", (_event, argv) => {
  const url = argv.find((arg) => arg.startsWith("babaavatar://"));
  if (url) {
    handleOpenUrl(url);
  }
  if (controlWindow) {
    if (controlWindow.isMinimized()) controlWindow.restore();
    controlWindow.focus();
  }
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
app.on("before-quit", () => {
  log.info("Beende BabaAvatar");
  unregisterAll();
  closeLogger();
});

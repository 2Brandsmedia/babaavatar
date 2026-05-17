export const IPC = {
  // Avatar-Management
  AVATAR_LIST: 'avatar:list',
  AVATAR_IMPORT_FILE: 'avatar:import-file',
  AVATAR_DELETE: 'avatar:delete',
  AVATAR_READ_LICENSE: 'avatar:read-license',
  AVATAR_OPEN_FOLDER: 'avatar:open-folder',
  AVATAR_ADDED: 'avatar:added',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_GET_ALL: 'settings:get-all',

  // Profile (pro Avatar)
  PROFILE_GET: 'profile:get',
  PROFILE_SET: 'profile:set',

  // Output-Fenster
  OUTPUT_OPEN: 'output:open',
  OUTPUT_CLOSE: 'output:close',
  OUTPUT_TOGGLE_ALWAYS_ON_TOP: 'output:always-on-top',

  // Avatar-Browser
  BROWSER_NAVIGATE: 'browser:navigate',
  BROWSER_BACK: 'browser:back',
  BROWSER_FORWARD: 'browser:forward',
  BROWSER_RELOAD: 'browser:reload',
  BROWSER_SHOW: 'browser:show',
  BROWSER_HIDE: 'browser:hide',
  BROWSER_SET_BOUNDS: 'browser:set-bounds',

  // Downloads
  DOWNLOAD_PROGRESS: 'download:progress',
  DOWNLOAD_DONE: 'download:done',

  // VRoid Hub OAuth
  VROID_LOGIN: 'vroid:login',
  VROID_LOGOUT: 'vroid:logout',
  VROID_AUTH_STATE: 'vroid:auth-state',
  VROID_LIST_CHARACTERS: 'vroid:list-characters',
  VROID_IMPORT_CHARACTER: 'vroid:import-character',

  // Hotkeys
  HOTKEY_REGISTER: 'hotkey:register',
  HOTKEY_UNREGISTER: 'hotkey:unregister',
  HOTKEY_TRIGGERED: 'hotkey:triggered',

  // Kuratierte Liste
  CURATED_LIST: 'curated:list',
  CURATED_DOWNLOAD: 'curated:download',

  // VMC (Virtual Motion Capture) — externe Tracker
  VMC_START: 'vmc:start',
  VMC_STOP: 'vmc:stop',
  VMC_STATUS: 'vmc:status',
  VMC_FRAME: 'vmc:frame',
  VMC_LOCAL_IPS: 'vmc:local-ips',
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];

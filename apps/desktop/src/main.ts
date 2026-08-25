/**
 * Electron main process — the local-first back end host.
 *
 * SECURITY BOUNDARY: everything native lives here, never in the renderer. The
 * renderer is sandboxed (contextIsolation on, nodeIntegration off) and reaches
 * this process ONLY through the typed `window.mi` / `window.miSecure` bridges.
 * The Gemini key lives in the OS keychain (safeStorage); research state
 * persists to a JSON snapshot in userData. (SQLite/Drizzle remains the
 * documented upgrade path — same ResearchStore seam.)
 */
import { app, BrowserWindow, ipcMain, Menu, type MenuItemConstructorOptions, nativeImage, net, protocol, safeStorage } from 'electron';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { IPC_CHANNELS, SECURE_CHANNELS, type MarketIntelRepository } from '@mi/contracts';
import { z } from 'zod';
import {
  createMarketInputSchema,
  deckResearchBriefSchema,
  cardFilterSchema,
  deepDiveInputSchema,
  factCheckInputSchema,
  verifyMetricInputSchema,
  reportRequestSchema,
  expandFocusSchema,
  overrideMetricInputSchema,
  askResearchInputSchema,
  listResearchThreadsFilterSchema,
  refreshCadenceSchema,
  dashboardTabSchema,
} from './ipc-schemas.js';
import { MockRepository } from '@mi/mocks';
import { GeminiRepository, type RepoSnapshot, type ResearchStore } from '@mi/research';
import { performGoogleOAuthFlow, loadDesktopEnv, type OAuthUser } from './oauth.js';

loadDesktopEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIST = app.isPackaged
  ? path.join(process.resourcesPath, 'web-dist')
  : path.join(__dirname, '../../web/dist');

app.name = 'Stratemark';
app.setName('Stratemark');
process.title = 'Stratemark';

function createApplicationMenu(): void {
  const isMac = process.platform === 'darwin';

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: 'Stratemark',
            submenu: [
              { role: 'about', label: 'About Stratemark' },
              { type: 'separator' },
              { role: 'hide', label: 'Hide Stratemark' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit', label: 'Quit Stratemark' },
            ] as MenuItemConstructorOptions[],
          },
        ]
      : []),
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [{ type: 'separator' }, { role: 'front' }] : [{ role: 'close' }]),
      ] as MenuItemConstructorOptions[],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

// ---------------------------------------------------------------------------
// Persistence + key management (main-process only)
// ---------------------------------------------------------------------------
function createFileStore(file: string): ResearchStore {
  return {
    read(): RepoSnapshot | null {
      try {
        return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as RepoSnapshot) : null;
      } catch {
        return null;
      }
    },
    write(snapshot: RepoSnapshot): void {
      try {
        mkdirSync(path.dirname(file), { recursive: true });
        const temp = `${file}.tmp`;
        writeFileSync(temp, JSON.stringify(snapshot));
        renameSync(temp, file);
      } catch (err) {
        console.error('Failed to persist research snapshot:', err);
      }
    },
  };
}

const keyFile = (): string => path.join(app.getPath('userData'), 'gemini.key.enc');

/**
 * Thrown when the OS cannot encrypt at rest. Surfaced to the renderer so the
 * user is told plainly, rather than silently getting weaker storage than the
 * filename claims.
 */
export class SecureStorageUnavailableError extends Error {
  constructor() {
    super(
      'Secure storage is not available on this system, so the API key was not saved. ' +
        'Enter it again each session, or install an OS keyring (e.g. gnome-keyring) and retry.',
    );
    this.name = 'SecureStorageUnavailableError';
  }
}

function loadApiKey(): string {
  try {
    if (!existsSync(keyFile())) return '';
    // Only ever read back through the same encryption that wrote it. Reading a
    // file as plaintext when encryption is unavailable is how a key written by
    // the old code path would keep being honored.
    if (!safeStorage.isEncryptionAvailable()) return '';
    return safeStorage.decryptString(readFileSync(keyFile()));
  } catch {
    return '';
  }
}

/**
 * Persist the API key, encrypted, or refuse.
 *
 * This previously fell back to `Buffer.from(key, 'utf8')` when
 * `safeStorage.isEncryptionAvailable()` returned false — writing the raw key to
 * a file named `gemini.key.enc`. On any machine without an OS keyring (Linux
 * without gnome-keyring, headless sessions, CI) the `.enc` extension was a lie
 * and the credential sat in plaintext on disk. Refusing is the correct
 * behaviour: a key the user must retype each session is a minor inconvenience,
 * a leaked key is not.
 */
function saveApiKey(key: string): void {
  if (!key) {
    if (existsSync(keyFile())) rmSync(keyFile());
    return;
  }
  if (!safeStorage.isEncryptionAvailable()) {
    throw new SecureStorageUnavailableError();
  }
  writeFileSync(keyFile(), safeStorage.encryptString(key));
}

// ---------------------------------------------------------------------------
// Repository host — live GeminiRepository when a key exists, demo otherwise.
// Hot-swapped when the key changes; refresh events re-wired on swap.
// ---------------------------------------------------------------------------
let repository: MarketIntelRepository;
let unwireRefresh: (() => void) | null = null;
let mainWin: BrowserWindow | null = null;

function makeRepository(): MarketIntelRepository {
  const apiKey = loadApiKey();
  if (!apiKey) return new MockRepository();
  return new GeminiRepository({
    apiKey,
    store: createFileStore(path.join(app.getPath('userData'), 'research', 'repo.json')),
    targetCompanies: 10,
    // Broad markets are researched as a sequential queue to stay predictable on free tier.
    concurrency: 1,
  });
}

function wireRefreshForwarding(): void {
  unwireRefresh?.();
  unwireRefresh = repository.subscribeDeckRefresh((evt) => {
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send(IPC_CHANNELS.deckRefreshEvent, evt);
    }
  });
}

function swapRepository(): void {
  repository = makeRepository();
  wireRefreshForwarding();
}

function registerIpc(): void {
  ipcMain.handle(IPC_CHANNELS.listMarkets, () => repository.listMarkets());
  ipcMain.handle(IPC_CHANNELS.getMarket, (_e, id: unknown) =>
    repository.getMarket(z.string().min(1).parse(id)),
  );
  ipcMain.handle(IPC_CHANNELS.createMarket, (_e, input: unknown) =>
    repository.createMarket(createMarketInputSchema.parse(input)),
  );
  ipcMain.handle(IPC_CHANNELS.updateMarketCadence, (_e, id: unknown, cadence: unknown) =>
    repository.updateMarketCadence(
      z.string().min(1).parse(id),
      refreshCadenceSchema.parse(cadence),
    ),
  );
  ipcMain.handle(IPC_CHANNELS.getDeckByMarket, (_e, marketId: unknown) =>
    repository.getDeckByMarket(z.string().min(1).parse(marketId)),
  );
  ipcMain.handle(IPC_CHANNELS.refreshDeck, (_e, marketId: unknown) =>
    repository.refreshDeck(z.string().min(1).parse(marketId)),
  );
  ipcMain.handle(IPC_CHANNELS.createResearchedDeck, (_e, brief: unknown, requestId: unknown) => {
    const validatedBrief = deckResearchBriefSchema.parse(brief);
    const validatedReqId = z.string().min(1).parse(requestId);
    return repository.createResearchedDeck(validatedBrief, {
      onProgress: (progress) => {
        if (mainWin && !mainWin.isDestroyed()) {
          mainWin.webContents.send(IPC_CHANNELS.researchProgressEvent, {
            requestId: validatedReqId,
            progress,
          });
        }
      },
    });
  });
  ipcMain.handle(IPC_CHANNELS.listCards, (_e, deckId: unknown, filter: unknown) =>
    repository.listCards(z.string().min(1).parse(deckId), cardFilterSchema.parse(filter)),
  );
  ipcMain.handle(IPC_CHANNELS.getCard, (_e, cardId: unknown) =>
    repository.getCard(z.string().min(1).parse(cardId)),
  );
  ipcMain.handle(IPC_CHANNELS.listSavedCards, () => repository.listSavedCards());
  ipcMain.handle(IPC_CHANNELS.saveCard, (_e, cardId: unknown) =>
    repository.saveCard(z.string().min(1).parse(cardId)),
  );
  ipcMain.handle(IPC_CHANNELS.unsaveCard, (_e, cardId: unknown) =>
    repository.unsaveCard(z.string().min(1).parse(cardId)),
  );
  ipcMain.handle(IPC_CHANNELS.getCompany, (_e, companyId: unknown) =>
    repository.getCompany(z.string().min(1).parse(companyId)),
  );
  ipcMain.handle(IPC_CHANNELS.getCompanyMetrics, (_e, companyId: unknown) =>
    repository.getCompanyMetrics(z.string().min(1).parse(companyId)),
  );
  ipcMain.handle(IPC_CHANNELS.getViceClaims, (_e, cardId: unknown) =>
    repository.getViceClaims(z.string().min(1).parse(cardId)),
  );
  ipcMain.handle(IPC_CHANNELS.getDashboardTab, (_e, companyId: unknown, tab: unknown, force?: unknown) =>
    repository.getDashboardTab(
      z.string().min(1).parse(companyId),
      dashboardTabSchema.parse(tab),
      z.boolean().optional().parse(force),
    ),
  );
  ipcMain.handle(IPC_CHANNELS.deepDive, (_e, input: unknown) =>
    repository.deepDive(deepDiveInputSchema.parse(input)),
  );
  ipcMain.handle(IPC_CHANNELS.factCheck, (_e, input: unknown) =>
    repository.factCheck(factCheckInputSchema.parse(input)),
  );
  ipcMain.handle(IPC_CHANNELS.verifyMetric, (_e, input: unknown) => {
    if (!repository.verifyMetric) throw new Error('verifyMetric unavailable on this backend');
    return repository.verifyMetric(verifyMetricInputSchema.parse(input));
  });
  ipcMain.handle(IPC_CHANNELS.generateReport, (_e, request: unknown) =>
    repository.generateReport(reportRequestSchema.parse(request)),
  );
  ipcMain.handle(IPC_CHANNELS.listReports, () => repository.listReports());
  ipcMain.handle(IPC_CHANNELS.getReport, (_e, id: unknown) =>
    repository.getReport(z.string().min(1).parse(id)),
  );
  ipcMain.handle(IPC_CHANNELS.expandDeck, (_e, marketId: unknown, focus: unknown) =>
    repository.expandDeck(
      z.string().min(1).parse(marketId),
      expandFocusSchema.parse(focus),
    ),
  );
  ipcMain.handle(IPC_CHANNELS.overrideMetric, (_e, input: unknown) =>
    repository.overrideMetric(overrideMetricInputSchema.parse(input)),
  );
  ipcMain.handle(IPC_CHANNELS.getMarketOpportunity, (_e, marketId: unknown, force?: unknown) =>
    repository.getMarketOpportunity(
      z.string().min(1).parse(marketId),
      z.boolean().optional().parse(force),
    ),
  );
  ipcMain.handle(IPC_CHANNELS.askResearch, (_e, input: unknown) =>
    repository.askResearch?.(askResearchInputSchema.parse(input)),
  );
  ipcMain.handle(IPC_CHANNELS.listResearchThreads, (_e, filter: unknown) =>
    repository.listResearchThreads?.(listResearchThreadsFilterSchema.parse(filter)) ?? [],
  );
  ipcMain.handle(IPC_CHANNELS.getResearchThread, (_e, id: unknown) =>
    repository.getResearchThread?.(z.string().min(1).parse(id)) ?? null,
  );
  ipcMain.handle(IPC_CHANNELS.saveThreadAsReport, (_e, threadId: unknown, focus?: unknown) =>
    repository.saveThreadAsReport?.(
      z.string().min(1).parse(threadId),
      z.string().nullable().optional().parse(focus),
    ),
  );
  ipcMain.handle(IPC_CHANNELS.listResearchJobs, () => repository.listResearchJobs?.() ?? []);
  ipcMain.handle(IPC_CHANNELS.getResearchJob, (_e, id: unknown) =>
    repository.getResearchJob?.(z.string().min(1).parse(id)) ?? null,
  );
  ipcMain.handle(IPC_CHANNELS.cancelResearchJob, (_e, id: unknown) =>
    repository.cancelResearchJob?.(z.string().min(1).parse(id)) ?? null,
  );
  ipcMain.handle(IPC_CHANNELS.resumeResearchJob, (_e, id: unknown) =>
    repository.resumeResearchJob?.(z.string().min(1).parse(id)) ?? null,
  );

  // Secure key storage — persists to the OS keychain and hot-swaps the backend.
  ipcMain.handle(SECURE_CHANNELS.getApiKey, (): string => loadApiKey());
  ipcMain.handle(SECURE_CHANNELS.setApiKey, (_e, key: unknown): void => {
    const validatedKey = z.string().parse(key);
    saveApiKey(validatedKey);
    swapRepository();
  });

  // Google Auth IPC handlers for Electron desktop shell
  let desktopUser: OAuthUser | null = null;

  const handleGoogleSignIn = async () => {
    try {
      const user = await performGoogleOAuthFlow();
      desktopUser = user;
      return desktopUser;
    } catch (err) {
      console.error('[main] Google sign-in failed:', err);
      throw err;
    }
  };

  const handleGoogleSignOut = async () => {
    desktopUser = null;
  };

  ipcMain.handle(IPC_CHANNELS.googleSignIn, handleGoogleSignIn);
  ipcMain.handle(IPC_CHANNELS.googleSignOut, handleGoogleSignOut);
  ipcMain.handle(SECURE_CHANNELS.googleSignIn, handleGoogleSignIn);
  ipcMain.handle(SECURE_CHANNELS.googleSignOut, handleGoogleSignOut);
}

function createWindow(): void {
  const iconPath = path.join(__dirname, '../build/icon.png');
  const appIcon = existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : undefined;

  mainWin = new BrowserWindow({
    width: 1440,
    height: 900,
    show: false,
    title: 'Stratemark',
    icon: appIcon,
    backgroundColor: '#EDECE8',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // required for an ESM preload; the bridge is still isolated
    },
  });

  mainWin.once('ready-to-show', () => {
    mainWin?.show();
    mainWin?.focus();
    if (process.platform === 'darwin') {
      if (appIcon) {
        try {
          app.dock?.setIcon(appIcon);
        } catch {
          // ignore
        }
      }
      app.dock?.show();
      app.focus({ steal: true });
    }
  });

  wireRefreshForwarding();

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) void mainWin.loadURL(devUrl);
  else void mainWin.loadURL('app://bundle/index.html');
}

void app.whenReady().then(() => {
  // Serve the web build under app:// (raw file:// blocks ES modules).
  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url);
    const rel = pathname === '/' ? '/index.html' : pathname;
    const filePath = path.join(WEB_DIST, decodeURIComponent(rel));
    return net.fetch(pathToFileURL(filePath).toString());
  });

  repository = makeRepository();
  createApplicationMenu();
  registerIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

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
import { app, BrowserWindow, ipcMain, net, protocol, safeStorage } from 'electron';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { IPC_CHANNELS, SECURE_CHANNELS, type MarketIntelRepository } from '@mi/contracts';
import { MockRepository } from '@mi/mocks';
import { GeminiRepository, type RepoSnapshot, type ResearchStore } from '@mi/research';
import { performGoogleOAuthFlow, loadDesktopEnv, type OAuthUser } from './oauth.js';

loadDesktopEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIST = app.isPackaged
  ? path.join(process.resourcesPath, 'web-dist')
  : path.join(__dirname, '../../web/dist');

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

function loadApiKey(): string {
  try {
    if (!existsSync(keyFile())) return '';
    const buf = readFileSync(keyFile());
    return safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(buf)
      : buf.toString('utf8');
  } catch {
    return '';
  }
}

function saveApiKey(key: string): void {
  if (!key) {
    if (existsSync(keyFile())) rmSync(keyFile());
    return;
  }
  const data = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(key)
    : Buffer.from(key, 'utf8');
  writeFileSync(keyFile(), data);
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
  ipcMain.handle(IPC_CHANNELS.getMarket, (_e, id: string) => repository.getMarket(id));
  ipcMain.handle(IPC_CHANNELS.createMarket, (_e, input) => repository.createMarket(input));
  ipcMain.handle(IPC_CHANNELS.updateMarketCadence, (_e, id: string, cadence) =>
    repository.updateMarketCadence(id, cadence),
  );
  ipcMain.handle(IPC_CHANNELS.getDeckByMarket, (_e, marketId: string) =>
    repository.getDeckByMarket(marketId),
  );
  ipcMain.handle(IPC_CHANNELS.refreshDeck, (_e, marketId: string) =>
    repository.refreshDeck(marketId),
  );
  ipcMain.handle(IPC_CHANNELS.createResearchedDeck, (_e, brief, requestId: string) =>
    repository.createResearchedDeck(brief, {
      onProgress: (progress) => {
        if (mainWin && !mainWin.isDestroyed()) {
          mainWin.webContents.send(IPC_CHANNELS.researchProgressEvent, { requestId, progress });
        }
      },
    }),
  );
  ipcMain.handle(IPC_CHANNELS.listCards, (_e, deckId: string, filter) =>
    repository.listCards(deckId, filter),
  );
  ipcMain.handle(IPC_CHANNELS.getCard, (_e, cardId: string) => repository.getCard(cardId));
  ipcMain.handle(IPC_CHANNELS.listSavedCards, () => repository.listSavedCards());
  ipcMain.handle(IPC_CHANNELS.saveCard, (_e, cardId: string) => repository.saveCard(cardId));
  ipcMain.handle(IPC_CHANNELS.unsaveCard, (_e, cardId: string) => repository.unsaveCard(cardId));
  ipcMain.handle(IPC_CHANNELS.getCompany, (_e, companyId: string) =>
    repository.getCompany(companyId),
  );
  ipcMain.handle(IPC_CHANNELS.getCompanyMetrics, (_e, companyId: string) =>
    repository.getCompanyMetrics(companyId),
  );
  ipcMain.handle(IPC_CHANNELS.getViceClaims, (_e, cardId: string) =>
    repository.getViceClaims(cardId),
  );
  ipcMain.handle(IPC_CHANNELS.getDashboardTab, (_e, companyId: string, tab, force?: boolean) =>
    repository.getDashboardTab(companyId, tab, force),
  );
  ipcMain.handle(IPC_CHANNELS.deepDive, (_e, input) => repository.deepDive(input));
  ipcMain.handle(IPC_CHANNELS.factCheck, (_e, input) => repository.factCheck(input));
  ipcMain.handle(IPC_CHANNELS.generateReport, (_e, request) => repository.generateReport(request));
  ipcMain.handle(IPC_CHANNELS.listReports, () => repository.listReports());
  ipcMain.handle(IPC_CHANNELS.getReport, (_e, id: string) => repository.getReport(id));
  ipcMain.handle(IPC_CHANNELS.expandDeck, (_e, marketId: string, focus) =>
    repository.expandDeck(marketId, focus),
  );
  ipcMain.handle(IPC_CHANNELS.overrideMetric, (_e, input) => repository.overrideMetric(input));
  ipcMain.handle(IPC_CHANNELS.getMarketOpportunity, (_e, marketId: string, force?: boolean) =>
    repository.getMarketOpportunity(marketId, force),
  );
  ipcMain.handle(IPC_CHANNELS.askResearch, (_e, input) => repository.askResearch?.(input));
  ipcMain.handle(
    IPC_CHANNELS.listResearchThreads,
    (_e, filter) => repository.listResearchThreads?.(filter) ?? [],
  );
  ipcMain.handle(
    IPC_CHANNELS.getResearchThread,
    (_e, id: string) => repository.getResearchThread?.(id) ?? null,
  );
  ipcMain.handle(IPC_CHANNELS.saveThreadAsReport, (_e, threadId: string, focus?: string | null) =>
    repository.saveThreadAsReport?.(threadId, focus),
  );
  ipcMain.handle(IPC_CHANNELS.listResearchJobs, () => repository.listResearchJobs?.() ?? []);
  ipcMain.handle(
    IPC_CHANNELS.getResearchJob,
    (_e, id: string) => repository.getResearchJob?.(id) ?? null,
  );
  ipcMain.handle(
    IPC_CHANNELS.cancelResearchJob,
    (_e, id: string) => repository.cancelResearchJob?.(id) ?? null,
  );
  ipcMain.handle(
    IPC_CHANNELS.resumeResearchJob,
    (_e, id: string) => repository.resumeResearchJob?.(id) ?? null,
  );

  // Secure key storage — persists to the OS keychain and hot-swaps the backend.
  ipcMain.handle(SECURE_CHANNELS.getApiKey, (): string => loadApiKey());
  ipcMain.handle(SECURE_CHANNELS.setApiKey, (_e, key: string): void => {
    saveApiKey(key);
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
  mainWin = new BrowserWindow({
    width: 1440,
    height: 900,
    backgroundColor: '#EDECE8',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // required for an ESM preload; the bridge is still isolated
    },
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
  registerIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

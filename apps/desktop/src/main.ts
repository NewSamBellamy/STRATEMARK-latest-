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
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  IPC_CHANNELS,
  SECURE_CHANNELS,
  type MarketIntelRepository,
} from '@mi/contracts';
import { MockRepository } from '@mi/mocks';
import { GeminiRepository, type RepoSnapshot, type ResearchStore } from '@mi/research';

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
        writeFileSync(file, JSON.stringify(snapshot));
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
    return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(buf) : buf.toString('utf8');
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
    concurrency: 3,
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
  ipcMain.handle(IPC_CHANNELS.createResearchedDeck, (_e, brief) =>
    repository.createResearchedDeck(brief),
  );
  ipcMain.handle(IPC_CHANNELS.listCards, (_e, deckId: string, filter) =>
    repository.listCards(deckId, filter),
  );
  ipcMain.handle(IPC_CHANNELS.getCard, (_e, cardId: string) => repository.getCard(cardId));
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
  ipcMain.handle(IPC_CHANNELS.generateReport, (_e, request) =>
    repository.generateReport(request),
  );
  ipcMain.handle(IPC_CHANNELS.listReports, () => repository.listReports());
  ipcMain.handle(IPC_CHANNELS.getReport, (_e, id: string) => repository.getReport(id));
  ipcMain.handle(IPC_CHANNELS.expandDeck, (_e, marketId: string, focus) =>
    repository.expandDeck(marketId, focus),
  );
  ipcMain.handle(IPC_CHANNELS.overrideMetric, (_e, input) => repository.overrideMetric(input));
  ipcMain.handle(IPC_CHANNELS.getMarketOpportunity, (_e, marketId: string, force?: boolean) =>
    repository.getMarketOpportunity(marketId, force),
  );

  // Secure key storage — persists to the OS keychain and hot-swaps the backend.
  ipcMain.handle(SECURE_CHANNELS.getApiKey, (): string => loadApiKey());
  ipcMain.handle(SECURE_CHANNELS.setApiKey, (_e, key: string): void => {
    saveApiKey(key);
    swapRepository();
  });
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

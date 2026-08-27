/**
 * Cloud Run entry point.
 *
 * Cloud Run sends SIGTERM and then waits a short grace period before killing
 * the container. Chromium is a child process; without an explicit shutdown it
 * is orphaned on every revision rollout.
 */
import { serve } from '@hono/node-server';
import { createApp } from './app';
import { readEnv, hasServerCredentials } from './env';
import { closeBrowser } from './lib/capture';
import { closePdfBrowser } from './lib/pdf';

const env = readEnv();
const app = createApp(env);

const server = serve({ fetch: app.fetch, port: env.port }, (info) => {
  // Structured so Cloud Logging parses it as a real log entry, not a string.
  console.log(
    JSON.stringify({
      severity: 'INFO',
      message: 'stratemark-agent-service listening',
      port: info.port,
      credentials: hasServerCredentials(env) ? (env.vertex ? 'vertex-adc' : 'api-key') : 'none',
      scheduledRefresh: Boolean(env.schedulerToken),
    }),
  );
});

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(JSON.stringify({ severity: 'INFO', message: `${signal} received, draining` }));
  server.close();
  await Promise.all([closeBrowser(), closePdfBrowser()]);
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

import { useEffect, useRef, useState } from 'react';
import { ClipboardCheck, ExternalLink, Globe, Loader2, MonitorPlay } from 'lucide-react';
import { useCompany, useDashboardTab } from '@/hooks/data';
import { QueryBoundary } from '@/components/states/QueryBoundary';
import { useDeepDive } from '@/features/deepdive/DeepDive';
import {
  SHOT_MAX_ATTEMPTS as MAX_ATTEMPTS,
  SHOT_PLACEHOLDER_MAX_WIDTH as PLACEHOLDER_MAX_WIDTH,
  SHOT_RETRY_MS as RETRY_MS,
  pageShotUrl,
} from '@/lib/screenshot';

function SitePreview({ url, fallbackShot }: { url: string; fallbackShot: string | null }) {
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState(false);
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const scheduleRetry = () => {
    if (attempt >= MAX_ATTEMPTS) {
      setFailed(true);
      return;
    }
    timer.current = setTimeout(() => setAttempt((a) => a + 1), RETRY_MS);
  };

  if (failed && fallbackShot) {
    return (
      <img
        src={fallbackShot}
        alt="Site preview"
        className="h-full w-full object-cover object-top"
      />
    );
  }
  if (failed) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <div className="rounded-full bg-surface-2 p-4 text-muted">
          <Globe className="h-7 w-7" />
        </div>
        <p className="max-w-sm text-sm text-muted">
          A live preview couldn’t be captured for this site. Open it directly instead.
        </p>
        <a href={url} target="_blank" rel="noopener noreferrer" className="btn-primary">
          <MonitorPlay className="h-4 w-4" />
          Open live site
        </a>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <img
        key={attempt}
        src={pageShotUrl(url, attempt)}
        alt={`Live preview of ${url}`}
        className="h-full w-full object-cover object-top"
        onLoad={(e) => {
          const w = (e.target as HTMLImageElement).naturalWidth;
          // Placeholder → the capture is still rendering server-side; retry.
          if (w > 0 && w < PLACEHOLDER_MAX_WIDTH) scheduleRetry();
          else setSettled(true);
        }}
        onError={() => scheduleRetry()}
      />
      {!settled && (
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-surface/85 px-3 py-2 text-[11px] font-medium text-muted backdrop-blur">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Capturing the live site — the preview sharpens in a few seconds…
        </div>
      )}
    </div>
  );
}

export function LiveLandingTab({ companyId }: { companyId: string }) {
  const query = useDashboardTab(companyId, 'live_landing');
  const name = useCompany(companyId).data?.name ?? 'this company';
  const { chat } = useDeepDive();
  // Live embeds are opt-in: most real company sites send X-Frame-Options /
  // frame-ancestors and render as a silent blank frame — the "landing page
  // doesn't work" bug. The screenshot is the dependable default everywhere
  // (web, Electron, embeds); the iframe is a button away when allowed.
  const [tryEmbed, setTryEmbed] = useState(false);

  return (
    <QueryBoundary query={query}>
      {(result) => {
        const { url, embeddable, screenshotUrl } = result.content;
        return (
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted">
                {name}’s live website, captured for a first-hand look at how they present
                themselves right now — audit the messaging or open the site directly.
              </p>
              {/* Compact actions (the full-size trio read as overwhelming). */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-content"
                  title="Grounded audit of this landing page: positioning, message, conversion"
                  onClick={() =>
                    chat(
                      { kind: 'datapoint', deckId: null, companyId, subject: `${name} landing page` },
                      {
                        seed: `Audit ${name}'s landing page (${url}) as a conversion-minded marketer: what is the positioning and promise, what's working, what's weak, and what would you test first? Ground observations in what search results and coverage actually say about the site and its messaging.`,
                      },
                    )
                  }
                >
                  <ClipboardCheck className="h-3.5 w-3.5" />
                  Audit
                </button>
                {embeddable && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-content"
                    onClick={() => setTryEmbed((v) => !v)}
                    title="Attempt an interactive in-app embed (some sites block this)"
                  >
                    <MonitorPlay className="h-3.5 w-3.5" />
                    {tryEmbed ? 'Preview' : 'Live embed'}
                  </button>
                )}
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-content"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open site
                </a>
              </div>
            </div>

            {/* Browser-chrome frame: the preview reads as a window onto the
                real site, not a broken image. */}
            <div className="panel overflow-hidden">
              <div className="flex items-center gap-2 border-b border-border bg-surface-2/70 px-3 py-2">
                <span className="flex gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
                </span>
                <span className="ml-2 flex min-w-0 flex-1 items-center gap-1.5 rounded-md bg-surface px-2.5 py-1 text-[11px] text-muted">
                  <Globe className="h-3 w-3 shrink-0" />
                  <span className="truncate">{url.replace(/^https?:\/\//, '')}</span>
                </span>
              </div>
              <div className="h-[520px] bg-white">
                {tryEmbed && embeddable ? (
                  <iframe
                    title={`Live site for ${companyId}`}
                    src={url}
                    className="h-full w-full border-0 bg-white"
                    sandbox="allow-scripts allow-same-origin allow-popups"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                  />
                ) : (
                  <SitePreview url={url} fallbackShot={screenshotUrl ?? null} />
                )}
              </div>
            </div>
          </div>
        );
      }}
    </QueryBoundary>
  );
}

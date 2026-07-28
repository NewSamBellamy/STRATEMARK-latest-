import { ExternalLink, ImageOff, MonitorPlay } from 'lucide-react';
import { useDashboardTab } from '@/hooks/data';
import { QueryBoundary } from '@/components/states/QueryBoundary';

export function LiveLandingTab({ companyId }: { companyId: string }) {
  const query = useDashboardTab(companyId, 'live_landing');
  return (
    <QueryBoundary query={query}>
      {(result) => {
        const { url, embeddable, screenshotUrl } = result.content;
        return (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm text-muted">
                The company’s live site. In the desktop shell this renders via Electron BrowserView;
                on the web we embed via iframe with a fallback for sites that block embedding.
              </p>
              <a href={url} target="_blank" rel="noopener noreferrer" className="btn-ghost">
                <ExternalLink className="h-4 w-4" />
                Open site
              </a>
            </div>

            {embeddable ? (
              <div className="panel h-[560px] overflow-hidden">
                <iframe
                  title={`Live site for ${companyId}`}
                  src={url}
                  className="h-full w-full border-0 bg-white"
                  sandbox="allow-scripts allow-same-origin allow-popups"
                  referrerPolicy="no-referrer"
                  loading="lazy"
                />
              </div>
            ) : (
              <div className="panel flex h-[560px] flex-col items-center justify-center gap-4 p-8 text-center">
                {screenshotUrl ? (
                  <img
                    src={screenshotUrl}
                    alt="Site preview"
                    className="max-h-[380px] rounded-lg border border-border"
                  />
                ) : (
                  <div className="rounded-full bg-surface-2 p-4 text-muted">
                    <ImageOff className="h-7 w-7" />
                  </div>
                )}
                <div>
                  <h3 className="font-display text-lg text-content">This site blocks embedding</h3>
                  <p className="mx-auto mt-1 max-w-md text-sm text-muted">
                    The site sends <code className="text-content">X-Frame-Options</code> /{' '}
                    <code className="text-content">CSP frame-ancestors</code> headers that prevent
                    iframing. The desktop build will capture a live screenshot via BrowserView; for
                    now, open it directly.
                  </p>
                </div>
                <a href={url} target="_blank" rel="noopener noreferrer" className="btn-primary">
                  <MonitorPlay className="h-4 w-4" />
                  Open live site
                </a>
              </div>
            )}
          </div>
        );
      }}
    </QueryBoundary>
  );
}

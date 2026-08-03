import type { CardWithCompany, Report, ResearchThread } from '@mi/contracts';

export interface ShareExportOptions {
  cardWithCompany: CardWithCompany;
  reports?: Report[];
  threads?: ResearchThread[];
  includeConversations?: boolean;
}

export function generateShareHtml(options: ShareExportOptions): string {
  const { cardWithCompany, reports = [], threads = [], includeConversations = true } = options;
  const companyName = cardWithCompany.company?.name ?? cardWithCompany.card.title;
  const filteredThreads = includeConversations ? threads : [];

  const data = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    cardWithCompany,
    reports,
    threads: filteredThreads,
  };

  const jsonPayload = JSON.stringify(data).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Stratemark Share — ${companyName}</title>
  <style>
    :root {
      --bg: #EDECE8;
      --card-bg: #FFFFFF;
      --content: #1A1A18;
      --muted: #6B6B66;
      --border: #D8D6CE;
      --primary: #2563EB;
      --accent: #D97706;
    }
    body {
      margin: 0;
      padding: 24px;
      font-family: system-ui, -apple-system, sans-serif;
      background: var(--bg);
      color: var(--content);
      line-height: 1.5;
    }
    .container {
      max-width: 960px;
      margin: 0 auto;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border);
    }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 600;
      background: #E0E7FF;
      color: #3730A3;
    }
    .grid {
      display: grid;
      grid-template-columns: 280px 1fr;
      gap: 24px;
    }
    @media (max-width: 768px) {
      .grid { grid-template-columns: 1fr; }
    }
    .panel {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
    }
    .title {
      font-size: 24px;
      font-weight: 700;
      margin: 0 0 8px 0;
    }
    .subtitle {
      color: var(--muted);
      font-size: 14px;
      margin-bottom: 16px;
    }
    .metric-item {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px id var(--border);
      font-size: 14px;
    }
    .citation {
      font-size: 12px;
      color: var(--muted);
      margin-top: 4px;
    }
    .thread-msg {
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 8px;
      font-size: 13px;
    }
    .thread-msg.user { background: #F3F4F6; }
    .thread-msg.assistant { background: #EFF6FF; border-left: 3px solid var(--primary); }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <span class="badge">STRATEMARK SHARED INTEL</span>
        <h1 class="title" style="margin-top:8px;">${companyName}</h1>
      </div>
      <div style="text-align:right; font-size:12px; color:var(--muted);">
        Exported: ${new Date(data.exportedAt).toLocaleDateString()}
      </div>
    </div>

    <div class="grid">
      <div>
        <div class="panel">
          <h3 style="margin-top:0;">${cardWithCompany.card.title}</h3>
          <p class="subtitle">${cardWithCompany.company?.oneLiner ?? cardWithCompany.card.summary ?? ''}</p>
          ${cardWithCompany.card.tier ? `<p><strong>Tier:</strong> ${cardWithCompany.card.tier}</p>` : ''}
          ${cardWithCompany.company?.websiteUrl ? `<a href="${cardWithCompany.company.websiteUrl}" target="_blank">Visit Website ↗</a>` : ''}
        </div>
      </div>

      <div>
        ${
          cardWithCompany.metrics.length > 0
            ? `<div class="panel">
            <h3 style="margin-top:0;">Key Metrics</h3>
            ${cardWithCompany.metrics
              .map(
                (m) => `
              <div class="metric-item">
                <span>${m.metricType}</span>
                <strong>${m.value != null ? m.value : 'Unknown'} (${m.confidence})</strong>
              </div>
              ${m.methodNote ? `<div class="citation">Note: ${m.methodNote}</div>` : ''}
            `,
              )
              .join('')}
          </div>`
            : ''
        }

        ${
          reports.length > 0
            ? `<div class="panel">
            <h3 style="margin-top:0;">Reports (${reports.length})</h3>
            ${reports
              .map(
                (r) => `
              <div style="margin-bottom:16px;">
                <h4 style="margin:0 0 4px 0;">${r.title}</h4>
                <div style="font-size:13px; color:var(--muted);">${r.markdown.slice(0, 300)}...</div>
              </div>
            `,
              )
              .join('')}
          </div>`
            : ''
        }

        ${
          filteredThreads.length > 0
            ? `<div class="panel">
            <h3 style="margin-top:0;">Research Conversations (${filteredThreads.length})</h3>
            ${filteredThreads
              .map(
                (t) => `
              <div style="margin-bottom:16px;">
                <h4 style="margin:0 0 8px 0;">💬 ${t.title}</h4>
                ${t.messages
                  .map(
                    (msg) => `
                  <div class="thread-msg ${msg.role}">
                    <strong>${msg.role === 'user' ? 'User' : 'Copilot'}:</strong> ${msg.text}
                  </div>
                `,
                  )
                  .join('')}
              </div>
            `,
              )
              .join('')}
          </div>`
            : ''
        }
      </div>
    </div>
  </div>

  <script id="mi-share-data" type="application/json">
    ${jsonPayload}
  </script>
</body>
</html>`;
}

export function exportShareHtmlFile(options: ShareExportOptions): void {
  const html = generateShareHtml(options);
  const companyName =
    options.cardWithCompany.company?.name ?? options.cardWithCompany.card.title ?? 'card';
  const safeName = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const filename = `stratemark-${safeName}-share.html`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

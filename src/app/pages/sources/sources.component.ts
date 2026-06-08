import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AppStateService } from '../../services/app-state.service';
import { TierKey } from '../../models/workflow.models';

// ─── Source URL map for verification links ───────────────────────────────────
const SOURCE_URLS: Record<string, string> = {
  'anthropic news': 'https://www.anthropic.com/news',
  'google deepmind': 'https://deepmind.google/discover/blog/',
  'mistral ai': 'https://mistral.ai/news/',
  'deepseek ai (via google alerts)': 'https://www.google.com/search?q=deepseek+ai+news&tbm=nws',
  'xai grok': 'https://x.ai/blog',
  'meta ai blog': 'https://ai.meta.com/blog/',
  'hugging face blog': 'https://huggingface.co/blog',
  'hugging face papers': 'https://huggingface.co/papers',
  'google ai blog': 'https://ai.googleblog.com/',
  'microsoft ai blog rss': 'https://blogs.microsoft.com/ai/',
  'nvidia blog': 'https://blogs.nvidia.com/blog/category/deep-learning/',
  'aws ml blog': 'https://aws.amazon.com/blogs/machine-learning/',
  'aws ai news': 'https://aws.amazon.com/ai/',
  'azure ai blog': 'https://techcommunity.microsoft.com/t5/azure-ai-blog/bg-p/AzureAIBlog',
  'openai news rss': 'https://openai.com/news/',
  'openai api changelog': 'https://platform.openai.com/docs/changelog',
  'openai developer blog': 'https://openai.com/blog/',
  'chatgpt release notes': 'https://help.openai.com/en/articles/6825453-chatgpt-release-notes',
  'github copilot changelog': 'https://github.blog/changelog/label/copilot/',
  'google cloud ai': 'https://cloud.google.com/blog/products/ai-machine-learning',
  'google cloud release notes': 'https://cloud.google.com/release-notes',
  'arxiv ai papers': 'https://arxiv.org/list/cs.AI/recent',
  'arxiv ml papers': 'https://arxiv.org/list/cs.LG/recent',
  'bair berkeley ai': 'https://bair.berkeley.edu/blog/',
  'stanford hai': 'https://hai.stanford.edu/news',
  'neurips blog': 'https://blog.neurips.cc/',
  'google developers blog': 'https://developers.googleblog.com/',
  'google research blog': 'https://research.google/blog/',
  'iclr conference': 'https://iclr.cc/',
  'icml conference': 'https://icml.cc/',
  'nvidia gtc': 'https://www.nvidia.com/gtc/',
  'aws re:invent': 'https://reinvent.awsevents.com/',
  'google io': 'https://io.google/',
  'microsoft build': 'https://mybuild.microsoft.com/',
  'techcrunch ai': 'https://techcrunch.com/category/artificial-intelligence/',
  'venturebeat ai': 'https://venturebeat.com/ai/',
  'mit tech review ai': 'https://www.technologyreview.com/topic/artificial-intelligence/',
  'the verge ai': 'https://www.theverge.com/ai-artificial-intelligence',
  'wired ai': 'https://www.wired.com/tag/artificial-intelligence/',
  'ars technica ai': 'https://arstechnica.com/ai/',
  'semafor tech': 'https://www.semafor.com/topic/tech',
  'reuters ai news': 'https://www.reuters.com/technology/artificial-intelligence/',
  'reuters ai events': 'https://www.reuters.com/events/technology/',
  'india ai gov': 'https://indiaai.gov.in/',
  'india ai portal': 'https://indiaai.gov.in/news'
};

function getSourceUrl(name: string): string {
  return SOURCE_URLS[name.toLowerCase().trim()]
    ?? `https://www.google.com/search?q=${encodeURIComponent(name + ' official site')}`;
}

@Component({
  selector: 'app-sources',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
<div class="page-wrap">

  <!-- ── Header ── -->
  <div class="page-header">
    <div>
      <h1 class="page-title">Sources</h1>
      <p class="page-sub">
        {{ state.activeSourceCount() }} active of {{ state.totalSourceCount() }} total sources
        &nbsp;·&nbsp; click any source to open and verify it
      </p>
    </div>
    <!-- Read-only notice badge -->
    <div class="readonly-badge">
      <div class="readonly-badge-top">
        <svg viewBox="0 0 16 16" fill="currentColor" width="13" height="13" style="flex-shrink:0">
          <path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
        </svg>
        <span>This page is view only. To add, remove, or toggle sources, use the Generate flow.</span>
      </div>
      <a class="readonly-btn" routerLink="/app/generate">
        Go to Generate flow
        <svg viewBox="0 0 16 16" fill="currentColor" width="11" height="11">
          <path d="M1 8a.5.5 0 0 1 .5-.5h11.793l-3.147-3.146a.5.5 0 0 1 .708-.708l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 0 1-.708-.708L13.293 8.5H1.5A.5.5 0 0 1 1 8z"/>
        </svg>
      </a>
    </div>
  </div>

  <!-- ── Search ── -->
  <div class="toolbar">
    <div class="search-wrap">
      <svg class="search-icon" viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
        <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.099zm-5.44 1.156a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z"/>
      </svg>
      <input class="search-input" type="text" [(ngModel)]="searchQ" placeholder="Search sources…">
    </div>
    <!-- Summary counts -->
    <div class="counts-row">
      <span class="count-chip count-active">
        <svg viewBox="0 0 12 12" fill="currentColor" width="9" height="9">
          <path d="M10.28 1.28L3.989 7.575 1.695 5.28A1 1 0 0 0 .28 6.695l3 3a1 1 0 0 0 1.414 0l7-7A1 1 0 0 0 10.28 1.28z"/>
        </svg>
        {{ state.activeSourceCount() }} enabled
      </span>
      <span class="count-chip count-inactive">
        {{ state.totalSourceCount() - state.activeSourceCount() }} disabled
      </span>
    </div>
  </div>

  <!-- ── Tier filter chips ── -->
  <div class="tier-chips-row">
    <button class="tc" [class.tc-active]="!tierFilter" type="button" (click)="tierFilter = null">All</button>
    <button class="tc" *ngFor="let t of state.tierOrder"
      [class.tc-active]="tierFilter === t" type="button"
      (click)="tierFilter = tierFilter === t ? null : t">
      {{ state.tierNames[t] }}
      <span class="tc-count">{{ state.getActiveCountForTier(t) }}/{{ state.sourcesDB()[t].length }}</span>
    </button>
  </div>

  <!-- ── Tier panels ── -->
  <div class="tiers-wrap">
    <div class="tier-panel" *ngFor="let section of filteredTiers">

      <div class="tier-panel-head" (click)="toggleTier(section.tier)" role="button" [attr.aria-expanded]="!collapsedTiers.has(section.tier)">
        <span class="tp-name">{{ section.name }}</span>
        <span class="tp-badge">{{ section.activeCount }}/{{ section.totalCount }} active</span>
        <svg class="tp-chevron" [class.tp-chevron-collapsed]="collapsedTiers.has(section.tier)"
          viewBox="0 0 16 16" fill="currentColor" width="13" height="13">
          <path d="M7.646 4.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1-.708.708L8 5.707l-5.646 5.647a.5.5 0 0 1-.708-.708l6-6z"/>
        </svg>
      </div>

      <div class="sources-grid" *ngIf="!collapsedTiers.has(section.tier)">
        <a class="src-card"
          *ngFor="let src of section.sources"
          [href]="getUrl(src)"
          target="_blank"
          rel="noopener noreferrer"
          [class.src-on]="state.activeMap()[src]"
          [title]="'Open ' + src">

          <!-- Status dot -->
          <span class="src-status-dot" [class.dot-on]="state.activeMap()[src]"></span>

          <!-- Source name -->
          <span class="src-card-name">{{ src }}</span>

          <!-- External link icon -->
          <span class="src-link-icon">
            <svg viewBox="0 0 16 16" fill="currentColor" width="10" height="10">
              <path d="M8.636 3.5a.5.5 0 0 0-.5-.5H1.5A1.5 1.5 0 0 0 0 4.5v10A1.5 1.5 0 0 0 1.5 16h10a1.5 1.5 0 0 0 1.5-1.5V7.864a.5.5 0 0 0-1 0V14.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5h6.636a.5.5 0 0 0 .5-.5z"/>
              <path d="M16 .5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0 0 1h3.793L6.146 9.146a.5.5 0 1 0 .708.708L15 1.707V5.5a.5.5 0 0 0 1 0v-5z"/>
            </svg>
          </span>
        </a>
      </div>

      <div class="no-src" *ngIf="!collapsedTiers.has(section.tier) && section.sources.length === 0">No sources match</div>
    </div>
    <div class="no-tiers" *ngIf="filteredTiers.length === 0">
      No sources found for "{{ searchQ }}"
    </div>
  </div>

</div>
  `,
  styles: [`
    :host {
      --amber:        #f5a623;
      --amber-hover:  #f9b83a;
      --amber-dim:    rgba(245,166,35,0.14);
      --amber-border: rgba(245,166,35,0.28);
      --amber-dark:   #d97706;
      --bg:           #faf7f2;
      --surface:      #ffffff;
      --border:       #e8e0d4;
      --border-med:   #ddd4c4;
      --text-primary:   #1c160a;
      --text-secondary: #6b5e46;
      --text-tertiary:  #a0917a;
      --divider:        #ede8df;
      display: block;
      font-family: 'Outfit', system-ui, sans-serif;
    }

    .page-wrap {
      padding: 36px 40px 64px;
      min-height: 100%;
      display: flex;
      flex-direction: column;
      gap: 22px;
      background: var(--bg);
      box-sizing: border-box;
    }

    /* ── Header ── */
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      flex-wrap: wrap;
      gap: 14px;
    }

    .page-title {
      font-size: 2rem;
      font-weight: 800;
      color: var(--text-primary);
      letter-spacing: -0.5px;
      line-height: 1;
      margin-bottom: 6px;
    }

    .page-sub {
      font-size: 0.84rem;
      color: var(--text-tertiary);
      line-height: 1.5;
    }

    /* Read-only notice badge */
    .readonly-badge {
      display: flex;
      flex-direction: column;
      gap: 10px;
      background: #fffbeb;
      border: 1.5px solid #fde68a;
      border-radius: 12px;
      padding: 13px 18px;
      flex-shrink: 0;
      max-width: 380px;
    }

    .readonly-badge-top {
      display: flex;
      align-items: flex-start;
      gap: 9px;
      font-size: 0.80rem;
      font-weight: 500;
      color: #92400e;
      line-height: 1.5;
    }

    .readonly-badge-top svg { color: #d97706; margin-top: 2px; }

    .readonly-btn {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      align-self: flex-start;
      background: var(--amber);
      color: #1c160a;
      font-size: 0.76rem;
      font-weight: 700;
      font-family: 'Outfit', sans-serif;
      padding: 7px 14px;
      border-radius: 8px;
      text-decoration: none;
      transition: background 0.15s, transform 0.12s;
    }

    .readonly-btn:hover {
      background: var(--amber-hover);
      transform: translateY(-1px);
    }

    /* ── Toolbar ── */
    .toolbar {
      display: flex;
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;
    }

    .search-wrap {
      position: relative;
      flex: 1;
      min-width: 220px;
    }

    .search-icon {
      position: absolute;
      left: 13px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-tertiary);
      pointer-events: none;
    }

    .search-input {
      width: 100%;
      padding: 10px 14px 10px 36px;
      border: 1.5px solid var(--border-med);
      border-radius: 10px;
      font-size: 0.84rem;
      font-family: 'Outfit', sans-serif;
      background: var(--surface);
      outline: none;
      color: var(--text-primary);
      transition: border-color 0.15s;
      box-sizing: border-box;
    }

    .search-input:focus {
      border-color: var(--amber);
      box-shadow: 0 0 0 3px rgba(245,166,35,0.10);
    }

    /* Count chips */
    .counts-row {
      display: flex;
      gap: 8px;
      flex-shrink: 0;
    }

    .count-chip {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.76rem;
      font-weight: 600;
      padding: 7px 14px;
      border-radius: 20px;
    }

    .count-active {
      background: rgba(245,166,35,0.12);
      color: var(--amber-dark);
      border: 1.5px solid rgba(245,166,35,0.25);
    }

    .count-inactive {
      background: var(--surface);
      color: var(--text-tertiary);
      border: 1.5px solid var(--border-med);
    }

    /* ── Tier filter chips ── */
    .tier-chips-row { display: flex; gap: 8px; flex-wrap: wrap; }

    .tc {
      display: flex;
      align-items: center;
      gap: 7px;
      padding: 7px 16px;
      border-radius: 20px;
      font-size: 0.76rem;
      font-weight: 600;
      font-family: 'Outfit', sans-serif;
      cursor: pointer;
      background: var(--surface);
      border: 1.5px solid var(--border-med);
      color: var(--text-secondary);
      transition: all 0.15s;
    }

    .tc:hover { border-color: var(--amber-border); color: var(--amber-dark); }

    .tc-active {
      background: var(--amber);
      color: #1c160a;
      border-color: var(--amber);
      font-weight: 700;
    }

    .tc-count {
      font-size: 0.64rem;
      opacity: 0.70;
    }

    /* ── Tier panels ── */
    .tiers-wrap { display: flex; flex-direction: column; gap: 16px; }

    .tier-panel {
      background: var(--surface);
      border-radius: 14px;
      border: 1.5px solid var(--border);
      overflow: hidden;
      box-shadow: 0 1px 4px rgba(28,22,10,0.04);
    }

    .tier-panel-head {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 20px;
      background: #faf8f4;
      border-bottom: 1.5px solid var(--border);
      cursor: pointer;
      user-select: none;
      transition: background 0.13s;
    }

    .tier-panel-head:hover { background: #f5f0e8; }

    .tp-chevron {
      color: var(--text-tertiary);
      flex-shrink: 0;
      transition: transform 0.2s ease;
    }

    .tp-chevron-collapsed {
      transform: rotate(180deg);
    }

    .tp-name {
      font-size: 0.90rem;
      font-weight: 700;
      color: var(--text-primary);
      flex: 1;
    }

    .tp-badge {
      font-size: 0.68rem;
      font-weight: 700;
      background: var(--amber-dim);
      color: var(--amber-dark);
      border: 1px solid var(--amber-border);
      padding: 3px 10px;
      border-radius: 20px;
    }

    /* ── Source cards — anchor tags, view only ── */
    .sources-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 6px;
      padding: 14px 16px;
    }

    .src-card {
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 9px 11px;
      border-radius: 9px;
      border: 1.5px solid var(--border);
      background: #faf8f4;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.14s;
      user-select: none;
    }

    /* hover — lift and amber tint to signal clickability */
    .src-card:hover {
      background: rgba(245,166,35,0.07);
      border-color: var(--amber-border);
      transform: translateY(-1px);
      box-shadow: 0 3px 10px rgba(245,166,35,0.14);
    }

    .src-card:hover .src-link-icon {
      opacity: 1;
      color: var(--amber-dark);
    }

    /* Active sources — amber tinted */
    .src-on {
      background: rgba(245,166,35,0.08);
      border-color: var(--amber-border);
    }

    /* Status dot — replaces checkbox */
    .src-status-dot {
      width: 8px;
      height: 8px;
      min-width: 8px;
      border-radius: 50%;
      background: var(--border-med);
      flex-shrink: 0;
      transition: background 0.12s;
    }

    .dot-on {
      background: var(--amber);
      box-shadow: 0 0 0 2px rgba(245,166,35,0.22);
    }

    .src-card-name {
      font-size: 0.76rem;
      color: var(--text-primary);
      flex: 1;
      line-height: 1.3;
    }

    .src-on .src-card-name {
      color: #1c160a;
      font-weight: 600;
    }

    /* External link icon — always visible, amber tint signals clickability */
    .src-link-icon {
      color: var(--amber-dark);
      opacity: 0.70;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: opacity 0.12s, color 0.12s;
    }

    .no-src, .no-tiers {
      padding: 32px;
      text-align: center;
      color: var(--text-tertiary);
      font-size: 0.84rem;
    }
  `]
})
export class SourcesComponent {
  searchQ = '';
  tierFilter: TierKey | null = null;
  collapsedTiers = new Set<TierKey>();

  constructor(public state: AppStateService) {}

  getUrl(name: string): string { return getSourceUrl(name); }

  toggleTier(tier: TierKey): void {
    if (this.collapsedTiers.has(tier)) {
      this.collapsedTiers.delete(tier);
    } else {
      this.collapsedTiers.add(tier);
    }
  }

  get filteredTiers() {
    const q = this.searchQ.trim().toLowerCase();
    return this.state.tierOrder
      .filter(t => !this.tierFilter || this.tierFilter === t)
      .map(t => {
        const all = this.state.sourcesDB()[t];
        const sources = q ? all.filter(s => s.toLowerCase().includes(q)) : all;
        return {
          tier: t,
          name: this.state.tierNames[t],
          sources,
          activeCount: all.filter(s => this.state.activeMap()[s]).length,
          totalCount: all.length
        };
      });
  }
}

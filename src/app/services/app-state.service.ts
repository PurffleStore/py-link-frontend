import { Injectable, signal, computed } from '@angular/core';
import { Platform, TierKey, RunHistoryEntry } from '../models/workflow.models';

export interface AppState {
  // Platform
  selectedPlatform: Platform;
  // Config
  lookbackHours: number;
  postsToGenerate: number;
  emailRecipient: string;
  // Sources
  sourcesDB: Record<TierKey, string[]>;
  activeMap: Record<string, boolean>;
  // Run history
  runHistory: RunHistoryEntry[];
  // Last run
  lastRunText: string;
}

const INITIAL_SOURCES: Record<TierKey, string[]> = {
  t1: [
    'openai news rss', 'anthropic news', 'google deepmind', 'mistral ai',
    'deepseek ai (via google alerts)', 'xai grok', 'meta ai blog', 'hugging face blog',
    'hugging face papers', 'google ai blog', 'microsoft ai blog rss', 'nvidia blog',
    'aws ml blog', 'aws ai news', 'azure ai blog', 'openai api changelog',
    'openai developer blog', 'chatgpt release notes', 'github copilot changelog',
    'google cloud ai', 'google cloud release notes'
  ],
  t2: [
    'arxiv ai papers', 'arxiv ml papers', 'bair berkeley ai', 'stanford hai',
    'neurips blog', 'google developers blog', 'google research blog',
    'iclr conference', 'icml conference', 'nvidia gtc', 'aws re:invent',
    'google io', 'microsoft build'
  ],
  t3: [
    'techcrunch ai', 'venturebeat ai', 'mit tech review ai', 'the verge ai',
    'wired ai', 'ars technica ai', 'semafor tech', 'reuters ai news', 'reuters ai events'
  ],
  t4: ['india ai gov', 'india ai portal']
};

@Injectable({ providedIn: 'root' })
export class AppStateService {
  // Signals
  selectedPlatform = signal<Platform>('linkedin');
  lookbackHours = signal<number>(48);
  postsToGenerate = signal<number>(1);
  emailRecipient = signal<string>('');
  sourcesDB = signal<Record<TierKey, string[]>>(INITIAL_SOURCES);
  activeMap = signal<Record<string, boolean>>(this.buildInitialActiveMap(INITIAL_SOURCES));
  runHistory = signal<RunHistoryEntry[]>([]);
  lastRunText = signal<string>('—');
  generateStep = signal<string>('platform');

  // Computed
  readonly activeSourceCount = computed(() =>
    Object.values(this.activeMap()).filter(Boolean).length
  );

  readonly totalSourceCount = computed(() =>
    Object.values(this.sourcesDB()).flat().length
  );

  readonly tierOrder: TierKey[] = ['t1', 't2', 't3', 't4'];

  readonly tierNames: Record<TierKey, string> = {
    t1: 'Tier 1 — Official AI',
    t2: 'Tier 2 — Research',
    t3: 'Tier 3 — Tech Media',
    t4: 'Tier 4 — Other'
  };

  private buildInitialActiveMap(sources: Record<TierKey, string[]>): Record<string, boolean> {
    const map: Record<string, boolean> = {};
    Object.values(sources).flat().forEach(s => { map[s] = true; });
    return map;
  }

  getActiveCountForTier(tier: TierKey): number {
    return this.sourcesDB()[tier].filter(s => this.activeMap()[s]).length;
  }

  toggleSource(source: string): void {
    this.activeMap.update(m => ({ ...m, [source]: !m[source] }));
  }

  toggleTierAll(tier: TierKey): void {
    const tierSources = this.sourcesDB()[tier];
    const someDisabled = tierSources.some(s => !this.activeMap()[s]);
    this.activeMap.update(m => {
      const next = { ...m };
      tierSources.forEach(s => { next[s] = someDisabled; });
      return next;
    });
  }

  selectAllSources(): void {
    this.activeMap.update(m => {
      const next = { ...m };
      Object.keys(next).forEach(k => { next[k] = true; });
      return next;
    });
  }

  deselectAllSources(): void {
    this.activeMap.update(m => {
      const next = { ...m };
      Object.keys(next).forEach(k => { next[k] = false; });
      return next;
    });
  }

  addSource(name: string, tier: TierKey = 't3'): boolean {
    const normalised = name.trim().toLowerCase();
    if (!normalised) return false;
    if (Object.values(this.sourcesDB()).flat().includes(normalised)) return false;
    this.sourcesDB.update(db => ({ ...db, [tier]: [...db[tier], normalised] }));
    this.activeMap.update(m => ({ ...m, [normalised]: true }));
    return true;
  }

  deleteSource(source: string, tier: TierKey): void {
    this.sourcesDB.update(db => ({ ...db, [tier]: db[tier].filter(s => s !== source) }));
    this.activeMap.update(m => { const next = { ...m }; delete next[source]; return next; });
  }

  addRunHistoryEntry(entry: RunHistoryEntry): void {
    this.runHistory.update(h => [entry, ...h].slice(0, 50));
    this.lastRunText.set(
      new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    );
  }
}

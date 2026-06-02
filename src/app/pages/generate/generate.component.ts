import {
  Component, OnDestroy, ChangeDetectorRef, NgZone,
  ViewChild, ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AppStateService } from '../../services/app-state.service';
import { WorkflowApiService } from '../../services/workflow-api.service';
import {
  Platform, JobStatusResponse, WorkflowStep, RunHistoryEntry
} from '../../models/workflow.models';

interface GeneratedPost { index: number; title: string; body: string; hashtags: string; imagePrompt?: string; source?: string; url?: string; published?: string; }

type GenStep = 'platform' | 'configure' | 'review' | 'run';

const PLATFORM_STEPS: Record<Platform, Array<Pick<WorkflowStep, 'number' | 'key' | 'label'>>> = {
  linkedin: [
    { number: 1, key: 'source_scan',      label: 'Scanning selected sources' },
    { number: 2, key: 'story_shortlist',  label: 'Shortlisting LinkedIn-worthy stories' },
    { number: 3, key: 'post_angle',       label: 'Building post angles' },
    { number: 4, key: 'draft_generation', label: 'Drafting LinkedIn posts' },
    { number: 5, key: 'delivery',         label: 'Sending final drafts to email' }
  ],
  twitter: [
    { number: 1, key: 'source_scan',      label: 'Scanning selected sources' },
    { number: 2, key: 'story_shortlist',  label: 'Shortlisting tweet-worthy stories' },
    { number: 3, key: 'tweet_angle',      label: 'Building tweet angles' },
    { number: 4, key: 'draft_generation', label: 'Drafting tweets' },
    { number: 5, key: 'delivery',         label: 'Sending final drafts to email' }
  ]
};

// No hard cap — posts and lookback are unlimited

@Component({
  selector: 'app-generate',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './generate.component.html',
  styleUrl: './generate.component.scss'
})
export class GenerateComponent implements OnDestroy {

  // Wizard step
  currentStep: GenStep = 'platform';
  readonly steps: GenStep[] = ['platform', 'configure', 'review', 'run'];

  localPlatform: Platform;
  localLookback: number;
  localPosts: number;
  localEmail: string;

  // ── Jump window steppers — ▲ jumps to next 4, ▼ jumps to previous 4 ──
  // Fixed options — lookback: 24h,48h,72h,96h | posts: 1-5
  readonly lookbackWindow: number[] = [24, 48, 72, 96];
  readonly postsWindow: number[]    = [1, 2, 3, 4, 5];

  emailError = '';
  isEmailEditMode = false;
  emailDraft = '';
  emailTouched = false;

  sourceSearch = '';
  newSourceName = '';
  newSourcePlaceholder = 'e.g. techcrunch ai';
  highlightNewSource = false;
  modalTierFilter: import('../../models/workflow.models').TierKey | null = null;

  // ── Custom folders ──
  customFolders: Array<{ id: string; name: string; sources: string[] }> = [];
  folderActiveMap: Record<string, Record<string, boolean>> = {};
  activeFolderFilter: string | null = null;

  // ── Add Source modal ──
  addSourceModalOpen = false;
  addModal = {
    name: '',
    placeholder: 'e.g. techcrunch.com/ai or "Reuters AI"',
    flash: false,
    destination: 'auto' as 'auto' | 'folder',
    selectedFolderId: null as string | null,
    detectedCategory: '' as string,
    preselectedFolder: false
  };
  private addModalFlashTimer?: ReturnType<typeof setTimeout>;

  // ── Create Folder modal ──
  createFolderModalOpen = false;
  newFolderName = '';

  // ── Source URL map (for verification links) ──
  private readonly SOURCE_URLS: Record<string, string> = {
    'anthropic news': 'https://www.anthropic.com/news',
    'google deepmind': 'https://deepmind.google/discover/blog/',
    'mistral ai': 'https://mistral.ai/news/',
    'deepseek ai (via google alerts)': 'https://www.google.com/search?q=deepseek+ai+news&tbm=nws',
    'xai grok': 'https://x.ai/blog',
    'meta ai blog': 'https://ai.meta.com/blog/',
    'hugging face blog': 'https://huggingface.co/blog',
    'google ai blog': 'https://ai.googleblog.com/',
    'microsoft ai blog rss': 'https://blogs.microsoft.com/ai/',
    'nvidia blog': 'https://blogs.nvidia.com/blog/category/deep-learning/',
    'aws ml blog': 'https://aws.amazon.com/blogs/machine-learning/',
    'aws ai news': 'https://aws.amazon.com/ai/',
    'azure ai blog': 'https://techcommunity.microsoft.com/t5/azure-ai-blog/bg-p/AzureAIBlog',
    'openai api changelog': 'https://platform.openai.com/docs/changelog',
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

  // Auto-detect category from source name
  private detectCategory(name: string): string {
    const n = name.toLowerCase();
    if (/openai|anthropic|google ai|deepmind|meta ai|xai|grok|azure ai|aws ai|nvidia|mistral|cohere|hugging face|chatgpt|copilot/.test(n)) return 'Official AI';
    if (/arxiv|research|neurips|iclr|icml|stanford|berkeley|conference|paper/.test(n)) return 'Research';
    if (/techcrunch|verge|wired|venturebeat|mit tech|reuters|semafor|ars technica/.test(n)) return 'Tech Media';
    return 'Tech Media';
  }

  isRunning = false;
  isReconnecting = false;
  elapsedText = '0s';
  workflowSteps: WorkflowStep[] = [];
  runResult: 'success' | 'error' | null = null;
  runResultMessage = '';

  // Direct DOM reference — status text is written here without going through CD
  @ViewChild('aiStatusEl') private aiStatusEl?: ElementRef<HTMLElement>;

  private elapsedIntervalId?: number;
  private pollIntervalId?: number;
  private aiStatusIntervalId?: number;
  private currentJobId: string | null = null;
  private waitingForPosts  = false;
  private pendingRunId: string | null = null;
  private postWaitStart    = 0;
  private postWaitInterval?: ReturnType<typeof setInterval>;
  private readonly POST_WAIT_MAX_MS = 30_000;  // wait up to 30 s for posts
  private startedAtMs = 0;
  private highlightTimer?: ReturnType<typeof setTimeout>;

  private readonly AI_MSGS_LI: readonly string[] = [
    'Scanning your selected sources…',
    'Reading the latest AI headlines…',
    'Filtering for high-signal stories…',
    'Shortlisting LinkedIn-worthy content…',
    'Analysing audience relevance…',
    'Building post angles…',
    'Crafting professional narratives…',
    'Drafting your LinkedIn posts…',
    'Polishing tone and structure…',
    'Finalising and sending to your inbox…'
  ];

  private readonly AI_MSGS_TW: readonly string[] = [
    'Scanning your selected sources…',
    'Reading the latest AI headlines…',
    'Filtering tweet-worthy stories…',
    'Shortlisting high-engagement topics…',
    'Building sharp tweet angles…',
    'Drafting 280-char posts…',
    'Checking tone and punch…',
    'Finalising your tweets…',
    'Sending drafts to your inbox…'
  ];

  private aiMsgIndex = 0;

  constructor(
    public state: AppStateService,
    private api: WorkflowApiService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {
    this.localPlatform = state.selectedPlatform();
    this.localLookback = +(localStorage.getItem('cfg_lookback') || state.lookbackHours());
    this.localPosts    = +(localStorage.getItem('cfg_posts')    || state.postsToGenerate());
    this.localEmail    = state.emailRecipient();
    this.emailDraft    = '';
    localStorage.removeItem('cfg_email'); // clear any old saved email
  }

  ngOnDestroy() { this.clearAllTimers(); }

  get stepIndex(): number { return this.steps.indexOf(this.currentStep); }

  canAdvance(): boolean {
    if (this.currentStep === 'platform') return !!this.localPlatform;
    if (this.currentStep === 'configure') return this.localLookback > 0 && this.localPosts > 0 && this.isValidEmail(this.localEmail);
    if (this.currentStep === 'review') return this.isValidEmail(this.localEmail) && this.state.activeSourceCount() > 0;
    return false;
  }

  // ── Validation errors shown inline when user clicks Next without completing ──
  validationErrors: Record<string, string> = {};

  tryNext(): void {
    this.validationErrors = {};
    if (this.currentStep === 'platform') {
      if (!this.localPlatform) {
        this.validationErrors['platform'] = 'Please select a platform before continuing.';
        return;
      }
    }
    if (this.currentStep === 'configure') {
      if (!this.isValidEmail(this.localEmail)) {
        this.validationErrors['email'] = 'A valid email address is required to receive your posts.';
        if (!this.isEmailEditMode) { this.enableEmailEdit(); }
      }
      if (this.localLookback <= 0) this.validationErrors['lookback'] = 'Please set a lookback window.';
      if (this.localPosts <= 0) this.validationErrors['posts'] = 'Please set at least 1 post.';
      if (Object.keys(this.validationErrors).length) return;
    }
    if (this.currentStep === 'review') {
      if (this.state.activeSourceCount() === 0) {
        this.validationErrors['sources'] = 'Please enable at least one source before generating.';
        return;
      }
    }
    this.next();
  }

  tryRun(): void {
    this.validationErrors = {};
    if (this.state.activeSourceCount() === 0) {
      this.validationErrors['sources'] = 'Please enable at least one source before generating.';
      return;
    }
    this.startRun();
  }

  goHome(): void { this.router.navigate(['/']); }

  goTo(step: GenStep): void {
    const idx = this.steps.indexOf(step);
    if (idx <= this.stepIndex || this.canAdvance()) { this.currentStep = step; this.state.generateStep.set(step); }
  }

  next(): void {
    if (!this.canAdvance()) return;
    const idx = this.stepIndex;
    if (idx < this.steps.length - 1) { this.currentStep = this.steps[idx + 1]; this.state.generateStep.set(this.currentStep); }
  }

  back(): void {
    if (this.currentStep === 'run' || this.stepIndex === 0) return;
    this.currentStep = this.steps[this.stepIndex - 1]; this.state.generateStep.set(this.currentStep);
  }

  selectPlatform(p: Platform): void {
    this.localPlatform = p;
    delete this.validationErrors['platform'];
  }

  get lookbackLabel(): string {
    const h = this.localLookback;
    if (!h) return '—';
    if (h < 24) return `${h}h`;
    const days = h / 24;
    const rounded = Math.round(days * 10) / 10;
    return Number.isInteger(rounded) ? `${rounded} day${rounded !== 1 ? 's' : ''}` : `${rounded} days`;
  }

  get postsLabel(): string {
    return this.localPosts === 1 ? '1 post' : `${this.localPosts} posts`;
  }

  clampPosts(): void {
    this.localPosts = Math.max(Math.round(this.localPosts), 1);
  }

  enableEmailEdit(): void {
    this.isEmailEditMode = true;
    this.emailDraft = this.localEmail;
    this.emailError = '';
    this.emailHint = '';
  }

  onEmailInput(): void {
    const v = this.emailDraft.trim();
    if (!v) { this.emailError = ''; this.emailHint = 'Enter your email to receive generated posts.'; return; }
    if (!v.includes('@')) { this.emailError = 'Missing "@" — a valid email must contain @'; this.emailHint = ''; return; }
    const parts = v.split('@');
    if (parts[0].length === 0) { this.emailError = 'Email cannot start with @'; this.emailHint = ''; return; }
    if (!parts[1] || !parts[1].includes('.')) { this.emailError = 'Missing domain — e.g. gmail.com after @'; this.emailHint = ''; return; }
    const domainParts = parts[1].split('.');
    const tld = domainParts[domainParts.length - 1];
    if (!tld || tld.length < 2) { this.emailError = 'Invalid domain extension — must be at least 2 characters (e.g. .com)'; this.emailHint = ''; return; }
    if (!this.isValidEmail(v)) { this.emailError = 'Invalid email format — e.g. yourname@domain.com'; this.emailHint = ''; return; }
    this.emailError = '';
    this.emailHint = '';
  }

  get emailDraftValid(): boolean { return this.isValidEmail(this.emailDraft.trim()); }

  emailHint = '';

  saveEmail(): void {
    if (!this.isValidEmail(this.emailDraft.trim())) {
      this.onEmailInput(); return;
    }
    this.localEmail = this.emailDraft.trim();
    this.isEmailEditMode = false;
    this.emailError = '';
    this.emailHint = '';
    delete this.validationErrors['email'];
  }

  cancelEmail(): void {
    this.isEmailEditMode = false;
    this.emailError = '';
    this.emailHint = '';
    // Revert draft back to saved email — don't keep unsaved changes
    this.emailDraft = this.localEmail;
  }

  private isValidEmail(e: string): boolean {
    return /^[a-zA-Z0-9][a-zA-Z0-9._+\-]*@[a-zA-Z0-9][a-zA-Z0-9.\-]*\.[a-zA-Z]{3,}$/.test(e.trim());
  }

  get filteredTiers() {
    const q = this.sourceSearch.trim().toLowerCase();
    return this.state.tierOrder
      .filter(t => !this.modalTierFilter || this.modalTierFilter === t)
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
      })
      .filter(s => s.sources.length > 0);
  }

  addSource(): void {
    if (!this.newSourceName.trim()) { this.flashHighlight(); return; }
    const ok = this.state.addSource(this.newSourceName);
    if (!ok) { this.newSourcePlaceholder = 'Source already exists!'; this.flashHighlight(); return; }
    this.newSourceName = '';
    this.newSourcePlaceholder = 'e.g. techcrunch ai';
  }

  private flashHighlight(): void {
    clearTimeout(this.highlightTimer);
    this.highlightNewSource = true;
    this.highlightTimer = setTimeout(() => {
      this.highlightNewSource = false;
      this.newSourcePlaceholder = 'e.g. techcrunch ai';
      this.cdr.detectChanges();
    }, 800);
  }

  // ── Add Source Modal ──
  openAddSourceModal(): void {
    this.addModal = { name: '', placeholder: 'e.g. techcrunch.com/ai or "Reuters AI"', flash: false, destination: 'auto', selectedFolderId: this.customFolders[0]?.id ?? null, detectedCategory: '', preselectedFolder: false };
    this.addSourceModalOpen = true;
  }

  openAddSourceModalForFolder(folderId: string): void {
    this.addModal = { name: '', placeholder: 'e.g. techcrunch.com/ai or "Reuters AI"', flash: false, destination: 'folder', selectedFolderId: folderId, detectedCategory: '', preselectedFolder: true };
    this.addSourceModalOpen = true;
  }

  closeAddSourceModal(): void { this.addSourceModalOpen = false; }

  getFolderName(id: string | null): string {
    return this.customFolders.find(f => f.id === id)?.name ?? '';
  }

  onAddModalNameChange(): void {
    const n = this.addModal.name.trim();
    this.addModal.detectedCategory = n.length > 2 ? this.detectCategory(n) : '';
  }

  submitAddSource(): void {
    const name = this.addModal.name.trim();
    if (!name) return;

    if (this.addModal.destination === 'folder' && this.addModal.selectedFolderId) {
      // Add to custom folder
      const folder = this.customFolders.find(f => f.id === this.addModal.selectedFolderId);
      if (folder && !folder.sources.includes(name)) {
        folder.sources.push(name);
        if (!this.folderActiveMap[folder.id]) this.folderActiveMap[folder.id] = {};
        this.folderActiveMap[folder.id][name] = true;
      }
    } else {
      // Auto-place: pick tier based on detected category
      const cat = this.detectCategory(name);
      const tierMap: Record<string, import('../../models/workflow.models').TierKey> = { 'Official AI': 't1', 'Research': 't2', 'Tech Media': 't3' };
      const tier = tierMap[cat] ?? 't3';
      this.state.addSource(name, tier);
    }
    this.closeAddSourceModal();
  }

  // ── Create Folder Modal ──
  openCreateFolderModal(): void { this.newFolderName = ''; this.createFolderModalOpen = true; }
  closeCreateFolderModal(): void { this.createFolderModalOpen = false; }

  submitCreateFolder(): void {
    const name = this.newFolderName.trim();
    if (!name) return;
    const id = 'folder_' + Date.now();
    this.customFolders.push({ id, name, sources: [] });
    this.folderActiveMap[id] = {};
    this.closeCreateFolderModal();
  }

  deleteFolder(id: string): void {
    this.customFolders = this.customFolders.filter(f => f.id !== id);
    delete this.folderActiveMap[id];
    if (this.activeFolderFilter === id) this.activeFolderFilter = null;
  }

  toggleFolderFilter(id: string): void {
    this.activeFolderFilter = this.activeFolderFilter === id ? null : id;
  }

  get visibleFolders() {
    const q = this.sourceSearch.trim().toLowerCase();
    return this.customFolders
      .filter(f => !this.activeFolderFilter || this.activeFolderFilter === f.id)
      .map(f => ({
        ...f,
        sources: q ? f.sources.filter(s => s.toLowerCase().includes(q)) : f.sources
      }));
  }

  toggleFolderAll(id: string): void {
    const folder = this.customFolders.find(f => f.id === id);
    if (!folder) return;
    const map = this.folderActiveMap[id] ?? {};
    const allOn = folder.sources.every(s => map[s]);
    folder.sources.forEach(s => { map[s] = !allOn; });
    this.folderActiveMap[id] = { ...map };
  }

  toggleFolderSource(folderId: string, src: string): void {
    if (!this.folderActiveMap[folderId]) this.folderActiveMap[folderId] = {};
    this.folderActiveMap[folderId][src] = !this.folderActiveMap[folderId][src];
    this.folderActiveMap = { ...this.folderActiveMap };
  }

  removeFolderSource(folderId: string, src: string): void {
    const folder = this.customFolders.find(f => f.id === folderId);
    if (folder) folder.sources = folder.sources.filter(s => s !== src);
  }

  // ── Source verification URL ──
  getSourceUrl(sourceName: string): string {
    const key = sourceName.toLowerCase().trim();
    if (this.SOURCE_URLS[key]) return this.SOURCE_URLS[key];
    // Try to construct a Google search as fallback
    return `https://www.google.com/search?q=${encodeURIComponent(sourceName + ' official site')}`;
  }

  isValidEmailPublic(e: string): boolean {
    return /^[a-zA-Z0-9][a-zA-Z0-9._+\-]*@[a-zA-Z0-9][a-zA-Z0-9.\-]*\.[a-zA-Z]{3,}$/.test((e || '').trim());
  }

  async startRun(): Promise<void> {
    // Persist config to localStorage
    localStorage.setItem('cfg_lookback', String(this.localLookback));
    localStorage.setItem('cfg_posts',    String(this.localPosts));
    // Email is NOT persisted — user must enter it each session
    this.state.selectedPlatform.set(this.localPlatform);
    this.state.lookbackHours.set(this.localLookback);
    this.state.postsToGenerate.set(this.localPosts);
    this.state.emailRecipient.set(this.localEmail);

    const activeSources = Object.keys(this.state.activeMap()).filter(s => this.state.activeMap()[s]);
    this.isRunning = true;
    this.runResult = null;
    this.runResultMessage = '';
    this.currentStep = 'run'; this.state.generateStep.set('run');
    this.workflowSteps = this.buildInitialSteps();
    this.clearAllTimers();

    // Detect once so the modal DOM renders and #aiStatusEl becomes available
    this.cdr.detectChanges();
    this.startTimers();

    let jobId: string;
    try {
      const res = await this.api.startWorkflow({
        lookback_hours: this.localLookback,
        max_final_articles: this.localPosts,
        email_recipient: this.localEmail,
        active_sources: activeSources,
        platform: this.localPlatform
      });
      if (!res.success || !res.jobId) {
        this.finishRun(false, 'Failed to start workflow'); return;
      }
      jobId = res.jobId;
      this.currentJobId = jobId;
    } catch (err) {
      this.finishRun(false, `Cannot reach backend: ${err instanceof Error ? err.message : 'Unknown error'}`);
      return;
    }

    const pollStart = Date.now();
    const maxMs = 62 * 60 * 1000;
    let failures = 0;

    this.pollIntervalId = window.setInterval(async () => {
      if (Date.now() - pollStart > maxMs) {
        clearInterval(this.pollIntervalId);
        this.finishRun(false, 'Workflow timed out after 62 minutes.');
        return;
      }
      try {
        const status = await this.api.getJobStatus(jobId);
        failures = 0;
        this.isReconnecting = false;
        this.handleStatus(status);
      } catch {
        failures++;
        if (failures >= 2) { this.isReconnecting = true; this.cdr.detectChanges(); }
        if (failures >= 10) {
          clearInterval(this.pollIntervalId);
          this.finishRun(false, 'Lost connection to backend.');
        }
      }
    }, 2000);
  }

  cancelRun(): void {
    const jobId = this.currentJobId;
    this.clearAllTimers();
    this.isRunning = false;
    this.isReconnecting = false;
    this.currentJobId = null;
    this.runResult = 'error';
    this.runResultMessage = 'Workflow cancelled.';
    if (jobId) this.api.cancelWorkflow(jobId).catch(console.error);
    this.cdr.detectChanges();
  }

  done(): void { this.router.navigate(['/dashboard']); }

  runAgain(): void {
    this.clearAllTimers();
    this.isRunning = false;
    this.runResult = null;
    this.workflowSteps = [];
    this.aiMsgIndex = 0;
    this.currentStep = 'platform'; this.state.generateStep.set('platform');
    this.cdr.detectChanges();
  }

  private handleStatus(status: JobStatusResponse & { generatedPosts?: GeneratedPost[] }): void {
    if (typeof status.startedAt === 'number' && status.startedAt > 0 && !this.startedAtMs) {
      this.startedAtMs = status.startedAt;
    }
    if (status.status === 'done') {
      clearInterval(this.pollIntervalId);
      this.markAllDone();

      // Always fetch /latest-posts immediately on done — most reliable source
      // since postsStore on server is always up to date.
      const runId = Date.now().toString();
      this.pendingRunId = runId;

      // Fetch posts from all available sources simultaneously
      const fromStatus: GeneratedPost[] = Array.isArray(status.generatedPosts) && status.generatedPosts.length > 0
        ? status.generatedPosts : [];

      if (fromStatus.length > 0) {
        // Posts came directly in the done response — save immediately
        this.saveHistoryEntryWithId(runId, fromStatus);
        // Also enrich any other empty entries in background
        this.enrichLocalStorage(fromStatus);
        return;
      }

      // Save placeholder immediately so run appears in History
      this.saveHistoryEntryWithId(runId, []);

      // Fetch from /latest-posts immediately (don't wait for poll cycle)
      this.fetchLatestPosts().then(latestPosts => {
        if (latestPosts.length > 0) {
          this.enrichLocalStorage(latestPosts, runId);
        }
      });

      // Also start background poll as fallback
      if (!this.waitingForPosts) {
        this.waitingForPosts = true;
        this.postWaitStart  = Date.now();
        this.startPostWaitPoll(runId);
      }
      return;
    }
    if (status.status === 'error') {
      clearInterval(this.pollIntervalId);
      this.state.addRunHistoryEntry({
        id: Date.now().toString(),
        platform: this.localPlatform,
        ranAt: new Date(),
        email: this.localEmail,
        sourcesUsed: this.state.activeSourceCount(),
        postsGenerated: this.localPosts,
        lookbackHours: this.localLookback,
        status: 'error'
      });
      this.finishRun(false, status.message || 'Workflow failed');
      return;
    }
    if (status.steps?.length) {
      this.workflowSteps = status.steps.map(s => ({
        ...s, message: s.status === 'done' ? 'Completed' : s.message ?? ''
      }));
    } else {
      const cur = Math.max(1, status.currentStep ?? 1);
      this.workflowSteps = this.workflowSteps.map((s, i) => {
        if (i + 1 < cur) return { ...s, status: 'done', message: 'Completed' };
        if (i + 1 === cur) return { ...s, status: 'running', message: 'Running...' };
        return { ...s, status: 'pending', message: '' };
      });
    }
    this.cdr.detectChanges();
  }

  private finishRun(ok: boolean, msg: string): void {
    this.clearAllTimers();
    this.isRunning = false;
    this.isReconnecting = false;
    this.currentJobId = null;
    this.runResult = ok ? 'success' : 'error';
    this.runResultMessage = msg;
    this.cdr.detectChanges();
  }

  private buildInitialSteps(): WorkflowStep[] {
    return PLATFORM_STEPS[this.localPlatform].map((s, i) => ({
      ...s,
      status: i === 0 ? 'running' : 'pending',
      message: i === 0 ? 'Starting...' : ''
    }));
  }

  private markAllDone(): void {
    this.workflowSteps = this.workflowSteps.map(s => ({ ...s, status: 'done', message: 'Completed' }));
    this.cdr.detectChanges();
  }

  // ══ CORE FIX: Direct DOM write — completely outside Angular CD ══
  private setStatusText(msg: string): void {
    const el = this.aiStatusEl?.nativeElement;
    if (!el) return;
    // Remove animation class, force reflow, re-add — triggers keyframe exactly once
    el.classList.remove('status-animate');
    void el.offsetWidth; // force browser reflow
    el.textContent = msg;
    el.classList.add('status-animate');
  }

  private startTimers(): void {
    this.clearAllTimers();
    this.startedAtMs = Date.now();
    this.elapsedText = '0s';
    this.aiMsgIndex = 0;

    const msgs = this.localPlatform === 'twitter' ? this.AI_MSGS_TW : this.AI_MSGS_LI;

    // Write first message directly to DOM
    // Small delay to ensure *ngIf has rendered the element
    setTimeout(() => this.setStatusText(msgs[0]), 50);

    let lastElapsed = 0;

    this.ngZone.runOutsideAngular(() => {

      // Status: direct DOM write, zero Angular involvement
      this.aiStatusIntervalId = window.setInterval(() => {
        this.aiMsgIndex = (this.aiMsgIndex + 1) % msgs.length;
        const msg = msgs[this.aiMsgIndex];
        this.setStatusText(msg); // no ngZone.run — no CD triggered
      }, 4500);

      // Elapsed: only enter zone when second changes
      this.elapsedIntervalId = window.setInterval(() => {
        if (!this.startedAtMs) return;
        const s = Math.floor((Date.now() - this.startedAtMs) / 1000);
        if (s === lastElapsed) return;
        lastElapsed = s;
        const m = Math.floor(s / 60);
        const sec = s % 60;
        const t = m > 0 ? `${m}m ${String(sec).padStart(2, '0')}s` : `${s}s`;
        this.ngZone.run(() => {
          this.elapsedText = t;
          this.cdr.markForCheck();
        });
      }, 250);
    });
  }

  private clearAllTimers(): void {
    if (this.elapsedIntervalId !== undefined) {
      clearInterval(this.elapsedIntervalId);
      this.elapsedIntervalId = undefined;
    }
    if (this.aiStatusIntervalId !== undefined) {
      clearInterval(this.aiStatusIntervalId);
      this.aiStatusIntervalId = undefined;
    }
    if (this.pollIntervalId !== undefined) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = undefined;
    }
    if (this.postWaitInterval !== undefined) {
      clearInterval(this.postWaitInterval);
      this.postWaitInterval = undefined;
    }
    this.waitingForPosts = false;
    clearTimeout(this.highlightTimer);
  }

  // ── Save history entry with a specific ID ─────────────────
  private saveHistoryEntry(posts: GeneratedPost[]): void {
    this.saveHistoryEntryWithId(Date.now().toString(), posts);
  }

  // ── Write posts into localStorage for a specific runId (or most recent empty) ──
  private enrichLocalStorage(posts: GeneratedPost[], runId?: string): void {
    if (!posts.length) return;
    try {
      const raw = localStorage.getItem('pylink_run_history_v1');
      if (!raw) return;
      const entries = JSON.parse(raw) as any[];
      let changed = false;
      if (runId) {
        // Try to enrich specific run first
        const idx = entries.findIndex(e => e.id === runId);
        if (idx >= 0 && (!entries[idx].generatedPosts || !entries[idx].generatedPosts.length)) {
          entries[idx].generatedPosts = posts;
          changed = true;
        }
      }
      if (!changed) {
        // Enrich most recent empty run
        for (const entry of entries) {
          if (entry.status === 'success' && (!entry.generatedPosts || !entry.generatedPosts.length)) {
            entry.generatedPosts = posts;
            changed = true;
            break;
          }
        }
      }
      if (changed) {
        localStorage.setItem('pylink_run_history_v1', JSON.stringify(entries));
        console.log('[generate] enrichLocalStorage: posts written to localStorage');
      }
    } catch { /* ignore */ }
  }

  private saveHistoryEntryWithId(id: string, posts: GeneratedPost[]): void {
    this.state.addRunHistoryEntry({
      id,
      platform:       this.localPlatform,
      ranAt:          new Date(),
      email:          this.localEmail,
      sourcesUsed:    this.state.activeSourceCount(),
      postsGenerated: this.localPosts,
      lookbackHours:  this.localLookback,
      status:         'success',
      generatedPosts: posts
    } as RunHistoryEntry);
    this.finishRun(true, 'Workflow complete! Check your email.');
  }

  // ── Enrich an already-saved history entry with posts ───────
  // Called after a placeholder was saved and posts arrive later.
  private enrichHistoryEntry(runId: string, posts: GeneratedPost[]): void {
    if (!posts.length) return;
    // Update localStorage directly so History page picks it up on next load
    try {
      const raw = localStorage.getItem('pylink_run_history_v1');
      if (raw) {
        const entries = JSON.parse(raw) as any[];
        const idx = entries.findIndex(e => e.id === runId);
        if (idx >= 0) {
          entries[idx].generatedPosts = posts;
          localStorage.setItem('pylink_run_history_v1', JSON.stringify(entries));
        }
      }
    } catch { /* ignore */ }
  }

  // ── Poll every 3 s waiting for posts (up to POST_WAIT_MAX_MS) ──
  private startPostWaitPoll(runId: string): void {
    const jobId = this.currentJobId;

    this.postWaitInterval = setInterval(async () => {
      const elapsed = Date.now() - this.postWaitStart;

      // Try /latest-posts on every tick
      const posts = await this.fetchLatestPosts();
      if (posts.length > 0) {
        clearInterval(this.postWaitInterval);
        this.postWaitInterval = undefined;
        this.waitingForPosts  = false;
        this.pendingRunId     = null;
        this.enrichHistoryEntry(runId, posts);
        this.enrichLocalStorage(posts, runId);
        return;
      }

      // Also try job-status if jobId still available
      if (jobId) {
        try {
          const s = await this.api.getJobStatus(jobId) as JobStatusResponse & { generatedPosts?: GeneratedPost[] };
          const jp: GeneratedPost[] = Array.isArray(s.generatedPosts) && s.generatedPosts.length > 0
            ? s.generatedPosts : [];
          if (jp.length > 0) {
            clearInterval(this.postWaitInterval);
            this.postWaitInterval = undefined;
            this.waitingForPosts  = false;
            this.pendingRunId     = null;
            this.enrichHistoryEntry(runId, jp);
            this.enrichLocalStorage(jp, runId);
            return;
          }
        } catch { /* ignore */ }
      }

      if (elapsed > this.POST_WAIT_MAX_MS) {
        // Give up — the placeholder entry stays with email notice
        clearInterval(this.postWaitInterval);
        this.postWaitInterval = undefined;
        this.waitingForPosts  = false;
        this.pendingRunId     = null;
      }
    }, 3000);
  }

  // ── Fetch posts from /latest-posts endpoint ─────────────────
  private async fetchLatestPosts(): Promise<GeneratedPost[]> {
    try {
      const res = await fetch('/latest-posts');
      if (!res.ok) return [];
      const data = await res.json();
      if (data.found && Array.isArray(data.posts) && data.posts.length > 0) {
        return data.posts as GeneratedPost[];
      }
    } catch { /* ignore */ }
    return [];
  }

  getStepClass(s: WorkflowStep): string {
    return s.status === 'done' ? 'step-done'
      : s.status === 'running' ? 'step-running'
      : 'step-pending';
  }
}

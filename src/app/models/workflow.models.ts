// ─── Platform ───────────────────────────────────────────────
export type Platform = 'linkedin' | 'twitter';

// ─── Tier ───────────────────────────────────────────────────
export type TierKey = 't1' | 't2' | 't3' | 't4';

// ─── Workflow step ───────────────────────────────────────────
export interface WorkflowStep {
  number:  number;
  key:     string;
  label:   string;
  status:  'pending' | 'running' | 'done' | 'error';
  message: string;
}

// ─── Job status response from backend ───────────────────────
export interface JobStatusResponse {
  status:       'running' | 'done' | 'error' | 'not_found';
  message:      string;
  currentStep:  number;
  totalSteps:   number;
  steps:        WorkflowStep[];
  startedAt:    number;
  finishedAt:   number | null;
  elapsedMs:    number;
  /** Generated posts returned by n8n via /workflow-complete */
  generatedPosts?: GeneratedPost[];
}

// ─── A single generated post ─────────────────────────────────
export interface GeneratedPost {
  /** 1-based index within this run */
  index:       number;
  /** Post headline / title */
  title:       string;
  /** Main post body text */
  body:        string;
  /** Hashtags string e.g. "#AI #Innovation" */
  hashtags:    string;
  /** Image generation prompt for Midjourney / Leonardo etc. */
  imagePrompt?: string;
  /** Source name e.g. "OpenAI API Changelog" */
  source?:     string;
  /** Source article URL */
  url?:        string;
  /** Published date string */
  published?:  string;
}


// ─── Workflow API config (sent to /run-workflow) ─────────────
export interface WorkflowConfig {
  lookback_hours:     number;
  max_final_articles: number;
  email_recipient:    string;
  active_sources:     string[];
  platform:           Platform;
}

// ─── Response from POST /run-workflow ────────────────────────
export interface StartWorkflowResponse {
  success:  boolean;
  jobId:    string;
  message?: string;
}

// ─── Run history entry ───────────────────────────────────────
export interface RunHistoryEntry {
  id:             string;
  platform:       Platform;
  ranAt:          Date;
  email:          string;
  sourcesUsed:    number;
  postsGenerated: number;
  lookbackHours:  number;
  status:         'success' | 'error' | 'cancelled';
  /** Actual generated posts — populated when backend returns them */
  generatedPosts?: GeneratedPost[];
}

import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AppStateService } from '../../services/app-state.service';
import { RunHistoryEntry, GeneratedPost } from '../../models/workflow.models';

type RichEntry = RunHistoryEntry & { generatedPosts?: GeneratedPost[] };

interface PostRecord {
  post:       GeneratedPost;
  run:        RichEntry;
  pinned:     boolean;
  tags:       string[];
  deleted:    boolean;
  deletedAt?: number;
}

interface DayGroup {
  dateKey:  string;
  label:    string;
  relLabel: string;
  rows:     RunRow[];
  expanded: boolean;
}

interface RunRow {
  run:  RichEntry;
  open: boolean;
}

const LS_KEY       = 'pylink_run_history_v1';
const LS_META      = 'pylink_post_meta_v1';      // pins, tags, deleted
const LS_TRASH     = 'pylink_trash_v1';
const PAGE_SIZE    = 5;
const TRASH_TTL_MS = 30 * 24 * 60 * 60 * 1000;  // 30 days

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, RouterLink],
  template: `
<div class="hw" [class.dark]="darkMode">

  <!-- ══ TOP BAR ══ -->
  <div class="topbar">
    <div>
      <h1 class="pg-title">Run History</h1>
      <p class="pg-sub">{{ filteredAllRuns.length }} run{{ filteredAllRuns.length !== 1 ? 's' : '' }} · {{ totalPostCount }} post{{ totalPostCount !== 1 ? 's' : '' }}
        <span *ngIf="activeView === 'trash'" class="trash-label"> — Recycle Bin</span>
        <span *ngIf="searchQ" class="search-label"> — searching "{{ searchQ }}"</span>
      </p>
    </div>
    <div class="topbar-actions">
      <button class="btn-icon" (click)="darkMode = !darkMode" [title]="darkMode ? 'Light mode' : 'Dark mode'">
        <svg *ngIf="!darkMode" viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><path d="M6 .278a.768.768 0 0 1 .08.858 7.208 7.208 0 0 0-.878 3.46c0 4.021 3.278 7.277 7.318 7.277.527 0 1.04-.055 1.533-.16a.787.787 0 0 1 .81.316.733.733 0 0 1-.031.893A8.349 8.349 0 0 1 8.344 16C3.734 16 0 12.286 0 7.71 0 4.266 2.114 1.312 5.124.06A.752.752 0 0 1 6 .278z"/></svg>
        <svg *ngIf="darkMode"  viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><path d="M8 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm0 1a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM8 0a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 0zm0 13a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 13zm8-5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2a.5.5 0 0 1 .5.5zM3 8a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2A.5.5 0 0 1 3 8z"/></svg>
      </button>
      <button class="btn-icon" (click)="manualRefresh()" [class.btn-refreshing]="isRefreshing" title="Check for new posts">
        <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14" [class.spin]="isRefreshing">
          <path d="M11.534 7h3.932a.25.25 0 0 1 .192.41l-1.966 2.36a.25.25 0 0 1-.384 0l-1.966-2.36a.25.25 0 0 1 .192-.41zm-11 2h3.932a.25.25 0 0 0 .192-.41L2.692 6.23a.25.25 0 0 0-.384 0L.342 8.59A.25.25 0 0 0 .534 9z"/>
          <path fill-rule="evenodd" d="M8 3c-1.552 0-2.94.707-3.857 1.818a.5.5 0 1 1-.771-.636A6.002 6.002 0 0 1 13.917 7H12.9A5.002 5.002 0 0 0 8 3zM3.1 9a5.002 5.002 0 0 0 8.757 2.182.5.5 0 1 1 .771.636A6.002 6.002 0 0 1 2.083 9H3.1z"/>
        </svg>
      </button>
      <button class="btn-icon" (click)="activeView = activeView === 'trash' ? 'history' : 'trash'"
              [class.btn-icon-active]="activeView === 'trash'" title="Recycle Bin">
        <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
          <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
          <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1z"/>
        </svg>
        <span *ngIf="trashCount > 0" class="trash-badge">{{ trashCount }}</span>
      </button>
      <a class="btn-new" routerLink="/generate">
        <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13">
          <path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0 1 12 2v5h4a1 1 0 0 1 .82 1.573l-7 10A1 1 0 0 1 8 18v-5H4a1 1 0 0 1-.82-1.573l7-10a1 1 0 0 1 1.12-.38z"/>
        </svg>
        New generation
      </a>
    </div>
  </div>

  <!-- ══ KPI STRIP ══ -->
  <div class="kpi-strip" *ngIf="allRuns.length > 0 && activeView === 'history'">
    <div class="kpi-card">
      <div class="kpi-icon ki-orange"><svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0 1 12 2.586L15.414 6A2 2 0 0 1 16 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"/></svg></div>
      <div><div class="kpi-val">{{ totalPosts }}</div><div class="kpi-lbl">Total Posts</div><div class="kpi-sub">Across all runs</div></div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon ki-green"><svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"/></svg></div>
      <div><div class="kpi-val">{{ successRate }}%</div><div class="kpi-lbl">Emails Delivered</div><div class="kpi-sub">Success rate</div></div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon ki-blue"><svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zm0 8a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zm2 8a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2h-2z"/></svg></div>
      <div><div class="kpi-val">{{ allRuns.length }}</div><div class="kpi-lbl">Total Runs</div><div class="kpi-sub">All time</div></div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon ki-purple"><svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 0 0 .95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 0 0-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 0 0-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 0 0-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 0 0 .951-.69l1.07-3.292z"/></svg></div>
      <div><div class="kpi-val">{{ pinnedCount }}</div><div class="kpi-lbl">Pinned Posts</div><div class="kpi-sub">Favourites</div></div>
    </div>
  </div>

  <!-- ══ SEARCH + FILTER BAR ══ -->
  <div class="filter-bar" *ngIf="activeView === 'history'">
    <div class="search-wrap">
      <svg class="s-ico" viewBox="0 0 16 16" fill="currentColor" width="13" height="13"><path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.116-.099zm-5.44 1.156a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z"/></svg>
      <input class="search-input" type="text" [(ngModel)]="searchQ" placeholder="Search posts by title or content…">
      <button *ngIf="searchQ" class="search-clear" (click)="searchQ = ''">×</button>
    </div>
    <div class="filter-chips">
      <button class="fc" [class.fc-on]="platformFilter === 'all'"      (click)="platformFilter = 'all'">All platforms</button>
      <button class="fc" [class.fc-on]="platformFilter === 'linkedin'" (click)="platformFilter = 'linkedin'">LinkedIn</button>
      <button class="fc" [class.fc-on]="platformFilter === 'twitter'"  (click)="platformFilter = 'twitter'">X / Twitter</button>
      <div class="fc-sep"></div>
      <button class="fc" [class.fc-on]="showPinnedOnly" (click)="showPinnedOnly = !showPinnedOnly">
        <svg viewBox="0 0 16 16" fill="currentColor" width="10" height="10"><path d="M9.828.722a.5.5 0 0 1 .354.146l4.95 4.95a.5.5 0 0 1 0 .707c-.48.48-1.072.588-1.503.588-.177 0-.335-.018-.46-.039l-3.134 3.134a5.927 5.927 0 0 1 .16 1.013c.046.702-.032 1.687-.72 2.375a.5.5 0 0 1-.707 0l-2.829-2.828-3.182 3.182c-.195.195-1.219.902-1.414.707-.195-.195.512-1.22.707-1.414l3.182-3.182-2.828-2.829a.5.5 0 0 1 0-.707c.688-.688 1.673-.767 2.375-.72a5.922 5.922 0 0 1 1.013.16l3.134-3.133a2.772 2.772 0 0 1-.04-.461c0-.43.108-1.022.589-1.503a.5.5 0 0 1 .353-.146z"/></svg>
        Pinned
      </button>
      <div class="fc-sep"></div>
      <select class="sort-select" [(ngModel)]="sortOrder">
        <option value="newest">Newest first</option>
        <option value="oldest">Oldest first</option>
      </select>
    </div>
    <!-- Date range filter row -->
    <div class="date-filter-row">
      <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12" style="color:var(--t3);flex-shrink:0"><path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5zM1 4v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4H1z"/></svg>
      <button class="fc" [class.fc-on]="dateFilter === 'all'"     (click)="setDateFilter('all')">All time</button>
      <button class="fc" [class.fc-on]="dateFilter === '7d'"      (click)="setDateFilter('7d')">Last 7 days</button>
      <button class="fc" [class.fc-on]="dateFilter === '30d'"     (click)="setDateFilter('30d')">Last 30 days</button>
      <button class="fc" [class.fc-on]="dateFilter === '90d'"     (click)="setDateFilter('90d')">Last 90 days</button>
      <button class="fc" [class.fc-on]="dateFilter === 'custom'"  (click)="setDateFilter('custom')">
        <svg viewBox="0 0 16 16" fill="currentColor" width="10" height="10"><path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5zM1 4v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4H1z"/></svg>
        Custom
      </button>
      <!-- Custom date inputs shown when custom selected -->
      <ng-container *ngIf="dateFilter === 'custom'">
        <input class="date-input" type="date" [(ngModel)]="customDateFrom" (change)="onCustomDateChange()" [max]="customDateTo || todayStr">
        <span class="date-sep">→</span>
        <input class="date-input" type="date" [(ngModel)]="customDateTo"   (change)="onCustomDateChange()" [min]="customDateFrom" [max]="todayStr">
      </ng-container>
      <!-- Active filter badge -->
      <span class="date-active-badge" *ngIf="dateFilter !== 'all'">
        {{ dateFilterLabel }}
        <button class="date-clear" (click)="setDateFilter('all')">×</button>
      </span>
    </div>
  </div>

  <!-- ══ BULK ACTION BAR ══ -->
  <div class="bulk-bar" *ngIf="selectedPosts.size > 0">
    <span class="bulk-count">{{ selectedPosts.size }} selected</span>
    <button class="bulk-btn" (click)="bulkCopy()">
      <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12"><path d="M4 1.5H3a2 2 0 00-2 2V14a2 2 0 002 2h10a2 2 0 002-2V3.5a2 2 0 00-2-2h-1v1h1a1 1 0 011 1V14a1 1 0 01-1 1H3a1 1 0 01-1-1V3.5a1 1 0 011-1h1v-1z"/><path d="M9.5 1a.5.5 0 01.5.5v1a.5.5 0 01-.5.5h-3a.5.5 0 01-.5-.5v-1a.5.5 0 01.5-.5h3z"/></svg>
      Copy all
    </button>
    <button class="bulk-btn" (click)="bulkExport()">
      <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/><path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/></svg>
      Export .txt
    </button>
    <button class="bulk-btn bulk-btn-del" (click)="bulkDelete()">
      <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1z"/></svg>
      Delete
    </button>
    <button class="bulk-btn" (click)="selectedPosts.clear()">Cancel</button>
  </div>

  <!-- ══ EMPTY ══ -->
  <div class="empty" *ngIf="allRuns.length === 0 && activeView === 'history'">
    <div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" width="34" height="34"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div>
    <h3>No history yet</h3>
    <p>Run a generation and your posts will be archived here.</p>
    <a class="btn-new" routerLink="/generate" style="margin-top:6px">Start your first run</a>
  </div>

  <!-- ══ TRASH VIEW ══ -->
  <div class="trash-view" *ngIf="activeView === 'trash'">
    <div class="empty" *ngIf="trashedPosts.length === 0">
      <div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" width="34" height="34"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></div>
      <h3>Recycle Bin is empty</h3>
      <p>Deleted posts appear here for 30 days before permanent removal.</p>
    </div>
    <div class="trash-notice" *ngIf="trashedPosts.length > 0">
      <svg viewBox="0 0 16 16" fill="currentColor" width="13" height="13"><path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/><path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/></svg>
      Posts are permanently deleted after 30 days.
      <button class="btn-empty-trash" (click)="emptyTrash()">Empty trash</button>
    </div>
    <div class="post-card" *ngFor="let rec of trashedPosts">
      <div class="pc-summary trash-item">
        <div class="pc-l">
          <span class="pc-num">POST {{ rec.post.index }}</span>
          <div class="pc-text">
            <div class="pc-title">{{ rec.post.title }}</div>
            <div class="pc-preview">{{ preview(rec.post.body) }}</div>
          </div>
        </div>
        <div class="pc-actions">
          <button class="act-btn act-restore" (click)="restorePost(rec)" title="Restore">
            <svg viewBox="0 0 16 16" fill="currentColor" width="13" height="13"><path d="M11.534 7h3.932a.25.25 0 0 1 .192.41l-1.966 2.36a.25.25 0 0 1-.384 0l-1.966-2.36a.25.25 0 0 1 .192-.41zm-11 2h3.932a.25.25 0 0 0 .192-.41L2.692 6.23a.25.25 0 0 0-.384 0L.342 8.59A.25.25 0 0 0 .534 9z"/><path fill-rule="evenodd" d="M8 3c-1.552 0-2.94.707-3.857 1.818a.5.5 0 1 1-.771-.636A6.002 6.002 0 0 1 13.917 7H12.9A5.002 5.002 0 0 0 8 3z"/></svg>
            Restore
          </button>
          <button class="act-btn act-del-perm" (click)="permanentDelete(rec)" title="Delete permanently">
            <svg viewBox="0 0 16 16" fill="currentColor" width="13" height="13"><path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854z"/></svg>
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- ══ HISTORY FEED ══ -->
  <div class="feed" *ngIf="activeView === 'history' && allRuns.length > 0">
    <div class="day-block" *ngFor="let group of pagedGroups">
      <div class="day-hdr" (click)="toggleDay(group)">
        <div class="dh-l">
          <div class="dh-cal"><svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13"><path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"/></svg></div>
          <span class="dh-date">{{ group.label }}</span>
          <span class="dh-badge">{{ group.rows.length }} run{{ group.rows.length !== 1 ? 's' : '' }}</span>
          <span class="dh-badge dh-badge-posts">{{ dayPostCount(group) }} post{{ dayPostCount(group) !== 1 ? 's' : '' }}</span>
        </div>
        <div class="dh-r">
          <span class="dh-sent"><span class="dh-dot"></span>Sent</span>
          <span class="dh-rel">{{ group.relLabel }}</span>
          <svg class="dh-chev" [class.dh-chev-open]="group.expanded" viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
        </div>
      </div>

      <div class="runs-wrap" *ngIf="group.expanded">
        <div class="run-block" *ngFor="let row of group.rows; let ri = index">
          <div class="run-hdr" (click)="toggleRun(row)">
            <div class="rh-l">
              <span class="run-index">Run {{ group.rows.length - ri }}</span>
              <span class="run-time">{{ row.run.ranAt | date:'h:mm a' }}</span>
              <span class="run-pill" [class.pill-tw]="row.run.platform === 'twitter'">
                <svg *ngIf="row.run.platform !== 'twitter'" viewBox="0 0 20 20" fill="currentColor" width="9" height="9"><path fill-rule="evenodd" d="M16.338 16.338H13.67V12.16c0-.995-.017-2.277-1.387-2.277-1.39 0-1.601 1.086-1.601 2.207v4.248H8.014v-8.59h2.559v1.174h.037c.356-.675 1.227-1.387 2.526-1.387 2.703 0 3.203 1.778 3.203 4.092v4.711zM5.005 6.575a1.548 1.548 0 1 1 0-3.096 1.548 1.548 0 0 1 0 3.096zm-1.337 9.763H6.34v-8.59H3.667v8.59zM17.668 1H2.328C1.595 1 1 1.581 1 2.298v15.403C1 18.418 1.595 19 2.328 19h15.34c.734 0 1.332-.582 1.332-1.299V2.298C19 1.581 18.402 1 17.668 1z"/></svg>
                <svg *ngIf="row.run.platform === 'twitter'" viewBox="0 0 20 20" fill="currentColor" width="9" height="9"><path d="M11.896 9.07 17.537 2.5h-1.331l-4.898 5.493-3.907-5.493H3L8.938 11.1 3 18h1.331l5.204-5.836 4.151 5.836H17L11.896 9.07Z"/></svg>
                {{ row.run.platform === 'twitter' ? 'Twitter / X' : 'LinkedIn' }}
              </span>
              <span class="run-meta">{{ row.run.sourcesUsed }} sources · {{ row.run.lookbackHours }}h lookback</span>
            </div>
            <div class="rh-r">
              <span class="run-post-count">{{ runPostCount(row.run) }} post{{ runPostCount(row.run) !== 1 ? 's' : '' }}</span>
              <span class="badge-ok" *ngIf="row.run.status === 'success'">Success</span>
              <span class="badge-err" *ngIf="row.run.status === 'error'">Error</span>
              <svg class="run-chev" [class.run-chev-open]="row.open" viewBox="0 0 16 16" fill="currentColor" width="13" height="13"><path fill-rule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/></svg>
            </div>
          </div>

          <div class="posts-wrap" *ngIf="row.open">
            <ng-container *ngIf="hasPosts(row.run)">
              <div class="post-card"
                   *ngFor="let post of visiblePosts(row.run)"
                   [class.post-card-open]="isPostOpen(row.run.id, post.index)"
                   [class.post-pinned]="isPinned(row.run.id, post.index)">

                <!-- Select checkbox -->
                <div class="pc-select-wrap">
                  <input type="checkbox" class="pc-checkbox"
                         [checked]="selectedPosts.has(postKey(row.run.id, post.index))"
                         (change)="toggleSelect(row.run.id, post.index)">
                </div>

                <div class="pc-summary" (click)="togglePost(row.run.id, post.index)">
                  <div class="pc-l">
                    <span class="pc-num">POST {{ post.index }}</span>
                    <div class="pc-text">
                      <div class="pc-title">
                        <svg *ngIf="isPinned(row.run.id, post.index)" viewBox="0 0 16 16" fill="currentColor" width="10" height="10" style="color:var(--amber);margin-right:4px"><path d="M9.828.722a.5.5 0 0 1 .354.146l4.95 4.95a.5.5 0 0 1 0 .707c-.48.48-1.072.588-1.503.588-.177 0-.335-.018-.46-.039l-3.134 3.134a5.927 5.927 0 0 1 .16 1.013c.046.702-.032 1.687-.72 2.375a.5.5 0 0 1-.707 0l-2.829-2.828-3.182 3.182c-.195.195-1.219.902-1.414.707-.195-.195.512-1.22.707-1.414l3.182-3.182-2.828-2.829a.5.5 0 0 1 0-.707c.688-.688 1.673-.767 2.375-.72a5.922 5.922 0 0 1 1.013.16l3.134-3.133a2.772 2.772 0 0 1-.04-.461c0-.43.108-1.022.589-1.503a.5.5 0 0 1 .353-.146z"/></svg>
                        {{ post.title }}
                      </div>
                      <div class="pc-preview">{{ preview(post.body) }}</div>
                    </div>
                  </div>
                  <div class="pc-actions" (click)="$event.stopPropagation()">
                    <button class="act-btn" [class.act-pinned]="isPinned(row.run.id, post.index)"
                            (click)="togglePin(row.run.id, post.index)" title="Pin / Unpin">
                      <svg viewBox="0 0 16 16" fill="currentColor" width="11" height="11"><path d="M9.828.722a.5.5 0 0 1 .354.146l4.95 4.95a.5.5 0 0 1 0 .707c-.48.48-1.072.588-1.503.588-.177 0-.335-.018-.46-.039l-3.134 3.134a5.927 5.927 0 0 1 .16 1.013c.046.702-.032 1.687-.72 2.375a.5.5 0 0 1-.707 0l-2.829-2.828-3.182 3.182c-.195.195-1.219.902-1.414.707-.195-.195.512-1.22.707-1.414l3.182-3.182-2.828-2.829a.5.5 0 0 1 0-.707c.688-.688 1.673-.767 2.375-.72a5.922 5.922 0 0 1 1.013.16l3.134-3.133a2.772 2.772 0 0 1-.04-.461c0-.43.108-1.022.589-1.503a.5.5 0 0 1 .353-.146z"/></svg>
                    </button>
                    <button class="act-btn" (click)="openModal(post, row.run)" title="View full post">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
                    </button>
                    <button class="act-btn" (click)="duplicatePost(post, row.run)" title="Duplicate post">
                      <svg viewBox="0 0 16 16" fill="currentColor" width="13" height="13"><path d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V2zm2-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H6zM2 5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1h1v1a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1v1H2z"/></svg>
                    </button>
                    <button class="act-btn" [class.act-copied]="copiedKey === postKey(row.run.id, post.index)"
                            (click)="copyPost(post, postKey(row.run.id, post.index))" title="Copy">
                      <svg *ngIf="copiedKey !== postKey(row.run.id, post.index)" viewBox="0 0 16 16" fill="currentColor" width="13" height="13"><path d="M4 1.5H3a2 2 0 00-2 2V14a2 2 0 002 2h10a2 2 0 002-2V3.5a2 2 0 00-2-2h-1v1h1a1 1 0 011 1V14a1 1 0 01-1 1H3a1 1 0 01-1-1V3.5a1 1 0 011-1h1v-1z"/><path d="M9.5 1a.5.5 0 01.5.5v1a.5.5 0 01-.5.5h-3a.5.5 0 01-.5-.5v-1a.5.5 0 01.5-.5h3z"/></svg>
                      <svg *ngIf="copiedKey === postKey(row.run.id, post.index)" viewBox="0 0 16 16" fill="currentColor" width="13" height="13"><path d="M13.854 3.646a.5.5 0 010 .708l-7 7a.5.5 0 01-.708 0l-3.5-3.5a.5.5 0 11.708-.708L6.5 10.293l6.646-6.647a.5.5 0 01.708 0z"/></svg>
                    </button>
                    <button class="act-btn" (click)="downloadPost(post)" title="Download as .txt">
                      <svg viewBox="0 0 16 16" fill="currentColor" width="13" height="13"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/><path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/></svg>
                    </button>
                    <button class="act-btn act-btn-li"
                            [class.act-li-posted]="linkedinPostedKey === postKey(row.run.id, post.index)"
                            [class.act-li-loading]="linkedinPostingKey === postKey(row.run.id, post.index)"
                            (click)="openLinkedInConfirm(post, postKey(row.run.id, post.index))"
                            [disabled]="linkedinPostingKey === postKey(row.run.id, post.index)"
                            title="Post to LinkedIn">
                      <svg *ngIf="linkedinPostedKey !== postKey(row.run.id, post.index) && linkedinPostingKey !== postKey(row.run.id, post.index)" viewBox="0 0 20 20" fill="currentColor" width="11" height="11"><path fill-rule="evenodd" d="M16.338 16.338H13.67V12.16c0-.995-.017-2.277-1.387-2.277-1.39 0-1.601 1.086-1.601 2.207v4.248H8.014v-8.59h2.559v1.174h.037c.356-.675 1.227-1.387 2.526-1.387 2.703 0 3.203 1.778 3.203 4.092v4.711zM5.005 6.575a1.548 1.548 0 1 1 0-3.096 1.548 1.548 0 0 1 0 3.096zm-1.337 9.763H6.34v-8.59H3.667v8.59zM17.668 1H2.328C1.595 1 1 1.581 1 2.298v15.403C1 18.418 1.595 19 2.328 19h15.34c.734 0 1.332-.582 1.332-1.299V2.298C19 1.581 18.402 1 17.668 1z"/></svg>
                      <svg *ngIf="linkedinPostedKey === postKey(row.run.id, post.index)" viewBox="0 0 16 16" fill="currentColor" width="11" height="11"><path d="M13.854 3.646a.5.5 0 010 .708l-7 7a.5.5 0 01-.708 0l-3.5-3.5a.5.5 0 11.708-.708L6.5 10.293l6.646-6.647a.5.5 0 01.708 0z"/></svg>
                      <svg *ngIf="linkedinPostingKey === postKey(row.run.id, post.index)" class="spin" viewBox="0 0 16 16" fill="currentColor" width="11" height="11"><path d="M11.534 7h3.932a.25.25 0 0 1 .192.41l-1.966 2.36a.25.25 0 0 1-.384 0l-1.966-2.36a.25.25 0 0 1 .192-.41zm-11 2h3.932a.25.25 0 0 0 .192-.41L2.692 6.23a.25.25 0 0 0-.384 0L.342 8.59A.25.25 0 0 0 .534 9z"/><path fill-rule="evenodd" d="M8 3c-1.552 0-2.94.707-3.857 1.818a.5.5 0 1 1-.771-.636A6.002 6.002 0 0 1 13.917 7H12.9A5.002 5.002 0 0 0 8 3zM3.1 9a5.002 5.002 0 0 0 8.757 2.182.5.5 0 1 1 .771.636A6.002 6.002 0 0 1 2.083 9H3.1z"/></svg>
                    </button>
                    <button class="act-btn act-btn-del" (click)="softDeletePost(post, row.run)" title="Delete">
                      <svg viewBox="0 0 16 16" fill="currentColor" width="13" height="13"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1z"/></svg>
                    </button>
                  </div>
                </div>

                <!-- Expanded inline body -->
                <div class="pc-body" *ngIf="isPostOpen(row.run.id, post.index)">
                  <h3 class="pb-h3" *ngIf="post.title && !post.title.startsWith('Post ')">{{ post.title }}</h3>
                  <p class="pb-text">{{ post.body }}</p>
                  <p class="pb-tags" *ngIf="post.hashtags">{{ post.hashtags }}</p>
                  <div class="pb-img-prompt" *ngIf="post.imagePrompt && post.imagePrompt.trim()">
                    <div class="pip-lbl">IMAGE GENERATION PROMPT</div>
                    <div class="pip-txt">"{{ post.imagePrompt }}"</div>
                    <div class="pip-note">Use on: Midjourney, Leonardo.ai, Adobe Firefly, or Canva AI</div>
                  </div>
                  <div class="pb-meta" *ngIf="post.source || post.published || post.url">
                    <div class="pm-row" *ngIf="post.source"><span class="pm-k">Source</span><span class="pm-v">{{ post.source }}</span></div>
                    <div class="pm-row" *ngIf="post.published"><span class="pm-k">Published</span><span class="pm-v">{{ post.published }}</span></div>
                    <div class="pm-row" *ngIf="post.url"><span class="pm-k">Read more</span><a class="pm-a" [href]="post.url" target="_blank" rel="noopener">{{ post.url }}</a></div>
                  </div>

                  <!-- Tag input -->
                  <div class="tag-section">
                    <div class="tag-list">
                      <span class="tag-chip" *ngFor="let tag of getTags(row.run.id, post.index)">
                        {{ tag }}
                        <button class="tag-del" (click)="removeTag(row.run.id, post.index, tag)">×</button>
                      </span>
                      <input class="tag-input" type="text" placeholder="+ Add tag…"
                             (keydown.enter)="addTag(row.run.id, post.index, $any($event))"
                             (keydown.comma)="addTag(row.run.id, post.index, $any($event))">
                    </div>
                  </div>

                  <div class="pb-foot">
                    <button class="btn-copy-post" [class.btn-copied]="copiedKey === postKey(row.run.id, post.index)"
                            (click)="copyPost(post, postKey(row.run.id, post.index))">
                      {{ copiedKey === postKey(row.run.id, post.index) ? '✓ Copied!' : 'Copy post' }}
                    </button>
                    <button class="btn-post-li"
                            [class.btn-li-posted]="linkedinPostedKey === postKey(row.run.id, post.index)"
                            [class.btn-li-loading]="linkedinPostingKey === postKey(row.run.id, post.index)"
                            [disabled]="linkedinPostingKey === postKey(row.run.id, post.index)"
                            (click)="openLinkedInConfirm(post, postKey(row.run.id, post.index))">
                      <svg *ngIf="linkedinPostedKey !== postKey(row.run.id, post.index) && linkedinPostingKey !== postKey(row.run.id, post.index)" viewBox="0 0 20 20" fill="currentColor" width="12" height="12"><path fill-rule="evenodd" d="M16.338 16.338H13.67V12.16c0-.995-.017-2.277-1.387-2.277-1.39 0-1.601 1.086-1.601 2.207v4.248H8.014v-8.59h2.559v1.174h.037c.356-.675 1.227-1.387 2.526-1.387 2.703 0 3.203 1.778 3.203 4.092v4.711zM5.005 6.575a1.548 1.548 0 1 1 0-3.096 1.548 1.548 0 0 1 0 3.096zm-1.337 9.763H6.34v-8.59H3.667v8.59zM17.668 1H2.328C1.595 1 1 1.581 1 2.298v15.403C1 18.418 1.595 19 2.328 19h15.34c.734 0 1.332-.582 1.332-1.299V2.298C19 1.581 18.402 1 17.668 1z"/></svg>
                      <svg *ngIf="linkedinPostedKey === postKey(row.run.id, post.index)" viewBox="0 0 16 16" fill="currentColor" width="12" height="12"><path d="M13.854 3.646a.5.5 0 010 .708l-7 7a.5.5 0 01-.708 0l-3.5-3.5a.5.5 0 11.708-.708L6.5 10.293l6.646-6.647a.5.5 0 01.708 0z"/></svg>
                      <svg *ngIf="linkedinPostingKey === postKey(row.run.id, post.index)" class="spin" viewBox="0 0 16 16" fill="currentColor" width="12" height="12"><path d="M11.534 7h3.932a.25.25 0 0 1 .192.41l-1.966 2.36a.25.25 0 0 1-.384 0l-1.966-2.36a.25.25 0 0 1 .192-.41zm-11 2h3.932a.25.25 0 0 0 .192-.41L2.692 6.23a.25.25 0 0 0-.384 0L.342 8.59A.25.25 0 0 0 .534 9z"/><path fill-rule="evenodd" d="M8 3c-1.552 0-2.94.707-3.857 1.818a.5.5 0 1 1-.771-.636A6.002 6.002 0 0 1 13.917 7H12.9A5.002 5.002 0 0 0 8 3zM3.1 9a5.002 5.002 0 0 0 8.757 2.182.5.5 0 1 1 .771.636A6.002 6.002 0 0 1 2.083 9H3.1z"/></svg>
                      {{ linkedinPostedKey === postKey(row.run.id, post.index) ? '✓ Posted!' : linkedinPostingKey === postKey(row.run.id, post.index) ? 'Posting…' : 'Post to LinkedIn' }}
                    </button>
                    <button class="pb-btn-dl" (click)="downloadPost(post)">Download .txt</button>
                    <button class="btn-edit-modal" (click)="openModal(post, row.run); enterEditMode()">
                      <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12"><path d="M12.854.146a.5.5 0 0 0-.707 0L10.5 1.793 14.207 5.5l1.647-1.646a.5.5 0 0 0 0-.708l-3-3zm.646 6.061L9.793 2.5 3.293 9H3.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.207l6.5-6.5zm-7.468 7.468A.5.5 0 0 1 6 13.5V13h-.5a.5.5 0 0 1-.5-.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.5-.5V10h-.5a.499.499 0 0 1-.175-.032l-.179.178a.5.5 0 0 0-.11.168l-2 5a.5.5 0 0 0 .65.65l5-2a.5.5 0 0 0 .168-.11l.178-.178z"/></svg>
                      Edit
                    </button>
                    <button class="pb-btn-close" (click)="togglePost(row.run.id, post.index)">Close</button>
                  </div>
                </div>

              </div>
            </ng-container>

            <!-- No posts notice -->
            <div class="email-notice" *ngIf="!hasPosts(row.run) && row.run.status === 'success'">
              <div class="en-icon"><svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/></svg></div>
              <div class="en-body">
                <div class="en-title">{{ row.run.postsGenerated }} post{{ row.run.postsGenerated !== 1 ? 's were' : ' was' }} generated and delivered to your inbox</div>
                <div class="en-desc">Check <strong>{{ row.run.email }}</strong> · Post content will appear here automatically once your n8n workflow sends it back.</div>
              </div>
            </div>
            <div class="error-notice" *ngIf="row.run.status === 'error'">
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"/></svg>
              This run encountered an error. No posts were delivered.
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- ══ PAGINATION ══ -->
  <div class="pgn" *ngIf="totalPages > 1 && activeView === 'history'">
    <button class="pg-btn" (click)="goPage(currentPage - 1)" [disabled]="currentPage === 1">‹</button>
    <button class="pg-num" *ngFor="let p of pageNums" [class.pg-act]="p === currentPage" (click)="goPage(p)">{{ p }}</button>
    <button class="pg-btn" (click)="goPage(currentPage + 1)" [disabled]="currentPage === totalPages">›</button>
  </div>

</div>

<!-- ══════════════════ LINKEDIN CONFIRM DIALOG ══════════════════ -->
<div class="li-confirm-bd" *ngIf="liConfirmPost" (click)="cancelLinkedInConfirm()">
  <div class="li-confirm-box" (click)="$event.stopPropagation()">
    <div class="li-confirm-hdr">
      <div class="li-confirm-logo">
        <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fill-rule="evenodd" d="M16.338 16.338H13.67V12.16c0-.995-.017-2.277-1.387-2.277-1.39 0-1.601 1.086-1.601 2.207v4.248H8.014v-8.59h2.559v1.174h.037c.356-.675 1.227-1.387 2.526-1.387 2.703 0 3.203 1.778 3.203 4.092v4.711zM5.005 6.575a1.548 1.548 0 1 1 0-3.096 1.548 1.548 0 0 1 0 3.096zm-1.337 9.763H6.34v-8.59H3.667v8.59zM17.668 1H2.328C1.595 1 1 1.581 1 2.298v15.403C1 18.418 1.595 19 2.328 19h15.34c.734 0 1.332-.582 1.332-1.299V2.298C19 1.581 18.402 1 17.668 1z"/></svg>
        Post to LinkedIn
      </div>
      <button class="modal-cls" (click)="cancelLinkedInConfirm()">×</button>
    </div>
    <div class="li-confirm-body">
      <div class="li-preview-label">Preview</div>
      <div class="li-preview-text">{{ liConfirmPreview }}</div>
      <div class="li-error" *ngIf="liPostError">
        <svg viewBox="0 0 16 16" fill="currentColor" width="13" height="13"><path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/><path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z"/></svg>
        {{ liPostError }}
      </div>
    </div>
    <div class="li-confirm-foot">
      <button class="li-btn-confirm"
              [disabled]="linkedinPostingKey === liConfirmKey"
              (click)="confirmPostToLinkedIn()">
        <svg *ngIf="linkedinPostingKey !== liConfirmKey" viewBox="0 0 20 20" fill="currentColor" width="13" height="13"><path fill-rule="evenodd" d="M16.338 16.338H13.67V12.16c0-.995-.017-2.277-1.387-2.277-1.39 0-1.601 1.086-1.601 2.207v4.248H8.014v-8.59h2.559v1.174h.037c.356-.675 1.227-1.387 2.526-1.387 2.703 0 3.203 1.778 3.203 4.092v4.711zM5.005 6.575a1.548 1.548 0 1 1 0-3.096 1.548 1.548 0 0 1 0 3.096zm-1.337 9.763H6.34v-8.59H3.667v8.59zM17.668 1H2.328C1.595 1 1 1.581 1 2.298v15.403C1 18.418 1.595 19 2.328 19h15.34c.734 0 1.332-.582 1.332-1.299V2.298C19 1.581 18.402 1 17.668 1z"/></svg>
        <svg *ngIf="linkedinPostingKey === liConfirmKey" class="spin" viewBox="0 0 16 16" fill="currentColor" width="13" height="13"><path d="M11.534 7h3.932a.25.25 0 0 1 .192.41l-1.966 2.36a.25.25 0 0 1-.384 0l-1.966-2.36a.25.25 0 0 1 .192-.41zm-11 2h3.932a.25.25 0 0 0 .192-.41L2.692 6.23a.25.25 0 0 0-.384 0L.342 8.59A.25.25 0 0 0 .534 9z"/><path fill-rule="evenodd" d="M8 3c-1.552 0-2.94.707-3.857 1.818a.5.5 0 1 1-.771-.636A6.002 6.002 0 0 1 13.917 7H12.9A5.002 5.002 0 0 0 8 3zM3.1 9a5.002 5.002 0 0 0 8.757 2.182.5.5 0 1 1 .771.636A6.002 6.002 0 0 1 2.083 9H3.1z"/></svg>
        {{ linkedinPostingKey === liConfirmKey ? 'Publishing…' : 'Publish now' }}
      </button>
      <button class="pb-btn-close" (click)="cancelLinkedInConfirm()">Cancel</button>
    </div>
  </div>
</div>

<!-- ══ UNDO TOAST ══ -->
<div class="undo-toast" *ngIf="undoToast" [class.undo-toast-visible]="undoToast">
  <svg viewBox="0 0 16 16" fill="currentColor" width="13" height="13"><path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/></svg>
  Post updated
  <button class="undo-btn" (click)="undoEdit()">Undo</button>
  <button class="undo-dismiss" (click)="dismissUndo()">×</button>
</div>


<div class="modal-bd" *ngIf="modalPost" (click)="closeModal()">
  <div class="modal-box" (click)="$event.stopPropagation()">
    <div class="modal-hdr">
      <div class="mh-l">
        <span class="run-pill" [class.pill-tw]="modalRun?.platform === 'twitter'" style="font-size:0.74rem;padding:4px 12px">
          {{ modalRun?.platform === 'twitter' ? 'Twitter / X' : 'LinkedIn' }}
        </span>
        <span class="modal-date" *ngIf="modalRun">{{ modalRun.ranAt | date:'MMM d, yyyy · h:mm a' }}</span>
      </div>
      <div class="mh-r">
        <!-- Pin toggle in modal -->
        <button class="modal-pin-btn"
                [class.modal-pin-active]="modalRun && isPinned(modalRun.id, modalPost!.index)"
                (click)="togglePin(modalRun!.id, modalPost!.index)"
                [title]="modalRun && isPinned(modalRun.id, modalPost!.index) ? 'Unpin post' : 'Pin post'">
          <svg viewBox="0 0 16 16" fill="currentColor" width="13" height="13"><path d="M9.828.722a.5.5 0 0 1 .354.146l4.95 4.95a.5.5 0 0 1 0 .707c-.48.48-1.072.588-1.503.588-.177 0-.335-.018-.46-.039l-3.134 3.134a5.927 5.927 0 0 1 .16 1.013c.046.702-.032 1.687-.72 2.375a.5.5 0 0 1-.707 0l-2.829-2.828-3.182 3.182c-.195.195-1.219.902-1.414.707-.195-.195.512-1.22.707-1.414l3.182-3.182-2.828-2.829a.5.5 0 0 1 0-.707c.688-.688 1.673-.767 2.375-.72a5.922 5.922 0 0 1 1.013.16l3.134-3.133a2.772 2.772 0 0 1-.04-.461c0-.43.108-1.022.589-1.503a.5.5 0 0 1 .353-.146z"/></svg>
          {{ modalRun && isPinned(modalRun.id, modalPost!.index) ? 'Pinned' : 'Pin' }}
        </button>
        <button class="modal-cls" (click)="closeModal()">×</button>
      </div>
    </div>
    <div class="modal-body" *ngIf="modalPost">
      <div class="modal-post-num">POST {{ modalPost.index }}</div>
      <h2 class="modal-title">{{ modalPost.title }}</h2>
      <!-- View mode body -->
      <p class="modal-text" *ngIf="!editMode">{{ modalPost.body }}</p>
      <p class="modal-tags" *ngIf="modalPost.hashtags && !editMode">{{ modalPost.hashtags }}</p>

      <!-- Edit mode body -->
      <div class="modal-edit-area" *ngIf="editMode">
        <div class="edit-field-label">Post body</div>
        <textarea class="modal-edit-textarea"
          [(ngModel)]="editDraft"
          rows="10"
          placeholder="Edit your post here…"></textarea>
        <div class="edit-char-row">
          <span class="edit-char-count" [class.edit-char-warn]="editDraft.length > 3000">
            {{ editDraft.length }} / 3000 chars
          </span>
        </div>
        <div class="edit-field-label" style="margin-top:10px">Hashtags</div>
        <input class="modal-edit-input"
          type="text"
          [(ngModel)]="editHashtagsDraft"
          placeholder="#AI #Innovation…" />
      </div>
      <div class="pb-img-prompt" *ngIf="modalPost.imagePrompt && modalPost.imagePrompt.trim()">
        <div class="pip-lbl">IMAGE GENERATION PROMPT</div>
        <div class="pip-txt">"{{ modalPost.imagePrompt }}"</div>
        <div class="pip-note">Use on: Midjourney, Leonardo.ai, Adobe Firefly, or Canva AI</div>
      </div>
      <div class="pb-meta" *ngIf="modalPost.source || modalPost.published || modalPost.url">
        <div class="pm-row" *ngIf="modalPost.source"><span class="pm-k">Source</span><span class="pm-v">{{ modalPost.source }}</span></div>
        <div class="pm-row" *ngIf="modalPost.published"><span class="pm-k">Published</span><span class="pm-v">{{ modalPost.published }}</span></div>
        <div class="pm-row" *ngIf="modalPost.url"><span class="pm-k">Read more</span><a class="pm-a" [href]="modalPost.url" target="_blank">{{ modalPost.url }}</a></div>
      </div>
    </div>
    <div class="modal-foot">
      <!-- View mode buttons -->
      <ng-container *ngIf="!editMode">
        <button class="btn-copy-post" [class.btn-copied]="copiedKey === 'modal'" (click)="copyPost(modalPost!, 'modal')">
          {{ copiedKey === 'modal' ? '✓ Copied!' : 'Copy full post' }}
        </button>
        <button class="btn-post-li"
                [class.btn-li-posted]="linkedinPostedKey === 'modal'"
                [class.btn-li-loading]="linkedinPostingKey === 'modal'"
                [disabled]="linkedinPostingKey === 'modal'"
                (click)="openLinkedInConfirm(modalPost!, 'modal')">
          <svg *ngIf="linkedinPostedKey !== 'modal' && linkedinPostingKey !== 'modal'" viewBox="0 0 20 20" fill="currentColor" width="12" height="12"><path fill-rule="evenodd" d="M16.338 16.338H13.67V12.16c0-.995-.017-2.277-1.387-2.277-1.39 0-1.601 1.086-1.601 2.207v4.248H8.014v-8.59h2.559v1.174h.037c.356-.675 1.227-1.387 2.526-1.387 2.703 0 3.203 1.778 3.203 4.092v4.711zM5.005 6.575a1.548 1.548 0 1 1 0-3.096 1.548 1.548 0 0 1 0 3.096zm-1.337 9.763H6.34v-8.59H3.667v8.59zM17.668 1H2.328C1.595 1 1 1.581 1 2.298v15.403C1 18.418 1.595 19 2.328 19h15.34c.734 0 1.332-.582 1.332-1.299V2.298C19 1.581 18.402 1 17.668 1z"/></svg>
          <svg *ngIf="linkedinPostedKey === 'modal'" viewBox="0 0 16 16" fill="currentColor" width="12" height="12"><path d="M13.854 3.646a.5.5 0 010 .708l-7 7a.5.5 0 01-.708 0l-3.5-3.5a.5.5 0 11.708-.708L6.5 10.293l6.646-6.647a.5.5 0 01.708 0z"/></svg>
          <svg *ngIf="linkedinPostingKey === 'modal'" class="spin" viewBox="0 0 16 16" fill="currentColor" width="12" height="12"><path d="M11.534 7h3.932a.25.25 0 0 1 .192.41l-1.966 2.36a.25.25 0 0 1-.384 0l-1.966-2.36a.25.25 0 0 1 .192-.41zm-11 2h3.932a.25.25 0 0 0 .192-.41L2.692 6.23a.25.25 0 0 0-.384 0L.342 8.59A.25.25 0 0 0 .534 9z"/><path fill-rule="evenodd" d="M8 3c-1.552 0-2.94.707-3.857 1.818a.5.5 0 1 1-.771-.636A6.002 6.002 0 0 1 13.917 7H12.9A5.002 5.002 0 0 0 8 3zM3.1 9a5.002 5.002 0 0 0 8.757 2.182.5.5 0 1 1 .771.636A6.002 6.002 0 0 1 2.083 9H3.1z"/></svg>
          {{ linkedinPostedKey === 'modal' ? '✓ Posted!' : linkedinPostingKey === 'modal' ? 'Posting…' : 'Post to LinkedIn' }}
        </button>
        <button class="pb-btn-dl" (click)="downloadPost(modalPost!)">Download .txt</button>
        <button class="btn-edit-modal" (click)="enterEditMode()">
          <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12"><path d="M12.854.146a.5.5 0 0 0-.707 0L10.5 1.793 14.207 5.5l1.647-1.646a.5.5 0 0 0 0-.708l-3-3zm.646 6.061L9.793 2.5 3.293 9H3.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.207l6.5-6.5zm-7.468 7.468A.5.5 0 0 1 6 13.5V13h-.5a.5.5 0 0 1-.5-.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.5-.5V10h-.5a.499.499 0 0 1-.175-.032l-.179.178a.5.5 0 0 0-.11.168l-2 5a.5.5 0 0 0 .65.65l5-2a.5.5 0 0 0 .168-.11l.178-.178z"/></svg>
          Edit
        </button>
        <button class="pb-btn-close" (click)="closeModal()">Close</button>
      </ng-container>

      <!-- Edit mode buttons -->
      <ng-container *ngIf="editMode">
        <button class="btn-save-edit" (click)="saveEdit()">
          <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12"><path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/></svg>
          Save changes
        </button>
        <button class="pb-btn-close" (click)="cancelEdit()">Cancel</button>
      </ng-container>
    </div>
  </div>
</div>
  `,
  styles: [`
    :host {
      --amber:      #f5a623; --amber-h: #f9b83a;
      --amber-dim:  rgba(245,166,35,0.12); --amber-b: rgba(245,166,35,0.30); --amber-dk: #d97706;
      --bg:         #faf7f2; --surf: #ffffff; --surf2: #faf8f4;
      --bdr:        #e8e0d4; --bdr-m: #ddd4c4;
      --t1: #1c160a; --t2: #6b5e46; --t3: #a0917a; --div: #ede8df;
      --green: #22c55e; --green-bg: #dcfce7; --green-fg: #166534;
      --red-bg: #fee2e2; --red-fg: #991b1b;
      --blue-bg: #eff6ff; --blue-fg: #1d4ed8;
      display: block; font-family: 'Inter', system-ui, sans-serif;
    }

    /* Dark mode */
    :host .dark { --bg:#0f0e0b; --surf:#1a1710; --surf2:#201e18; --bdr:#2e2b22; --bdr-m:#3a3728; --t1:#f5f0e6; --t2:#b8a98a; --t3:#7a6d56; --div:#2a2720; }

    .hw { padding:36px 40px 80px; min-height:100%; display:flex; flex-direction:column; gap:20px; background:var(--bg); box-sizing:border-box; }

    /* ── Top bar ── */
    .topbar { display:flex; align-items:flex-start; justify-content:space-between; flex-wrap:wrap; gap:14px; }
    .pg-title { font-size:2rem; font-weight:800; color:var(--t1); letter-spacing:-0.5px; line-height:1; margin:0 0 5px; }
    .pg-sub   { font-size:0.84rem; color:var(--t3); margin:0; }
    .trash-label { color:#ef4444; font-weight:700; }
    .search-label{ color:var(--amber-dk); font-weight:600; }
    .topbar-actions { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }

    .btn-new {
      display:inline-flex; align-items:center; gap:8px;
      background:var(--amber); color:#1c160a; border:none; border-radius:10px;
      padding:10px 20px; font-size:0.86rem; font-weight:700; font-family:'Inter',sans-serif;
      text-decoration:none; cursor:pointer; white-space:nowrap;
      box-shadow:0 4px 16px rgba(245,166,35,0.30); transition:background 0.15s, transform 0.15s;
    }
    .btn-new:hover { background:var(--amber-h); transform:translateY(-1px); }

    .btn-icon {
      width:36px; height:36px; border-radius:9px; position:relative;
      background:var(--surf); border:1.5px solid var(--bdr-m); color:var(--t2);
      cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.14s;
    }
    .btn-icon:hover { border-color:var(--amber-b); color:var(--amber-dk); }
    .btn-icon-active { background:var(--amber-dim); border-color:var(--amber-b); color:var(--amber-dk); }
    .btn-refreshing  { border-color:var(--amber-b); color:var(--amber-dk); }
    .spin { animation:spin 1s linear infinite; }
    @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }

    .trash-badge {
      position:absolute; top:-5px; right:-5px;
      background:#ef4444; color:#fff; font-size:0.58rem; font-weight:800;
      width:16px; height:16px; border-radius:50%; display:flex; align-items:center; justify-content:center;
    }

    /* ── KPI ── */
    .kpi-strip { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; }
    @media(max-width:900px){ .kpi-strip{ grid-template-columns:1fr 1fr; } }
    .kpi-card { background:var(--surf); border:1.5px solid var(--bdr); border-radius:14px; padding:16px 18px; display:flex; align-items:center; gap:14px; box-shadow:0 1px 4px rgba(28,22,10,0.04); }
    .kpi-icon { width:42px; height:42px; border-radius:10px; flex-shrink:0; display:flex; align-items:center; justify-content:center; }
    .ki-orange{ background:rgba(245,166,35,0.14); color:var(--amber-dk); }
    .ki-green { background:rgba(34,197,94,0.12);  color:#16a34a; }
    .ki-blue  { background:rgba(59,130,246,0.12); color:#1d4ed8; }
    .ki-purple{ background:rgba(139,92,246,0.12); color:#7c3aed; }
    .kpi-val  { font-size:1.6rem; font-weight:800; color:var(--t1); letter-spacing:-0.5px; line-height:1; }
    .kpi-lbl  { font-size:0.78rem; font-weight:700; color:var(--t2); margin-top:3px; }
    .kpi-sub  { font-size:0.70rem; color:var(--t3); margin-top:1px; }

    /* ── Filter bar ── */
    .filter-bar { display:flex; gap:12px; flex-wrap:wrap; align-items:center; }
    .search-wrap { position:relative; flex:1; min-width:240px; }
    .s-ico { position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--t3); pointer-events:none; }
    .search-input {
      width:100%; padding:9px 34px 9px 34px; border:1.5px solid var(--bdr-m);
      border-radius:10px; font-size:0.84rem; font-family:'Inter',sans-serif;
      background:var(--surf); outline:none; color:var(--t1); box-sizing:border-box; transition:border-color 0.14s;
    }
    .search-input:focus { border-color:var(--amber); box-shadow:0 0 0 3px rgba(245,166,35,0.09); }
    .search-clear { position:absolute; right:10px; top:50%; transform:translateY(-50%); background:none; border:none; color:var(--t3); cursor:pointer; font-size:1rem; padding:2px 6px; }
    .filter-chips { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
    .fc {
      padding:6px 14px; border-radius:20px; font-size:0.74rem; font-weight:600;
      font-family:'Inter',sans-serif; cursor:pointer;
      background:var(--surf); border:1.5px solid var(--bdr-m); color:var(--t2); transition:all 0.13s;
      display:flex; align-items:center; gap:5px;
    }
    .fc:hover { border-color:var(--amber-b); color:var(--amber-dk); }
    .fc-on { background:var(--amber); color:#1c160a; border-color:var(--amber); font-weight:700; }
    .fc-sep { width:1px; height:18px; background:var(--bdr-m); }
    .sort-select {
      padding:6px 12px; border:1.5px solid var(--bdr-m); border-radius:20px;
      font-size:0.74rem; font-family:'Inter',sans-serif; background:var(--surf);
      outline:none; color:var(--t2); cursor:pointer;
    }

    /* ── Bulk bar ── */
    .bulk-bar {
      display:flex; align-items:center; gap:10px; flex-wrap:wrap;
      background:var(--amber-dim); border:1.5px solid var(--amber-b);
      border-radius:10px; padding:10px 16px;
    }
    .bulk-count { font-size:0.82rem; font-weight:700; color:var(--amber-dk); flex:1; }
    .bulk-btn {
      display:inline-flex; align-items:center; gap:6px;
      background:var(--surf); border:1.5px solid var(--bdr-m);
      border-radius:8px; padding:6px 14px; font-size:0.76rem; font-weight:600;
      font-family:'Inter',sans-serif; color:var(--t2); cursor:pointer; transition:all 0.13s;
    }
    .bulk-btn:hover { border-color:var(--amber-b); color:var(--amber-dk); }
    .bulk-btn-del:hover { border-color:#fca5a5; color:var(--red-fg); background:var(--red-bg); }

    /* ── Empty ── */
    .empty { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; padding:60px 20px; text-align:center; }
    .empty-icon { width:64px; height:64px; border-radius:50%; background:var(--amber-dim); border:2px solid var(--amber-b); display:flex; align-items:center; justify-content:center; color:var(--amber); }
    .empty h3 { font-size:1.1rem; font-weight:800; color:var(--t1); margin:0; }
    .empty p  { font-size:0.84rem; color:var(--t3); margin:0; }

    /* ── Trash ── */
    .trash-view { display:flex; flex-direction:column; gap:8px; }
    .trash-notice { display:flex; align-items:center; gap:10px; background:var(--red-bg); border:1.5px solid #fca5a5; border-radius:8px; padding:10px 16px; font-size:0.80rem; color:var(--red-fg); }
    .btn-empty-trash { margin-left:auto; background:var(--red-fg); color:#fff; border:none; border-radius:7px; padding:5px 14px; font-size:0.74rem; font-weight:700; cursor:pointer; font-family:'Inter',sans-serif; }
    .trash-item { background:rgba(239,68,68,0.04) !important; }
    .act-restore { color:#16a34a !important; display:inline-flex; align-items:center; gap:5px; padding:0 12px !important; width:auto !important; }
    .act-restore:hover { background:var(--green-bg) !important; border-color:#86efac !important; }
    .act-del-perm:hover { background:var(--red-bg) !important; color:var(--red-fg) !important; border-color:#fca5a5 !important; }

    /* ── Feed ── */
    .feed { display:flex; flex-direction:column; gap:10px; }
    .day-block { background:var(--surf); border:1.5px solid var(--bdr); border-radius:14px; overflow:hidden; box-shadow:0 1px 4px rgba(28,22,10,0.04); }
    .day-hdr { display:flex; align-items:center; justify-content:space-between; padding:14px 20px; cursor:pointer; transition:background 0.13s; }
    .day-hdr:hover { background:var(--surf2); }
    .dh-l { display:flex; align-items:center; gap:10px; } .dh-r { display:flex; align-items:center; gap:12px; }
    .dh-cal { width:28px; height:28px; border-radius:7px; background:var(--amber-dim); border:1px solid var(--amber-b); display:flex; align-items:center; justify-content:center; color:var(--amber-dk); flex-shrink:0; }
    .dh-date { font-size:0.95rem; font-weight:700; color:var(--t1); }
    .dh-badge { font-size:0.68rem; font-weight:700; color:var(--t3); background:var(--surf2); border:1.5px solid var(--bdr-m); padding:2px 10px; border-radius:20px; }
    .dh-badge-posts { background:var(--amber-dim); color:var(--amber-dk); border-color:var(--amber-b); }
    .dh-sent { display:flex; align-items:center; gap:6px; font-size:0.76rem; font-weight:700; color:var(--t2); }
    .dh-dot  { width:7px; height:7px; border-radius:50%; background:var(--green); flex-shrink:0; }
    .dh-rel  { font-size:0.74rem; color:var(--t3); }
    .dh-chev { color:var(--t3); transition:transform 0.22s ease; }
    .dh-chev-open { transform:rotate(180deg); }
    .runs-wrap { border-top:1.5px solid var(--div); }
    .run-block { border-bottom:1px solid var(--div); }
    .run-block:last-child { border-bottom:none; }
    .run-hdr { display:flex; align-items:center; justify-content:space-between; padding:11px 20px; cursor:pointer; transition:background 0.12s; gap:10px; flex-wrap:wrap; }
    .run-hdr:hover { background:var(--surf2); }
    .rh-l { display:flex; align-items:center; gap:9px; flex-wrap:wrap; } .rh-r { display:flex; align-items:center; gap:9px; flex-shrink:0; }
    .run-index { font-size:0.70rem; font-weight:800; color:var(--t3); min-width:38px; }
    .run-time  { font-size:0.76rem; color:var(--t2); font-weight:600; }
    .run-pill { display:inline-flex; align-items:center; gap:4px; font-size:0.68rem; font-weight:700; background:rgba(10,102,194,0.10); color:#0a66c2; border:1px solid rgba(10,102,194,0.20); padding:2px 8px; border-radius:20px; white-space:nowrap; }
    .pill-tw { background:rgba(0,0,0,0.06); color:#111; border-color:rgba(0,0,0,0.12); }
    .run-meta { font-size:0.70rem; color:var(--t3); }
    .run-post-count { font-size:0.74rem; font-weight:600; color:var(--t2); }
    .badge-ok  { display:inline-block; background:var(--green-bg); color:var(--green-fg); font-size:0.60rem; font-weight:800; text-transform:uppercase; padding:2px 8px; border-radius:20px; }
    .badge-err { display:inline-block; background:var(--red-bg); color:var(--red-fg); font-size:0.60rem; font-weight:800; text-transform:uppercase; padding:2px 8px; border-radius:20px; }
    .run-chev { color:var(--t3); transition:transform 0.20s ease; }
    .run-chev-open { transform:rotate(90deg); }
    .posts-wrap { padding:8px 14px 12px; display:flex; flex-direction:column; gap:7px; background:#fdfcf9; }

    /* ── Post card ── */
    .post-card { background:var(--surf); border:1.5px solid var(--bdr); border-radius:10px; overflow:hidden; display:flex; }
    .post-card-open { border-color:var(--amber-b); box-shadow:0 0 0 2px rgba(245,166,35,0.08); }
    .post-pinned { border-color:var(--amber); }
    .pc-select-wrap { padding:11px 0 11px 12px; display:flex; align-items:flex-start; }
    .pc-checkbox { width:15px; height:15px; cursor:pointer; accent-color:var(--amber); }
    .pc-summary { display:flex; align-items:center; justify-content:space-between; padding:10px 12px; cursor:pointer; transition:background 0.12s; gap:10px; flex:1; }
    .pc-summary:hover { background:var(--surf2); }
    .pc-l { display:flex; align-items:flex-start; gap:10px; flex:1; min-width:0; }
    .pc-num { flex-shrink:0; background:var(--amber); color:#1c160a; font-size:0.60rem; font-weight:800; letter-spacing:0.05em; text-transform:uppercase; padding:2px 7px; border-radius:5px; margin-top:2px; white-space:nowrap; }
    .pc-text { flex:1; min-width:0; }
    .pc-title   { font-size:0.84rem; font-weight:700; color:var(--t1); line-height:1.3; margin-bottom:3px; display:flex; align-items:center; }
    .pc-preview { font-size:0.74rem; color:var(--t2); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .pc-actions { display:flex; align-items:center; gap:3px; flex-shrink:0; }
    .act-btn { width:28px; height:28px; border-radius:6px; background:var(--surf); border:1.5px solid var(--bdr-m); color:var(--t2); cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.12s; }
    .act-btn:hover { border-color:var(--amber-b); color:var(--amber-dk); background:var(--amber-dim); }
    .act-copied { border-color:#86efac !important; color:var(--green-fg) !important; background:var(--green-bg) !important; }
    .act-pinned { background:var(--amber-dim) !important; border-color:var(--amber-b) !important; color:var(--amber-dk) !important; }
    .act-btn-del:hover { background:var(--red-bg) !important; color:var(--red-fg) !important; border-color:#fca5a5 !important; }

    /* ── Post body ── */
    .pc-body { border-top:1.5px solid var(--div); padding:14px 14px 12px; display:flex; flex-direction:column; gap:10px; width:100%; box-sizing:border-box; }
    .pb-h3   { font-size:0.96rem; font-weight:800; color:var(--t1); letter-spacing:-0.1px; margin:0; }
    .pb-text { font-size:0.84rem; color:var(--t1); line-height:1.75; white-space:pre-wrap; margin:0; }
    .pb-tags { font-size:0.80rem; color:#1d4ed8; font-weight:600; margin:0; }
    .pb-img-prompt { background:var(--blue-bg); border:1.5px solid #bfdbfe; border-radius:8px; padding:11px 13px; }
    .pip-lbl { font-size:0.58rem; font-weight:800; text-transform:uppercase; letter-spacing:0.10em; color:var(--blue-fg); margin-bottom:4px; }
    .pip-txt { font-size:0.78rem; color:#1e3a8a; font-style:italic; line-height:1.55; }
    .pip-note{ font-size:0.68rem; color:#3b82f6; margin-top:4px; }
    .pb-meta { border-top:1px solid var(--div); padding-top:8px; display:flex; flex-direction:column; gap:4px; }
    .pm-row  { display:flex; gap:10px; align-items:baseline; }
    .pm-k    { font-size:0.66rem; font-weight:700; color:var(--t3); min-width:64px; text-transform:uppercase; letter-spacing:0.04em; }
    .pm-v    { font-size:0.76rem; color:var(--t2); }
    .pm-a    { font-size:0.72rem; color:var(--blue-fg); word-break:break-all; text-decoration:underline; }

    /* ── Tags ── */
    .tag-section { padding-top:4px; }
    .tag-list { display:flex; flex-wrap:wrap; gap:6px; align-items:center; }
    .tag-chip { display:inline-flex; align-items:center; gap:4px; background:var(--amber-dim); border:1px solid var(--amber-b); color:var(--amber-dk); font-size:0.70rem; font-weight:700; padding:2px 8px; border-radius:20px; }
    .tag-del  { background:none; border:none; cursor:pointer; color:var(--amber-dk); font-size:0.80rem; padding:0 1px; line-height:1; }
    .tag-input { border:1.5px dashed var(--bdr-m); border-radius:20px; padding:2px 10px; font-size:0.70rem; font-family:'Inter',sans-serif; outline:none; color:var(--t2); background:transparent; width:100px; transition:border-color 0.13s; }
    .tag-input:focus { border-color:var(--amber); }

    /* ── Buttons ── */
    .pb-foot { display:flex; gap:8px; padding-top:4px; flex-wrap:wrap; }
    .btn-copy-post { display:inline-flex; align-items:center; gap:6px; background:var(--amber); color:#1c160a; border:none; border-radius:8px; padding:7px 14px; font-size:0.76rem; font-weight:700; font-family:'Inter',sans-serif; cursor:pointer; transition:background 0.13s; }
    .btn-copy-post:hover { background:var(--amber-h); }
    .btn-copied { background:var(--green-bg) !important; color:var(--green-fg) !important; }
    .pb-btn-dl   { background:var(--surf); border:1.5px solid var(--bdr-m); border-radius:8px; padding:7px 14px; font-size:0.76rem; font-weight:600; font-family:'Inter',sans-serif; color:var(--t2); cursor:pointer; transition:all 0.13s; }
    .pb-btn-dl:hover { border-color:var(--blue-fg); color:var(--blue-fg); }
    .pb-btn-close{ background:var(--surf); border:1.5px solid var(--bdr-m); border-radius:8px; padding:7px 14px; font-size:0.76rem; font-weight:600; font-family:'Inter',sans-serif; color:var(--t2); cursor:pointer; transition:all 0.13s; }
    .pb-btn-close:hover { border-color:var(--bdr); color:var(--t1); }

    /* ── Notices ── */
    .email-notice { display:flex; align-items:flex-start; gap:12px; background:var(--blue-bg); border:1.5px solid #bfdbfe; border-radius:10px; padding:12px 14px; }
    .en-icon  { flex-shrink:0; color:var(--blue-fg); margin-top:1px; }
    .en-title { font-size:0.82rem; font-weight:700; color:#1e40af; margin-bottom:3px; }
    .en-desc  { font-size:0.74rem; color:var(--blue-fg); line-height:1.5; }
    .error-notice { display:flex; align-items:center; gap:8px; background:var(--red-bg); border:1.5px solid #fca5a5; border-radius:10px; padding:11px 14px; font-size:0.80rem; font-weight:600; color:var(--red-fg); }

    /* ── Pagination ── */
    .pgn { display:flex; align-items:center; justify-content:center; gap:4px; padding-top:8px; }
    .pg-btn { width:34px; height:34px; border-radius:8px; background:var(--surf); border:1.5px solid var(--bdr-m); color:var(--t2); cursor:pointer; font-size:1rem; display:flex; align-items:center; justify-content:center; transition:all 0.13s; }
    .pg-btn:hover:not(:disabled) { border-color:var(--amber-b); color:var(--amber-dk); }
    .pg-btn:disabled { opacity:0.35; cursor:default; }
    .pg-num { width:34px; height:34px; border-radius:8px; background:var(--surf); border:1.5px solid var(--bdr-m); color:var(--t2); cursor:pointer; font-size:0.82rem; font-weight:600; font-family:'Inter',sans-serif; display:flex; align-items:center; justify-content:center; transition:all 0.13s; }
    .pg-num:hover { border-color:var(--amber-b); color:var(--amber-dk); }
    .pg-act { background:var(--amber) !important; color:#1c160a !important; border-color:var(--amber) !important; font-weight:800 !important; }

    /* ── Modal ── */
    .modal-bd { position:fixed; inset:0; background:rgba(10,8,4,0.62); backdrop-filter:blur(4px); z-index:1000; display:flex; align-items:center; justify-content:center; padding:20px; animation:fi 0.18s ease; }
    @keyframes fi { from{opacity:0} to{opacity:1} }
    .modal-box { background:var(--surf); border-radius:18px; border:1.5px solid var(--bdr); box-shadow:0 24px 64px rgba(10,8,4,0.28); width:100%; max-width:720px; max-height:88vh; display:flex; flex-direction:column; animation:su 0.22s ease; overflow:hidden; }
    @keyframes su { from{transform:translateY(18px);opacity:0} to{transform:translateY(0);opacity:1} }
    .modal-hdr { display:flex; align-items:center; justify-content:space-between; padding:16px 22px 14px; border-bottom:1.5px solid var(--bdr); flex-shrink:0; gap:12px; }
    .mh-l { display:flex; align-items:center; gap:10px; }
    .modal-date{ font-size:0.76rem; color:var(--t3); }
    .modal-cls { width:30px; height:30px; border-radius:7px; background:var(--surf2); border:1.5px solid var(--bdr-m); color:var(--t2); cursor:pointer; font-size:1.1rem; display:flex; align-items:center; justify-content:center; transition:all 0.13s; }
    .modal-cls:hover { background:var(--red-bg); color:var(--red-fg); border-color:#fca5a5; }
    .modal-body { flex:1; overflow-y:auto; padding:20px 22px; display:flex; flex-direction:column; gap:12px; }
    .modal-body::-webkit-scrollbar { width:4px; }
    .modal-body::-webkit-scrollbar-thumb { background:#ddd4c4; border-radius:4px; }
    .modal-post-num { display:inline-block; background:var(--amber); color:#1c160a; font-size:0.66rem; font-weight:800; letter-spacing:0.06em; text-transform:uppercase; padding:2px 10px; border-radius:5px; width:fit-content; }
    .modal-title { font-size:1.12rem; font-weight:800; color:var(--t1); letter-spacing:-0.2px; margin:0; line-height:1.3; }
    .modal-text  { font-size:0.86rem; color:var(--t1); line-height:1.75; white-space:pre-wrap; margin:0; }
    .modal-tags  { font-size:0.82rem; color:var(--blue-fg); font-weight:600; margin:0; }
    .modal-foot  { display:flex; align-items:center; gap:10px; padding:12px 22px; border-top:1.5px solid var(--bdr); flex-shrink:0; flex-wrap:wrap; }

    @media(max-width:640px) { .hw{ padding:18px 14px 60px; } .modal-box{ border-radius:14px; } }
    /* ── Post to LinkedIn button ── */
    .btn-post-li {
      display:inline-flex; align-items:center; gap:6px;
      background:#0a66c2; color:#fff; border:none; border-radius:8px;
      padding:7px 14px; font-size:0.76rem; font-weight:700;
      font-family:'Inter',sans-serif; cursor:pointer; transition:background 0.13s;
    }
    .btn-post-li:hover:not(:disabled) { background:#004182; }
    .btn-post-li:disabled { opacity:0.65; cursor:not-allowed; }
    .btn-li-posted { background:#16a34a !important; }
    .btn-li-posted:hover { background:#15803d !important; }
    .btn-li-loading { opacity:0.80; }

    /* Icon button LinkedIn variant */
    .act-btn-li:hover { border-color:rgba(10,102,194,0.40) !important; color:#0a66c2 !important; background:rgba(10,102,194,0.08) !important; }
    .act-li-posted { background:var(--green-bg) !important; border-color:#86efac !important; color:var(--green-fg) !important; }
    .act-li-loading { border-color:rgba(10,102,194,0.30) !important; color:#0a66c2 !important; }

    /* ── LinkedIn confirm dialog ── */
    .li-confirm-bd {
      position:fixed; inset:0; background:rgba(0,0,0,0.45); z-index:1100;
      display:flex; align-items:center; justify-content:center; padding:20px;
    }
    .li-confirm-box {
      background:var(--surf); border:1.5px solid var(--bdr); border-radius:16px;
      width:100%; max-width:480px; box-shadow:0 20px 60px rgba(0,0,0,0.18);
      display:flex; flex-direction:column; overflow:hidden;
    }
    .li-confirm-hdr {
      display:flex; align-items:center; justify-content:space-between;
      padding:16px 20px 14px; border-bottom:1.5px solid var(--div);
    }
    .li-confirm-logo {
      display:flex; align-items:center; gap:8px;
      font-size:0.92rem; font-weight:800; color:#0a66c2;
    }
    .li-confirm-body { padding:16px 20px; }
    .li-preview-label { font-size:0.66rem; font-weight:800; text-transform:uppercase; letter-spacing:0.08em; color:var(--t3); margin-bottom:8px; }
    .li-preview-text {
      font-size:0.82rem; color:var(--t1); line-height:1.7; white-space:pre-wrap;
      background:var(--surf2); border:1.5px solid var(--bdr-m); border-radius:8px;
      padding:12px 14px; max-height:200px; overflow-y:auto;
    }
    .li-error {
      display:flex; align-items:center; gap:8px; margin-top:10px;
      background:var(--red-bg); border:1.5px solid #fca5a5; border-radius:8px;
      padding:9px 12px; font-size:0.78rem; font-weight:600; color:var(--red-fg);
    }
    .li-confirm-foot {
      display:flex; gap:8px; padding:14px 20px 18px;
      border-top:1.5px solid var(--div);
    }
    .li-btn-confirm {
      display:inline-flex; align-items:center; gap:7px;
      background:#0a66c2; color:#fff; border:none; border-radius:8px;
      padding:9px 20px; font-size:0.82rem; font-weight:700;
      font-family:'Inter',sans-serif; cursor:pointer; transition:background 0.13s;
    }
    .li-btn-confirm:hover:not(:disabled) { background:#004182; }
    .li-btn-confirm:disabled { opacity:0.65; cursor:not-allowed; }

    /* ── Edit button ── */
    .btn-edit-modal {
      display:inline-flex; align-items:center; gap:6px;
      background:var(--surf); border:1.5px solid var(--bdr-m);
      border-radius:8px; padding:7px 14px; font-size:0.76rem; font-weight:600;
      font-family:'Inter',sans-serif; color:var(--t2); cursor:pointer; transition:all 0.13s;
    }
    .btn-edit-modal:hover { border-color:var(--amber-b); color:var(--amber-dk); background:var(--amber-dim); }

    /* ── Save changes button ── */
    .btn-save-edit {
      display:inline-flex; align-items:center; gap:6px;
      background:var(--amber); color:#1c160a; border:none;
      border-radius:8px; padding:7px 16px; font-size:0.76rem; font-weight:700;
      font-family:'Inter',sans-serif; cursor:pointer; transition:background 0.13s;
    }
    .btn-save-edit:hover { background:var(--amber-h); }

    /* ── Edit area inside modal ── */
    .modal-edit-area { display:flex; flex-direction:column; gap:5px; }
    .edit-field-label {
      font-size:0.66rem; font-weight:800; text-transform:uppercase;
      letter-spacing:0.08em; color:var(--t3);
    }
    .modal-edit-textarea {
      width:100%; padding:11px 13px; border:1.5px solid var(--bdr-m);
      border-radius:9px; background:var(--surf2); font-family:'Inter',sans-serif;
      font-size:0.84rem; line-height:1.7; color:var(--t1); resize:vertical;
      outline:none; box-sizing:border-box; transition:border-color 0.13s;
    }
    .modal-edit-textarea:focus { border-color:var(--amber); box-shadow:0 0 0 3px rgba(245,166,35,0.09); }
    .modal-edit-input {
      width:100%; padding:8px 12px; border:1.5px solid var(--bdr-m);
      border-radius:9px; background:var(--surf2); font-family:'Inter',sans-serif;
      font-size:0.82rem; color:var(--t1); outline:none; box-sizing:border-box;
      transition:border-color 0.13s;
    }
    .modal-edit-input:focus { border-color:var(--amber); box-shadow:0 0 0 3px rgba(245,166,35,0.09); }
    .edit-char-row { display:flex; justify-content:flex-end; }
    .edit-char-count { font-size:0.68rem; color:var(--t3); font-weight:600; }
    .edit-char-warn  { color:#dc2626 !important; }

    /* ════════════════════════════════════
       FEATURE 5 — Pin in modal
    ════════════════════════════════════ */
    .mh-r { display:flex; align-items:center; gap:8px; }
    .modal-pin-btn {
      display:inline-flex; align-items:center; gap:5px;
      padding:5px 12px; border-radius:8px;
      background:var(--surf2); border:1.5px solid var(--bdr-m);
      font-size:0.74rem; font-weight:600; font-family:'Inter',sans-serif;
      color:var(--t3); cursor:pointer; transition:all 0.13s;
    }
    .modal-pin-btn:hover { border-color:var(--amber-b); color:var(--amber-dk); background:var(--amber-dim); }
    .modal-pin-active {
      background:var(--amber-dim) !important;
      border-color:var(--amber-b) !important;
      color:var(--amber-dk) !important;
      font-weight:700 !important;
    }

    /* ════════════════════════════════════
       FEATURE 6 — Date range filter
    ════════════════════════════════════ */
    .date-filter-row {
      display:flex; align-items:center; gap:6px; flex-wrap:wrap;
      width:100%; padding-top:2px;
    }
    .date-input {
      padding:5px 10px; border:1.5px solid var(--bdr-m); border-radius:8px;
      font-size:0.74rem; font-family:'Inter',sans-serif; background:var(--surf);
      color:var(--t1); outline:none; cursor:pointer; transition:border-color 0.13s;
    }
    .date-input:focus { border-color:var(--amber); box-shadow:0 0 0 3px rgba(245,166,35,0.09); }
    .date-sep { font-size:0.80rem; color:var(--t3); font-weight:600; }
    .date-active-badge {
      display:inline-flex; align-items:center; gap:6px;
      background:rgba(245,166,35,0.15); border:1.5px solid var(--amber-b);
      color:var(--amber-dk); font-size:0.72rem; font-weight:700;
      padding:3px 10px; border-radius:20px;
    }
    .date-clear {
      background:none; border:none; cursor:pointer;
      color:var(--amber-dk); font-size:0.90rem; padding:0; line-height:1;
    }

    /* ════════════════════════════════════
       FEATURE 9 — Undo toast
    ════════════════════════════════════ */
    .undo-toast {
      position:fixed; bottom:28px; left:50%; transform:translateX(-50%) translateY(20px);
      display:flex; align-items:center; gap:10px;
      background:#1c160a; color:#f5f0e6;
      border-radius:12px; padding:11px 16px;
      font-size:0.82rem; font-weight:600; font-family:'Inter',sans-serif;
      box-shadow:0 8px 32px rgba(0,0,0,0.28);
      z-index:2000; opacity:0; pointer-events:none;
      transition:opacity 0.22s ease, transform 0.22s ease;
    }
    .undo-toast-visible {
      opacity:1; transform:translateX(-50%) translateY(0); pointer-events:auto;
    }
    .undo-btn {
      background:var(--amber); color:#1c160a; border:none; border-radius:7px;
      padding:4px 12px; font-size:0.76rem; font-weight:800;
      font-family:'Inter',sans-serif; cursor:pointer; transition:background 0.13s;
    }
    .undo-btn:hover { background:var(--amber-h); }
    .undo-dismiss {
      background:none; border:none; color:rgba(245,240,230,0.5);
      font-size:1rem; cursor:pointer; padding:0 2px; line-height:1;
      transition:color 0.13s;
    }
    .undo-dismiss:hover { color:#f5f0e6; }
  `]
})
export class HistoryComponent implements OnInit, OnDestroy {

  // ── State ──────────────────────────────────────────────────
  allRuns:     RichEntry[]  = [];
  dayGroups:   DayGroup[]   = [];
  currentPage  = 1;
  activeView:  'history' | 'trash' = 'history';
  darkMode     = false;
  isRefreshing = false;
  searchQ      = '';
  platformFilter: 'all' | 'linkedin' | 'twitter' = 'all';
  showPinnedOnly  = false;
  sortOrder: 'newest' | 'oldest' = 'newest';
  selectedPosts   = new Set<string>();

  // Open state
  private openPosts = new Set<string>();

  // Meta: pins, tags, deleted keys
  private meta: Record<string, { pinned?: boolean; tags?: string[]; deleted?: boolean; deletedAt?: number }> = {};

  // Trash
  trashedPosts: { post: GeneratedPost; run: RichEntry }[] = [];

  // Modal
  modalPost: GeneratedPost | null = null;
  modalRun:  RichEntry | null     = null;

  // Edit mode
  editMode           = false;
  editDraft          = '';
  editHashtagsDraft  = '';

  // Undo toast (feature 9)
  undoToast              = false;
  private undoSnapshot:  { body: string; hashtags: string } | null = null;
  private undoPostRef:   GeneratedPost | null = null;
  private undoRunRef:    RichEntry | null = null;
  private undoTimer?:    ReturnType<typeof setTimeout>;

  // Date filter (feature 6)
  dateFilter:    'all' | '7d' | '30d' | '90d' | 'custom' = 'all';
  customDateFrom = '';
  customDateTo   = '';
  get todayStr(): string {
    return new Date().toISOString().split('T')[0];
  }
  get dateFilterLabel(): string {
    if (this.dateFilter === '7d')     return 'Last 7 days';
    if (this.dateFilter === '30d')    return 'Last 30 days';
    if (this.dateFilter === '90d')    return 'Last 90 days';
    if (this.dateFilter === 'custom') {
      if (this.customDateFrom && this.customDateTo) return `${this.customDateFrom} → ${this.customDateTo}`;
      if (this.customDateFrom) return `From ${this.customDateFrom}`;
      if (this.customDateTo)   return `Until ${this.customDateTo}`;
      return 'Custom range';
    }
    return '';
  }

  // Copy
  copiedKey: string | null = null;
  private copiedTimer?: ReturnType<typeof setTimeout>;

  // Enrich polling
  private enrichPollInterval?: ReturnType<typeof setInterval>;
  private enrichAttempts = 0;
  private readonly ENRICH_MAX_ATTEMPTS = 150;

  constructor(public state: AppStateService) {}

  ngOnInit(): void  { this.loadMeta(); this.load(); this.startEnrichPolling(); }
  ngOnDestroy(): void {
    clearTimeout(this.copiedTimer);
    clearTimeout(this.undoTimer);
    this.stopEnrichPolling();
    document.body.style.overflow = '';
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    if (this.editMode) { this.cancelEdit(); return; }
    this.closeModal();
  }

  // ══ META (pins, tags, trash) ══════════════════════════════

  private loadMeta(): void {
    try { const r = localStorage.getItem(LS_META); if (r) this.meta = JSON.parse(r); } catch {}
    this.rebuildTrash();
  }

  private saveMeta(): void {
    try { localStorage.setItem(LS_META, JSON.stringify(this.meta)); } catch {}
    this.rebuildTrash();
  }

  private metaKey(runId: string, postIdx: number) { return `${runId}::${postIdx}`; }

  isPinned(runId: string, postIdx: number): boolean { return !!this.meta[this.metaKey(runId, postIdx)]?.pinned; }

  togglePin(runId: string, postIdx: number): void {
    const k = this.metaKey(runId, postIdx);
    this.meta[k] = { ...this.meta[k], pinned: !this.meta[k]?.pinned };
    this.saveMeta();
  }

  getTags(runId: string, postIdx: number): string[] { return this.meta[this.metaKey(runId, postIdx)]?.tags || []; }

  addTag(runId: string, postIdx: number, event: Event): void {
    event.preventDefault();
    const input = event.target as HTMLInputElement;
    const tag = input.value.trim().replace(/,$/, '');
    if (!tag) return;
    const k = this.metaKey(runId, postIdx);
    const tags = this.getTags(runId, postIdx);
    if (!tags.includes(tag)) {
      this.meta[k] = { ...this.meta[k], tags: [...tags, tag] };
      this.saveMeta();
    }
    input.value = '';
  }

  removeTag(runId: string, postIdx: number, tag: string): void {
    const k = this.metaKey(runId, postIdx);
    this.meta[k] = { ...this.meta[k], tags: this.getTags(runId, postIdx).filter(t => t !== tag) };
    this.saveMeta();
  }

  // ══ TRASH ════════════════════════════════════════════════

  private rebuildTrash(): void {
    const now = Date.now();
    this.trashedPosts = [];
    for (const run of this.allRuns) {
      for (const post of (run.generatedPosts || [])) {
        const m = this.meta[this.metaKey(run.id, post.index)];
        if (m?.deleted) {
          if (m.deletedAt && now - m.deletedAt > TRASH_TTL_MS) {
            delete this.meta[this.metaKey(run.id, post.index)]; // auto-purge after 30 days
          } else {
            this.trashedPosts.push({ post, run });
          }
        }
      }
    }
  }

  get trashCount(): number { return this.trashedPosts.length; }

  softDeletePost(post: GeneratedPost, run: RichEntry): void {
    const k = this.metaKey(run.id, post.index);
    this.meta[k] = { ...this.meta[k], deleted: true, deletedAt: Date.now() };
    this.saveMeta();
    this.rebuild();
  }

  restorePost(rec: { post: GeneratedPost; run: RichEntry }): void {
    const k = this.metaKey(rec.run.id, rec.post.index);
    this.meta[k] = { ...this.meta[k], deleted: false };
    this.saveMeta();
    this.rebuild();
  }

  permanentDelete(rec: { post: GeneratedPost; run: RichEntry }): void {
    delete this.meta[this.metaKey(rec.run.id, rec.post.index)];
    this.saveMeta();
    this.rebuild();
  }

  emptyTrash(): void {
    for (const rec of this.trashedPosts) {
      delete this.meta[this.metaKey(rec.run.id, rec.post.index)];
    }
    this.saveMeta(); this.rebuild();
  }

  // ══ PERSISTENCE ══════════════════════════════════════════

  private load(): void {
    const mem = (this.state.runHistory() as RichEntry[]).map(r => this.norm(r));
    let stored: RichEntry[] = [];
    try { const r = localStorage.getItem(LS_KEY); if (r) stored = JSON.parse(r).map((e: any) => this.norm(e)); } catch {}
    const memIds = new Set(mem.map(r => r.id));
    const extra  = stored.filter(r => !memIds.has(r.id));
    extra.forEach(r => this.state.addRunHistoryEntry(r as RunHistoryEntry));
    this.allRuns = this.dedup([...mem, ...extra]);
    this.persist();
    this.rebuildTrash();
    this.rebuild();
  }

  private norm(r: any): RichEntry { return { ...r, ranAt: new Date(r.ranAt), generatedPosts: r.generatedPosts || [] }; }

  persist(): void {
    try { localStorage.setItem(LS_KEY, JSON.stringify(this.allRuns)); } catch {}
  }

  private dedup(runs: RichEntry[]): RichEntry[] {
    const seen = new Set<string>();
    return runs.filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; })
      .sort((a, b) => new Date(b.ranAt).getTime() - new Date(a.ranAt).getTime());
  }

  private syncNew(): void {
    const cur   = this.state.runHistory() as RichEntry[];
    const myIds = new Set(this.allRuns.map(r => r.id));
    const added = cur.filter(r => !myIds.has(r.id));
    if (!added.length) return;
    this.allRuns = this.dedup([...this.allRuns, ...added.map(r => this.norm(r))]);
    this.persist();
    this.rebuild();
  }

  // ══ BUILD DAY GROUPS ═════════════════════════════════════

  private rebuild(): void {
    this.syncNew();
    const now = Date.now();
    const sorted = this.sortOrder === 'oldest'
      ? [...this.filteredAllRuns].reverse()
      : this.filteredAllRuns;

    const map = new Map<string, RichEntry[]>();
    for (const run of sorted) {
      const key = this.dayKey(new Date(run.ranAt));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(run);
    }

    this.dayGroups = Array.from(map.entries()).map(([key, runs]) => {
      const latest  = runs[0];
      const diffMs  = now - new Date(latest.ranAt).getTime();
      const diffMin = Math.floor(diffMs / 60000);
      const diffH   = Math.floor(diffMs / 3600000);
      const diffD   = Math.floor(diffMs / 86400000);
      let relLabel = diffMin < 1 ? 'Just now' : diffMin < 60 ? `${diffMin} min ago`
        : diffH < 24 ? `${diffH}h ago` : diffD === 1 ? 'Yesterday' : `${diffD} days ago`;
      return {
        dateKey: key,
        label: new Date(latest.ranAt).toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' }),
        relLabel,
        rows: runs.map(r => ({ run: r, open: false })),
        expanded: diffD === 0
      };
    });
    this.rebuildTrash();
    this.currentPage = 1;
  }

  // ══ COMPUTED ═════════════════════════════════════════════

  get filteredAllRuns(): RichEntry[] {
    let runs = this.allRuns;
    if (this.platformFilter !== 'all') runs = runs.filter(r => r.platform === this.platformFilter);
    if (this.showPinnedOnly) runs = runs.filter(r =>
      (r.generatedPosts || []).some(p => this.isPinned(r.id, p.index))
    );
    if (this.searchQ.trim()) {
      const q = this.searchQ.toLowerCase();
      runs = runs.filter(r =>
        (r.generatedPosts || []).some(p =>
          p.title?.toLowerCase().includes(q) || p.body?.toLowerCase().includes(q)
        )
      );
    }
    // Date filter
    if (this.dateFilter !== 'all') {
      const now = Date.now();
      if (this.dateFilter === '7d')  runs = runs.filter(r => now - new Date(r.ranAt).getTime() <= 7  * 86400000);
      if (this.dateFilter === '30d') runs = runs.filter(r => now - new Date(r.ranAt).getTime() <= 30 * 86400000);
      if (this.dateFilter === '90d') runs = runs.filter(r => now - new Date(r.ranAt).getTime() <= 90 * 86400000);
      if (this.dateFilter === 'custom') {
        if (this.customDateFrom) {
          const from = new Date(this.customDateFrom).getTime();
          runs = runs.filter(r => new Date(r.ranAt).getTime() >= from);
        }
        if (this.customDateTo) {
          const to = new Date(this.customDateTo).getTime() + 86400000; // inclusive
          runs = runs.filter(r => new Date(r.ranAt).getTime() <= to);
        }
      }
    }
    return runs;
  }

  get pagedGroups(): DayGroup[] {
    this.syncNew();
    const s = (this.currentPage - 1) * PAGE_SIZE;
    return this.dayGroups.slice(s, s + PAGE_SIZE);
  }

  get totalPages(): number { return Math.ceil(this.dayGroups.length / PAGE_SIZE); }
  get pageNums():   number[] { return Array.from({ length: this.totalPages }, (_, i) => i + 1); }

  get totalPosts():    number { return this.allRuns.reduce((s, r) => s + this.visiblePosts(r).length, 0); }
  get totalPostCount():number { return this.filteredAllRuns.reduce((s, r) => s + this.visiblePosts(r).length, 0); }
  get successRate():   number {
    if (!this.allRuns.length) return 0;
    return Math.round(this.allRuns.filter(r => r.status === 'success').length / this.allRuns.length * 100);
  }
  get pinnedCount():   number {
    let c = 0;
    for (const r of this.allRuns) for (const p of this.visiblePosts(r)) if (this.isPinned(r.id, p.index)) c++;
    return c;
  }

  visiblePosts(run: RichEntry): GeneratedPost[] {
    return (run.generatedPosts || []).filter(p => !this.meta[this.metaKey(run.id, p.index)]?.deleted);
  }

  // ══ HELPERS ══════════════════════════════════════════════

  private dayKey(d: Date): string { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  hasPosts(run: RichEntry): boolean { return this.visiblePosts(run).length > 0; }
  runPostCount(run: RichEntry): number { return this.visiblePosts(run).length || (run.postsGenerated || 0); }
  dayPostCount(group: DayGroup): number { return group.rows.reduce((s, r) => s + this.runPostCount(r.run), 0); }
  preview(body: string): string { const c = (body||'').replace(/\n/g,' ').trim(); return c.length > 110 ? c.slice(0,110)+'…' : c; }
  postKey(runId: string, idx: number): string { return `${runId}:${idx}`; }

  toggleDay(group: DayGroup): void { group.expanded = !group.expanded; }
  toggleRun(row: RunRow): void     { row.open = !row.open; }
  togglePost(runId: string, idx: number): void {
    const k = `${runId}::post::${idx}`;
    this.openPosts.has(k) ? this.openPosts.delete(k) : this.openPosts.add(k);
  }
  isPostOpen(runId: string, idx: number): boolean { return this.openPosts.has(`${runId}::post::${idx}`); }

  goPage(p: number): void {
    if (p < 1 || p > this.totalPages) return;
    this.currentPage = p;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ══ SELECT / BULK ═════════════════════════════════════════

  toggleSelect(runId: string, idx: number): void {
    const k = this.postKey(runId, idx);
    this.selectedPosts.has(k) ? this.selectedPosts.delete(k) : this.selectedPosts.add(k);
  }

  private getSelectedPostObjects(): GeneratedPost[] {
    const posts: GeneratedPost[] = [];
    for (const run of this.allRuns) {
      for (const post of (run.generatedPosts||[])) {
        if (this.selectedPosts.has(this.postKey(run.id, post.index))) posts.push(post);
      }
    }
    return posts;
  }

  bulkCopy(): void {
    const text = this.getSelectedPostObjects().map(p => this.buildFullText(p)).join('\n\n---\n\n');
    navigator.clipboard.writeText(text).catch(()=>{});
    this.selectedPosts.clear();
  }

  bulkExport(): void {
    const text = this.getSelectedPostObjects().map(p => this.buildFullText(p)).join('\n\n---\n\n');
    this.downloadText(text, 'pylink-posts-export.txt');
    this.selectedPosts.clear();
  }

  bulkDelete(): void {
    for (const run of this.allRuns) {
      for (const post of (run.generatedPosts||[])) {
        if (this.selectedPosts.has(this.postKey(run.id, post.index))) this.softDeletePost(post, run);
      }
    }
    this.selectedPosts.clear();
  }

  // ── LinkedIn posting state ─────────────────────────────────
  linkedinPostingKey: string | null = null;
  linkedinPostedKey:  string | null = null;
  liConfirmPost:      GeneratedPost | null = null;
  liConfirmKey:       string | null = null;
  liConfirmPreview:   string = '';
  liPostError:        string | null = null;

  openLinkedInConfirm(post: GeneratedPost, key: string): void {
    this.liConfirmPost    = post;
    this.liConfirmKey     = key;
    this.liPostError      = null;
    // Build preview: body + hashtags (no image prompt or meta)
    const parts: string[] = [];
    if (post.body)     parts.push(post.body);
    if (post.hashtags) parts.push(post.hashtags);
    this.liConfirmPreview = parts.join('\n\n');
    document.body.style.overflow = 'hidden';
  }

  cancelLinkedInConfirm(): void {
    if (this.linkedinPostingKey === this.liConfirmKey) return; // don't dismiss while posting
    this.liConfirmPost  = null;
    this.liConfirmKey   = null;
    this.liPostError    = null;
    document.body.style.overflow = '';
  }

  async confirmPostToLinkedIn(): Promise<void> {
    if (!this.liConfirmPost || !this.liConfirmKey) return;
    const post = this.liConfirmPost;
    const key  = this.liConfirmKey;
    this.linkedinPostingKey = key;
    this.liPostError = null;

    const text = this.liConfirmPreview;

    try {
      const controller = new AbortController();
      const timeoutId  = setTimeout(() => controller.abort(), 15000); // 15 s hard timeout

      let res: Response;
      try {
        res = await fetch('/api/linkedin/post', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ text, title: post.title }),
          signal:  controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!res!.ok) {
        let msg = `Server error (${res!.status})`;
        try { const d = await res!.json(); msg = d.error || d.message || msg; } catch {}
        throw new Error(msg);
      }

      this.linkedinPostingKey = null;
      this.linkedinPostedKey  = key;
      document.body.style.overflow = '';
      this.liConfirmPost = null;
      this.liConfirmKey  = null;

      // Reset the "Posted!" badge after 5 s
      setTimeout(() => {
        if (this.linkedinPostedKey === key) this.linkedinPostedKey = null;
      }, 5000);

    } catch (err: any) {
      this.linkedinPostingKey = null;
      if (err?.name === 'AbortError') {
        this.liPostError = 'Request timed out. Check that the /api/linkedin/post endpoint is set up on your backend.';
      } else if (err?.message?.includes('Failed to fetch') || err?.message?.includes('NetworkError')) {
        this.liPostError = 'Could not reach /api/linkedin/post. Make sure the backend endpoint exists.';
      } else {
        this.liPostError = err?.message || 'Could not post to LinkedIn. Please try again.';
      }
    }
  }

  openModal(post: GeneratedPost, run: RichEntry): void {
    this.modalPost = post; this.modalRun = run;
    this.editMode = false; this.editDraft = ''; this.editHashtagsDraft = '';
    document.body.style.overflow = 'hidden';
  }

  closeModal(): void {
    this.modalPost = null; this.modalRun = null;
    this.editMode = false; this.editDraft = ''; this.editHashtagsDraft = '';
    document.body.style.overflow = '';
  }

  // ── Edit mode ─────────────────────────────────────────────

  enterEditMode(): void {
    if (!this.modalPost) return;
    this.editDraft         = this.modalPost.body || '';
    this.editHashtagsDraft = this.modalPost.hashtags || '';
    this.editMode          = true;
  }

  cancelEdit(): void {
    this.editMode = false;
    this.editDraft = '';
    this.editHashtagsDraft = '';
  }

  saveEdit(): void {
    if (!this.modalPost || !this.modalRun) return;

    // Snapshot for undo BEFORE applying changes
    this.undoSnapshot = { body: this.modalPost.body, hashtags: this.modalPost.hashtags || '' };
    this.undoPostRef  = this.modalPost;
    this.undoRunRef   = this.modalRun;

    // Apply to in-memory post object
    this.modalPost.body     = this.editDraft;
    this.modalPost.hashtags = this.editHashtagsDraft;

    // Persist: update the matching run in allRuns
    const run = this.allRuns.find(r => r.id === this.modalRun!.id);
    if (run?.generatedPosts) {
      const post = run.generatedPosts.find(p => p.index === this.modalPost!.index);
      if (post) {
        post.body     = this.editDraft;
        post.hashtags = this.editHashtagsDraft;
      }
    }
    this.persist();

    this.editMode          = false;
    this.editDraft         = '';
    this.editHashtagsDraft = '';

    // Show undo toast for 5 s
    this.showUndoToast();
  }

  // ── Undo (feature 9) ──────────────────────────────────────

  private showUndoToast(): void {
    clearTimeout(this.undoTimer);
    this.undoToast = true;
    this.undoTimer = setTimeout(() => this.dismissUndo(), 5000);
  }

  undoEdit(): void {
    if (!this.undoSnapshot || !this.undoPostRef || !this.undoRunRef) return;
    // Restore snapshot
    this.undoPostRef.body     = this.undoSnapshot.body;
    this.undoPostRef.hashtags = this.undoSnapshot.hashtags;
    // Persist
    const run = this.allRuns.find(r => r.id === this.undoRunRef!.id);
    if (run?.generatedPosts) {
      const post = run.generatedPosts.find(p => p.index === this.undoPostRef!.index);
      if (post) { post.body = this.undoSnapshot.body; post.hashtags = this.undoSnapshot.hashtags; }
    }
    this.persist();
    this.dismissUndo();
  }

  dismissUndo(): void {
    clearTimeout(this.undoTimer);
    this.undoToast    = false;
    this.undoSnapshot = null;
    this.undoPostRef  = null;
    this.undoRunRef   = null;
  }

  // ── Date filter (feature 6) ───────────────────────────────

  setDateFilter(f: 'all' | '7d' | '30d' | '90d' | 'custom'): void {
    this.dateFilter = f;
    if (f !== 'custom') { this.customDateFrom = ''; this.customDateTo = ''; }
    this.rebuild();
  }

  onCustomDateChange(): void {
    this.rebuild();
  }

  // ══ COPY (full post including all sections) ═══════════════

  buildFullText(post: GeneratedPost): string {
    const parts: string[] = [];
    if (post.title && !post.title.startsWith('Post ')) parts.push(post.title);
    if (post.body) parts.push('\n' + post.body);
    if (post.hashtags) parts.push('\n' + post.hashtags);
    if (post.imagePrompt && post.imagePrompt.trim()) parts.push('\n--- IMAGE GENERATION PROMPT ---\n"' + post.imagePrompt + '"\nUse on: Midjourney, Leonardo.ai, Adobe Firefly, or Canva AI');
    if (post.source)    parts.push('\nSource: ' + post.source);
    if (post.published) parts.push('Published: ' + post.published);
    if (post.url)       parts.push('Read more: ' + post.url);
    return parts.join('\n').trim();
  }

  copyPost(post: GeneratedPost, key: string): void {
    const text = this.buildFullText(post);
    const done = () => {
      this.copiedKey = key;
      clearTimeout(this.copiedTimer);
      this.copiedTimer = setTimeout(() => { this.copiedKey = null; }, 2000);
    };
    navigator.clipboard.writeText(text).then(done).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta); done();
    });
  }

  // ══ DOWNLOAD ═════════════════════════════════════════════

  downloadPost(post: GeneratedPost): void {
    const text = this.buildFullText(post);
    const safeTitle = (post.title || 'post').replace(/[^a-z0-9]/gi, '-').slice(0, 40);
    this.downloadText(text, `pylink-${safeTitle}.txt`);
  }

  private downloadText(text: string, filename: string): void {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  // ══ DUPLICATE ════════════════════════════════════════════

  duplicatePost(post: GeneratedPost, run: RichEntry): void {
    const cloned: GeneratedPost = { ...post, index: (run.generatedPosts?.length || 0) + 1, title: post.title + ' (copy)' };
    if (!run.generatedPosts) run.generatedPosts = [];
    run.generatedPosts.push(cloned);
    this.persist();
    this.rebuild();
  }

  // ══ ENRICH POLLING ═══════════════════════════════════════

  private startEnrichPolling(): void {
    this.enrichAttempts = 0;
    this.tryEnrich();
    this.enrichPollInterval = setInterval(() => this.tryEnrich(), 4000);
  }

  private stopEnrichPolling(): void {
    if (this.enrichPollInterval !== undefined) { clearInterval(this.enrichPollInterval); this.enrichPollInterval = undefined; }
  }

  private async tryEnrich(): Promise<void> {
    this.enrichAttempts++;
    const emptyRuns = this.allRuns.filter(r => r.status === 'success' && (!r.generatedPosts || r.generatedPosts.length === 0));
    if (emptyRuns.length === 0) { this.stopEnrichPolling(); return; }
    if (this.enrichAttempts > this.ENRICH_MAX_ATTEMPTS) { this.stopEnrichPolling(); return; }
    try {
      const res  = await fetch('/latest-posts');
      if (!res.ok) return;
      const data = await res.json();
      if (!data.found || !Array.isArray(data.posts) || !data.posts.length) return;
      let enriched = false;
      for (const run of this.allRuns) {
        if (run.status === 'success' && (!run.generatedPosts || run.generatedPosts.length === 0)) {
          (run as RichEntry).generatedPosts = data.posts;
          enriched = true; break;
        }
      }
      if (enriched) {
        this.persist(); this.rebuildTrash(); this.rebuild();
        const stillEmpty = this.allRuns.filter(r => r.status === 'success' && (!r.generatedPosts || r.generatedPosts.length === 0));
        if (stillEmpty.length === 0) this.stopEnrichPolling();
      }
    } catch { /* keep polling */ }
  }

  async manualRefresh(): Promise<void> {
    if (this.isRefreshing) return;
    this.isRefreshing = true;
    this.enrichAttempts = 0;
    await this.tryEnrich();
    setTimeout(() => { this.isRefreshing = false; }, 1500);
  }
}

import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { AppStateService } from '../services/app-state.service';
import { filter } from 'rxjs/operators';

type GenStep = 'platform' | 'configure' | 'review' | 'run';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss'
})
export class ShellComponent {
  sidebarCollapsed = false;
  currentUrl = '';
  readonly stepOrder: GenStep[] = ['platform', 'configure', 'review', 'run'];

  constructor(public state: AppStateService, private router: Router) {
    this.currentUrl = this.router.url;
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e: any) => {
        this.currentUrl = e.urlAfterRedirects || e.url;
        window.scrollTo(0, 0); // ← added
        if (!this.currentUrl.includes('/generate')) {
          this.state.generateStep.set('platform');
        }
      });
  }

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  isGeneratePage(): boolean {
    return this.currentUrl.includes('/app/generate');
  }

  isStepDone(step: GenStep): boolean {
    const currentIdx = this.stepOrder.indexOf(this.state.generateStep() as GenStep);
    return this.stepOrder.indexOf(step) < currentIdx;
  }
}
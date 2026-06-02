import { Routes } from '@angular/router';
import { HomeComponent }        from './home/home.component';
import { ShellComponent }       from './shell/shell.component';
import { DashboardComponent }   from './pages/dashboard/dashboard.component';
import { GenerateComponent }    from './pages/generate/generate.component';
import { SourcesComponent }     from './pages/sources/sources.component';
import { HistoryComponent }     from './pages/history/history.component';
import { PrivacyComponent }     from './privacy/privacy.component';
import { AboutComponent }       from './about/about.component';
import { TermsComponent }       from './terms/terms.component';
import { AboutPyLinkComponent } from './about-pylink/about-pylink.component';

export const routes: Routes = [
  // Standalone full-screen pages — no shell
  { path: '',              component: HomeComponent, pathMatch: 'full' },
  { path: 'privacy-policy', component: PrivacyComponent },
  { path: 'about',          component: AboutComponent },
  { path: 'about-pylink',   component: AboutPyLinkComponent },
  { path: 'terms',          component: TermsComponent },

  // All app pages inside the shell (sidebar layout)
  {
    path: 'app',
    component: ShellComponent,
    children: [
      { path: '',          redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: DashboardComponent },
      { path: 'generate',  component: GenerateComponent },
      { path: 'sources',   component: SourcesComponent },
      { path: 'history',   component: HistoryComponent },
    ]
  },

  // Catch-all
  { path: '**', redirectTo: '' }
];
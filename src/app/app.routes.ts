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
import { LoginComponent }       from './login/login/login.component';
import { authGuard }            from './login/auth.guard';

export const routes: Routes = [

  // ── Public full-screen pages (no shell, no auth required) ──────────────
  { path: '',               component: HomeComponent, pathMatch: 'full' },
  { path: 'login',          component: LoginComponent },
  { path: 'privacy-policy', component: PrivacyComponent },
  { path: 'about',          component: AboutComponent },
  { path: 'about-pylink',   component: AboutPyLinkComponent },
  { path: 'terms',          component: TermsComponent },

  // ── Protected app pages inside the shell ───────────────────────────────
  // authGuard redirects to /login if the user is not authenticated.
  // Previously the guard was imported but never applied — anyone could
  // reach /app/dashboard directly without logging in.
  {
    path: 'app',
    component: ShellComponent,
    canActivate: [authGuard],           // ← ADDED: was imported but unused
    children: [
      { path: '',          redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: DashboardComponent },
      { path: 'generate',  component: GenerateComponent },
      { path: 'sources',   component: SourcesComponent },
      { path: 'history',   component: HistoryComponent },
    ]
  },

  // ── Catch-all ───────────────────────────────────────────────────────────
  // Redirects to home, NOT to /app/dashboard.
  // Sending unknown URLs to a protected route caused a redirect loop:
  // unknown URL → /app/dashboard → authGuard → /login (if not authed), or
  // for an authed user it silently swallowed typo'd URLs into the dashboard.
  { path: '**', redirectTo: '' }        // ← FIXED: was '/app/dashboard'

];

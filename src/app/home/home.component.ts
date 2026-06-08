import { Component, OnInit, HostListener, NgZone } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../login/auth.service';

@Component({
  selector: 'app-home',
  imports: [RouterLink, CommonModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit {

  activeSection: string = 'hero';
  navbarScrolled: boolean = false;
  openFaq: number | null = null;
  showLoginToast: boolean = false;

  private readonly NAVBAR_HEIGHT = 70;

  constructor(private ngZone: NgZone, private auth: AuthService, private router: Router) {}

  ngOnInit(): void {
    document.documentElement.style.overflowY = 'auto';
    document.body.style.overflowY = 'auto';
    document.body.style.height = 'auto';
    document.documentElement.style.height = 'auto';
  }

  @HostListener('window:scroll', [])
  onWindowScroll(): void {
    const scrollY = window.scrollY;
    this.navbarScrolled = scrollY > 60;
    const sections = ['faq', 'use-cases', 'how-it-works', 'features', 'hero'];
    for (const id of sections) {
      const el = document.getElementById(id);
      if (el && el.getBoundingClientRect().top <= this.NAVBAR_HEIGHT + 60) {
        this.activeSection = id;
        break;
      }
    }
  }

  scrollTo(sectionId: string): void {
    const el = document.getElementById(sectionId);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - this.NAVBAR_HEIGHT;
    window.scrollTo({ top, behavior: 'smooth' });
  }

  toggleFaq(index: number): void {
    this.openFaq = this.openFaq === index ? null : index;
  }

  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  goToApp(): void {
    // ✅ Already logged in → go straight to dashboard, skip login
    if (this.auth.isLoggedIn()) {
      this.router.navigate(['/app/dashboard']);
    } else {
      this.router.navigate(['/login']);
    }
  }
}
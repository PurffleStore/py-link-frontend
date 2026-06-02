import { Component, OnInit, HostListener, NgZone } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit {

  activeSection: string = 'hero';
  navbarScrolled: boolean = false;
  openFaq: number | null = null;

  private readonly NAVBAR_HEIGHT = 70;

  constructor(private ngZone: NgZone) {}

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
    if (!el) { return; }
    const top = el.getBoundingClientRect().top + window.scrollY - this.NAVBAR_HEIGHT;
    window.scrollTo({ top, behavior: 'smooth' });
  }

  toggleFaq(index: number): void {
    this.openFaq = this.openFaq === index ? null : index;
  }
}

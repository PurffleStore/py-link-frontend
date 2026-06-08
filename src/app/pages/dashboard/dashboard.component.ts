import { Component } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AppStateService } from '../../services/app-state.service';
import { AuthService } from '../../login/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {

  constructor(public state: AppStateService, private auth: AuthService) {}

  logout(): void {
    this.auth.logout(); // clears sessionStorage → navigates to /login
  }

  get greeting(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }

  statusClass(status: string): string {
    if (status === 'success') return 'status-badge badge-success';
    if (status === 'error')   return 'status-badge badge-error';
    return 'status-badge badge-cancelled';
  }
}
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';

export interface User {
  username: string;
  displayName: string;
}

const CREDENTIALS: { username: string; password: string; displayName: string }[] = [
  { username: 'Pykara1', password: 'Pyk@12345', displayName: 'PY Kara 1' },
  { username: 'Pykara2', password: 'Pyk@12345', displayName: 'PY Kara 2' },
  { username: 'Pykara3', password: 'Pyk@12345', displayName: 'PY Kara 3' },
  { username: 'Pykara4', password: 'Pyk@12345', displayName: 'PY Kara 4' },
  { username: 'Pykara5', password: 'Pyk@12345', displayName: 'PY Kara 5' },
];

// ✅ sessionStorage → clears when browser/tab is closed → always asks login on fresh visit
const SESSION_KEY = 'pylink_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  constructor(private router: Router) {}

  login(username: string, password: string): boolean {
    const match = CREDENTIALS.find(
      c => c.username === username.trim() && c.password === password
    );
    if (match) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        username: match.username,
        displayName: match.displayName
      }));
      return true;
    }
    return false;
  }

  logout(): void {
    sessionStorage.removeItem(SESSION_KEY);
    this.router.navigate(['/login']);
  }

  isLoggedIn(): boolean {
    return !!sessionStorage.getItem(SESSION_KEY);
  }

  getCurrentUser(): User | null {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  }
}
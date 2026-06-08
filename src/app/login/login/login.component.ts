import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../auth.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterModule, CommonModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  username = '';
  password = '';
  showPass = false;
  errorMsg = '';
  loading  = false;

  // Track whether user has touched each field
  usernameTouched = false;
  passwordTouched = false;

  constructor(private auth: AuthService, private router: Router) {}

  // ── Validation rules ──────────────────────────────────────────

  get usernameError(): string {
    if (!this.usernameTouched) return '';
    if (!this.username.trim()) return 'This field is required.';
    if (this.username.trim().length < 3) return 'Username must be at least 3 characters.';
    if (this.username.trim().length > 30) return 'Username must be at most 30 characters.';
    if (!/^[a-zA-Z0-9]+$/.test(this.username.trim()))
      return 'Username should contain only letters and numbers.';
    return '';
  }

  get passwordError(): string {
    if (!this.passwordTouched) return '';
    if (!this.password) return 'This field is required.';
    if (this.password.length < 8)
      return 'Password must be at least 8 characters.';
    if (!/[A-Z]/.test(this.password))
      return 'Password must contain at least one uppercase letter.';
    if (!/[a-z]/.test(this.password))
      return 'Password must contain at least one lowercase letter.';
    if (!/[0-9]/.test(this.password))
      return 'Password must contain at least one number.';
    if (!/[^a-zA-Z0-9]/.test(this.password))
      return 'Password must contain at least one special character.';
    return '';
  }

  get isFormValid(): boolean {
    return (
      !!this.username.trim() &&
      !!this.password &&
      !this.usernameError &&
      !this.passwordError
    );
  }

  // ── Touch handlers ────────────────────────────────────────────

  onUsernameBlur(): void { this.usernameTouched = true; }
  onPasswordBlur(): void { this.passwordTouched = true; }

  // ── Submit ────────────────────────────────────────────────────

  submit(): void {
    this.usernameTouched = true;
    this.passwordTouched = true;
    this.errorMsg = '';

    if (!this.isFormValid) return;

    this.loading = true;
    setTimeout(() => {
      const ok = this.auth.login(this.username, this.password);
      this.loading = false;
      if (ok) {
        this.router.navigate(['/app/dashboard']);
      } else {
        this.errorMsg = 'Incorrect username or password. Please try again.';
        this.password = '';
        this.passwordTouched = false;
      }
    }, 600);
  }
}
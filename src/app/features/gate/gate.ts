import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import {
  PasswordVerification,
  PasswordVerificationFailure,
  type PasswordVerificationError
} from '../../core/auth/password-verification';

@Component({
  selector: 'app-gate',
  template: `
    <main class="gate-page">
      <form class="gate-card" (submit)="submit($event)">
        <p class="brand-mark" aria-hidden="true">d20</p>
        <h1>Gen Con Roll Call</h1>
        <p class="lede">Private map check-ins and rally points for the crew.</p>

        <label class="field">
          <span>Shared password</span>
          <input
            type="password"
            autocomplete="current-password"
            [value]="password()"
            [disabled]="isSubmitting()"
            [attr.aria-invalid]="errorMessage() ? 'true' : null"
            aria-describedby="password-error password-helper"
            (input)="password.set($any($event.target).value)"
          />
        </label>

        @if (errorMessage()) {
          <p id="password-error" class="error" role="alert">{{ errorMessage() }}</p>
        }

        <button class="primary-action" type="submit" [disabled]="!canSubmit()">
          {{ isSubmitting() ? 'Checking...' : 'Continue' }}
        </button>

        <p id="password-helper" class="helper">Password verification runs on the server. The shared password is never stored in this app bundle.</p>
      </form>
    </main>
  `,
  styles: `
    .gate-page {
      min-height: 100svh;
      display: grid;
      place-items: center;
      padding: 24px;
      background:
        radial-gradient(circle at 18% 12%, rgba(214, 56, 47, 0.12), transparent 26rem),
        var(--color-bg);
    }

    .gate-card {
      width: min(100%, 390px);
      padding: 28px;
      border: 1px solid var(--color-border);
      border-radius: 16px;
      background: var(--color-surface);
      box-shadow: 0 18px 48px var(--color-shadow);
    }

    .brand-mark {
      width: 54px;
      height: 54px;
      display: grid;
      place-items: center;
      margin: 0 0 18px;
      border-radius: 14px;
      background: var(--color-gencon-red);
      color: white;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    h1 {
      margin: 0;
      color: var(--color-text);
      font-size: 31px;
      line-height: 1.05;
    }

    .lede,
    .helper {
      color: var(--color-muted);
    }

    .lede {
      margin: 10px 0 28px;
      font-size: 16px;
      line-height: 1.45;
    }

    .field {
      display: grid;
      gap: 8px;
      color: var(--color-text);
      font-size: 13px;
      font-weight: 800;
    }

    input {
      min-height: 48px;
      padding: 0 14px;
      border: 1px solid var(--color-border);
      border-radius: 10px;
      color: var(--color-text);
      font: inherit;
      font-size: 16px;
      font-weight: 600;
    }

    .primary-action {
      width: 100%;
      min-height: 48px;
      display: grid;
      place-items: center;
      margin-top: 18px;
      border: 0;
      border-radius: 10px;
      background: var(--color-gencon-red);
      color: white;
      font-size: 15px;
      font-weight: 800;
    }

    .primary-action:disabled {
      cursor: not-allowed;
      opacity: 0.52;
    }

    .error {
      margin: 10px 0 0;
      color: var(--color-gencon-red);
      font-size: 13px;
      font-weight: 750;
      line-height: 1.35;
    }

    .helper {
      margin: 16px 0 0;
      font-size: 12px;
      line-height: 1.4;
    }
  `
})
export class Gate {
  private readonly passwordVerification = inject(PasswordVerification);
  private readonly router = inject(Router);

  readonly password = signal('');
  readonly isSubmitting = signal(false);
  readonly error = signal<PasswordVerificationError | null>(null);
  readonly canSubmit = computed(() => Boolean(this.password().trim()) && !this.isSubmitting());
  readonly errorMessage = computed(() => this.error() ? this.messageFor(this.error()) : '');

  async submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();

    if (!this.canSubmit()) {
      return;
    }

    this.isSubmitting.set(true);
    this.error.set(null);

    try {
      await this.passwordVerification.verify(this.password().trim());
      void this.router.navigateByUrl('/onboarding');
    } catch (error) {
      this.error.set(error instanceof PasswordVerificationFailure ? error.code : 'unknown-error');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  private messageFor(error: PasswordVerificationError | null): string {
    switch (error) {
      case 'missing-config':
        return 'Password verification is not configured yet.';
      case 'invalid-password':
        return 'That password did not work.';
      case 'too-many-attempts':
        return 'Too many attempts. Wait a few minutes and try again.';
      case 'server-not-configured':
        return 'The password service is missing its secret. Check Firebase setup.';
      case 'network-error':
        return 'Could not reach the password service. Check your connection and try again.';
      default:
        return 'Something went wrong checking the password.';
    }
  }
}

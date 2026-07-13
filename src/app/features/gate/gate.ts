import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import {
  PasswordVerification,
  PasswordVerificationFailure,
  type PasswordVerificationError,
} from '../../core/auth/password-verification';

@Component({
  selector: 'app-gate',
  template: `
    <main class="gate-page">
      <form class="gate-card" (submit)="submit($event)">
        <header>
          <h1><span>Gen Con</span><span>Roll Call</span></h1>
          <p class="lede">Find the crew. Pick a spot. Rally up.</p>
        </header>

        <label class="field">
          <span>Crew password</span>
          <input
            [type]="showPassword() ? 'text' : 'password'"
            autocomplete="current-password"
            [value]="password()"
            [disabled]="isSubmitting()"
            [attr.aria-invalid]="errorMessage() ? 'true' : null"
            aria-describedby="password-error"
            (input)="password.set($any($event.target).value)"
          />
          <button
            type="button"
            class="password-toggle"
            [attr.aria-pressed]="showPassword()"
            [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'"
            (click)="showPassword.update((visible) => !visible)"
          >
            @if (showPassword()) {
              <span aria-hidden="true">Hide</span>
            } @else {
              <span aria-hidden="true">Show</span>
            }
          </button>
        </label>

        @if (errorMessage()) {
          <p id="password-error" class="error" role="alert">{{ errorMessage() }}</p>
        }

        <button class="primary-action" type="submit" [disabled]="!canSubmit()">
          {{ isSubmitting() ? 'Checking...' : 'Let me in' }}
        </button>
        <img
          class="gate-illustration"
          src="/images/indy-convention-center.webp"
          alt=""
          aria-hidden="true"
        />
        <p class="event-date">Gen Con Indy <span aria-hidden="true">·</span> July 30–Aug 2</p>
      </form>
    </main>
  `,
  styles: `
    .gate-page {
      min-height: 100svh;
      display: grid;
      place-items: center;
      padding: 0;
      background: var(--color-surface);
    }

    .gate-card {
      width: min(100%, 430px);
      min-height: 100svh;
      display: flex;
      flex-direction: column;
      padding: clamp(42px, 9svh, 78px) 28px max(26px, env(safe-area-inset-bottom));
      background: var(--color-surface);
    }

    header {
      margin-bottom: clamp(34px, 7svh, 58px);
    }

    h1 {
      margin: 0;
      font-family: var(--font-display);
      font-size: clamp(54px, 15vw, 68px);
      font-stretch: condensed;
      font-weight: 950;
      letter-spacing: -0.065em;
      line-height: 0.84;
      text-transform: uppercase;
    }

    h1 span {
      display: block;
    }

    h1 span:last-child {
      color: var(--color-gencon-red);
    }

    .lede {
      margin: 22px 0 0;
      color: var(--color-muted);
      font-size: 17px;
      font-weight: 520;
      letter-spacing: -0.01em;
      line-height: 1.35;
    }

    .field {
      position: relative;
      display: grid;
      gap: 8px;
      color: var(--color-text);
      font-size: 14px;
      font-weight: 850;
    }

    input {
      min-height: 58px;
      padding: 0 70px 0 15px;
      border: 1.5px solid var(--color-text);
      border-radius: 8px;
      color: var(--color-text);
      font: inherit;
      font-size: 16px;
      font-weight: 600;
    }

    .primary-action {
      width: 100%;
      min-height: 58px;
      display: grid;
      place-items: center;
      margin-top: 16px;
      border: 0;
      border-radius: 6px;
      background: var(--color-gencon-red);
      color: white;
      font-size: 17px;
      font-weight: 850;
    }

    .password-toggle {
      position: absolute;
      right: 9px;
      bottom: 9px;
      min-width: 52px;
      min-height: 40px;
      padding: 0 8px;
      border: 0;
      background: transparent;
      color: var(--color-muted);
      font-size: 12px;
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

    .gate-illustration {
      width: calc(100% + 20px);
      max-height: 250px;
      object-fit: contain;
      margin: auto -10px 8px;
    }

    .event-date {
      margin: 0;
      color: var(--color-muted);
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 0.015em;
      text-align: center;
    }

    @media (max-height: 700px) {
      .gate-card {
        padding-top: 28px;
      }

      header {
        margin-bottom: 24px;
      }

      .gate-illustration {
        max-height: 160px;
      }
    }
  `,
})
export class Gate {
  private readonly passwordVerification = inject(PasswordVerification);
  private readonly router = inject(Router);

  readonly password = signal('');
  readonly showPassword = signal(false);
  readonly isSubmitting = signal(false);
  readonly error = signal<PasswordVerificationError | null>(null);
  readonly canSubmit = computed(() => Boolean(this.password().trim()) && !this.isSubmitting());
  readonly errorMessage = computed(() => (this.error() ? this.messageFor(this.error()) : ''));

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
        return 'Roll Call isn’t ready yet.';
      case 'invalid-password':
        return 'That password did not work.';
      case 'too-many-attempts':
        return 'Too many attempts. Wait a few minutes and try again.';
      case 'server-not-configured':
        return 'Roll Call isn’t ready yet.';
      case 'firebase-not-configured':
        return 'Roll Call isn’t ready yet.';
      case 'auth-required':
        return 'Couldn’t let you in. Try again.';
      case 'network-error':
        return 'Couldn’t connect. Check your signal and try again.';
      default:
        return 'Something went wrong checking the password.';
    }
  }
}

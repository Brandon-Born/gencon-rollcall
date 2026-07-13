import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { MemberProfile, MemberProfileError } from '../../core/members/member-profile';
import { SessionStore } from '../../core/session/session-store';

@Component({
  selector: 'app-onboarding',
  imports: [RouterLink],
  template: `
    <main class="onboarding-page">
      <section class="panel">
        <a class="back-link" routerLink="/gate">← Back</a>
        <p class="wordmark" aria-hidden="true">Roll Call</p>
        <h1>What should we call you?</h1>
        <p class="lede">This is how the crew will spot you on the map.</p>

        <label class="field">
          <span>Display name</span>
          <input
            type="text"
            autocomplete="nickname"
            maxlength="32"
            [value]="displayName()"
            (input)="displayName.set($any($event.target).value)"
          />
        </label>

        <button type="button" [disabled]="isSaving() || !displayName().trim()" (click)="continue()">
          {{ isSaving() ? 'Saving...' : 'Join the crew' }}
        </button>

        @if (errorMessage()) {
          <p class="error" role="alert">{{ errorMessage() }}</p>
        }
      </section>
    </main>
  `,
  styles: `
    .onboarding-page {
      min-height: 100svh;
      display: grid;
      place-items: center;
      padding: 24px;
      background: var(--color-surface);
    }

    .panel {
      width: min(100%, 390px);
      padding: 30px 28px;
      background: var(--color-surface);
    }

    .back-link {
      color: var(--color-gencon-red);
      font-size: 13px;
      font-weight: 850;
      text-decoration: none;
    }

    .wordmark {
      margin: clamp(46px, 12svh, 100px) 0 18px;
      color: var(--color-gencon-red);
      font-family: var(--font-display);
      font-size: 18px;
      font-weight: 950;
      letter-spacing: -0.03em;
      text-transform: uppercase;
    }

    h1 {
      margin: 0 0 10px;
      color: var(--color-text);
      font-family: var(--font-display);
      font-size: 42px;
      font-stretch: condensed;
      font-weight: 950;
      letter-spacing: -0.045em;
      line-height: 0.98;
      text-transform: uppercase;
    }

    .lede {
      margin: 0 0 24px;
      color: var(--color-muted);
      font-size: 16px;
      line-height: 1.4;
    }

    .field {
      display: grid;
      gap: 8px;
      font-size: 13px;
      font-weight: 800;
    }

    input {
      min-height: 54px;
      padding: 0 14px;
      border: 1px solid var(--color-border);
      border-radius: 8px;
      color: var(--color-text);
      font-size: 16px;
      font-weight: 650;
    }

    button {
      width: 100%;
      min-height: 54px;
      margin-top: 18px;
      border: 0;
      border-radius: 6px;
      background: var(--color-gencon-red);
      color: white;
      font-size: 16px;
      font-weight: 850;
    }

    button:disabled {
      opacity: 0.52;
    }

    .error {
      margin: 12px 0 0;
      color: var(--color-gencon-red);
      font-size: 13px;
      font-weight: 750;
      line-height: 1.35;
    }
  `,
})
export class Onboarding {
  private readonly memberProfile = inject(MemberProfile);
  private readonly router = inject(Router);
  private readonly session = inject(SessionStore);

  readonly displayName = signal(this.session.displayName());
  readonly errorMessage = signal('');
  readonly isSaving = signal(false);

  async continue(): Promise<void> {
    if (this.isSaving()) {
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set('');

    try {
      await this.memberProfile.joinCurrentMember(this.displayName());
      void this.router.navigateByUrl('/app/map');
    } catch (error) {
      this.errorMessage.set(messageFor(error));
    } finally {
      this.isSaving.set(false);
    }
  }
}

function messageFor(error: unknown): string {
  if (error instanceof MemberProfileError && error.code === 'display-name-required') {
    return 'Enter a display name before continuing.';
  }

  if (error instanceof MemberProfileError && error.code === 'not-authorized') {
    return 'We lost your place. Go back and enter the crew password again.';
  }

  if (error instanceof MemberProfileError && error.code === 'member-identity-unavailable') {
    return 'Couldn’t check the crew list. Check your connection and try again.';
  }

  return 'Could not save your display name. Check your connection and try again.';
}

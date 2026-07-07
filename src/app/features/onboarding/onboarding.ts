import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { SessionStore } from '../../core/session/session-store';

@Component({
  selector: 'app-onboarding',
  imports: [RouterLink],
  template: `
    <main class="onboarding-page">
      <section class="panel">
        <a class="back-link" routerLink="/gate">Back</a>
        <h1>What should the crew call you?</h1>
        <p>This name labels your pin, status, notes, and rally responses.</p>

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

        <button type="button" [disabled]="!displayName().trim()" (click)="continue()">
          Enter map
        </button>
      </section>
    </main>
  `,
  styles: `
    .onboarding-page {
      min-height: 100svh;
      display: grid;
      place-items: center;
      padding: 24px;
      background: var(--color-bg);
    }

    .panel {
      width: min(100%, 390px);
      padding: 28px;
      border-radius: 16px;
      background: var(--color-surface);
      box-shadow: 0 18px 48px var(--color-shadow);
    }

    .back-link {
      color: var(--color-muted);
      font-size: 13px;
      font-weight: 800;
      text-decoration: none;
    }

    h1 {
      margin: 18px 0 10px;
      color: var(--color-text);
      font-size: 27px;
      line-height: 1.1;
    }

    p {
      margin: 0 0 24px;
      color: var(--color-muted);
      line-height: 1.45;
    }

    .field {
      display: grid;
      gap: 8px;
      font-size: 13px;
      font-weight: 800;
    }

    input {
      min-height: 48px;
      padding: 0 14px;
      border: 1px solid var(--color-border);
      border-radius: 10px;
      color: var(--color-text);
      font-size: 16px;
      font-weight: 650;
    }

    button {
      width: 100%;
      min-height: 48px;
      margin-top: 18px;
      border: 0;
      border-radius: 10px;
      background: var(--color-gencon-red);
      color: white;
      font-size: 15px;
      font-weight: 800;
    }

    button:disabled {
      opacity: 0.52;
    }
  `
})
export class Onboarding {
  private readonly router = inject(Router);
  private readonly session = inject(SessionStore);

  readonly displayName = signal(this.session.displayName());

  continue(): void {
    this.session.setDisplayName(this.displayName());
    void this.router.navigateByUrl('/app/map');
  }
}

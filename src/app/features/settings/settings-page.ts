import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AuthSession } from '../../core/auth/auth-session';
import { SessionStore } from '../../core/session/session-store';

@Component({
  selector: 'app-settings-page',
  template: `
    <main class="page">
      <header>
        <h1>Settings</h1>
        <p>Control your name, visibility, and local session.</p>
      </header>

      <section class="panel">
        <label>
          <span>Display name</span>
          <input
            type="text"
            maxlength="32"
            [value]="displayName()"
            (input)="displayName.set($any($event.target).value)"
          />
        </label>
        <button type="button" (click)="saveName()">Save name</button>
      </section>

      <section class="panel">
        <div>
          <strong>Location visibility</strong>
          <p>Hide your map pin while staying visible in the people list.</p>
        </div>
        <button type="button" class="secondary">Hide my location</button>
      </section>

      <button type="button" class="danger" (click)="leave()">Leave app</button>
    </main>
  `,
  styles: `
    .page {
      min-height: 100svh;
      padding: 22px 16px;
      background: var(--color-bg);
    }

    h1,
    p {
      margin: 0;
    }

    h1 {
      color: var(--color-text);
      font-size: 28px;
    }

    header p,
    .panel p {
      color: var(--color-muted);
      line-height: 1.42;
    }

    header p {
      margin-top: 6px;
    }

    .panel {
      display: grid;
      gap: 14px;
      margin-top: 16px;
      padding: 16px;
      border: 1px solid var(--color-border);
      border-radius: 16px;
      background: var(--color-surface);
    }

    label {
      display: grid;
      gap: 8px;
      color: var(--color-muted);
      font-size: 12px;
      font-weight: 850;
    }

    input {
      min-height: 46px;
      padding: 0 12px;
      border: 1px solid var(--color-border);
      border-radius: 10px;
      color: var(--color-text);
      font-size: 15px;
      font-weight: 700;
    }

    strong {
      color: var(--color-text);
      font-size: 17px;
    }

    button {
      min-height: 46px;
      border: 0;
      border-radius: 10px;
      background: var(--color-gencon-red);
      color: white;
      font-size: 15px;
      font-weight: 850;
    }

    .secondary {
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      color: var(--color-text);
    }

    .danger {
      width: 100%;
      margin-top: 18px;
      background: #151821;
    }
  `
})
export class SettingsPage {
  private readonly authSession = inject(AuthSession);
  private readonly router = inject(Router);
  private readonly session = inject(SessionStore);

  readonly displayName = signal(this.session.displayName());

  saveName(): void {
    this.session.setDisplayName(this.displayName());
  }

  async leave(): Promise<void> {
    await this.authSession.leaveApp();
    void this.router.navigateByUrl('/gate');
  }
}

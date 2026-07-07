import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-gate',
  imports: [RouterLink],
  template: `
    <main class="gate-page">
      <section class="gate-card">
        <p class="brand-mark" aria-hidden="true">d20</p>
        <h1>Gen Con Roll Call</h1>
        <p class="lede">Private map check-ins and rally points for the crew.</p>

        <label class="field">
          <span>Shared password</span>
          <input
            type="password"
            autocomplete="current-password"
            [value]="password()"
            (input)="password.set($any($event.target).value)"
          />
        </label>

        <a class="primary-action" routerLink="/onboarding" [class.disabled]="!password().trim()">
          Continue
        </a>

        <p class="helper">Backend password verification will replace this local prototype transition.</p>
      </section>
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
      min-height: 48px;
      display: grid;
      place-items: center;
      margin-top: 18px;
      border-radius: 10px;
      background: var(--color-gencon-red);
      color: white;
      font-size: 15px;
      font-weight: 800;
      text-decoration: none;
    }

    .primary-action.disabled {
      pointer-events: none;
      opacity: 0.52;
    }

    .helper {
      margin: 16px 0 0;
      font-size: 12px;
      line-height: 1.4;
    }
  `
})
export class Gate {
  readonly password = signal('');
}

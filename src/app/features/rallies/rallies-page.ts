import { Component } from '@angular/core';

@Component({
  selector: 'app-rallies-page',
  template: `
    <main class="page">
      <header>
        <div>
          <h1>Rally Points</h1>
          <p>Coordinate meetups without a text storm.</p>
        </div>
        <button type="button">New</button>
      </header>

      <article class="rally">
        <span class="marker" aria-hidden="true">Flag</span>
        <div>
          <h2>Food trucks after this event</h2>
          <p class="meta">Grand Concourse - Center</p>
          <p>Meet near the info desk when the current event wraps.</p>
        </div>

        <div class="responses">
          <button type="button">Heading there <strong>2</strong></button>
          <button type="button">Arrived <strong>1</strong></button>
          <button type="button">Cannot make it <strong>1</strong></button>
        </div>
      </article>
    </main>
  `,
  styles: `
    .page {
      min-height: 100svh;
      padding: 22px 16px;
      background: var(--color-bg);
    }

    header {
      display: flex;
      align-items: start;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 18px;
    }

    h1,
    h2,
    p {
      margin: 0;
    }

    h1 {
      color: var(--color-text);
      font-size: 28px;
    }

    header p,
    .meta,
    .rally p {
      color: var(--color-muted);
    }

    header p {
      margin-top: 6px;
    }

    header button {
      min-height: 42px;
      padding: 0 16px;
      border: 0;
      border-radius: 999px;
      background: var(--color-gencon-red);
      color: white;
      font-weight: 900;
    }

    .rally {
      display: grid;
      grid-template-columns: 58px 1fr;
      gap: 14px;
      padding: 16px;
      border: 1px solid var(--color-border);
      border-radius: 16px;
      background: var(--color-surface);
    }

    .marker {
      width: 54px;
      height: 54px;
      display: grid;
      place-items: center;
      border-radius: 16px;
      background: var(--color-gencon-red);
      color: white;
      font-size: 11px;
      font-weight: 900;
      text-transform: uppercase;
    }

    h2 {
      color: var(--color-text);
      font-size: 20px;
      line-height: 1.2;
    }

    .meta {
      margin-top: 5px;
      font-weight: 750;
    }

    .rally p:not(.meta) {
      margin-top: 9px;
      line-height: 1.42;
    }

    .responses {
      grid-column: 1 / -1;
      display: grid;
      gap: 9px;
      margin-top: 8px;
    }

    .responses button {
      min-height: 48px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 14px;
      border: 1px solid var(--color-border);
      border-radius: 12px;
      background: var(--color-surface-warm);
      color: var(--color-text);
      font-size: 15px;
      font-weight: 850;
    }
  `
})
export class RalliesPage {}

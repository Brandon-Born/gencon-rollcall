import { Component, DestroyRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { RallyPoint } from '../../core/models/rally-point';
import { RallyPointError, RallyPoints } from '../../core/rallies/rally-points';

interface RallyListItem {
  id: string;
  title: string;
  note: string;
  creatorName: string;
  scheduledLabel: string;
  coordinateLabel: string;
}

@Component({
  selector: 'app-rallies-page',
  imports: [RouterLink],
  template: `
    <main class="page">
      <header>
        <div>
          <h1>Rally Points</h1>
          <p>Coordinate meetups without a text storm.</p>
        </div>
        <a routerLink="/app/map">Map</a>
      </header>

      @if (isLoading()) {
        <section class="state" aria-live="polite">
          <span class="state-icon" aria-hidden="true"></span>
          <strong>Loading rally points</strong>
          <p>Subscribing to active meetup spots.</p>
        </section>
      } @else if (loadError()) {
        <section class="state error" role="alert">
          <strong>Rally points unavailable</strong>
          <p>{{ loadError() }}</p>
          <button type="button" (click)="reloadRallies()">Try again</button>
        </section>
      } @else if (!rallyItems().length) {
        <section class="state">
          <strong>No rally points yet</strong>
          <p>Create one from the map when the group needs a meetup spot.</p>
          <a routerLink="/app/map">Open map</a>
        </section>
      } @else {
        <section class="list" aria-label="Active rally points">
          @for (rally of rallyItems(); track rally.id) {
            <article class="rally">
              <span class="marker" aria-hidden="true">RP</span>
              <div>
                <h2>{{ rally.title }}</h2>
                <p class="meta">{{ rally.scheduledLabel }} · {{ rally.creatorName }}</p>
                <p>{{ rally.note || 'No note added.' }}</p>
                <p class="coordinate">{{ rally.coordinateLabel }}</p>
              </div>
            </article>
          }
        </section>
      }
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
      line-height: 1.08;
    }

    header p,
    .meta,
    .rally p,
    .state p {
      color: var(--color-muted);
    }

    header p {
      margin-top: 6px;
    }

    header a,
    .state a,
    .state button {
      min-height: 42px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0 16px;
      border: 0;
      border-radius: 999px;
      background: var(--color-gencon-red);
      color: white;
      font-size: 14px;
      font-weight: 900;
      text-decoration: none;
    }

    .list {
      display: grid;
      gap: 10px;
    }

    .rally {
      display: grid;
      grid-template-columns: 54px minmax(0, 1fr);
      gap: 14px;
      padding: 16px;
      border: 1px solid var(--color-border);
      border-radius: 14px;
      background: var(--color-surface);
      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.07);
    }

    .marker {
      width: 50px;
      height: 50px;
      display: grid;
      place-items: center;
      border: 3px solid white;
      border-radius: 14px 14px 14px 5px;
      background: var(--color-gencon-red);
      color: white;
      font-size: 11px;
      font-weight: 950;
      letter-spacing: 0;
      box-shadow: 0 8px 18px rgba(214, 56, 47, 0.22);
    }

    h2 {
      overflow-wrap: anywhere;
      color: var(--color-text);
      font-size: 19px;
      line-height: 1.2;
    }

    .meta {
      margin-top: 5px;
      font-size: 13px;
      font-weight: 800;
      line-height: 1.3;
    }

    .rally p:not(.meta) {
      margin-top: 9px;
      font-size: 14px;
      line-height: 1.42;
    }

    .coordinate {
      font-weight: 800;
    }

    .state {
      display: grid;
      justify-items: center;
      gap: 10px;
      padding: 32px 20px;
      border: 1px solid var(--color-border);
      border-radius: 14px;
      background: var(--color-surface);
      text-align: center;
    }

    .state strong {
      color: var(--color-text);
      font-size: 18px;
      line-height: 1.2;
    }

    .state p {
      max-width: 22rem;
      font-size: 14px;
      line-height: 1.42;
    }

    .state-icon {
      width: 34px;
      height: 34px;
      border: 4px solid rgba(214, 56, 47, 0.18);
      border-top-color: var(--color-gencon-red);
      border-radius: 999px;
      animation: spin 900ms linear infinite;
    }

    .state.error {
      border-color: rgba(214, 56, 47, 0.28);
    }

    .state.error p {
      color: var(--color-gencon-red);
      font-weight: 750;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .state-icon {
        animation: none;
      }
    }
  `,
})
export class RalliesPage {
  private readonly rallyPoints = inject(RallyPoints);
  private readonly destroyRef = inject(DestroyRef);
  private unsubscribe: (() => void) | null = null;
  private isDestroyed = false;

  readonly isLoading = signal(true);
  readonly loadError = signal('');
  readonly rallyItems = signal<RallyListItem[]>([]);

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.isDestroyed = true;
      this.unsubscribe?.();
      this.unsubscribe = null;
    });

    void this.reloadRallies();
  }

  async reloadRallies(): Promise<void> {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.isLoading.set(true);
    this.loadError.set('');

    try {
      const unsubscribe = await this.rallyPoints.watchRallyPoints(
        (rallyPoints) => {
          if (this.isDestroyed) {
            return;
          }

          this.rallyItems.set(rallyPoints.map(toRallyListItem));
          this.isLoading.set(false);
          this.loadError.set('');
        },
        (error) => {
          if (this.isDestroyed) {
            return;
          }

          this.isLoading.set(false);
          this.loadError.set(messageForRallyError(error));
        },
      );

      if (this.isDestroyed) {
        unsubscribe();
        return;
      }

      this.unsubscribe = unsubscribe;
    } catch (error) {
      if (!this.isDestroyed) {
        this.isLoading.set(false);
        this.loadError.set(messageForRallyError(error));
      }
    }
  }
}

function toRallyListItem(rallyPoint: RallyPoint): RallyListItem {
  return {
    id: rallyPoint.id,
    title: rallyPoint.title,
    note: rallyPoint.note,
    creatorName: rallyPoint.createdByName,
    scheduledLabel: rallyPoint.scheduledTime
      ? scheduledLabel(rallyPoint.scheduledTime)
      : 'No time set',
    coordinateLabel: `Map spot ${formatPercent(rallyPoint.mapXPercent)}%, ${formatPercent(
      rallyPoint.mapYPercent,
    )}%`,
  };
}

function messageForRallyError(error: unknown): string {
  if (error instanceof RallyPointError && error.code === 'not-authorized') {
    return 'Your session is not authorized. Sign in again before viewing rally points.';
  }

  return 'Could not load rally points. Check your connection and try again.';
}

function scheduledLabel(scheduledTime: Date): string {
  return scheduledTime.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatPercent(value: number): string {
  const normalized = Math.round(Math.min(100, Math.max(0, value)) * 10) / 10;
  return Number.isInteger(normalized)
    ? String(normalized)
    : normalized.toFixed(1).replace(/0+$/, '').replace(/\.$/, '');
}

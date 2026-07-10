import { Component, DestroyRef, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

import type { RallyPoint } from '../../core/models/rally-point';
import { RallyPoints } from '../../core/rallies/rally-points';

const knownRallyIdsKey = 'gencon-roll-call-known-rallies';

@Component({
  selector: 'app-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="app-shell">
      <router-outlet />

      <nav class="tab-bar" aria-label="Main navigation">
        <a routerLink="/app/map" routerLinkActive="active">
          <strong>Map</strong>
        </a>
        <a routerLink="/app/people" routerLinkActive="active">
          <strong>People</strong>
        </a>
        <a routerLink="/app/rallies" routerLinkActive="active">
          <strong>Rally Points</strong>
          @if (newRallyCount()) {
            <span class="badge" [attr.aria-label]="newRallyCount() + ' new rally points'">
              {{ newRallyCount() }}
            </span>
          }
        </a>
        <a routerLink="/app/settings" routerLinkActive="active">
          <strong>Settings</strong>
        </a>
      </nav>
    </div>
  `,
  styles: `
    .app-shell {
      min-height: 100svh;
      padding-bottom: calc(74px + env(safe-area-inset-bottom));
      background: var(--color-bg);
    }

    .tab-bar {
      position: fixed;
      right: 0;
      bottom: 0;
      left: 0;
      z-index: 20;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 4px;
      padding: 8px 10px calc(8px + env(safe-area-inset-bottom));
      border-top: 1px solid var(--color-border);
      background: rgba(255, 255, 255, 0.94);
      backdrop-filter: blur(16px);
    }

    a {
      position: relative;
      min-height: 54px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 10px;
      color: var(--color-muted);
      font-size: 12px;
      font-weight: 800;
      text-decoration: none;
    }

    a.active {
      background: rgba(214, 56, 47, 0.09);
      color: var(--color-gencon-red);
    }

    .badge {
      position: absolute;
      top: 4px;
      right: max(5px, calc(50% - 38px));
      min-width: 19px;
      height: 19px;
      display: grid;
      place-items: center;
      padding: 0 5px;
      border: 2px solid white;
      border-radius: 999px;
      background: var(--color-gencon-red);
      color: white;
      font-size: 10px;
      font-weight: 900;
    }
  `,
})
export class Shell {
  private readonly destroyRef = inject(DestroyRef);
  private readonly rallyPoints = inject(RallyPoints);
  private readonly router = inject(Router);
  private unsubscribeRallies: (() => void) | null = null;
  private isDestroyed = false;
  private activeRallies: RallyPoint[] = [];
  private knownRallyIds = readKnownRallyIds();
  private hasKnownRallySnapshot = hasStoredRallySnapshot();

  readonly newRallyCount = signal(0);

  constructor() {
    const navigationSubscription = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        if (isRallyAwarenessRoute(event.urlAfterRedirects)) {
          this.markRalliesSeen();
        }
      });

    this.destroyRef.onDestroy(() => {
      this.isDestroyed = true;
      navigationSubscription.unsubscribe();
      this.unsubscribeRallies?.();
      this.unsubscribeRallies = null;
    });

    void this.startRallyStream();
  }

  private async startRallyStream(): Promise<void> {
    const unsubscribe = await this.rallyPoints.watchRallyPoints(
      (rallies) => {
        if (this.isDestroyed) {
          return;
        }

        this.activeRallies = rallies;

        if (!this.hasKnownRallySnapshot) {
          this.hasKnownRallySnapshot = true;
          this.markRalliesSeen();
          return;
        }

        if (isRallyAwarenessRoute(this.router.url)) {
          this.markRalliesSeen();
        } else {
          this.newRallyCount.set(
            rallies.filter((rally) => !this.knownRallyIds.has(rally.id)).length,
          );
        }
      },
      () => this.newRallyCount.set(0),
    );

    if (this.isDestroyed) {
      unsubscribe();
    } else {
      this.unsubscribeRallies = unsubscribe;
    }
  }

  private markRalliesSeen(): void {
    this.activeRallies.forEach((rally) => this.knownRallyIds.add(rally.id));
    writeKnownRallyIds(this.knownRallyIds);
    this.newRallyCount.set(0);
  }
}

function isRallyAwarenessRoute(url: string): boolean {
  return url.startsWith('/app/map') || url.startsWith('/app/rallies');
}

function readKnownRallyIds(): Set<string> {
  try {
    const value = localStorage.getItem(knownRallyIdsKey);
    const ids = value ? (JSON.parse(value) as unknown) : [];
    return new Set(
      Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [],
    );
  } catch {
    return new Set();
  }
}

function hasStoredRallySnapshot(): boolean {
  try {
    return localStorage.getItem(knownRallyIdsKey) !== null;
  } catch {
    return false;
  }
}

function writeKnownRallyIds(ids: Set<string>): void {
  try {
    localStorage.setItem(knownRallyIdsKey, JSON.stringify([...ids].slice(-100)));
  } catch {
    // Badge persistence is best-effort; real-time awareness still works for this session.
  }
}

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
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m3 5 5-2 8 3 5-2v15l-5 2-8-3-5 2V5Z" />
            <path d="M8 3v15M16 6v15" />
          </svg>
          <strong>Map</strong>
        </a>
        <a routerLink="/app/people" routerLinkActive="active">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="9" cy="8" r="3" />
            <circle cx="17" cy="10" r="2.5" />
            <path d="M3.5 20v-1.5A4.5 4.5 0 0 1 8 14h2a4.5 4.5 0 0 1 4.5 4.5V20M14.5 15.5a4 4 0 0 1 6 3.5v1" />
          </svg>
          <strong>People</strong>
        </a>
        <a routerLink="/app/rallies" routerLinkActive="active">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 21V3M6 4h10l-2 3 2 3H6" />
          </svg>
          <strong>Rallies</strong>
          @if (newRallyCount()) {
            <span class="badge" [attr.aria-label]="newRallyCount() + ' new rally points'">
              {{ newRallyCount() }}
            </span>
          }
        </a>
        <a routerLink="/app/settings" routerLinkActive="active">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a7 7 0 0 0-1.7-1L14.5 3h-5l-.4 3.1a7 7 0 0 0-1.7 1l-2.4-1-2 3.4L5.1 11a7 7 0 0 0 0 2L3 14.5l2 3.4 2.4-1a7 7 0 0 0 1.7 1l.4 3.1h5l.4-3.1a7 7 0 0 0 1.7-1l2.4 1 2-3.4L18.9 13a7 7 0 0 0 .1-1Z" />
          </svg>
          <strong>Settings</strong>
        </a>
      </nav>
    </div>
  `,
  styles: `
    .app-shell {
      min-height: 100svh;
      padding-bottom: calc(78px + env(safe-area-inset-bottom));
      background: var(--color-bg);
    }

    .tab-bar {
      position: fixed;
      bottom: 0;
      left: 50%;
      z-index: 20;
      width: min(100%, 820px);
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 0;
      padding: 7px 8px calc(7px + env(safe-area-inset-bottom));
      border-top: 1px solid var(--color-border);
      background: rgba(255, 255, 255, 0.94);
      backdrop-filter: blur(16px);
      transform: translateX(-50%);
    }

    a {
      position: relative;
      min-height: 60px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      align-items: center;
      justify-content: center;
      color: var(--color-muted);
      font-size: 11px;
      font-weight: 750;
      text-decoration: none;
    }

    a.active {
      color: var(--color-gencon-red);
    }

    a::before {
      position: absolute;
      top: -8px;
      width: 28px;
      height: 3px;
      border-radius: 0 0 3px 3px;
      background: transparent;
      content: '';
    }

    a.active::before {
      background: var(--color-gencon-red);
    }

    svg {
      width: 23px;
      height: 23px;
      fill: none;
      stroke: currentColor;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-width: 1.8;
    }

    .badge {
      position: absolute;
      top: 2px;
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

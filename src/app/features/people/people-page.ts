import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AuthSession } from '../../core/auth/auth-session';
import { MemberProfile } from '../../core/members/member-profile';
import type { Member } from '../../core/models/member';
import { type MemberStatus, STATUS_OPTIONS, statusLabel } from '../../shared/status/status-options';
import { peopleSummaryLabel } from './people-summary';

interface PersonListItem {
  id: string;
  mapId: string | null;
  displayName: string;
  initials: string;
  status: MemberStatus;
  statusLabel: string;
  note: string;
  freshnessLabel: string;
  updatedAtIso: string;
  locationVisible: boolean;
  canOpenMap: boolean;
  isCurrent: boolean;
  tone: string;
  isOffline: boolean;
  isStale: boolean;
  sortTime: number;
}

const staleAfterMs = 60 * 60 * 1000;
const minuteMs = 60 * 1000;
const hourMs = 60 * minuteMs;
const dayMs = 24 * hourMs;

@Component({
  selector: 'app-people-page',
  template: `
    <main class="page">
      <header>
        <div>
          <h1>People</h1>
          <p>Where the crew’s at</p>
        </div>
        @if (!isLoading() && people().length) {
          <span class="summary">{{ summaryLabel() }}</span>
        }
      </header>

      @if (isLoading()) {
        <section class="state" aria-live="polite">
          <span class="state-icon" aria-hidden="true"></span>
          <strong>Loading people</strong>
          <p>Checking who’s around.</p>
        </section>
      } @else if (loadError()) {
        <section class="state error" role="alert">
          <strong>People unavailable</strong>
          <p>{{ errorMessage() }}</p>
          <button type="button" (click)="reloadPeople()">Try again</button>
        </section>
      } @else if (!people().length) {
        <section class="state">
          <strong>It’s quiet in here</strong>
          <p>The crew will show up as they join.</p>
        </section>
      } @else {
        <section class="list" aria-label="Group status list">
          @for (person of people(); track person.id) {
            <article
              class="person"
              [class.offline]="person.isOffline"
              [class.stale]="person.isStale"
              [class.map-link]="person.canOpenMap"
              [attr.role]="person.canOpenMap ? 'link' : null"
              [attr.tabindex]="person.canOpenMap ? 0 : null"
              (click)="openPersonOnMap(person)"
              (keydown.enter)="openPersonOnMap(person)"
            >
              <span class="avatar" [class]="person.tone" aria-hidden="true">{{
                person.initials
              }}</span>
              <div class="person-body">
                <div class="row">
                  <strong>
                    {{ person.displayName }}
                    @if (person.isCurrent) {
                      <span class="you-label">(You)</span>
                    }
                  </strong>
                  <time [attr.datetime]="person.updatedAtIso">{{ person.freshnessLabel }}</time>
                </div>

                <p class="status">
                  <span class="status-dot" [class]="person.tone" aria-hidden="true"></span>
                  {{ person.statusLabel }}
                </p>

                <p class="note">{{ person.note || 'No note yet.' }}</p>

                @if (!person.locationVisible) {
                  <p class="meta">Location hidden</p>
                }
              </div>
              @if (person.canOpenMap) {
                <span class="map-affordance" aria-hidden="true">›</span>
              }
            </article>
          }
        </section>
      }
    </main>
  `,
  styles: `
    .page {
      width: min(100%, 820px);
      min-height: 100svh;
      margin: 0 auto;
      padding: 26px 0 22px;
      border-right: 1px solid var(--color-border);
      border-left: 1px solid var(--color-border);
      background: var(--color-bg);
    }

    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      margin-bottom: 8px;
      padding: 0 18px 20px;
      border-bottom: 1px solid var(--color-border);
    }

    header p {
      margin: 5px 0 0;
      color: var(--color-muted);
      font-size: 15px;
      font-weight: 500;
    }

    h1 {
      margin: 0;
      color: var(--color-text);
      font-family: var(--font-display);
      font-size: 40px;
      font-stretch: condensed;
      font-weight: 950;
      letter-spacing: -0.055em;
      line-height: 0.95;
      text-transform: uppercase;
    }

    .summary {
      flex: 0 0 auto;
      padding: 0;
      color: var(--color-muted);
      font-size: 13px;
      font-weight: 700;
      white-space: nowrap;
    }

    .list {
      background: var(--color-surface);
    }

    .person {
      display: grid;
      grid-template-columns: 50px minmax(0, 1fr) auto;
      gap: 14px;
      min-height: 112px;
      padding: 18px;
      border-bottom: 1px solid var(--color-border);
      background: var(--color-surface);
    }

    .person.stale {
      background: #faf7f2;
    }

    .person.offline {
      opacity: 0.72;
    }

    .person.map-link {
      cursor: pointer;
    }

    .person.map-link:focus-visible {
      outline: 3px solid rgba(47, 128, 237, 0.3);
      outline-offset: 2px;
    }

    .map-affordance {
      align-self: center;
      color: var(--color-map-blue);
      font-size: 28px;
      font-weight: 500;
      line-height: 1;
    }

    .you-label {
      color: var(--color-map-blue);
      font-size: 11px;
    }

    .avatar {
      width: 52px;
      height: 52px;
      display: grid;
      place-items: center;
      border: 3px solid var(--color-map-blue);
      border-radius: 999px;
      background: var(--color-surface);
      color: var(--color-text);
      font-size: 14px;
      font-weight: 900;
    }

    .avatar.green {
      border-color: var(--color-green);
    }

    .avatar.blue {
      border-color: var(--color-map-blue);
    }

    .avatar.gold {
      border-color: var(--color-gold);
    }

    .avatar.orange,
    .avatar.red {
      border-color: var(--color-orange);
    }

    .avatar.gray {
      border-color: var(--color-muted);
    }

    .status-dot.green {
      background: var(--color-green);
    }

    .status-dot.blue {
      background: var(--color-map-blue);
    }

    .status-dot.gold {
      background: var(--color-gold);
    }

    .status-dot.orange,
    .status-dot.red {
      background: var(--color-orange);
    }

    .status-dot.gray {
      background: var(--color-muted);
    }

    .person-body {
      min-width: 0;
    }

    .row {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 10px;
    }

    strong {
      min-width: 0;
      overflow-wrap: anywhere;
      color: var(--color-text);
      font-size: 17px;
      line-height: 1.2;
    }

    time {
      flex: 0 0 auto;
      color: var(--color-muted);
      font-size: 12px;
      font-weight: 800;
    }

    p {
      margin: 4px 0 0;
      color: var(--color-muted);
      font-size: 14px;
      line-height: 1.35;
    }

    .status {
      display: flex;
      align-items: center;
      gap: 7px;
      color: var(--color-text);
      font-weight: 850;
    }

    .status-dot {
      width: 9px;
      height: 9px;
      flex: 0 0 auto;
      border-radius: 999px;
    }

    .note {
      overflow-wrap: anywhere;
    }

    .meta {
      color: var(--color-muted);
      font-size: 12px;
      font-weight: 750;
    }

    .state {
      min-height: 280px;
      display: grid;
      place-items: center;
      align-content: center;
      gap: 10px;
      padding: 28px;
      border-bottom: 1px solid var(--color-border);
      background: var(--color-surface);
      color: var(--color-text);
      text-align: center;
    }

    .state strong {
      font-size: 18px;
    }

    .state p {
      max-width: 22rem;
      margin: 0;
    }

    .state button {
      min-height: 42px;
      padding: 0 14px;
      border: 0;
      border-radius: 6px;
      background: var(--color-gencon-red);
      color: white;
      font-size: 14px;
      font-weight: 850;
    }

    .state-icon {
      width: 36px;
      height: 36px;
      border: 4px solid rgba(47, 128, 237, 0.2);
      border-top-color: var(--color-map-blue);
      border-radius: 999px;
      animation: spin 900ms linear infinite;
    }

    .state.error {
      border-color: rgba(214, 56, 47, 0.28);
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
export class PeoplePage {
  private readonly authSession = inject(AuthSession);
  private readonly memberProfile = inject(MemberProfile);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private peopleUnsubscribe: (() => void) | null = null;
  private isDestroyed = false;

  readonly members = signal<Member[]>([]);
  readonly now = signal(new Date());
  readonly isLoading = signal(true);
  readonly loadError = signal(false);
  readonly people = computed(() => {
    const now = this.now();

    return this.members()
      .map((member) => toPersonListItem(member, now, this.authSession.user()?.uid ?? ''))
      .sort((first, second) => {
        if (first.isOffline !== second.isOffline) {
          return first.isOffline ? 1 : -1;
        }

        return (
          second.sortTime - first.sortTime || first.displayName.localeCompare(second.displayName)
        );
      });
  });
  readonly summaryLabel = computed(() => {
    return peopleSummaryLabel(this.people());
  });
  readonly errorMessage = computed(() =>
    this.loadError()
      ? 'Couldn’t load the crew. Check your connection and try again.'
      : '',
  );

  constructor() {
    const interval = window.setInterval(() => this.now.set(new Date()), minuteMs);

    this.destroyRef.onDestroy(() => {
      this.isDestroyed = true;
      window.clearInterval(interval);
      this.peopleUnsubscribe?.();
      this.peopleUnsubscribe = null;
    });

    void this.startMembersStream();
  }

  reloadPeople(): void {
    void this.startMembersStream();
  }

  openPersonOnMap(person: PersonListItem): void {
    if (person.canOpenMap) {
      void this.router.navigate(['/app/map'], {
        queryParams: { member: person.id, map: person.mapId },
      });
    }
  }

  private async startMembersStream(): Promise<void> {
    this.peopleUnsubscribe?.();
    this.peopleUnsubscribe = null;
    this.isLoading.set(true);
    this.loadError.set(false);

    try {
      const unsubscribe = await this.memberProfile.watchMembers(
        (members) => {
          if (this.isDestroyed) {
            return;
          }

          this.members.set(members);
          this.isLoading.set(false);
          this.loadError.set(false);
        },
        () => {
          if (this.isDestroyed) {
            return;
          }

          this.isLoading.set(false);
          this.loadError.set(true);
        },
      );

      if (this.isDestroyed) {
        unsubscribe();
        return;
      }

      this.peopleUnsubscribe = unsubscribe;
    } catch {
      if (!this.isDestroyed) {
        this.isLoading.set(false);
        this.loadError.set(true);
      }
    }
  }
}

function toPersonListItem(member: Member, now: Date, currentUid: string): PersonListItem {
  const updatedAt = validDate(member.lastUpdatedAt) ? member.lastUpdatedAt : member.joinedAt;
  const diffMs = Math.max(0, now.getTime() - updatedAt.getTime());
  const isOffline = member.status === 'offline';

  return {
    id: member.id,
    mapId: member.mapId,
    displayName: member.displayName || 'Unnamed member',
    initials: initialsFor(member.displayName),
    status: member.status,
    statusLabel: statusLabel(member.status),
    note: member.note,
    freshnessLabel: freshnessLabel(updatedAt, now),
    updatedAtIso: updatedAt.toISOString(),
    locationVisible: member.locationVisible,
    canOpenMap:
      member.locationVisible &&
      member.mapId !== null &&
      member.mapXPercent !== null &&
      member.mapYPercent !== null,
    isCurrent: member.id === currentUid,
    tone: toneForStatus(member.status),
    isOffline,
    isStale: !isOffline && diffMs >= staleAfterMs,
    sortTime: updatedAt.getTime(),
  };
}

function initialsFor(displayName: string): string {
  const initials = displayName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return initials || '?';
}

function freshnessLabel(updatedAt: Date, now: Date): string {
  const diffMs = Math.max(0, now.getTime() - updatedAt.getTime());

  if (diffMs < minuteMs) {
    return 'Just now';
  }

  if (diffMs < hourMs) {
    return `${Math.floor(diffMs / minuteMs)}m ago`;
  }

  if (diffMs < dayMs) {
    return `${Math.floor(diffMs / hourMs)}h ago`;
  }

  return updatedAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function toneForStatus(status: MemberStatus): string {
  return STATUS_OPTIONS.find((option) => option.value === status)?.tone ?? 'gray';
}

function validDate(value: Date): boolean {
  return value instanceof Date && Number.isFinite(value.getTime());
}

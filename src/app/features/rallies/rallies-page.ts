import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthSession } from '../../core/auth/auth-session';
import type {
  RallyPoint,
  RallyResponse,
  RallyResponseStatus,
} from '../../core/models/rally-point';
import { RallyPointError, RallyPoints } from '../../core/rallies/rally-points';

interface RallyListItem {
  id: string;
  title: string;
  note: string;
  creatorName: string;
  scheduledLabel: string;
  coordinateLabel: string;
  responseCounts: RallyResponseCounts;
  currentResponse: RallyResponseStatus | null;
  currentResponseLabel: string;
}

interface RallyResponseCounts {
  headingThere: number;
  arrived: number;
  cannotMakeIt: number;
}

const rallyResponseOptions: ReadonlyArray<{ value: RallyResponseStatus; label: string }> = [
  { value: 'heading-there', label: 'Heading there' },
  { value: 'arrived', label: 'Arrived' },
  { value: 'cannot-make-it', label: 'Cannot make it' },
];

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

                <section class="responses" [attr.aria-label]="'Response options for ' + rally.title">
                  <h3>How are you getting there?</h3>
                  <div class="response-actions">
                    @for (response of rallyResponseOptions; track response.value) {
                      <button
                        type="button"
                        [class.selected]="rally.currentResponse === response.value"
                        [attr.aria-pressed]="rally.currentResponse === response.value"
                        [attr.aria-label]="response.label + ' for ' + rally.title"
                        [disabled]="responseSavingRallyId() === rally.id"
                        (click)="saveResponse(rally.id, response.value)"
                      >
                        {{ response.label }}
                      </button>
                    }
                  </div>
                  <p class="response-counts" aria-live="polite">
                    <span>{{ rally.responseCounts.headingThere }} heading there</span>
                    <span>{{ rally.responseCounts.arrived }} arrived</span>
                    <span>{{ rally.responseCounts.cannotMakeIt }} cannot make it</span>
                  </p>
                  @if (rally.currentResponse) {
                    <p class="current-response">Your response: {{ rally.currentResponseLabel }}</p>
                  }
                  @if (responseNotice(); as notice) {
                    @if (notice.rallyId === rally.id) {
                      <p class="response-notice" [class.error]="notice.isError" role="status">
                        {{ notice.message }}
                      </p>
                    }
                  }
                </section>
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

    .responses {
      display: grid;
      gap: 10px;
      margin-top: 18px;
      padding-top: 16px;
      border-top: 1px solid var(--color-border);
    }

    h3 {
      margin: 0;
      color: var(--color-text);
      font-size: 14px;
      line-height: 1.25;
    }

    .response-actions {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 7px;
    }

    .response-actions button {
      min-height: 44px;
      padding: 8px 6px;
      border: 1px solid var(--color-border);
      border-radius: 8px;
      background: var(--color-surface);
      color: var(--color-text);
      font: inherit;
      font-size: 12px;
      font-weight: 850;
      line-height: 1.15;
    }

    .response-actions button.selected {
      border-color: var(--color-gencon-red);
      background: var(--color-gencon-red);
      color: white;
    }

    .response-actions button:disabled {
      cursor: wait;
      opacity: 0.62;
    }

    .response-counts {
      display: flex;
      flex-wrap: wrap;
      gap: 5px 12px;
      font-size: 12px !important;
      font-weight: 800;
    }

    .response-counts span::first-letter {
      text-transform: uppercase;
    }

    .current-response,
    .response-notice {
      margin-top: 0 !important;
      color: var(--color-text) !important;
      font-size: 13px !important;
      font-weight: 800;
    }

    .response-notice.error {
      color: var(--color-gencon-red) !important;
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
  private readonly authSession = inject(AuthSession);
  private readonly rallyPoints = inject(RallyPoints);
  private readonly destroyRef = inject(DestroyRef);
  private rallyPointsUnsubscribe: (() => void) | null = null;
  private readonly rallyResponseUnsubscribes = new Map<string, () => void>();
  private subscriptionVersion = 0;
  private isDestroyed = false;

  readonly isLoading = signal(true);
  readonly loadError = signal('');
  readonly rallyResponseOptions = rallyResponseOptions;
  readonly rallyPointData = signal<RallyPoint[]>([]);
  readonly rallyResponses = signal<RallyResponse[]>([]);
  readonly responseSavingRallyId = signal<string | null>(null);
  readonly responseNotice = signal<{ rallyId: string; message: string; isError: boolean } | null>(null);
  readonly rallyItems = computed(() =>
    this.rallyPointData().map((rallyPoint) =>
      toRallyListItem(rallyPoint, this.rallyResponses(), this.authSession.user()?.uid ?? ''),
    ),
  );

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.isDestroyed = true;
      this.stopSubscriptions();
    });

    void this.reloadRallies();
  }

  async reloadRallies(): Promise<void> {
    this.stopSubscriptions();
    const version = ++this.subscriptionVersion;
    let rallyPointsLoaded = false;
    const responseRallyIdsLoaded = new Set<string>();
    this.isLoading.set(true);
    this.loadError.set('');

    try {
      const rallyPointsUnsubscribe = await this.rallyPoints.watchRallyPoints(
        (rallyPoints) => {
          if (this.isDestroyed || version !== this.subscriptionVersion) {
            return;
          }

          this.rallyPointData.set(rallyPoints);
          rallyPointsLoaded = true;
          void this.syncResponseSubscriptions(rallyPoints, responseRallyIdsLoaded, version);
          this.finishInitialLoad(
            rallyPointsLoaded &&
              rallyPoints.every((rallyPoint) => responseRallyIdsLoaded.has(rallyPoint.id)),
          );
        },
        (error) => this.handleLoadError(error, version),
      );

      if (this.isDestroyed || version !== this.subscriptionVersion) {
        rallyPointsUnsubscribe();
        return;
      }

      this.rallyPointsUnsubscribe = rallyPointsUnsubscribe;
    } catch (error) {
      this.handleLoadError(error, version);
    }
  }

  async saveResponse(rallyPointId: string, responseStatus: RallyResponseStatus): Promise<void> {
    if (this.responseSavingRallyId()) {
      return;
    }

    this.responseSavingRallyId.set(rallyPointId);
    this.responseNotice.set(null);

    try {
      await this.rallyPoints.saveResponse(rallyPointId, responseStatus);
      this.responseNotice.set({ rallyId: rallyPointId, message: 'Response saved.', isError: false });
    } catch (error) {
      this.responseNotice.set({
        rallyId: rallyPointId,
        message: messageForResponseError(error),
        isError: true,
      });
    } finally {
      this.responseSavingRallyId.set(null);
    }
  }

  private stopSubscriptions(): void {
    this.rallyPointsUnsubscribe?.();
    this.rallyPointsUnsubscribe = null;
    this.rallyResponseUnsubscribes.forEach((unsubscribe) => unsubscribe());
    this.rallyResponseUnsubscribes.clear();
    this.rallyResponses.set([]);
  }

  private async syncResponseSubscriptions(
    rallyPoints: RallyPoint[],
    responseRallyIdsLoaded: Set<string>,
    version: number,
  ): Promise<void> {
    const activeRallyIds = new Set(rallyPoints.map((rallyPoint) => rallyPoint.id));

    for (const [rallyPointId, unsubscribe] of this.rallyResponseUnsubscribes) {
      if (!activeRallyIds.has(rallyPointId)) {
        unsubscribe();
        this.rallyResponseUnsubscribes.delete(rallyPointId);
        responseRallyIdsLoaded.delete(rallyPointId);
      }
    }

    this.rallyResponses.update((responses) =>
      responses.filter((response) => activeRallyIds.has(response.rallyPointId)),
    );

    for (const rallyPoint of rallyPoints) {
      if (this.rallyResponseUnsubscribes.has(rallyPoint.id)) {
        continue;
      }

      try {
        const unsubscribe = await this.rallyPoints.watchRallyResponses(
          rallyPoint.id,
          (responses) => {
            if (this.isDestroyed || version !== this.subscriptionVersion) {
              return;
            }

            this.rallyResponses.update((currentResponses) => [
              ...currentResponses.filter((response) => response.rallyPointId !== rallyPoint.id),
              ...responses,
            ]);
            responseRallyIdsLoaded.add(rallyPoint.id);
            this.finishInitialLoad(
              this.rallyPointData().every((activeRally) =>
                responseRallyIdsLoaded.has(activeRally.id),
              ),
            );
          },
          (error) => this.handleLoadError(error, version),
        );

        if (this.isDestroyed || version !== this.subscriptionVersion) {
          unsubscribe();
          return;
        }

        this.rallyResponseUnsubscribes.set(rallyPoint.id, unsubscribe);
      } catch (error) {
        this.handleLoadError(error, version);
      }
    }
  }

  private finishInitialLoad(isLoaded: boolean): void {
    if (isLoaded) {
      this.isLoading.set(false);
      this.loadError.set('');
    }
  }

  private handleLoadError(error: unknown, version: number): void {
    if (this.isDestroyed || version !== this.subscriptionVersion) {
      return;
    }

    this.isLoading.set(false);
    this.loadError.set(messageForRallyError(error));
  }
}

function toRallyListItem(
  rallyPoint: RallyPoint,
  responses: RallyResponse[],
  currentMemberId: string,
): RallyListItem {
  const responseCounts: RallyResponseCounts = { headingThere: 0, arrived: 0, cannotMakeIt: 0 };
  let currentResponse: RallyResponseStatus | null = null;

  for (const response of responses) {
    if (response.rallyPointId !== rallyPoint.id) {
      continue;
    }

    if (response.responseStatus === 'heading-there') {
      responseCounts.headingThere += 1;
    } else if (response.responseStatus === 'arrived') {
      responseCounts.arrived += 1;
    } else {
      responseCounts.cannotMakeIt += 1;
    }

    if (response.memberId === currentMemberId) {
      currentResponse = response.responseStatus;
    }
  }

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
    responseCounts,
    currentResponse,
    currentResponseLabel: currentResponse ? responseLabel(currentResponse) : '',
  };
}

function messageForRallyError(error: unknown): string {
  if (error instanceof RallyPointError && error.code === 'not-authorized') {
    return 'Your session is not authorized. Sign in again before viewing rally points.';
  }

  return 'Could not load rally points. Check your connection and try again.';
}

function messageForResponseError(error: unknown): string {
  if (error instanceof RallyPointError && error.code === 'not-authorized') {
    return 'Your session is not authorized. Sign in again before responding.';
  }

  return 'Could not save your response. Check your connection and try again.';
}

function responseLabel(responseStatus: RallyResponseStatus): string {
  return rallyResponseOptions.find((option) => option.value === responseStatus)?.label ?? '';
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

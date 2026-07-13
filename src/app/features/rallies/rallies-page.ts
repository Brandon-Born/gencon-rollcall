import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthSession } from '../../core/auth/auth-session';
import { MemberProfile } from '../../core/members/member-profile';
import type { Member } from '../../core/models/member';
import type { RallyPoint, RallyResponse, RallyResponseStatus } from '../../core/models/rally-point';
import {
  isRallyPointMeetingNow,
  RallyPointError,
  RallyPoints,
} from '../../core/rallies/rally-points';
import { START_RALLY_QUERY_PARAMS } from './rally-navigation';

interface RallyListItem {
  id: string;
  mapId: string | null;
  title: string;
  note: string;
  creatorName: string;
  scheduledLabel: string;
  responseCounts: RallyResponseCounts;
  responseNames: RallyResponseNames;
  currentResponse: RallyResponseStatus | null;
  currentResponseLabel: string;
  canExpire: boolean;
}

interface RallyResponseCounts {
  headingThere: number;
  arrived: number;
  cannotMakeIt: number;
}

interface RallyResponseNames {
  headingThere: string[];
  arrived: string[];
  cannotMakeIt: string[];
}

const rallyResponseOptions: ReadonlyArray<{ value: RallyResponseStatus; label: string }> = [
  { value: 'heading-there', label: 'Heading there' },
  { value: 'arrived', label: 'Arrived' },
  { value: 'cannot-make-it', label: 'Can’t make it' },
];

@Component({
  selector: 'app-rallies-page',
  imports: [RouterLink],
  template: `
    <main class="page">
      <header>
        <div>
          <h1>Rallies</h1>
          <p>Pick a place. See who’s in.</p>
        </div>
        <a routerLink="/app/map">Map</a>
      </header>

      @if (expirationNotice(); as notice) {
        <p class="page-notice" [class.error]="notice.isError" role="status">{{ notice.message }}</p>
      }

      @if (isLoading()) {
        <section class="state" aria-live="polite">
          <span class="state-icon" aria-hidden="true"></span>
          <strong>Loading rallies</strong>
          <p>Checking the meetup spots.</p>
        </section>
      } @else if (loadError()) {
        <section class="state error" role="alert">
          <strong>Rally points unavailable</strong>
          <p>{{ loadError() }}</p>
          <button type="button" (click)="reloadRallies()">Try again</button>
        </section>
      } @else if (!rallyItems().length) {
        <section class="state">
          <span class="empty-marker" aria-hidden="true">+</span>
          <strong>No rallies yet</strong>
          <p>Pick a spot on the map and invite the crew.</p>
          <a routerLink="/app/map" [queryParams]="startRallyQueryParams">Start a rally</a>
        </section>
      } @else {
        <section class="list" aria-label="Active rally points">
          @for (rally of rallyItems(); track rally.id) {
            <article class="rally">
              <span class="marker" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M6 21V3M7 4h10l-2 3 2 3H7" /></svg>
              </span>
              <div>
                <h2>{{ rally.title }}</h2>
                <p class="meta">{{ rally.scheduledLabel }} · {{ rally.creatorName }}</p>
                <p>{{ rally.note || 'No note added.' }}</p>
                <div class="rally-actions">
                  <a
                    class="coordinate"
                    routerLink="/app/map"
                    [queryParams]="{ rally: rally.id, map: rally.mapId }"
                  >
                    View on map
                  </a>

                  @if (rally.canExpire) {
                    @if (confirmingRallyId() === rally.id) {
                      <section
                        class="end-confirmation"
                        role="alertdialog"
                        [attr.aria-labelledby]="'end-rally-title-' + rally.id"
                      >
                        <strong [id]="'end-rally-title-' + rally.id">End this rally?</strong>
                        <p>This removes it from the active map and rally list for everyone.</p>
                        <div class="end-confirmation-actions">
                          <button
                            type="button"
                            class="cancel-end-action"
                            [disabled]="expiringRallyId() === rally.id"
                            (click)="cancelEndRally()"
                          >
                            Keep rally
                          </button>
                          <button
                            type="button"
                            class="expire-action"
                            [disabled]="expiringRallyId() === rally.id"
                            (click)="expireRally(rally.id)"
                          >
                            {{
                              expiringRallyId() === rally.id
                                ? 'Ending rally...'
                                : 'End for everyone'
                            }}
                          </button>
                        </div>
                      </section>
                    } @else {
                      <button
                        type="button"
                        class="expire-action"
                        [disabled]="expiringRallyId() === rally.id"
                        (click)="requestEndRally(rally.id)"
                      >
                        End rally
                      </button>
                    }
                  }
                </div>

                <section
                  class="responses"
                  [attr.aria-label]="'Response options for ' + rally.title"
                >
                  <h3>Are you going?</h3>
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
                    <span>{{ rally.responseCounts.cannotMakeIt }} can’t make it</span>
                  </p>
                  @if (rally.responseNames.headingThere.length) {
                    <p class="response-names">
                      <strong>Heading:</strong> {{ rally.responseNames.headingThere.join(', ') }}
                    </p>
                  }
                  @if (rally.responseNames.arrived.length) {
                    <p class="response-names">
                      <strong>Arrived:</strong> {{ rally.responseNames.arrived.join(', ') }}
                    </p>
                  }
                  @if (rally.responseNames.cannotMakeIt.length) {
                    <p class="response-names">
                      <strong>Can't:</strong> {{ rally.responseNames.cannotMakeIt.join(', ') }}
                    </p>
                  }
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
      gap: 16px;
      margin-bottom: 8px;
      padding: 0 18px 20px;
      border-bottom: 1px solid var(--color-border);
    }

    h1,
    h2,
    p {
      margin: 0;
    }

    h1 {
      color: var(--color-text);
      font-family: var(--font-display);
      font-size: 40px;
      font-stretch: condensed;
      font-weight: 950;
      letter-spacing: -0.055em;
      line-height: 0.95;
      text-transform: uppercase;
    }

    header p,
    .meta,
    .rally p,
    .state p {
      color: var(--color-muted);
    }

    header p {
      margin-top: 5px;
      font-size: 15px;
    }

    header a,
    .state a,
    .state button {
      min-height: 42px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0 4px;
      border: 0;
      background: transparent;
      color: var(--color-gencon-red);
      font-size: 14px;
      font-weight: 900;
      text-decoration: none;
    }

    .list {
      background: var(--color-surface);
    }

    .rally {
      display: grid;
      grid-template-columns: 58px minmax(0, 1fr);
      gap: 14px;
      padding: 20px 18px;
      border-bottom: 1px solid var(--color-border);
      background: var(--color-surface);
    }

    .marker {
      width: 50px;
      height: 50px;
      display: grid;
      place-items: center;
      border: 2px solid var(--color-gencon-red);
      border-radius: 999px;
      background: var(--color-surface);
      color: var(--color-gencon-red);
    }

    .marker svg {
      width: 26px;
      height: 26px;
      fill: none;
      stroke: currentColor;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-width: 1.8;
    }

    h2 {
      overflow-wrap: anywhere;
      color: var(--color-text);
      font-size: 20px;
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
      display: inline-block;
      color: var(--color-map-blue);
      font-size: 14px;
      font-weight: 800;
      text-decoration: none;
    }

    .rally-actions {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px 12px;
      margin-top: 9px;
    }

    .page-notice {
      margin: 0;
      padding: 12px 18px;
      color: var(--color-green);
      font-size: 14px;
      font-weight: 800;
    }

    .page-notice.error {
      color: var(--color-gencon-red);
    }

    .expire-action {
      min-height: 40px;
      margin: 0;
      padding: 0 14px;
      border: 1px solid rgba(214, 56, 47, 0.34);
      border-radius: 8px;
      background: var(--color-surface);
      color: var(--color-gencon-red);
      font: inherit;
      font-size: 13px;
      font-weight: 850;
    }

    .expire-action:disabled {
      cursor: wait;
      opacity: 0.62;
    }

    .end-confirmation {
      flex: 1 0 100%;
      display: grid;
      gap: 9px;
      margin-top: 4px;
      padding: 12px;
      border: 1px solid rgba(214, 56, 47, 0.28);
      border-radius: 10px;
      background: rgba(214, 56, 47, 0.05);
    }

    .end-confirmation strong {
      color: var(--color-text);
      font-size: 14px;
    }

    .end-confirmation p {
      margin-top: 0 !important;
      font-size: 13px !important;
    }

    .end-confirmation-actions {
      display: grid;
      grid-template-columns: 1fr 1.35fr;
      gap: 8px;
    }

    .end-confirmation-actions button {
      min-height: 40px;
      margin: 0;
      padding: 0 10px;
      border-radius: 8px;
      font: inherit;
      font-size: 12px;
      font-weight: 850;
    }

    .cancel-end-action {
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      color: var(--color-text);
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

    .response-names {
      margin-top: 0 !important;
      overflow-wrap: anywhere;
      font-size: 13px !important;
    }

    .response-names strong {
      color: var(--color-text);
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
      min-height: 360px;
      display: grid;
      justify-items: center;
      gap: 10px;
      padding: 44px 20px;
      border-bottom: 1px solid var(--color-border);
      background: var(--color-surface);
      text-align: center;
    }

    .state strong {
      color: var(--color-text);
      font-size: 18px;
      line-height: 1.2;
    }

    .state a,
    .state button {
      min-width: 132px;
      padding: 0 16px;
      border-radius: 6px;
      background: var(--color-gencon-red);
      color: white;
    }

    .empty-marker {
      width: 64px;
      height: 64px;
      display: grid;
      place-items: center;
      border: 2px dashed var(--color-gencon-red);
      border-radius: 999px;
      color: var(--color-gencon-red);
      font-size: 34px;
      font-weight: 350;
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
  readonly startRallyQueryParams = START_RALLY_QUERY_PARAMS;
  private readonly authSession = inject(AuthSession);
  private readonly memberProfile = inject(MemberProfile);
  private readonly rallyPoints = inject(RallyPoints);
  private readonly destroyRef = inject(DestroyRef);
  private rallyPointsUnsubscribe: (() => void) | null = null;
  private membersUnsubscribe: (() => void) | null = null;
  private readonly rallyResponseUnsubscribes = new Map<string, () => void>();
  private subscriptionVersion = 0;
  private isDestroyed = false;

  readonly isLoading = signal(true);
  readonly loadError = signal('');
  readonly rallyResponseOptions = rallyResponseOptions;
  readonly rallyPointData = signal<RallyPoint[]>([]);
  readonly members = signal<Member[]>([]);
  readonly rallyResponses = signal<RallyResponse[]>([]);
  readonly responseSavingRallyId = signal<string | null>(null);
  readonly responseNotice = signal<{ rallyId: string; message: string; isError: boolean } | null>(
    null,
  );
  readonly expiringRallyId = signal<string | null>(null);
  readonly confirmingRallyId = signal<string | null>(null);
  readonly expirationNotice = signal<{ message: string; isError: boolean } | null>(null);
  readonly rallyItems = computed(() =>
    this.rallyPointData().map((rallyPoint) =>
      toRallyListItem(
        rallyPoint,
        this.rallyResponses(),
        this.members(),
        this.authSession.user()?.uid ?? '',
      ),
    ),
  );

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.isDestroyed = true;
      this.membersUnsubscribe?.();
      this.membersUnsubscribe = null;
      this.stopSubscriptions();
    });

    void this.reloadRallies();
    void this.startMembersStream();
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
      const rallyPoint = this.rallyPointData().find((rally) => rally.id === rallyPointId);

      if (!rallyPoint) {
        throw new RallyPointError('rally-location-invalid');
      }

      await this.rallyPoints.saveResponse(rallyPoint, responseStatus);
      this.responseNotice.set({
        rallyId: rallyPointId,
        message:
          responseStatus === 'arrived'
            ? 'Arrived. Your pin moved to the rally point.'
            : 'Response saved.',
        isError: false,
      });
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

  async expireRally(rallyPointId: string): Promise<void> {
    if (this.expiringRallyId()) {
      return;
    }

    this.expiringRallyId.set(rallyPointId);
    this.expirationNotice.set(null);

    try {
      await this.rallyPoints.expireRallyPoint(rallyPointId);
      this.confirmingRallyId.set(null);
      this.expirationNotice.set({
        message: 'Rally ended. It remains in history but no longer appears as active.',
        isError: false,
      });
    } catch (error) {
      this.expirationNotice.set({ message: messageForExpirationError(error), isError: true });
    } finally {
      this.expiringRallyId.set(null);
    }
  }

  requestEndRally(rallyPointId: string): void {
    if (!this.expiringRallyId()) {
      this.confirmingRallyId.set(rallyPointId);
    }
  }

  cancelEndRally(): void {
    if (!this.expiringRallyId()) {
      this.confirmingRallyId.set(null);
    }
  }

  private stopSubscriptions(): void {
    this.rallyPointsUnsubscribe?.();
    this.rallyPointsUnsubscribe = null;
    this.rallyResponseUnsubscribes.forEach((unsubscribe) => unsubscribe());
    this.rallyResponseUnsubscribes.clear();
    this.rallyResponses.set([]);
  }

  private async startMembersStream(): Promise<void> {
    try {
      const unsubscribe = await this.memberProfile.watchMembers(
        (members) => {
          if (!this.isDestroyed) {
            this.members.set(members);
          }
        },
        () => {
          if (!this.isDestroyed) {
            this.loadError.set('Could not load member names. Check your connection and try again.');
            this.isLoading.set(false);
          }
        },
      );

      if (this.isDestroyed) {
        unsubscribe();
      } else {
        this.membersUnsubscribe = unsubscribe;
      }
    } catch {
      if (!this.isDestroyed) {
        this.loadError.set('Could not load member names. Check your connection and try again.');
        this.isLoading.set(false);
      }
    }
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
  members: Member[],
  currentMemberId: string,
): RallyListItem {
  const responseCounts: RallyResponseCounts = { headingThere: 0, arrived: 0, cannotMakeIt: 0 };
  const responseNames: RallyResponseNames = {
    headingThere: [],
    arrived: [],
    cannotMakeIt: [],
  };
  const memberNames = new Map(members.map((member) => [member.id, member.displayName]));
  let currentResponse: RallyResponseStatus | null = null;

  for (const response of responses) {
    if (response.rallyPointId !== rallyPoint.id) {
      continue;
    }

    if (response.responseStatus === 'heading-there') {
      responseCounts.headingThere += 1;
      responseNames.headingThere.push(memberNames.get(response.memberId) || 'Former member');
    } else if (response.responseStatus === 'arrived') {
      responseCounts.arrived += 1;
      responseNames.arrived.push(memberNames.get(response.memberId) || 'Former member');
    } else {
      responseCounts.cannotMakeIt += 1;
      responseNames.cannotMakeIt.push(memberNames.get(response.memberId) || 'Former member');
    }

    if (response.memberId === currentMemberId) {
      currentResponse = response.responseStatus;
    }
  }

  responseNames.headingThere.sort((a, b) => a.localeCompare(b));
  responseNames.arrived.sort((a, b) => a.localeCompare(b));
  responseNames.cannotMakeIt.sort((a, b) => a.localeCompare(b));

  return {
    id: rallyPoint.id,
    mapId: rallyPoint.mapId,
    title: rallyPoint.title,
    note: rallyPoint.note,
    creatorName: rallyPoint.createdByName,
    scheduledLabel: isRallyPointMeetingNow(rallyPoint)
      ? 'Meeting now'
      : rallyPoint.scheduledTime
        ? scheduledLabel(rallyPoint.scheduledTime)
        : 'No time set',
    responseCounts,
    responseNames,
    currentResponse,
    currentResponseLabel: currentResponse ? responseLabel(currentResponse) : '',
    canExpire: rallyPoint.createdByMemberId === currentMemberId,
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

function messageForExpirationError(error: unknown): string {
  if (error instanceof RallyPointError && error.code === 'not-authorized') {
    return 'Your session is not authorized. Sign in again before ending this rally.';
  }

  return 'Could not end this rally. Only its creator can end it, so check your connection and try again.';
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

import {
  Component,
  DestroyRef,
  ElementRef,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { AppConfigService, type AppConfigLoadError } from '../../core/app-config/app-config';
import { AuthSession } from '../../core/auth/auth-session';
import { MemberProfile, MemberProfileError } from '../../core/members/member-profile';
import type { Member } from '../../core/models/member';
import type { RallyPoint, RallyResponse, RallyResponseStatus } from '../../core/models/rally-point';
import {
  isRallyPointMeetingNow,
  RallyPointError,
  RallyPoints,
} from '../../core/rallies/rally-points';
import { MemberStatus, STATUS_OPTIONS, statusLabel } from '../../shared/status/status-options';

interface MapPin {
  id: string;
  initials: string;
  name: string;
  xPercent: number;
  yPercent: number;
  renderX: number;
  renderY: number;
  status: MemberStatus;
  statusLabel: string;
  note: string;
  freshnessLabel: string;
  updatedAtIso: string;
  isCurrentMember: boolean;
}

interface MapRallyMarker {
  id: string;
  title: string;
  note: string;
  creatorName: string;
  xPercent: number;
  yPercent: number;
  renderX: number;
  renderY: number;
  scheduledLabel: string;
  scheduledIso: string | null;
  responseCounts: MapRallyResponseCounts;
  responseNames: MapRallyResponseNames;
  currentResponse: RallyResponseStatus | null;
}

interface MapRallyResponseCounts {
  headingThere: number;
  arrived: number;
  cannotMakeIt: number;
}

interface MapRallyResponseNames {
  headingThere: string[];
  arrived: string[];
  cannotMakeIt: string[];
}

interface MapPoint {
  x: number;
  y: number;
}

interface PreviousPinState {
  x: number | null;
  y: number | null;
  locationVisible: boolean;
}

interface MapGestureStart {
  distance: number;
  midpoint: MapPoint;
  scale: number;
  translateX: number;
  translateY: number;
}

interface MapView {
  scale: number;
  translateX: number;
  translateY: number;
}

interface MapImageBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface MapTapCandidate {
  pointerId: number;
  start: MapPoint;
  latest: MapPoint;
  maxDistance: number;
  hadMultiplePointers: boolean;
}

const MIN_MAP_SCALE = 1;
const MAX_MAP_SCALE = 4;
const TAP_MOVE_TOLERANCE_PX = 8;
const minuteMs = 60 * 1000;
const hourMs = 60 * minuteMs;
const dayMs = 24 * hourMs;
const rallyResponseOptions: ReadonlyArray<{ value: RallyResponseStatus; label: string }> = [
  { value: 'heading-there', label: 'Heading there' },
  { value: 'arrived', label: 'Arrived' },
  { value: 'cannot-make-it', label: 'Cannot make it' },
];

@Component({
  selector: 'app-map-page',
  template: `
    <main class="map-page">
      <header>
        <div>
          <p>Gen Con Roll Call</p>
          <h1>{{ mapTitle() }}</h1>
        </div>
        <div class="header-actions">
          <button
            type="button"
            class="primary-action"
            [disabled]="isRallyDraftOpen()"
            (click)="openRallyForm()"
          >
            New rally
          </button>
          <button
            type="button"
            [disabled]="isLocationHiding() || currentMemberLocationHidden()"
            (click)="hideCurrentLocation()"
          >
            {{ locationButtonLabel() }}
          </button>
        </div>
      </header>

      <section class="map-frame" [attr.aria-label]="mapFrameLabel()">
        @if (isMapLoading()) {
          <div class="map-state">
            <span class="map-state-icon" aria-hidden="true"></span>
            <strong>Loading map</strong>
            <p>Checking the current convention map configuration.</p>
          </div>
        } @else if (mapLoadError()) {
          <div class="map-state map-state-error">
            <strong>Map unavailable</strong>
            <p>{{ mapLoadErrorMessage() }}</p>
            <button type="button" (click)="reloadMapConfig()">Try again</button>
          </div>
        } @else if (!configuredMapUrl()) {
          <div class="map-state">
            <strong>No map configured yet</strong>
            <p>
              Add a static map asset and set <code>appConfig/current</code> before placing pins.
            </p>
          </div>
        } @else if (mapImageFailed()) {
          <div class="map-state map-state-error">
            <strong>Map image did not load</strong>
            <p>
              Check that <code>{{ configuredMapUrl() }}</code> is a deployed static asset or
              reachable URL.
            </p>
            <button type="button" (click)="retryMapImage()">Retry image</button>
          </div>
        } @else {
          <div
            #mapViewport
            class="map-viewport"
            [class.dragging]="isMapDragging()"
            (pointerdown)="startMapPointer($event)"
            (pointermove)="moveMapPointer($event)"
            (pointerup)="endMapPointer($event)"
            (pointercancel)="endMapPointer($event)"
            (lostpointercapture)="endMapPointer($event)"
            (wheel)="zoomMapWithWheel($event)"
          >
            <div class="map-art" [style.transform]="mapTransform()">
              <img
                [src]="configuredMapUrl()"
                [alt]="mapTitle()"
                draggable="false"
                (load)="markMapImageLoaded($event)"
                (error)="markMapImageFailed()"
              />

              @for (pin of pins(); track pin.id) {
                <button
                  type="button"
                  class="pin"
                  [attr.data-status]="pin.status"
                  [class.current]="pin.isCurrentMember"
                  [class.selected]="selectedPin()?.id === pin.id"
                  [style.left.%]="pin.renderX"
                  [style.top.%]="pin.renderY"
                  [style.transform]="pinTransform()"
                  [attr.aria-label]="
                    pin.name + ', ' + pin.statusLabel + ', updated ' + pin.freshnessLabel
                  "
                  (pointerdown)="$event.stopPropagation()"
                  (click)="selectPin(pin.id)"
                >
                  {{ pin.initials }}
                </button>
              }

              @for (rally of rallyMarkers(); track rally.id) {
                <button
                  type="button"
                  class="rally-marker"
                  [class.selected]="selectedRally()?.id === rally.id"
                  [style.left.%]="rally.renderX"
                  [style.top.%]="rally.renderY"
                  [style.transform]="pinTransform()"
                  [attr.aria-label]="
                    'Rally point: ' + rally.title + ', created by ' + rally.creatorName
                  "
                  (pointerdown)="$event.stopPropagation()"
                  (click)="selectRally(rally.id)"
                >
                  RP
                </button>
              }

              @if (pendingRallyMarker(); as pendingRally) {
                <span
                  class="rally-marker pending"
                  [style.left.%]="pendingRally.renderX"
                  [style.top.%]="pendingRally.renderY"
                  [style.transform]="pinTransform()"
                  aria-hidden="true"
                >
                  +
                </span>
              }
            </div>
          </div>

          <div class="map-controls" role="group" aria-label="Map zoom controls">
            <button type="button" (click)="zoomMapBy(mapViewport, 0.8)" aria-label="Zoom out">
              −
            </button>
            <button
              type="button"
              class="map-reset"
              [disabled]="isMapViewAtRest()"
              [attr.aria-label]="mapResetAriaLabel()"
              (click)="resetMapView()"
            >
              {{ mapResetLabel() }}
            </button>
            <button type="button" (click)="zoomMapBy(mapViewport, 1.25)" aria-label="Zoom in">
              +
            </button>
          </div>

          @if (selectedPin(); as pin) {
            <aside class="pin-detail" aria-live="polite">
              <span
                class="pin-detail-avatar"
                [attr.data-status]="pin.status"
                [class.current]="pin.isCurrentMember"
                aria-hidden="true"
              >
                {{ pin.initials }}
              </span>
              <div>
                <strong>{{ pin.name }}</strong>
                <p>{{ pin.statusLabel }}</p>
                @if (pin.note) {
                  <p>{{ pin.note }}</p>
                }
                <time [attr.datetime]="pin.updatedAtIso">Updated {{ pin.freshnessLabel }}</time>
              </div>
              <button type="button" aria-label="Close pin details" (click)="clearSelectedPin()">
                ×
              </button>
            </aside>
          } @else if (selectedRally(); as rally) {
            <aside class="pin-detail rally-detail" aria-live="polite">
              <span class="rally-detail-avatar" aria-hidden="true">RP</span>
              <div>
                <strong>{{ rally.title }}</strong>
                <p>Created by {{ rally.creatorName }}</p>
                @if (rally.note) {
                  <p class="rally-note">{{ rally.note }}</p>
                }
                @if (rally.scheduledIso) {
                  <time [attr.datetime]="rally.scheduledIso">{{ rally.scheduledLabel }}</time>
                } @else {
                  <time>No time set</time>
                }
                <div class="rally-response-actions" aria-label="Are you going?">
                  @for (response of rallyResponseOptions; track response.value) {
                    <button
                      type="button"
                      [class.selected]="rally.currentResponse === response.value"
                      [attr.aria-pressed]="rally.currentResponse === response.value"
                      [disabled]="responseSavingRallyId() === rally.id"
                      (click)="saveRallyResponse(rally.id, response.value)"
                    >
                      {{ response.label }}
                    </button>
                  }
                </div>
                <p class="rally-response-summary">
                  {{ rally.responseCounts.headingThere }} heading ·
                  {{ rally.responseCounts.arrived }} arrived ·
                  {{ rally.responseCounts.cannotMakeIt }} can't
                </p>
                @if (rally.responseNames.headingThere.length) {
                  <p class="rally-response-names">
                    <strong>Heading:</strong> {{ rally.responseNames.headingThere.join(', ') }}
                  </p>
                }
                @if (rally.responseNames.arrived.length) {
                  <p class="rally-response-names">
                    <strong>Arrived:</strong> {{ rally.responseNames.arrived.join(', ') }}
                  </p>
                }
                @if (rally.responseNames.cannotMakeIt.length) {
                  <p class="rally-response-names">
                    <strong>Can't:</strong> {{ rally.responseNames.cannotMakeIt.join(', ') }}
                  </p>
                }
              </div>
              <button type="button" aria-label="Close rally details" (click)="clearSelectedRally()">
                ×
              </button>
            </aside>
          }

          <div class="map-hint" [class.error]="mapHintIsError()" role="status">
            <span>{{ mapHintMessage() }}</span>
            @if (previousPinState()) {
              <button type="button" [disabled]="isPinSaving()" (click)="undoPinMove()">Undo</button>
            }
          </div>
        }
      </section>

      @if (isRallyDraftOpen()) {
        <form class="status-sheet rally-sheet" (submit)="saveRally($event)">
          <div class="sheet-header">
            <div>
              <p>New rally point</p>
              <strong>{{ rallyDraftTitle() || 'Choose a meetup spot' }}</strong>
            </div>
            <span class="status-meta" [class.error]="rallySaveIsError()">{{
              pendingRallyPoint() ? 'Spot selected' : 'Tap map'
            }}</span>
          </div>

          <label>
            <span>Title</span>
            <input
              type="text"
              maxlength="48"
              placeholder="Food court, demo table, hotel lobby..."
              [value]="rallyTitle()"
              [disabled]="isRallySaving()"
              (input)="updateRallyTitle($any($event.target).value)"
            />
          </label>

          <label>
            <span class="note-label">
              <span>Note</span>
              <small>{{ rallyNoteLength() }}/120</small>
            </span>
            <input
              type="text"
              maxlength="120"
              placeholder="Meet near the info desk after this event."
              [value]="rallyNote()"
              [disabled]="isRallySaving()"
              (input)="updateRallyNote($any($event.target).value)"
            />
          </label>

          <label>
            <span>Optional meetup time</span>
            <input
              type="datetime-local"
              [min]="minimumRallyTimeInput()"
              [value]="rallyScheduledTimeInput()"
              [disabled]="isRallySaving()"
              (input)="updateRallyScheduledTime($any($event.target).value)"
            />
          </label>

          <p class="save-message">
            Timed rallies stay visible for one hour after the meetup. No-time rallies last four
            hours.
          </p>

          <p class="rally-coordinate">{{ rallyCoordinateLabel() }}</p>

          <div class="form-actions">
            <button
              type="button"
              class="secondary-action"
              [disabled]="isRallySaving()"
              (click)="cancelRallyForm()"
            >
              Cancel
            </button>
            <button type="submit" class="status-save" [disabled]="!canSaveRally()">
              {{ isRallySaving() ? 'Creating...' : 'Create rally' }}
            </button>
          </div>

          @if (rallySaveMessage()) {
            <p class="save-message" [class.error]="rallySaveIsError()" role="status">
              {{ rallySaveMessage() }}
            </p>
          }
        </form>
      } @else {
        <form class="status-sheet" (submit)="saveStatus($event)">
          <div class="sheet-header">
            <div>
              <p>Your status</p>
              <strong>{{ selectedStatusLabel() }}</strong>
            </div>
            <span class="status-meta" [class.error]="statusSaveIsError()">{{
              statusMetaLabel()
            }}</span>
          </div>

          <div class="status-grid" aria-label="Choose status">
            @for (status of statuses; track status.value) {
              <button
                type="button"
                [class.active]="selectedStatus() === status.value"
                [disabled]="isStatusLoading() || isStatusSaving()"
                (click)="selectStatus(status.value)"
              >
                {{ status.label }}
              </button>
            }
          </div>

          <label>
            <span class="note-label">
              <span>Note</span>
              <small>{{ noteLength() }}/80</small>
            </span>
            <input
              type="text"
              maxlength="80"
              placeholder="Booth 2110, skywalk, running late..."
              [value]="note()"
              [disabled]="isStatusLoading() || isStatusSaving()"
              (input)="updateNote($any($event.target).value)"
            />
          </label>

          <button type="submit" class="status-save" [disabled]="!canSaveStatus()">
            {{ isStatusSaving() ? 'Saving...' : 'Save update' }}
          </button>

          @if (statusSaveMessage()) {
            <p class="save-message" [class.error]="statusSaveIsError()" role="status">
              {{ statusSaveMessage() }}
            </p>
          }
        </form>
      }
    </main>
  `,
  styles: `
    .map-page {
      min-height: 100svh;
      padding: 14px 14px 18px;
      background: var(--color-bg);
    }

    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 12px;
    }

    .header-actions {
      display: flex;
      gap: 8px;
    }

    header p,
    .sheet-header p {
      margin: 0 0 3px;
      color: var(--color-muted);
      font-size: 12px;
      font-weight: 800;
    }

    h1 {
      margin: 0;
      color: var(--color-text);
      font-size: 26px;
      line-height: 1.1;
    }

    header button {
      min-height: 40px;
      padding: 0 14px;
      border: 1px solid var(--color-border);
      border-radius: 999px;
      background: var(--color-surface);
      color: var(--color-text);
      font-size: 13px;
      font-weight: 800;
    }

    .primary-action {
      background: var(--color-gencon-red);
      color: white;
    }

    .map-frame {
      position: relative;
      overflow: hidden;
      height: clamp(320px, 52svh, 560px);
      border: 1px solid var(--color-border);
      border-radius: 16px;
      background: var(--color-surface);
      box-shadow: 0 14px 36px rgba(15, 23, 42, 0.1);
    }

    .map-viewport {
      position: relative;
      overflow: hidden;
      height: 100%;
      width: 100%;
      touch-action: none;
      overscroll-behavior: contain;
      cursor: grab;
    }

    .map-viewport.dragging {
      cursor: grabbing;
    }

    .map-art,
    .map-state {
      position: relative;
      height: 100%;
      width: 100%;
    }

    .map-art {
      background:
        linear-gradient(rgba(47, 128, 237, 0.07) 1px, transparent 1px),
        linear-gradient(90deg, rgba(47, 128, 237, 0.07) 1px, transparent 1px), #f6f8fb;
      background-size: 28px 28px;
      transform-origin: 0 0;
      will-change: transform;
    }

    img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: contain;
      object-position: center;
      user-select: none;
      -webkit-user-drag: none;
    }

    .map-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 28px;
      background:
        linear-gradient(rgba(47, 128, 237, 0.07) 1px, transparent 1px),
        linear-gradient(90deg, rgba(47, 128, 237, 0.07) 1px, transparent 1px), #f6f8fb;
      background-size: 28px 28px;
      color: var(--color-text);
      text-align: center;
    }

    .map-state-icon {
      width: 38px;
      height: 38px;
      border: 4px solid rgba(47, 128, 237, 0.2);
      border-top-color: var(--color-map-blue);
      border-radius: 999px;
      animation: spin 900ms linear infinite;
    }

    .map-state strong {
      font-size: 18px;
      line-height: 1.2;
    }

    .map-state p {
      max-width: 24rem;
      margin: 0;
      color: var(--color-muted);
      font-size: 14px;
      font-weight: 650;
      line-height: 1.42;
    }

    .map-state button {
      min-height: 40px;
      padding: 0 14px;
      border: 0;
      border-radius: 999px;
      background: var(--color-gencon-red);
      color: white;
      font-size: 13px;
      font-weight: 850;
    }

    .pin {
      position: absolute;
      z-index: 2;
      width: 46px;
      height: 46px;
      border: 3px solid var(--color-map-blue);
      border-radius: 999px;
      background: var(--color-surface);
      box-shadow: 0 8px 20px rgba(15, 23, 42, 0.22);
      color: var(--color-text);
      font-size: 14px;
      font-weight: 900;
    }

    .pin.current {
      outline: 3px solid rgba(47, 128, 237, 0.18);
      outline-offset: 3px;
    }

    .pin.selected {
      z-index: 4;
      box-shadow:
        0 0 0 4px rgba(255, 255, 255, 0.85),
        0 10px 24px rgba(15, 23, 42, 0.24);
    }

    .pin[data-status='available'],
    .pin-detail-avatar[data-status='available'] {
      border-color: var(--color-green);
    }

    .pin[data-status='heading-somewhere'],
    .pin[data-status='vendor-hall'],
    .pin-detail-avatar[data-status='heading-somewhere'],
    .pin-detail-avatar[data-status='vendor-hall'] {
      border-color: var(--color-gold);
    }

    .pin[data-status='food-drinks'],
    .pin[data-status='need-break'],
    .pin-detail-avatar[data-status='food-drinks'],
    .pin-detail-avatar[data-status='need-break'] {
      border-color: var(--color-orange);
    }

    .pin[data-status='offline'],
    .pin[data-status='hotel-resting'],
    .pin-detail-avatar[data-status='offline'],
    .pin-detail-avatar[data-status='hotel-resting'] {
      border-color: var(--color-muted);
    }

    .pin-detail {
      position: absolute;
      right: 10px;
      bottom: 50px;
      left: 10px;
      z-index: 5;
      display: grid;
      grid-template-columns: 48px minmax(0, 1fr) 38px;
      gap: 11px;
      align-items: center;
      padding: 10px;
      border: 1px solid rgba(216, 222, 232, 0.92);
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.94);
      box-shadow: 0 14px 30px rgba(15, 23, 42, 0.18);
      backdrop-filter: blur(12px);
    }

    .rally-detail {
      align-items: start;
      bottom: 50px;
      max-height: calc(100% - 70px);
      overflow-y: auto;
    }

    .rally-note {
      font-weight: 650 !important;
    }

    .rally-response-actions {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 5px;
      margin-top: 9px;
    }

    .rally-response-actions button {
      min-width: 0;
      min-height: 38px;
      padding: 5px;
      border: 1px solid var(--color-border);
      border-radius: 8px;
      background: var(--color-surface);
      color: var(--color-text);
      font-size: 11px;
      line-height: 1.1;
    }

    .rally-response-actions button.selected {
      border-color: var(--color-gencon-red);
      background: var(--color-gencon-red);
      color: white;
    }

    .rally-response-summary,
    .rally-response-names {
      overflow-wrap: anywhere;
      font-size: 11px !important;
    }

    .pin-detail-avatar {
      display: grid;
      width: 46px;
      height: 46px;
      place-items: center;
      border: 3px solid var(--color-map-blue);
      border-radius: 999px;
      background: var(--color-surface);
      color: var(--color-text);
      font-size: 14px;
      font-weight: 900;
    }

    .pin-detail-avatar.current {
      outline: 3px solid rgba(47, 128, 237, 0.18);
      outline-offset: 2px;
    }

    .pin-detail strong {
      display: block;
      overflow-wrap: anywhere;
      color: var(--color-text);
      font-size: 15px;
      line-height: 1.15;
    }

    .pin-detail p,
    .pin-detail time {
      display: block;
      margin: 3px 0 0;
      color: var(--color-muted);
      font-size: 12px;
      font-weight: 800;
      line-height: 1.25;
    }

    .pin-detail p {
      color: var(--color-text);
    }

    .pin-detail button {
      min-width: 38px;
      min-height: 38px;
      border: 0;
      border-radius: 999px;
      background: rgba(102, 112, 133, 0.1);
      color: var(--color-muted);
      font-size: 20px;
      font-weight: 900;
      line-height: 1;
    }

    .map-hint {
      position: absolute;
      right: 12px;
      bottom: 10px;
      left: 12px;
      z-index: 4;
      margin: 0;
      padding: 8px 10px;
      border: 1px solid rgba(216, 222, 232, 0.9);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.92);
      color: var(--color-muted);
      font-size: 12px;
      font-weight: 800;
      text-align: center;
      box-shadow: 0 8px 20px rgba(15, 23, 42, 0.1);
      backdrop-filter: blur(12px);
    }

    .map-hint button {
      min-height: 28px;
      padding: 0 10px;
      border: 0;
      border-radius: 999px;
      background: var(--color-map-blue);
      color: white;
    }

    .map-hint.error {
      color: var(--color-gencon-red);
    }

    .map-controls {
      position: absolute;
      top: 10px;
      right: 10px;
      z-index: 3;
      display: grid;
      grid-template-columns: 44px minmax(74px, auto) 44px;
      gap: 6px;
      padding: 6px;
      border: 1px solid rgba(216, 222, 232, 0.9);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.92);
      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.14);
      backdrop-filter: blur(12px);
    }

    .map-controls button {
      min-height: 44px;
      border: 0;
      border-radius: 999px;
      background: var(--color-surface);
      color: var(--color-text);
      font-size: 18px;
      font-weight: 900;
      line-height: 1;
    }

    .map-controls .map-reset {
      padding: 0 12px;
      color: var(--color-map-blue);
      font-size: 12px;
      font-weight: 850;
      white-space: nowrap;
    }

    .map-controls button:disabled {
      cursor: not-allowed;
      opacity: 0.55;
    }

    .status-sheet {
      position: relative;
      z-index: 2;
      margin-top: -28px;
      padding: 18px;
      border: 1px solid var(--color-border);
      border-radius: 16px 16px 0 0;
      background: var(--color-surface);
      box-shadow: 0 -10px 36px rgba(15, 23, 42, 0.13);
    }

    .sheet-header {
      display: flex;
      align-items: start;
      justify-content: space-between;
      gap: 14px;
    }

    .sheet-header strong {
      color: var(--color-text);
      font-size: 20px;
    }

    .sheet-header span {
      color: var(--color-muted);
      font-size: 12px;
      font-weight: 700;
    }

    .status-meta.error {
      color: var(--color-gencon-red);
    }

    .status-grid {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      margin: 18px -18px 16px;
      padding: 0 18px 2px;
    }

    .status-grid button {
      flex: 0 0 auto;
      min-height: 38px;
      padding: 0 13px;
      border: 1px solid var(--color-border);
      border-radius: 999px;
      background: var(--color-surface);
      color: var(--color-text);
      font-size: 13px;
      font-weight: 800;
    }

    .status-grid button.active {
      border-color: var(--color-gencon-red);
      background: rgba(214, 56, 47, 0.1);
      color: var(--color-gencon-red);
    }

    .status-grid button:disabled,
    .status-save:disabled,
    input:disabled {
      cursor: not-allowed;
      opacity: 0.58;
    }

    label {
      display: grid;
      gap: 7px;
      color: var(--color-muted);
      font-size: 12px;
      font-weight: 800;
    }

    .note-label {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    input {
      min-height: 44px;
      padding: 0 12px;
      border: 1px solid var(--color-border);
      border-radius: 10px;
      color: var(--color-text);
      font-size: 15px;
      font-weight: 600;
    }

    .status-save,
    .secondary-action {
      min-height: 44px;
      padding: 0 16px;
      border-radius: 10px;
      font-size: 15px;
      font-weight: 850;
    }

    .status-save {
      margin-top: 14px;
      border: 0;
      background: var(--color-gencon-red);
      color: white;
    }

    .save-message {
      margin: 10px 0 0;
      color: var(--color-muted);
      font-size: 13px;
    }

    .save-message.error {
      color: var(--color-gencon-red);
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .map-state-icon {
        animation: none;
      }
    }

    @media (min-height: 760px) {
      .map-frame {
        min-height: 390px;
      }
    }
  `,
})
export class MapPage {
  private readonly appConfig = inject(AppConfigService);
  private readonly route = inject(ActivatedRoute);
  private readonly authSession = inject(AuthSession);
  private readonly memberProfile = inject(MemberProfile);
  private readonly rallyPointsService = inject(RallyPoints);
  private readonly destroyRef = inject(DestroyRef);
  private readonly activeMapPointers = new Map<number, MapPoint>();
  private lastDragPoint: MapPoint | null = null;
  private gestureStart: MapGestureStart | null = null;
  private tapCandidate: MapTapCandidate | null = null;
  private mapViewportElement: HTMLElement | null = null;
  private viewportResizeObserver: ResizeObserver | null = null;
  private membersUnsubscribe: (() => void) | null = null;
  private rallyPointsUnsubscribe: (() => void) | null = null;
  private readonly rallyResponseUnsubscribes = new Map<string, () => void>();
  private isDestroyed = false;
  private requestedMemberId = this.route.snapshot.queryParamMap.get('member');
  private readonly sharingLocationRequested =
    this.route.snapshot.queryParamMap.get('share') === 'location';

  @ViewChild('mapViewport')
  set mapViewport(element: ElementRef<HTMLElement> | undefined) {
    this.viewportResizeObserver?.disconnect();
    this.viewportResizeObserver = null;
    this.mapViewportElement = element?.nativeElement ?? null;

    if (!this.mapViewportElement) {
      this.mapViewportWidth.set(0);
      this.mapViewportHeight.set(0);
      return;
    }

    this.updateMapViewportSize();

    if (typeof ResizeObserver !== 'undefined') {
      this.viewportResizeObserver = new ResizeObserver(() => this.updateMapViewportSize());
      this.viewportResizeObserver.observe(this.mapViewportElement);
    }
  }

  readonly statuses = STATUS_OPTIONS;
  readonly members = signal<Member[]>([]);
  readonly rallyPoints = signal<RallyPoint[]>([]);
  readonly rallyResponses = signal<RallyResponse[]>([]);
  readonly rallyResponseOptions = rallyResponseOptions;
  readonly responseSavingRallyId = signal<string | null>(null);
  readonly currentMember = computed(() => {
    const currentUid = this.authSession.user()?.uid;
    return this.members().find((member) => member.id === currentUid) ?? this.memberProfile.member();
  });
  readonly currentMemberLocationHidden = computed(
    () => this.currentMember()?.locationVisible === false,
  );
  readonly isLocationHiding = signal(false);
  readonly locationButtonLabel = computed(() => {
    if (this.isLocationHiding()) {
      return 'Hiding...';
    }

    return this.currentMemberLocationHidden() ? 'Hidden' : 'Hide me';
  });
  readonly now = signal(new Date());
  readonly selectedStatus = signal<MemberStatus>('available');
  readonly selectedStatusLabel = computed(() => statusLabel(this.selectedStatus()));
  readonly note = signal('');
  readonly noteLength = computed(() => this.note().length);
  readonly isStatusLoading = signal(false);
  readonly isStatusSaving = signal(false);
  readonly statusSaveMessage = signal('');
  readonly statusSaveIsError = signal(false);
  readonly lastSavedStatus = signal<MemberStatus>('available');
  readonly lastSavedNote = signal('');
  readonly hasUnsavedStatusChanges = computed(
    () =>
      this.selectedStatus() !== this.lastSavedStatus() ||
      normalizeNote(this.note()) !== this.lastSavedNote(),
  );
  readonly canSaveStatus = computed(
    () => !this.isStatusLoading() && !this.isStatusSaving() && this.hasUnsavedStatusChanges(),
  );
  readonly statusMetaLabel = computed(() => {
    if (this.isStatusLoading()) {
      return 'Loading profile...';
    }

    if (this.isStatusSaving()) {
      return 'Saving...';
    }

    if (this.statusSaveIsError()) {
      return 'Needs retry';
    }

    if (this.hasUnsavedStatusChanges()) {
      return 'Unsaved changes';
    }

    return 'Updated just now';
  });
  readonly mapImageFailed = signal(false);
  readonly isMapLoading = this.appConfig.isLoading;
  readonly mapLoadError = this.appConfig.error;
  readonly configuredMapUrl = computed(() => this.appConfig.config()?.mapImageUrl ?? '');
  readonly mapTitle = computed(() => this.appConfig.config()?.mapDisplayName ?? 'Shared map');
  readonly mapFrameLabel = computed(() => `${this.mapTitle()} image plane`);
  readonly mapLoadErrorMessage = computed(() => messageForMapError(this.mapLoadError()));
  readonly mapScale = signal(1);
  readonly mapTranslateX = signal(0);
  readonly mapTranslateY = signal(0);
  readonly mapViewportWidth = signal(0);
  readonly mapViewportHeight = signal(0);
  readonly mapImageNaturalWidth = signal(0);
  readonly mapImageNaturalHeight = signal(0);
  readonly isMapDragging = signal(false);
  readonly isPinSaving = signal(false);
  readonly previousPinState = signal<PreviousPinState | null>(null);
  readonly pinSaveMessage = signal('');
  readonly pinSaveIsError = signal(false);
  readonly selectedPinId = signal<string | null>(null);
  readonly selectedRallyId = signal<string | null>(null);
  readonly isRallyDraftOpen = signal(false);
  readonly pendingRallyPoint = signal<MapPoint | null>(null);
  readonly rallyTitle = signal('');
  readonly rallyDraftTitle = computed(() => normalizeRallyTitle(this.rallyTitle()));
  readonly rallyNote = signal('');
  readonly rallyNoteLength = computed(() => this.rallyNote().length);
  readonly rallyScheduledTimeInput = signal('');
  readonly minimumRallyTimeInput = computed(() => dateTimeLocalValue(this.now()));
  readonly rallyScheduledTimeIsPast = computed(() => {
    const scheduledTime = parseDateTimeLocal(this.rallyScheduledTimeInput());
    return scheduledTime !== null && scheduledTime.getTime() < this.now().getTime();
  });
  readonly isRallySaving = signal(false);
  readonly rallySaveMessage = signal('');
  readonly rallySaveIsError = signal(false);
  readonly canSaveRally = computed(
    () =>
      !this.isRallySaving() &&
      this.rallyDraftTitle().length > 0 &&
      this.pendingRallyPoint() !== null &&
      !this.rallyScheduledTimeIsPast(),
  );
  readonly mapTransform = computed(
    () =>
      `translate3d(${formatViewValue(this.mapTranslateX())}px, ${formatViewValue(
        this.mapTranslateY(),
      )}px, 0) scale(${formatViewValue(this.mapScale())})`,
  );
  readonly pinTransform = computed(
    () => `translate(-50%, -50%) scale(${formatViewValue(1 / this.mapScale())})`,
  );
  readonly mapZoomLabel = computed(() => `${Math.round(this.mapScale() * 100)}%`);
  readonly isMapViewAtRest = computed(
    () => this.mapScale() === 1 && this.mapTranslateX() === 0 && this.mapTranslateY() === 0,
  );
  readonly mapResetLabel = computed(() => (this.isMapViewAtRest() ? 'Fit' : 'Reset'));
  readonly mapResetAriaLabel = computed(
    () => `Reset map view. Current zoom ${this.mapZoomLabel()}.`,
  );
  readonly mapImageBounds = computed(() =>
    mapImageBoundsFor(
      this.mapViewportWidth(),
      this.mapViewportHeight(),
      this.mapImageNaturalWidth(),
      this.mapImageNaturalHeight(),
    ),
  );
  readonly pins = computed(() => {
    const bounds = this.mapImageBounds();
    const viewportWidth = this.mapViewportWidth();
    const viewportHeight = this.mapViewportHeight();
    const now = this.now();
    const currentUid = this.authSession.user()?.uid ?? '';

    return this.members()
      .filter(
        (member) =>
          member.locationVisible && member.mapXPercent !== null && member.mapYPercent !== null,
      )
      .map((member) => toMapPin(member, bounds, viewportWidth, viewportHeight, now, currentUid))
      .sort((first, second) => Number(first.isCurrentMember) - Number(second.isCurrentMember));
  });
  readonly selectedPin = computed(
    () => this.pins().find((pin) => pin.id === this.selectedPinId()) ?? null,
  );
  readonly rallyMarkers = computed(() => {
    const bounds = this.mapImageBounds();
    const viewportWidth = this.mapViewportWidth();
    const viewportHeight = this.mapViewportHeight();

    return this.rallyPoints().map((rallyPoint) =>
      toMapRallyMarker(
        rallyPoint,
        bounds,
        viewportWidth,
        viewportHeight,
        this.rallyResponses(),
        this.members(),
        this.authSession.user()?.uid ?? '',
      ),
    );
  });
  readonly selectedRally = computed(
    () =>
      this.rallyMarkers().find((rallyPoint) => rallyPoint.id === this.selectedRallyId()) ?? null,
  );
  readonly pendingRallyMarker = computed(() => {
    const pendingPoint = this.pendingRallyPoint();

    if (!pendingPoint) {
      return null;
    }

    const renderPoint = renderPercentForMapPoint(
      pendingPoint.x,
      pendingPoint.y,
      this.mapImageBounds(),
      this.mapViewportWidth(),
      this.mapViewportHeight(),
    );

    return {
      renderX: renderPoint.x,
      renderY: renderPoint.y,
    };
  });
  readonly rallyCoordinateLabel = computed(() => {
    const pendingPoint = this.pendingRallyPoint();

    if (!pendingPoint) {
      return 'Tap the map to choose the rally spot.';
    }

    return `Rally spot selected at ${formatPercent(pendingPoint.x)}%, ${formatPercent(pendingPoint.y)}%.`;
  });
  readonly mapHintIsError = computed(() => this.pinSaveIsError() || this.rallySaveIsError());
  readonly mapHintMessage = computed(() => {
    if (this.rallySaveMessage()) {
      return this.rallySaveMessage();
    }

    if (this.isRallyDraftOpen()) {
      return this.pendingRallyPoint()
        ? 'Rally spot selected. Complete the form below.'
        : 'Tap the map to choose a rally spot.';
    }

    return (
      this.pinSaveMessage() ||
      (this.sharingLocationRequested
        ? 'Tap your location on the map to share your pin again.'
        : 'Tap the map to place or move your pin.')
    );
  });

  constructor() {
    const interval = window.setInterval(() => this.now.set(new Date()), minuteMs);

    this.destroyRef.onDestroy(() => {
      this.isDestroyed = true;
      window.clearInterval(interval);
      this.viewportResizeObserver?.disconnect();
      this.viewportResizeObserver = null;
      this.membersUnsubscribe?.();
      this.membersUnsubscribe = null;
      this.rallyPointsUnsubscribe?.();
      this.rallyPointsUnsubscribe = null;
      this.rallyResponseUnsubscribes.forEach((unsubscribe) => unsubscribe());
      this.rallyResponseUnsubscribes.clear();
    });

    void this.reloadMapConfig();
    void this.loadStatusDraft();
    void this.startMembersStream();
    void this.startRallyPointsStream();
  }

  async loadStatusDraft(): Promise<void> {
    this.isStatusLoading.set(true);
    this.statusSaveMessage.set('');
    this.statusSaveIsError.set(false);

    try {
      const member = await this.memberProfile.loadCurrentMember();

      if (!member) {
        throw new MemberProfileError('member-not-found');
      }

      this.selectedStatus.set(member.status);
      this.note.set(normalizeNote(member.note));
      this.lastSavedStatus.set(member.status);
      this.lastSavedNote.set(normalizeNote(member.note));
    } catch (error) {
      this.statusSaveMessage.set(messageForMemberError(error));
      this.statusSaveIsError.set(true);
    } finally {
      this.isStatusLoading.set(false);
    }
  }

  async reloadMapConfig(): Promise<void> {
    this.mapImageFailed.set(false);
    this.resetMapView();
    await this.appConfig.loadCurrentConfig({ force: true });
  }

  retryMapImage(): void {
    this.mapImageFailed.set(false);
  }

  markMapImageLoaded(event: Event): void {
    const image = event.target;

    if (image instanceof HTMLImageElement) {
      this.mapImageNaturalWidth.set(image.naturalWidth);
      this.mapImageNaturalHeight.set(image.naturalHeight);
    }

    this.mapImageFailed.set(false);
    this.updateMapViewportSize();
    this.resetMapView();
    this.focusRequestedMember();
  }

  markMapImageFailed(): void {
    this.mapImageFailed.set(true);
    this.mapImageNaturalWidth.set(0);
    this.mapImageNaturalHeight.set(0);
    this.resetMapView();
  }

  startMapPointer(event: PointerEvent): void {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }

    if (isPinTarget(event.target)) {
      return;
    }

    const viewport = event.currentTarget;

    if (!(viewport instanceof HTMLElement)) {
      return;
    }

    event.preventDefault();
    viewport.setPointerCapture(event.pointerId);
    const point = pointFromPointerEvent(event, viewport);
    this.activeMapPointers.set(event.pointerId, point);
    this.isMapDragging.set(true);

    if (this.activeMapPointers.size >= 2) {
      if (this.tapCandidate) {
        this.tapCandidate.hadMultiplePointers = true;
      }

      this.gestureStart = this.createGestureStart();
      this.lastDragPoint = null;
      return;
    }

    this.gestureStart = null;
    this.lastDragPoint = point;
    this.tapCandidate = {
      pointerId: event.pointerId,
      start: point,
      latest: point,
      maxDistance: 0,
      hadMultiplePointers: false,
    };
  }

  moveMapPointer(event: PointerEvent): void {
    if (!this.activeMapPointers.has(event.pointerId)) {
      return;
    }

    const viewport = event.currentTarget;

    if (!(viewport instanceof HTMLElement)) {
      return;
    }

    event.preventDefault();
    const point = pointFromPointerEvent(event, viewport);
    this.activeMapPointers.set(event.pointerId, point);

    if (this.tapCandidate?.pointerId === event.pointerId) {
      this.tapCandidate.latest = point;
      this.tapCandidate.maxDistance = Math.max(
        this.tapCandidate.maxDistance,
        distanceBetween(this.tapCandidate.start, point),
      );
    }

    if (this.activeMapPointers.size >= 2) {
      if (this.tapCandidate) {
        this.tapCandidate.hadMultiplePointers = true;
      }

      const metrics = pointerMetrics([...this.activeMapPointers.values()]);

      if (!metrics) {
        return;
      }

      this.gestureStart ??= this.createGestureStart();

      if (!this.gestureStart || this.gestureStart.distance === 0) {
        return;
      }

      const nextScale = clampScale(
        this.gestureStart.scale * (metrics.distance / this.gestureStart.distance),
      );
      const contentX =
        (this.gestureStart.midpoint.x - this.gestureStart.translateX) / this.gestureStart.scale;
      const contentY =
        (this.gestureStart.midpoint.y - this.gestureStart.translateY) / this.gestureStart.scale;
      this.applyMapView(
        {
          scale: nextScale,
          translateX: metrics.midpoint.x - contentX * nextScale,
          translateY: metrics.midpoint.y - contentY * nextScale,
        },
        viewport,
      );
      return;
    }

    if (!this.lastDragPoint) {
      this.lastDragPoint = point;
      return;
    }

    this.applyMapView(
      {
        scale: this.mapScale(),
        translateX: this.mapTranslateX() + point.x - this.lastDragPoint.x,
        translateY: this.mapTranslateY() + point.y - this.lastDragPoint.y,
      },
      viewport,
    );
    this.lastDragPoint = point;
  }

  endMapPointer(event: PointerEvent): void {
    const viewport = event.currentTarget;
    const wasTapCandidate =
      viewport instanceof HTMLElement &&
      this.activeMapPointers.size === 1 &&
      this.tapCandidate?.pointerId === event.pointerId &&
      !this.tapCandidate.hadMultiplePointers &&
      this.tapCandidate.maxDistance <= TAP_MOVE_TOLERANCE_PX;
    const tapPoint = wasTapCandidate ? pointFromPointerEvent(event, viewport as HTMLElement) : null;

    if (viewport instanceof HTMLElement && viewport.hasPointerCapture(event.pointerId)) {
      viewport.releasePointerCapture(event.pointerId);
    }

    this.activeMapPointers.delete(event.pointerId);

    if (this.activeMapPointers.size >= 2) {
      this.gestureStart = this.createGestureStart();
      this.lastDragPoint = null;
      return;
    }

    this.gestureStart = null;

    if (this.activeMapPointers.size === 1) {
      this.lastDragPoint = [...this.activeMapPointers.values()][0] ?? null;
      return;
    }

    this.lastDragPoint = null;
    this.isMapDragging.set(false);

    if (tapPoint && viewport instanceof HTMLElement) {
      if (this.isRallyDraftOpen()) {
        this.selectRallyPointAtViewportPoint(tapPoint, viewport);
        return;
      }

      void this.savePinAtViewportPoint(tapPoint, viewport);
    }
  }

  zoomMapWithWheel(event: WheelEvent): void {
    const viewport = event.currentTarget;

    if (!(viewport instanceof HTMLElement)) {
      return;
    }

    event.preventDefault();
    const factor = Math.min(1.35, Math.max(0.74, Math.exp(-event.deltaY * 0.002)));
    this.zoomMapAt(viewport, factor, pointFromWheelEvent(event, viewport));
  }

  zoomMapBy(viewport: HTMLElement, factor: number): void {
    this.zoomMapAt(viewport, factor, {
      x: viewport.clientWidth / 2,
      y: viewport.clientHeight / 2,
    });
  }

  resetMapView(): void {
    this.activeMapPointers.clear();
    this.lastDragPoint = null;
    this.gestureStart = null;
    this.tapCandidate = null;
    this.isMapDragging.set(false);
    this.mapScale.set(1);
    this.mapTranslateX.set(0);
    this.mapTranslateY.set(0);
  }

  selectPin(pinId: string): void {
    this.selectedPinId.set(pinId);
  }

  clearSelectedPin(): void {
    this.selectedPinId.set(null);
  }

  selectRally(rallyId: string): void {
    this.selectedRallyId.set(rallyId);
    this.selectedPinId.set(null);
  }

  clearSelectedRally(): void {
    this.selectedRallyId.set(null);
  }

  openRallyForm(): void {
    this.isRallyDraftOpen.set(true);
    this.pendingRallyPoint.set(null);
    this.selectedPinId.set(null);
    this.selectedRallyId.set(null);
    this.rallySaveMessage.set('');
    this.rallySaveIsError.set(false);
    this.pinSaveMessage.set('');
    this.pinSaveIsError.set(false);
  }

  cancelRallyForm(): void {
    if (this.isRallySaving()) {
      return;
    }

    this.resetRallyDraft();
  }

  selectStatus(status: MemberStatus): void {
    this.selectedStatus.set(status);
    this.clearStatusMessage();
  }

  updateNote(value: string): void {
    this.note.set(value.slice(0, 80));
    this.clearStatusMessage();
  }

  updateRallyTitle(value: string): void {
    this.rallyTitle.set(value.slice(0, 48));
    this.clearRallyMessage();
  }

  updateRallyNote(value: string): void {
    this.rallyNote.set(value.slice(0, 120));
    this.clearRallyMessage();
  }

  updateRallyScheduledTime(value: string): void {
    this.rallyScheduledTimeInput.set(value);
    if (this.rallyScheduledTimeIsPast()) {
      this.rallySaveMessage.set('Choose a meetup time that is not in the past.');
      this.rallySaveIsError.set(true);
    } else {
      this.clearRallyMessage();
    }
  }

  async saveStatus(event: SubmitEvent): Promise<void> {
    event.preventDefault();

    if (!this.canSaveStatus()) {
      return;
    }

    this.isStatusSaving.set(true);
    this.statusSaveMessage.set('');
    this.statusSaveIsError.set(false);

    try {
      const member = await this.memberProfile.saveCurrentStatus(this.selectedStatus(), this.note());
      const savedNote = normalizeNote(member.note);
      this.selectedStatus.set(member.status);
      this.note.set(savedNote);
      this.lastSavedStatus.set(member.status);
      this.lastSavedNote.set(savedNote);
      this.statusSaveMessage.set('Status saved.');
    } catch (error) {
      this.statusSaveMessage.set(messageForMemberError(error));
      this.statusSaveIsError.set(true);
    } finally {
      this.isStatusSaving.set(false);
    }
  }

  async hideCurrentLocation(): Promise<void> {
    if (this.isLocationHiding() || this.currentMemberLocationHidden()) {
      return;
    }

    this.isLocationHiding.set(true);
    this.pinSaveMessage.set('Hiding location...');
    this.pinSaveIsError.set(false);

    try {
      const member = await this.memberProfile.hideCurrentLocation();
      this.previousPinState.set(null);
      this.selectedPinId.set(null);
      this.pinSaveMessage.set(
        member.locationVisible
          ? 'Location visibility unchanged.'
          : 'Location hidden. Tap the map to share a new pin.',
      );
    } catch (error) {
      this.pinSaveMessage.set(messageForHideLocationError(error));
      this.pinSaveIsError.set(true);
    } finally {
      this.isLocationHiding.set(false);
    }
  }

  async undoPinMove(): Promise<void> {
    const previous = this.previousPinState();

    if (!previous || this.isPinSaving()) {
      return;
    }

    this.isPinSaving.set(true);
    this.pinSaveMessage.set('Restoring previous pin...');
    this.pinSaveIsError.set(false);

    try {
      const member =
        previous.locationVisible && previous.x !== null && previous.y !== null
          ? await this.memberProfile.saveCurrentPin(previous.x, previous.y)
          : await this.memberProfile.hideCurrentLocation();
      this.previousPinState.set(null);
      this.selectedPinId.set(member.locationVisible ? member.id : null);
      this.pinSaveMessage.set('Previous pin restored.');
    } catch (error) {
      this.pinSaveMessage.set(messageForPinError(error));
      this.pinSaveIsError.set(true);
    } finally {
      this.isPinSaving.set(false);
    }
  }

  async saveRally(event: SubmitEvent): Promise<void> {
    event.preventDefault();

    if (!this.canSaveRally()) {
      return;
    }

    const pendingPoint = this.pendingRallyPoint();

    if (!pendingPoint) {
      return;
    }

    this.isRallySaving.set(true);
    this.rallySaveMessage.set('');
    this.rallySaveIsError.set(false);

    try {
      const rallyPoint = await this.rallyPointsService.createRallyPoint({
        title: this.rallyTitle(),
        note: this.rallyNote(),
        mapXPercent: pendingPoint.x,
        mapYPercent: pendingPoint.y,
        scheduledTime: parseDateTimeLocal(this.rallyScheduledTimeInput()),
      });

      this.resetRallyDraft();
      this.selectedRallyId.set(rallyPoint.id);
      this.pinSaveMessage.set('Rally point created.');
      this.pinSaveIsError.set(false);
    } catch (error) {
      this.rallySaveMessage.set(messageForRallyError(error));
      this.rallySaveIsError.set(true);
    } finally {
      this.isRallySaving.set(false);
    }
  }

  async saveRallyResponse(
    rallyPointId: string,
    responseStatus: RallyResponseStatus,
  ): Promise<void> {
    if (this.responseSavingRallyId()) {
      return;
    }

    this.responseSavingRallyId.set(rallyPointId);
    this.pinSaveMessage.set('Saving rally response...');
    this.pinSaveIsError.set(false);

    try {
      await this.rallyPointsService.saveResponse(rallyPointId, responseStatus);
      this.pinSaveMessage.set('Rally response saved.');
    } catch (error) {
      this.pinSaveMessage.set(messageForRallyResponseError(error));
      this.pinSaveIsError.set(true);
    } finally {
      this.responseSavingRallyId.set(null);
    }
  }

  labelFor(status: MemberStatus): string {
    return statusLabel(status);
  }

  private async savePinAtViewportPoint(point: MapPoint, viewport: HTMLElement): Promise<void> {
    const mapPercent = this.mapPercentFromViewportPoint(point, viewport);

    if (!mapPercent || this.isPinSaving() || this.isLocationHiding()) {
      return;
    }

    this.isPinSaving.set(true);
    this.pinSaveMessage.set('Saving pin...');
    this.pinSaveIsError.set(false);

    try {
      const currentMember = this.currentMember();
      const member = await this.memberProfile.saveCurrentPin(mapPercent.x, mapPercent.y);
      this.previousPinState.set({
        x: currentMember?.mapXPercent ?? null,
        y: currentMember?.mapYPercent ?? null,
        locationVisible: currentMember?.locationVisible ?? false,
      });
      this.selectedPinId.set(member.id);
      this.pinSaveMessage.set('Pin moved.');
    } catch (error) {
      this.pinSaveMessage.set(messageForPinError(error));
      this.pinSaveIsError.set(true);
    } finally {
      this.isPinSaving.set(false);
    }
  }

  private selectRallyPointAtViewportPoint(point: MapPoint, viewport: HTMLElement): void {
    const mapPercent = this.mapPercentFromViewportPoint(point, viewport);

    if (!mapPercent || this.isRallySaving()) {
      return;
    }

    this.pendingRallyPoint.set(mapPercent);
    this.selectedPinId.set(null);
    this.selectedRallyId.set(null);
    this.clearRallyMessage();
  }

  private async startMembersStream(): Promise<void> {
    this.membersUnsubscribe?.();
    this.membersUnsubscribe = null;

    try {
      const unsubscribe = await this.memberProfile.watchMembers(
        (members) => {
          if (this.isDestroyed) {
            return;
          }

          this.members.set(members);
          this.focusRequestedMember();
          this.pinSaveIsError.set(false);
        },
        () => {
          if (this.isDestroyed) {
            return;
          }

          this.pinSaveMessage.set('Could not load group pins. Check your session and connection.');
          this.pinSaveIsError.set(true);
        },
      );

      if (this.isDestroyed) {
        unsubscribe();
        return;
      }

      this.membersUnsubscribe = unsubscribe;
    } catch {
      if (!this.isDestroyed) {
        this.pinSaveMessage.set('Could not load group pins. Check your session and connection.');
        this.pinSaveIsError.set(true);
      }
    }
  }

  private async startRallyPointsStream(): Promise<void> {
    this.rallyPointsUnsubscribe?.();
    this.rallyPointsUnsubscribe = null;

    try {
      const unsubscribe = await this.rallyPointsService.watchRallyPoints(
        (rallyPoints) => {
          if (this.isDestroyed) {
            return;
          }

          this.rallyPoints.set(rallyPoints);
          void this.syncMapRallyResponseSubscriptions(rallyPoints);
          this.rallySaveIsError.set(false);
        },
        () => {
          if (this.isDestroyed) {
            return;
          }

          this.rallySaveMessage.set(
            'Could not load rally points. Check your session and connection.',
          );
          this.rallySaveIsError.set(true);
        },
      );

      if (this.isDestroyed) {
        unsubscribe();
        return;
      }

      this.rallyPointsUnsubscribe = unsubscribe;
    } catch {
      if (!this.isDestroyed) {
        this.rallySaveMessage.set(
          'Could not load rally points. Check your session and connection.',
        );
        this.rallySaveIsError.set(true);
      }
    }
  }

  private async syncMapRallyResponseSubscriptions(rallyPoints: RallyPoint[]): Promise<void> {
    const activeIds = new Set(rallyPoints.map((rallyPoint) => rallyPoint.id));

    for (const [rallyPointId, unsubscribe] of this.rallyResponseUnsubscribes) {
      if (!activeIds.has(rallyPointId)) {
        unsubscribe();
        this.rallyResponseUnsubscribes.delete(rallyPointId);
      }
    }

    this.rallyResponses.update((responses) =>
      responses.filter((response) => activeIds.has(response.rallyPointId)),
    );

    for (const rallyPoint of rallyPoints) {
      if (this.rallyResponseUnsubscribes.has(rallyPoint.id)) {
        continue;
      }

      const unsubscribe = await this.rallyPointsService.watchRallyResponses(
        rallyPoint.id,
        (responses) => {
          if (!this.isDestroyed) {
            this.rallyResponses.update((current) => [
              ...current.filter((response) => response.rallyPointId !== rallyPoint.id),
              ...responses,
            ]);
          }
        },
        () => {
          if (!this.isDestroyed) {
            this.pinSaveMessage.set('Could not load rally responses. Check your connection.');
            this.pinSaveIsError.set(true);
          }
        },
      );

      if (this.isDestroyed) {
        unsubscribe();
        return;
      }

      this.rallyResponseUnsubscribes.set(rallyPoint.id, unsubscribe);
    }
  }

  private clearStatusMessage(): void {
    this.statusSaveMessage.set('');
    this.statusSaveIsError.set(false);
  }

  private clearRallyMessage(): void {
    this.rallySaveMessage.set('');
    this.rallySaveIsError.set(false);
  }

  private resetRallyDraft(): void {
    this.isRallyDraftOpen.set(false);
    this.pendingRallyPoint.set(null);
    this.rallyTitle.set('');
    this.rallyNote.set('');
    this.rallyScheduledTimeInput.set('');
    this.rallySaveMessage.set('');
    this.rallySaveIsError.set(false);
  }

  private updateMapViewportSize(): void {
    if (!this.mapViewportElement) {
      this.mapViewportWidth.set(0);
      this.mapViewportHeight.set(0);
      return;
    }

    this.mapViewportWidth.set(this.mapViewportElement.clientWidth);
    this.mapViewportHeight.set(this.mapViewportElement.clientHeight);
  }

  private focusRequestedMember(): void {
    const memberId = this.requestedMemberId;
    const viewport = this.mapViewportElement;

    if (!memberId || !viewport) {
      return;
    }

    const pin = this.pins().find((item) => item.id === memberId);

    if (!pin) {
      return;
    }

    const scale = 2;
    this.applyMapView(
      {
        scale,
        translateX: viewport.clientWidth / 2 - (pin.renderX / 100) * viewport.clientWidth * scale,
        translateY: viewport.clientHeight / 2 - (pin.renderY / 100) * viewport.clientHeight * scale,
      },
      viewport,
    );
    this.selectedPinId.set(memberId);
    this.requestedMemberId = null;
  }

  private mapPercentFromViewportPoint(point: MapPoint, viewport: HTMLElement): MapPoint | null {
    this.updateMapViewportSize();

    const bounds =
      this.mapImageBounds() ??
      mapImageBoundsFor(
        viewport.clientWidth,
        viewport.clientHeight,
        viewport.clientWidth,
        viewport.clientHeight,
      );

    if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
      return null;
    }

    const contentPoint = {
      x: (point.x - this.mapTranslateX()) / this.mapScale(),
      y: (point.y - this.mapTranslateY()) / this.mapScale(),
    };

    return {
      x: clamp(((contentPoint.x - bounds.left) / bounds.width) * 100, 0, 100),
      y: clamp(((contentPoint.y - bounds.top) / bounds.height) * 100, 0, 100),
    };
  }

  private createGestureStart(): MapGestureStart | null {
    const metrics = pointerMetrics([...this.activeMapPointers.values()]);

    if (!metrics) {
      return null;
    }

    return {
      distance: metrics.distance,
      midpoint: metrics.midpoint,
      scale: this.mapScale(),
      translateX: this.mapTranslateX(),
      translateY: this.mapTranslateY(),
    };
  }

  private zoomMapAt(viewport: HTMLElement, factor: number, focalPoint: MapPoint): void {
    const nextScale = clampScale(this.mapScale() * factor);
    const contentX = (focalPoint.x - this.mapTranslateX()) / this.mapScale();
    const contentY = (focalPoint.y - this.mapTranslateY()) / this.mapScale();

    this.applyMapView(
      {
        scale: nextScale,
        translateX: focalPoint.x - contentX * nextScale,
        translateY: focalPoint.y - contentY * nextScale,
      },
      viewport,
    );
  }

  private applyMapView(view: MapView, viewport: HTMLElement): void {
    const nextView = constrainMapView(view, viewport.clientWidth, viewport.clientHeight);
    this.mapScale.set(nextView.scale);
    this.mapTranslateX.set(nextView.translateX);
    this.mapTranslateY.set(nextView.translateY);
  }
}

function messageForMapError(error: AppConfigLoadError | null): string {
  switch (error) {
    case 'firebase-not-configured':
      return 'Firebase is not configured yet. Add the public Firebase web config first.';
    case 'load-failed':
      return 'Could not read appConfig/current. Check your connection and authorization, then try again.';
    default:
      return '';
  }
}

function normalizeNote(note: string): string {
  return note.trim().replace(/\s+/g, ' ').slice(0, 80);
}

function normalizeRallyTitle(title: string): string {
  return title.trim().replace(/\s+/g, ' ').slice(0, 48);
}

function messageForMemberError(error: unknown): string {
  if (error instanceof MemberProfileError && error.code === 'not-authorized') {
    return 'Your session is not authorized. Sign in again before saving.';
  }

  if (error instanceof MemberProfileError && error.code === 'member-not-found') {
    return 'Your profile is not ready yet. Finish onboarding before saving status.';
  }

  return 'Could not save your status. Check your connection and try again.';
}

function messageForPinError(error: unknown): string {
  if (error instanceof MemberProfileError && error.code === 'not-authorized') {
    return 'Your session is not authorized. Sign in again before placing your pin.';
  }

  if (error instanceof MemberProfileError && error.code === 'member-not-found') {
    return 'Your profile is not ready yet. Finish onboarding before placing your pin.';
  }

  return 'Could not save your pin. Check your connection and try again.';
}

function messageForHideLocationError(error: unknown): string {
  if (error instanceof MemberProfileError && error.code === 'not-authorized') {
    return 'Your session is not authorized. Sign in again before changing visibility.';
  }

  if (error instanceof MemberProfileError && error.code === 'member-not-found') {
    return 'Your profile is not ready yet. Finish onboarding before changing visibility.';
  }

  return 'Could not hide your location. Check your connection and try again.';
}

function messageForRallyError(error: unknown): string {
  if (error instanceof RallyPointError && error.code === 'not-authorized') {
    return 'Your session is not authorized. Sign in again before creating a rally point.';
  }

  if (error instanceof RallyPointError && error.code === 'member-not-found') {
    return 'Your profile is not ready yet. Finish onboarding before creating a rally point.';
  }

  if (error instanceof RallyPointError && error.code === 'title-required') {
    return 'Add a title before creating the rally point.';
  }

  if (error instanceof RallyPointError && error.code === 'scheduled-time-past') {
    return 'Choose a meetup time that is not in the past.';
  }

  return 'Could not create the rally point. Check your connection and try again.';
}

function messageForRallyResponseError(error: unknown): string {
  if (error instanceof RallyPointError && error.code === 'not-authorized') {
    return 'Your session is not authorized. Sign in again before responding.';
  }

  return 'Could not save your rally response. Check your connection and try again.';
}

function toMapPin(
  member: Member,
  bounds: MapImageBounds | null,
  viewportWidth: number,
  viewportHeight: number,
  now: Date,
  currentUid: string,
): MapPin {
  const xPercent = member.mapXPercent ?? 0;
  const yPercent = member.mapYPercent ?? 0;
  const renderPoint = renderPercentForMapPoint(
    xPercent,
    yPercent,
    bounds,
    viewportWidth,
    viewportHeight,
  );
  const updatedAt = validDate(member.lastUpdatedAt) ? member.lastUpdatedAt : member.joinedAt;

  return {
    id: member.id,
    initials: initialsFor(member.displayName),
    name: member.displayName || 'Unnamed member',
    xPercent,
    yPercent,
    renderX: renderPoint.x,
    renderY: renderPoint.y,
    status: member.status,
    statusLabel: statusLabel(member.status),
    note: member.note,
    freshnessLabel: freshnessLabel(updatedAt, now),
    updatedAtIso: updatedAt.toISOString(),
    isCurrentMember: member.id === currentUid,
  };
}

function toMapRallyMarker(
  rallyPoint: RallyPoint,
  bounds: MapImageBounds | null,
  viewportWidth: number,
  viewportHeight: number,
  responses: RallyResponse[],
  members: Member[],
  currentMemberId: string,
): MapRallyMarker {
  const renderPoint = renderPercentForMapPoint(
    rallyPoint.mapXPercent,
    rallyPoint.mapYPercent,
    bounds,
    viewportWidth,
    viewportHeight,
  );
  const scheduledTime = validDateOrNull(rallyPoint.scheduledTime);
  const responseCounts: MapRallyResponseCounts = {
    headingThere: 0,
    arrived: 0,
    cannotMakeIt: 0,
  };
  const responseNames: MapRallyResponseNames = {
    headingThere: [],
    arrived: [],
    cannotMakeIt: [],
  };
  const memberNames = new Map(members.map((member) => [member.id, member.displayName]));
  let currentResponse: RallyResponseStatus | null = null;

  for (const response of responses.filter((item) => item.rallyPointId === rallyPoint.id)) {
    const name = memberNames.get(response.memberId) || 'Former member';

    if (response.responseStatus === 'heading-there') {
      responseCounts.headingThere += 1;
      responseNames.headingThere.push(name);
    } else if (response.responseStatus === 'arrived') {
      responseCounts.arrived += 1;
      responseNames.arrived.push(name);
    } else {
      responseCounts.cannotMakeIt += 1;
      responseNames.cannotMakeIt.push(name);
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
    title: rallyPoint.title,
    note: rallyPoint.note,
    creatorName: rallyPoint.createdByName,
    xPercent: rallyPoint.mapXPercent,
    yPercent: rallyPoint.mapYPercent,
    renderX: renderPoint.x,
    renderY: renderPoint.y,
    scheduledLabel: isRallyPointMeetingNow(rallyPoint)
      ? 'Meeting now'
      : scheduledTime
        ? scheduledLabel(scheduledTime)
        : 'No time set',
    scheduledIso: scheduledTime ? scheduledTime.toISOString() : null,
    responseCounts,
    responseNames,
    currentResponse,
  };
}

function renderPercentForMapPoint(
  xPercent: number,
  yPercent: number,
  bounds: MapImageBounds | null,
  viewportWidth: number,
  viewportHeight: number,
): MapPoint {
  if (!bounds || viewportWidth <= 0 || viewportHeight <= 0) {
    return {
      x: clamp(xPercent, 0, 100),
      y: clamp(yPercent, 0, 100),
    };
  }

  return {
    x: ((bounds.left + bounds.width * (clamp(xPercent, 0, 100) / 100)) / viewportWidth) * 100,
    y: ((bounds.top + bounds.height * (clamp(yPercent, 0, 100) / 100)) / viewportHeight) * 100,
  };
}

function mapImageBoundsFor(
  viewportWidth: number,
  viewportHeight: number,
  naturalWidth: number,
  naturalHeight: number,
): MapImageBounds | null {
  if (viewportWidth <= 0 || viewportHeight <= 0 || naturalWidth <= 0 || naturalHeight <= 0) {
    return null;
  }

  const viewportRatio = viewportWidth / viewportHeight;
  const imageRatio = naturalWidth / naturalHeight;

  if (viewportRatio > imageRatio) {
    const height = viewportHeight;
    const width = height * imageRatio;

    return {
      left: (viewportWidth - width) / 2,
      top: 0,
      width,
      height,
    };
  }

  const width = viewportWidth;
  const height = width / imageRatio;

  return {
    left: 0,
    top: (viewportHeight - height) / 2,
    width,
    height,
  };
}

function pointFromPointerEvent(event: PointerEvent, viewport: HTMLElement): MapPoint {
  const rect = viewport.getBoundingClientRect();

  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function distanceBetween(first: MapPoint, second: MapPoint): number {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function pointFromWheelEvent(event: WheelEvent, viewport: HTMLElement): MapPoint {
  const rect = viewport.getBoundingClientRect();

  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function pointerMetrics(
  points: readonly MapPoint[],
): { distance: number; midpoint: MapPoint } | null {
  const first = points[0];
  const second = points[1];

  if (!first || !second) {
    return null;
  }

  return {
    distance: Math.hypot(second.x - first.x, second.y - first.y),
    midpoint: {
      x: (first.x + second.x) / 2,
      y: (first.y + second.y) / 2,
    },
  };
}

function constrainMapView(view: MapView, viewportWidth: number, viewportHeight: number): MapView {
  const scale = clampScale(view.scale);

  if (scale === 1 || viewportWidth <= 0 || viewportHeight <= 0) {
    return {
      scale,
      translateX: 0,
      translateY: 0,
    };
  }

  const minTranslateX = viewportWidth - viewportWidth * scale;
  const minTranslateY = viewportHeight - viewportHeight * scale;

  return {
    scale,
    translateX: clamp(view.translateX, minTranslateX, 0),
    translateY: clamp(view.translateY, minTranslateY, 0),
  };
}

function clampScale(scale: number): number {
  return clamp(scale, MIN_MAP_SCALE, MAX_MAP_SCALE);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatViewValue(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}

function formatPercent(value: number): string {
  return formatViewValue(Math.round(clamp(value, 0, 100) * 10) / 10);
}

function parseDateTimeLocal(value: string): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
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
    return 'just now';
  }

  if (diffMs < hourMs) {
    return `${Math.floor(diffMs / minuteMs)}m ago`;
  }

  if (diffMs < dayMs) {
    return `${Math.floor(diffMs / hourMs)}h ago`;
  }

  return updatedAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function scheduledLabel(scheduledTime: Date): string {
  return scheduledTime.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function dateTimeLocalValue(date: Date): string {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
  return offsetDate.toISOString().slice(0, 16);
}

function validDate(value: Date): boolean {
  return value instanceof Date && Number.isFinite(value.getTime());
}

function validDateOrNull(value: Date | null): Date | null {
  return value instanceof Date && Number.isFinite(value.getTime()) ? value : null;
}

function isPinTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.closest('.pin') !== null;
}

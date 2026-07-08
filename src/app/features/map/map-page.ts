import { Component, computed, inject, signal } from '@angular/core';

import { AppConfigService, type AppConfigLoadError } from '../../core/app-config/app-config';
import { MemberProfile, MemberProfileError } from '../../core/members/member-profile';
import { MemberStatus, STATUS_OPTIONS, statusLabel } from '../../shared/status/status-options';

interface MapPin {
  initials: string;
  name: string;
  x: number;
  y: number;
  status: MemberStatus;
}

interface MapPoint {
  x: number;
  y: number;
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

const MIN_MAP_SCALE = 1;
const MAX_MAP_SCALE = 4;

@Component({
  selector: 'app-map-page',
  template: `
    <main class="map-page">
      <header>
        <div>
          <p>Gen Con Roll Call</p>
          <h1>{{ mapTitle() }}</h1>
        </div>
        <button type="button">Hide me</button>
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
            <p>Add a static map asset and set <code>appConfig/current</code> before placing pins.</p>
          </div>
        } @else if (mapImageFailed()) {
          <div class="map-state map-state-error">
            <strong>Map image did not load</strong>
            <p>Check that <code>{{ configuredMapUrl() }}</code> is a deployed static asset or reachable URL.</p>
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
                (load)="markMapImageLoaded()"
                (error)="markMapImageFailed()"
              />

              @for (pin of pins; track pin.initials) {
                <button
                  type="button"
                  class="pin"
                  [class]="pin.status"
                  [style.left.%]="pin.x"
                  [style.top.%]="pin.y"
                  [style.transform]="pinTransform()"
                  [attr.aria-label]="pin.name + ', ' + labelFor(pin.status)"
                >
                  {{ pin.initials }}
                </button>
              }
            </div>
          </div>

          <div class="map-controls" role="group" aria-label="Map zoom controls">
            <button type="button" (click)="zoomMapBy(mapViewport, 0.8)" aria-label="Zoom out">−</button>
            <button
              type="button"
              class="map-reset"
              [disabled]="isMapViewAtRest()"
              [attr.aria-label]="mapResetAriaLabel()"
              (click)="resetMapView()"
            >
              {{ mapResetLabel() }}
            </button>
            <button type="button" (click)="zoomMapBy(mapViewport, 1.25)" aria-label="Zoom in">+</button>
          </div>
        }
      </section>

      <form class="status-sheet" (submit)="saveStatus($event)">
        <div class="sheet-header">
          <div>
            <p>Your status</p>
            <strong>{{ selectedStatusLabel() }}</strong>
          </div>
          <span class="status-meta" [class.error]="statusSaveIsError()">{{ statusMetaLabel() }}</span>
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
          <p class="save-message" [class.error]="statusSaveIsError()" role="status">{{ statusSaveMessage() }}</p>
        }
      </form>
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
        linear-gradient(90deg, rgba(47, 128, 237, 0.07) 1px, transparent 1px),
        #f6f8fb;
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
        linear-gradient(90deg, rgba(47, 128, 237, 0.07) 1px, transparent 1px),
        #f6f8fb;
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

    .pin.available {
      border-color: var(--color-green);
    }

    .pin.heading-somewhere,
    .pin.vendor-hall {
      border-color: var(--color-gold);
    }

    .pin.offline,
    .pin.hotel-resting {
      border-color: var(--color-muted);
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

    .status-save {
      min-height: 44px;
      margin-top: 14px;
      padding: 0 16px;
      border: 0;
      border-radius: 10px;
      background: var(--color-gencon-red);
      color: white;
      font-size: 15px;
      font-weight: 850;
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
  `
})
export class MapPage {
  private readonly appConfig = inject(AppConfigService);
  private readonly memberProfile = inject(MemberProfile);
  private readonly activeMapPointers = new Map<number, MapPoint>();
  private lastDragPoint: MapPoint | null = null;
  private gestureStart: MapGestureStart | null = null;

  readonly statuses = STATUS_OPTIONS;
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
    () => this.selectedStatus() !== this.lastSavedStatus() || normalizeNote(this.note()) !== this.lastSavedNote()
  );
  readonly canSaveStatus = computed(
    () => !this.isStatusLoading() && !this.isStatusSaving() && this.hasUnsavedStatusChanges()
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
  readonly isMapDragging = signal(false);
  readonly mapTransform = computed(
    () =>
      `translate3d(${formatViewValue(this.mapTranslateX())}px, ${formatViewValue(
        this.mapTranslateY()
      )}px, 0) scale(${formatViewValue(this.mapScale())})`
  );
  readonly pinTransform = computed(() => `translate(-50%, -50%) scale(${formatViewValue(1 / this.mapScale())})`);
  readonly mapZoomLabel = computed(() => `${Math.round(this.mapScale() * 100)}%`);
  readonly isMapViewAtRest = computed(
    () => this.mapScale() === 1 && this.mapTranslateX() === 0 && this.mapTranslateY() === 0
  );
  readonly mapResetLabel = computed(() => this.isMapViewAtRest() ? 'Fit' : 'Reset');
  readonly mapResetAriaLabel = computed(() => `Reset map view. Current zoom ${this.mapZoomLabel()}.`);

  readonly pins: readonly MapPin[] = [
    { initials: 'JW', name: 'Jamie Wu', x: 39, y: 27, status: 'available' },
    { initials: 'MK', name: 'Morgan K.', x: 69, y: 35, status: 'heading-somewhere' },
    { initials: 'TS', name: 'Taylor S.', x: 29, y: 69, status: 'gaming' },
    { initials: 'AC', name: 'Alex Carter', x: 57, y: 54, status: 'available' }
  ];

  constructor() {
    void this.reloadMapConfig();
    void this.loadStatusDraft();
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

  markMapImageLoaded(): void {
    this.mapImageFailed.set(false);
    this.resetMapView();
  }

  markMapImageFailed(): void {
    this.mapImageFailed.set(true);
    this.resetMapView();
  }

  startMapPointer(event: PointerEvent): void {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }

    const viewport = event.currentTarget;

    if (!(viewport instanceof HTMLElement)) {
      return;
    }

    event.preventDefault();
    viewport.setPointerCapture(event.pointerId);
    this.activeMapPointers.set(event.pointerId, pointFromPointerEvent(event, viewport));
    this.isMapDragging.set(true);

    if (this.activeMapPointers.size >= 2) {
      this.gestureStart = this.createGestureStart();
      this.lastDragPoint = null;
      return;
    }

    this.gestureStart = null;
    this.lastDragPoint = pointFromPointerEvent(event, viewport);
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
    this.activeMapPointers.set(event.pointerId, pointFromPointerEvent(event, viewport));

    if (this.activeMapPointers.size >= 2) {
      const metrics = pointerMetrics([...this.activeMapPointers.values()]);

      if (!metrics) {
        return;
      }

      this.gestureStart ??= this.createGestureStart();

      if (!this.gestureStart || this.gestureStart.distance === 0) {
        return;
      }

      const nextScale = clampScale(this.gestureStart.scale * (metrics.distance / this.gestureStart.distance));
      const contentX = (this.gestureStart.midpoint.x - this.gestureStart.translateX) / this.gestureStart.scale;
      const contentY = (this.gestureStart.midpoint.y - this.gestureStart.translateY) / this.gestureStart.scale;
      this.applyMapView(
        {
          scale: nextScale,
          translateX: metrics.midpoint.x - contentX * nextScale,
          translateY: metrics.midpoint.y - contentY * nextScale
        },
        viewport
      );
      return;
    }

    const point = pointFromPointerEvent(event, viewport);

    if (!this.lastDragPoint) {
      this.lastDragPoint = point;
      return;
    }

    this.applyMapView(
      {
        scale: this.mapScale(),
        translateX: this.mapTranslateX() + point.x - this.lastDragPoint.x,
        translateY: this.mapTranslateY() + point.y - this.lastDragPoint.y
      },
      viewport
    );
    this.lastDragPoint = point;
  }

  endMapPointer(event: PointerEvent): void {
    const viewport = event.currentTarget;

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
      y: viewport.clientHeight / 2
    });
  }

  resetMapView(): void {
    this.activeMapPointers.clear();
    this.lastDragPoint = null;
    this.gestureStart = null;
    this.isMapDragging.set(false);
    this.mapScale.set(1);
    this.mapTranslateX.set(0);
    this.mapTranslateY.set(0);
  }

  selectStatus(status: MemberStatus): void {
    this.selectedStatus.set(status);
    this.clearStatusMessage();
  }

  updateNote(value: string): void {
    this.note.set(value.slice(0, 80));
    this.clearStatusMessage();
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

  labelFor(status: MemberStatus): string {
    return statusLabel(status);
  }

  private clearStatusMessage(): void {
    this.statusSaveMessage.set('');
    this.statusSaveIsError.set(false);
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
      translateY: this.mapTranslateY()
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
        translateY: focalPoint.y - contentY * nextScale
      },
      viewport
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

function messageForMemberError(error: unknown): string {
  if (error instanceof MemberProfileError && error.code === 'not-authorized') {
    return 'Your session is not authorized. Sign in again before saving.';
  }

  if (error instanceof MemberProfileError && error.code === 'member-not-found') {
    return 'Your profile is not ready yet. Finish onboarding before saving status.';
  }

  return 'Could not save your status. Check your connection and try again.';
}

function pointFromPointerEvent(event: PointerEvent, viewport: HTMLElement): MapPoint {
  const rect = viewport.getBoundingClientRect();

  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

function pointFromWheelEvent(event: WheelEvent, viewport: HTMLElement): MapPoint {
  const rect = viewport.getBoundingClientRect();

  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

function pointerMetrics(points: readonly MapPoint[]): { distance: number; midpoint: MapPoint } | null {
  const first = points[0];
  const second = points[1];

  if (!first || !second) {
    return null;
  }

  return {
    distance: Math.hypot(second.x - first.x, second.y - first.y),
    midpoint: {
      x: (first.x + second.x) / 2,
      y: (first.y + second.y) / 2
    }
  };
}

function constrainMapView(view: MapView, viewportWidth: number, viewportHeight: number): MapView {
  const scale = clampScale(view.scale);

  if (scale === 1 || viewportWidth <= 0 || viewportHeight <= 0) {
    return {
      scale,
      translateX: 0,
      translateY: 0
    };
  }

  const minTranslateX = viewportWidth - viewportWidth * scale;
  const minTranslateY = viewportHeight - viewportHeight * scale;

  return {
    scale,
    translateX: clamp(view.translateX, minTranslateX, 0),
    translateY: clamp(view.translateY, minTranslateY, 0)
  };
}

function clampScale(scale: number): number {
  return clamp(scale, MIN_MAP_SCALE, MAX_MAP_SCALE);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatViewValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}

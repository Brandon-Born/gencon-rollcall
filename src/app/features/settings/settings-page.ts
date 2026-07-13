import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';

import { AuthSession } from '../../core/auth/auth-session';
import { MemberProfile, MemberProfileError } from '../../core/members/member-profile';
import {
  PushNotificationError,
  PushNotifications,
} from '../../core/notifications/push-notifications';
import { SessionStore } from '../../core/session/session-store';

@Component({
  selector: 'app-settings-page',
  template: `
    <main class="page">
      <header>
        <h1>Settings</h1>
        <p>Your name, alerts, and privacy.</p>
      </header>

      <section class="panel">
        <h2>Profile</h2>
        <label>
          <span>Display name</span>
          <input
            type="text"
            maxlength="32"
            [value]="displayName()"
            (input)="displayName.set($any($event.target).value)"
          />
        </label>
        <button
          type="button"
          [disabled]="isSavingName() || !displayName().trim()"
          (click)="saveName()"
        >
          {{ isSavingName() ? 'Saving...' : 'Save name' }}
        </button>
        @if (saveMessage()) {
          <p class="save-message" [class.error]="saveMessageIsError()" role="status">
            {{ saveMessage() }}
          </p>
        }
      </section>

      <section class="panel">
        <div>
          <h2>Rally alerts</h2>
          <p>{{ notificationDescription() }}</p>
        </div>
        <button
          type="button"
          [class.secondary]="notifications.isEnabled()"
          [disabled]="notifications.isBusy() || !notifications.isSupported"
          (click)="toggleNotifications()"
        >
          {{ notificationButtonLabel() }}
        </button>
        @if (notificationMessage()) {
          <p class="save-message" [class.error]="notificationMessageIsError()" role="status">
            {{ notificationMessage() }}
          </p>
        }
      </section>

      <section class="panel">
        <div>
          <h2>Map pin</h2>
          <p>
            {{
              locationVisible()
                ? 'The crew can see your pin. Your status stays visible either way.'
                : 'Your pin is hidden until you place one on the map.'
            }}
          </p>
        </div>
        <button
          type="button"
          class="secondary"
          [disabled]="isHidingLocation() || !locationVisible()"
          (click)="hideLocation()"
        >
          {{ locationButtonLabel() }}
        </button>
        @if (!locationVisible()) {
          <button type="button" (click)="shareLocationAgain()">Share a pin</button>
        }
        @if (locationMessage()) {
          <p class="save-message" [class.error]="locationMessageIsError()" role="status">
            {{ locationMessage() }}
          </p>
        }
      </section>

      <section class="panel">
        <div>
          <h2>Latest version</h2>
          <p>Reload if something looks out of date.</p>
        </div>
        <button
          type="button"
          class="secondary"
          [disabled]="isUpdatingApp()"
          (click)="updateAndReload()"
        >
          {{ isUpdatingApp() ? 'Updating...' : 'Update & reload' }}
        </button>
      </section>

      @if (confirmingLeave()) {
        <section class="panel leave-confirmation" role="alertdialog" aria-labelledby="leave-title">
          <div>
            <strong id="leave-title">Leave Gen Con Roll Call?</strong>
            <p>
              This removes you from the crew on this device. You can always come back with the crew
              password.
            </p>
          </div>
          <div class="confirm-actions">
            <button
              type="button"
              class="secondary"
              [disabled]="isLeaving()"
              (click)="cancelLeave()"
            >
              Stay
            </button>
            <button type="button" class="danger" [disabled]="isLeaving()" (click)="confirmLeave()">
              {{ isLeaving() ? 'Leaving...' : 'Remove me and leave' }}
            </button>
          </div>
          @if (leaveMessage()) {
            <p class="save-message error" role="alert">{{ leaveMessage() }}</p>
          }
        </section>
      } @else {
        <button type="button" class="danger leave-trigger" (click)="confirmingLeave.set(true)">
          Leave Roll Call
        </button>
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

    header {
      padding: 0 18px 20px;
      border-bottom: 1px solid var(--color-border);
    }

    header p,
    .panel p {
      color: var(--color-muted);
      line-height: 1.42;
    }

    header p {
      margin-top: 5px;
      font-size: 15px;
    }

    .panel {
      display: grid;
      gap: 14px;
      margin: 0;
      padding: 22px 18px;
      border-bottom: 1px solid var(--color-border);
      background: var(--color-surface);
    }

    h2 {
      font-family: inherit;
      font-size: 18px;
      font-stretch: normal;
      font-weight: 850;
      letter-spacing: -0.02em;
      line-height: 1.2;
      text-transform: none;
    }

    label {
      display: grid;
      gap: 8px;
      color: var(--color-muted);
      font-size: 12px;
      font-weight: 850;
    }

    input {
      min-height: 46px;
      padding: 0 12px;
      border: 1px solid var(--color-border);
      border-radius: 10px;
      color: var(--color-text);
      font-size: 15px;
      font-weight: 700;
    }

    button {
      min-height: 46px;
      border: 0;
      border-radius: 6px;
      background: var(--color-gencon-red);
      color: white;
      font-size: 15px;
      font-weight: 850;
    }

    button:disabled {
      cursor: not-allowed;
      opacity: 0.52;
    }

    .save-message {
      margin: -4px 0 0;
      color: var(--color-muted);
      font-size: 13px;
      font-weight: 750;
      line-height: 1.35;
    }

    .save-message.error {
      color: var(--color-gencon-red);
    }

    .secondary {
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      color: var(--color-text);
    }

    .danger {
      background: var(--color-text);
    }

    .leave-trigger {
      width: auto;
      min-height: 52px;
      margin: 18px;
      border: 1px solid rgba(213, 43, 30, 0.3);
      background: transparent;
      color: var(--color-gencon-red);
    }

    .leave-confirmation {
      border-color: rgba(214, 56, 47, 0.32);
    }

    .confirm-actions {
      display: grid;
      grid-template-columns: 1fr 1.5fr;
      gap: 10px;
    }
  `,
})
export class SettingsPage {
  private readonly authSession = inject(AuthSession);
  private readonly memberProfile = inject(MemberProfile);
  readonly notifications = inject(PushNotifications);
  private readonly router = inject(Router);
  private readonly session = inject(SessionStore);
  private readonly swUpdate = inject(SwUpdate);

  readonly displayName = signal(this.session.displayName());
  readonly isSavingName = signal(false);
  readonly saveMessage = signal('');
  readonly saveMessageIsError = signal(false);
  readonly locationVisible = signal(true);
  readonly isHidingLocation = signal(false);
  readonly locationMessage = signal('');
  readonly locationMessageIsError = signal(false);
  readonly confirmingLeave = signal(false);
  readonly isLeaving = signal(false);
  readonly leaveMessage = signal('');
  readonly notificationMessage = signal('');
  readonly notificationMessageIsError = signal(false);
  readonly isUpdatingApp = signal(false);
  readonly notificationDescription = computed(() => {
    if (!this.notifications.isSupported) {
      return 'Rally alerts aren’t available in this browser.';
    }
    if (this.notifications.permission() === 'denied') {
      return 'Notifications are blocked in this browser. Allow them in the site settings to turn them on.';
    }
    return this.notifications.isEnabled()
      ? 'You’ll get new rally alerts and replies to rallies you start.'
      : 'Get a heads-up when someone picks a meetup spot.';
  });
  readonly notificationButtonLabel = computed(() => {
    if (this.notifications.isBusy()) return 'Saving...';
    return this.notifications.isEnabled() ? 'Turn off alerts' : 'Turn on alerts';
  });
  readonly locationButtonLabel = computed(() => {
    if (this.isHidingLocation()) {
      return 'Hiding...';
    }

    return this.locationVisible() ? 'Hide my pin' : 'Pin hidden';
  });

  constructor() {
    void this.loadLocationState();
  }

  async saveName(): Promise<void> {
    if (this.isSavingName()) {
      return;
    }

    this.isSavingName.set(true);
    this.saveMessage.set('');
    this.saveMessageIsError.set(false);

    try {
      const member = await this.memberProfile.saveCurrentMember(this.displayName());
      this.displayName.set(member.displayName);
      this.saveMessage.set('Name saved.');
    } catch (error) {
      this.saveMessage.set(messageFor(error));
      this.saveMessageIsError.set(true);
    } finally {
      this.isSavingName.set(false);
    }
  }

  cancelLeave(): void {
    if (!this.isLeaving()) {
      this.confirmingLeave.set(false);
      this.leaveMessage.set('');
    }
  }

  async confirmLeave(): Promise<void> {
    if (this.isLeaving()) {
      return;
    }

    this.isLeaving.set(true);
    this.leaveMessage.set('');

    try {
      try {
        await this.notifications.disable();
      } catch {
        // Leaving must still remove the member when a best-effort token cleanup is offline.
      }
      await this.memberProfile.deleteCurrentMember();
      await this.authSession.leaveApp();
      void this.router.navigateByUrl('/gate');
    } catch {
      this.leaveMessage.set(
        'Could not remove your member entry. Check your connection and try again.',
      );
      this.isLeaving.set(false);
    }
  }

  async toggleNotifications(): Promise<void> {
    this.notificationMessage.set('');
    this.notificationMessageIsError.set(false);
    try {
      if (this.notifications.isEnabled()) {
        await this.notifications.disable();
        this.notificationMessage.set('Notifications turned off on this device.');
      } else {
        await this.notifications.enable();
        this.notificationMessage.set('Notifications turned on for this device.');
      }
    } catch (error) {
      this.notificationMessage.set(notificationMessageFor(error));
      this.notificationMessageIsError.set(true);
    }
  }

  async updateAndReload(): Promise<void> {
    if (this.isUpdatingApp()) {
      return;
    }

    this.isUpdatingApp.set(true);

    try {
      await activateLatestAppVersion(this.swUpdate);
    } catch {
      // A normal reload is still useful when the update check is temporarily unavailable.
    } finally {
      window.location.reload();
    }
  }

  async hideLocation(): Promise<void> {
    if (this.isHidingLocation() || !this.locationVisible()) {
      return;
    }

    this.isHidingLocation.set(true);
    this.locationMessage.set('');
    this.locationMessageIsError.set(false);

    try {
      const member = await this.memberProfile.hideCurrentLocation();
      this.locationVisible.set(member.locationVisible);
      this.locationMessage.set('Pin hidden. Your status and note still show in People.');
    } catch (error) {
      this.locationMessage.set(locationMessageFor(error));
      this.locationMessageIsError.set(true);
    } finally {
      this.isHidingLocation.set(false);
    }
  }

  shareLocationAgain(): void {
    void this.router.navigate(['/app/map'], { queryParams: { share: 'location' } });
  }

  private async loadLocationState(): Promise<void> {
    try {
      const member = await this.memberProfile.loadCurrentMember();

      if (member) {
        this.locationVisible.set(member.locationVisible);
      }
    } catch {
      this.locationMessage.set(
        'Could not load your location visibility. Check your connection and try again.',
      );
      this.locationMessageIsError.set(true);
    }
  }
}

export interface AppUpdateClient {
  readonly isEnabled: boolean;
  checkForUpdate(): Promise<boolean>;
  activateUpdate(): Promise<boolean>;
}

export async function activateLatestAppVersion(update: AppUpdateClient): Promise<void> {
  if (update.isEnabled && (await update.checkForUpdate())) {
    await update.activateUpdate();
  }
}

function messageFor(error: unknown): string {
  if (error instanceof MemberProfileError && error.code === 'display-name-required') {
    return 'Enter a display name before saving.';
  }

  if (error instanceof MemberProfileError && error.code === 'not-authorized') {
    return 'Your session is not authorized. Sign in again before saving.';
  }

  if (error instanceof MemberProfileError && error.code === 'display-name-taken') {
    return 'That name is already in the crew.';
  }

  return 'Could not save your name. Check your connection and try again.';
}

function locationMessageFor(error: unknown): string {
  if (error instanceof MemberProfileError && error.code === 'not-authorized') {
    return 'Your session is not authorized. Sign in again before changing visibility.';
  }

  if (error instanceof MemberProfileError && error.code === 'member-not-found') {
    return 'Your profile is not ready yet. Finish onboarding before changing visibility.';
  }

  return 'Could not hide your location. Check your connection and try again.';
}

function notificationMessageFor(error: unknown): string {
  if (error instanceof PushNotificationError && error.code === 'permission-denied') {
    return 'Notifications were not allowed. You can change that in this browser’s site settings.';
  }
  if (error instanceof PushNotificationError && error.code === 'unsupported') {
    return 'This browser cannot receive push notifications for this app.';
  }
  return 'Could not update notifications. Check your connection and try again.';
}

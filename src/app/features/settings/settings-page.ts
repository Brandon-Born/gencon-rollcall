import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

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
        <p>Control your name, visibility, and local session.</p>
      </header>

      <section class="panel">
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
          <strong>Rally notifications</strong>
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
          <strong>Location visibility</strong>
          <p>
            {{
              locationVisible()
                ? 'Hide your map pin while staying visible in the people list.'
                : 'Your map pin is hidden. Tap the map anytime to share a new pin.'
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
          <button type="button" (click)="shareLocationAgain()">Share my location again</button>
        }
        @if (locationMessage()) {
          <p class="save-message" [class.error]="locationMessageIsError()" role="status">
            {{ locationMessage() }}
          </p>
        }
      </section>

      @if (confirmingLeave()) {
        <section class="panel leave-confirmation" role="alertdialog" aria-labelledby="leave-title">
          <div>
            <strong id="leave-title">Leave Gen Con Roll Call?</strong>
            <p>
              This removes your member entry and anonymous identity from this device. Returning
              later creates a new entry after you use the shared password again.
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
          Leave app
        </button>
      }
    </main>
  `,
  styles: `
    .page {
      min-height: 100svh;
      padding: 22px 16px;
      background: var(--color-bg);
    }

    h1,
    p {
      margin: 0;
    }

    h1 {
      color: var(--color-text);
      font-size: 28px;
    }

    header p,
    .panel p {
      color: var(--color-muted);
      line-height: 1.42;
    }

    header p {
      margin-top: 6px;
    }

    .panel {
      display: grid;
      gap: 14px;
      margin-top: 16px;
      padding: 16px;
      border: 1px solid var(--color-border);
      border-radius: 16px;
      background: var(--color-surface);
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

    strong {
      color: var(--color-text);
      font-size: 17px;
    }

    button {
      min-height: 46px;
      border: 0;
      border-radius: 10px;
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
      background: #151821;
    }

    .leave-trigger {
      width: 100%;
      margin-top: 18px;
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
  readonly notificationDescription = computed(() => {
    if (!this.notifications.isSupported) {
      return 'Push notifications are unavailable until web push is configured for this app and supported by this browser.';
    }
    if (this.notifications.permission() === 'denied') {
      return 'Notifications are blocked in this browser. Allow them in the site settings to turn them on.';
    }
    return this.notifications.isEnabled()
      ? 'This device gets new rally alerts and response updates for rallies you create.'
      : 'Get new rally alerts and response updates on this device. Location changes never send alerts.';
  });
  readonly notificationButtonLabel = computed(() => {
    if (this.notifications.isBusy()) return 'Saving...';
    return this.notifications.isEnabled() ? 'Turn off notifications' : 'Turn on notifications';
  });
  readonly locationButtonLabel = computed(() => {
    if (this.isHidingLocation()) {
      return 'Hiding...';
    }

    return this.locationVisible() ? 'Hide my location' : 'Location hidden';
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
      this.locationMessage.set('Location hidden. Your status and note still appear in People.');
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

function messageFor(error: unknown): string {
  if (error instanceof MemberProfileError && error.code === 'display-name-required') {
    return 'Enter a display name before saving.';
  }

  if (error instanceof MemberProfileError && error.code === 'not-authorized') {
    return 'Your session is not authorized. Sign in again before saving.';
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

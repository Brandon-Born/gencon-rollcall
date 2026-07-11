import { Injectable, inject, signal } from '@angular/core';

import { environment } from '../../../environments/environment';
import { AuthSession } from '../auth/auth-session';
import { FirebaseClient } from '../firebase/firebase-client';

const tokenStorageKey = 'gencon-rollcall.pushToken';

@Injectable({ providedIn: 'root' })
export class PushNotifications {
  private readonly authSession = inject(AuthSession);
  private readonly firebase = inject(FirebaseClient);

  readonly isBusy = signal(false);
  readonly isEnabled = signal(Boolean(localStorage.getItem(tokenStorageKey)));
  readonly permission = signal<NotificationPermission | 'unsupported'>(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  );

  readonly isSupported =
    typeof Notification !== 'undefined' &&
    'serviceWorker' in navigator &&
    Boolean(environment.webPushPublicKey);

  async enable(): Promise<void> {
    if (!this.isSupported) {
      throw new PushNotificationError('unsupported');
    }

    const user = this.authSession.user();
    if (!user || !this.authSession.isAuthorized()) {
      throw new PushNotificationError('not-authorized');
    }

    this.isBusy.set(true);
    try {
      const permission = await Notification.requestPermission();
      this.permission.set(permission);
      if (permission !== 'granted') {
        throw new PushNotificationError('permission-denied');
      }

      const registration = await navigator.serviceWorker.ready;
      const { getMessaging, getToken, isSupported } = await import('firebase/messaging');
      if (!(await isSupported())) {
        throw new PushNotificationError('unsupported');
      }

      const token = await getToken(getMessaging(await this.firebase.getApp()), {
        vapidKey: environment.webPushPublicKey,
        serviceWorkerRegistration: registration,
      });
      if (!token) {
        throw new PushNotificationError('token-unavailable');
      }

      await this.saveSubscription(token, 'POST');
      localStorage.setItem(tokenStorageKey, token);
      this.isEnabled.set(true);
    } finally {
      this.isBusy.set(false);
    }
  }

  async disable(): Promise<void> {
    const token = localStorage.getItem(tokenStorageKey);
    this.isBusy.set(true);
    try {
      if (token && this.authSession.user()) {
        await this.saveSubscription(token, 'DELETE');
      }
      localStorage.removeItem(tokenStorageKey);
      this.isEnabled.set(false);
    } finally {
      this.isBusy.set(false);
    }
  }

  private async saveSubscription(token: string, method: 'POST' | 'DELETE'): Promise<void> {
    const user = this.authSession.user();
    if (!user) {
      throw new PushNotificationError('not-authorized');
    }

    const response = await fetch('/api/notification-subscription', {
      method,
      headers: {
        authorization: `Bearer ${await user.getIdToken()}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });
    if (!response.ok) {
      throw new PushNotificationError('subscription-failed');
    }
  }
}

export type PushNotificationErrorCode =
  | 'unsupported'
  | 'not-authorized'
  | 'permission-denied'
  | 'token-unavailable'
  | 'subscription-failed';

export class PushNotificationError extends Error {
  constructor(readonly code: PushNotificationErrorCode) {
    super(code);
  }
}

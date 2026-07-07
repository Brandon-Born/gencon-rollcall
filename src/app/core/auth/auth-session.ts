import { Injectable, computed, inject, signal } from '@angular/core';
import type { User } from 'firebase/auth';

import { FirebaseClient } from '../firebase/firebase-client';
import { SessionStore } from '../session/session-store';

const authorizedUidKey = 'gencon-rollcall.authorizedUid';

export type AuthSessionError = 'firebase-not-configured';

@Injectable({ providedIn: 'root' })
export class AuthSession {
  private readonly firebase = inject(FirebaseClient);
  private readonly session = inject(SessionStore);
  private readonly readyResolvers: Array<() => void> = [];

  readonly authReady = signal(false);
  readonly authorizationReady = signal(false);
  readonly user = signal<User | null>(null);
  readonly isAuthorized = signal(false);
  readonly isReady = computed(() => this.authReady() && this.authorizationReady());

  constructor() {
    if (!this.firebase.isConfigured) {
      this.authReady.set(true);
      this.authorizationReady.set(true);
      this.resolveReady();
      return;
    }

    void this.watchAuthState();
  }

  async ensureAnonymousUser(): Promise<User> {
    if (!this.firebase.isConfigured) {
      throw new AuthSessionFailure('firebase-not-configured');
    }

    const { browserLocalPersistence, setPersistence, signInAnonymously } = await import('firebase/auth');
    const auth = await this.firebase.getAuth();
    await setPersistence(auth, browserLocalPersistence);

    if (auth.currentUser) {
      return auth.currentUser;
    }

    const credential = await signInAnonymously(auth);
    return credential.user;
  }

  markAuthorized(uid: string): void {
    localStorage.setItem(authorizedUidKey, uid);
    this.isAuthorized.set(true);
    this.authorizationReady.set(true);
    this.resolveReady();
  }

  async leaveApp(): Promise<void> {
    localStorage.removeItem(authorizedUidKey);
    this.session.clear();

    if (this.firebase.isConfigured) {
      const { signOut } = await import('firebase/auth');
      await signOut(await this.firebase.getAuth());
    }

    this.user.set(null);
    this.isAuthorized.set(false);
    this.authReady.set(true);
    this.authorizationReady.set(true);
    this.resolveReady();
  }

  whenReady(): Promise<void> {
    if (this.isReady()) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.readyResolvers.push(resolve);
    });
  }

  private async refreshAuthorization(uid: string): Promise<void> {
    this.authorizationReady.set(false);

    try {
      const { doc, getDoc } = await import('firebase/firestore');
      const snapshot = await getDoc(doc(await this.firebase.getFirestore(), 'authorizedUsers', uid));
      const isAuthorized = snapshot.exists() && snapshot.data()?.['authorized'] === true;
      this.isAuthorized.set(isAuthorized);

      if (isAuthorized) {
        localStorage.setItem(authorizedUidKey, uid);
      } else {
        localStorage.removeItem(authorizedUidKey);
      }
    } catch {
      this.isAuthorized.set(localStorage.getItem(authorizedUidKey) === uid);
    } finally {
      this.authorizationReady.set(true);
      this.resolveReady();
    }
  }

  private async watchAuthState(): Promise<void> {
    try {
      const { browserLocalPersistence, onAuthStateChanged, setPersistence } = await import('firebase/auth');
      const auth = await this.firebase.getAuth();
      await setPersistence(auth, browserLocalPersistence);

      onAuthStateChanged(auth, (user) => {
        this.user.set(user);
        this.authReady.set(true);

        if (!user) {
          this.isAuthorized.set(false);
          localStorage.removeItem(authorizedUidKey);
          this.authorizationReady.set(true);
          this.resolveReady();
          return;
        }

        void this.refreshAuthorization(user.uid);
      });
    } catch {
      this.user.set(null);
      this.isAuthorized.set(false);
      this.authReady.set(true);
      this.authorizationReady.set(true);
      this.resolveReady();
    }
  }

  private resolveReady(): void {
    if (!this.isReady()) {
      return;
    }

    while (this.readyResolvers.length) {
      this.readyResolvers.shift()?.();
    }
  }
}

export class AuthSessionFailure extends Error {
  constructor(readonly code: AuthSessionError) {
    super(code);
  }
}

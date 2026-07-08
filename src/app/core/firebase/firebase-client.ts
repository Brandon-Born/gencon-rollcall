import { Injectable } from '@angular/core';
import type { FirebaseApp, FirebaseOptions } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';

import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class FirebaseClient {
  private app: FirebaseApp | null = null;
  private authEmulatorConnected = false;
  private firestoreEmulatorConnected = false;

  readonly isConfigured = Boolean(environment.firebase.apiKey && environment.firebase.projectId);

  async getApp(): Promise<FirebaseApp> {
    if (!this.isConfigured) {
      throw new Error('Firebase is not configured. Fill src/environments/environment.ts first.');
    }

    const { initializeApp } = await import('firebase/app');
    this.app ??= initializeApp(environment.firebase as FirebaseOptions);
    return this.app;
  }

  async getAuth(): Promise<Auth> {
    const { connectAuthEmulator, getAuth } = await import('firebase/auth');
    const auth = getAuth(await this.getApp());

    if (environment.firebaseEmulators.enabled && !this.authEmulatorConnected) {
      connectAuthEmulator(
        auth,
        `http://${environment.firebaseEmulators.authHost}:${environment.firebaseEmulators.authPort}`,
        { disableWarnings: true }
      );
      this.authEmulatorConnected = true;
    }

    return auth;
  }

  async getFirestore(): Promise<Firestore> {
    const { connectFirestoreEmulator, getFirestore } = await import('firebase/firestore');
    const firestore = getFirestore(await this.getApp());

    if (environment.firebaseEmulators.enabled && !this.firestoreEmulatorConnected) {
      connectFirestoreEmulator(
        firestore,
        environment.firebaseEmulators.firestoreHost,
        environment.firebaseEmulators.firestorePort
      );
      this.firestoreEmulatorConnected = true;
    }

    return firestore;
  }
}

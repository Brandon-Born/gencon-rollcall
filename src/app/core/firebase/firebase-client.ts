import { Injectable } from '@angular/core';
import type { FirebaseApp, FirebaseOptions } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import type { FirebaseStorage } from 'firebase/storage';

import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class FirebaseClient {
  private app: FirebaseApp | null = null;

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
    const { getAuth } = await import('firebase/auth');
    return getAuth(await this.getApp());
  }

  async getFirestore(): Promise<Firestore> {
    const { getFirestore } = await import('firebase/firestore');
    return getFirestore(await this.getApp());
  }

  async getStorage(): Promise<FirebaseStorage> {
    const { getStorage } = await import('firebase/storage');
    return getStorage(await this.getApp());
  }
}

import { Injectable, inject, signal } from '@angular/core';

import { FirebaseClient } from '../firebase/firebase-client';
import type { AppConfig } from '../models/app-config';

export type AppConfigLoadError = 'firebase-not-configured' | 'load-failed';

@Injectable({ providedIn: 'root' })
export class AppConfigService {
  private readonly firebase = inject(FirebaseClient);
  private loadPromise: Promise<AppConfig | null> | null = null;

  readonly config = signal<AppConfig | null>(null);
  readonly isLoading = signal(false);
  readonly error = signal<AppConfigLoadError | null>(null);

  async loadCurrentConfig(options: { force?: boolean } = {}): Promise<AppConfig | null> {
    if (!options.force && this.config()) {
      return this.config();
    }

    if (!options.force && this.loadPromise) {
      return this.loadPromise;
    }

    this.isLoading.set(true);
    this.error.set(null);

    this.loadPromise = this.readCurrentConfig();

    try {
      const config = await this.loadPromise;
      this.config.set(config);
      return config;
    } catch (error) {
      this.config.set(null);
      this.error.set(error instanceof AppConfigServiceError ? error.code : 'load-failed');
      return null;
    } finally {
      this.loadPromise = null;
      this.isLoading.set(false);
    }
  }

  private async readCurrentConfig(): Promise<AppConfig | null> {
    if (!this.firebase.isConfigured) {
      throw new AppConfigServiceError('firebase-not-configured');
    }

    const { doc, getDoc } = await import('firebase/firestore');
    const snapshot = await getDoc(doc(await this.firebase.getFirestore(), 'appConfig', 'current'));

    if (!snapshot.exists()) {
      return null;
    }

    return toAppConfig(snapshot.data());
  }
}

class AppConfigServiceError extends Error {
  constructor(readonly code: AppConfigLoadError) {
    super(code);
  }
}

function toAppConfig(data: Record<string, unknown>): AppConfig {
  const displayName = stringValue(data['mapDisplayName']).trim();

  return {
    mapImageUrl: stringValue(data['mapImageUrl']).trim(),
    mapDisplayName: displayName || 'Convention map',
    updatedAt: dateValue(data['updatedAt'])
  };
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function dateValue(value: unknown): Date {
  if (value instanceof Date) {
    return value;
  }

  if (value && typeof value === 'object' && 'toDate' in value) {
    const maybeTimestamp = value as { toDate?: () => Date };

    if (typeof maybeTimestamp.toDate === 'function') {
      return maybeTimestamp.toDate();
    }
  }

  return new Date();
}

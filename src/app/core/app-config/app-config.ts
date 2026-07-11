import { Injectable, inject, signal } from '@angular/core';

import { FirebaseClient } from '../firebase/firebase-client';
import type { AppConfig, MapDefinition, MapManifest } from '../models/app-config';

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

    const data = snapshot.data();
    const mapManifestUrl = stringValue(data['mapManifestUrl']).trim();
    const legacyMap = legacyMapDefinition(data);

    if (mapManifestUrl) {
      try {
        const response = await fetch(mapManifestUrl, { headers: { accept: 'application/json' } });

        if (!response.ok) {
          throw new Error(`Map manifest returned ${response.status}.`);
        }

        const manifest = validateMapManifest(await response.json());
        return {
          mapManifestUrl,
          mapImageUrl: legacyMap?.imageUrl ?? '',
          mapDisplayName:
            stringValue(data['mapDisplayName']).trim() || manifest.displayName || 'Convention map',
          defaultMapId: manifest.defaultMapId,
          maps: manifest.maps,
          updatedAt: dateValue(data['updatedAt']),
        };
      } catch {
        if (!legacyMap) {
          throw new AppConfigServiceError('load-failed');
        }
      }
    }

    return createLegacyAppConfig(data, mapManifestUrl, legacyMap);
  }
}

class AppConfigServiceError extends Error {
  constructor(readonly code: AppConfigLoadError) {
    super(code);
  }
}

export function createLegacyAppConfig(
  data: Record<string, unknown>,
  mapManifestUrl = stringValue(data['mapManifestUrl']).trim(),
  legacyMap = legacyMapDefinition(data),
): AppConfig {
  const displayName = stringValue(data['mapDisplayName']).trim();

  return {
    mapManifestUrl,
    mapImageUrl: legacyMap?.imageUrl ?? '',
    mapDisplayName: displayName || 'Convention map',
    defaultMapId: legacyMap?.id ?? '',
    maps: legacyMap ? [legacyMap] : [],
    updatedAt: dateValue(data['updatedAt']),
  };
}

function legacyMapDefinition(data: Record<string, unknown>): MapDefinition | null {
  const imageUrl = stringValue(data['mapImageUrl']).trim();

  if (!imageUrl) {
    return null;
  }

  return {
    id: validMapId(data['mapId']) ? String(data['mapId']) : 'legacy',
    label: stringValue(data['mapDisplayName']).trim() || 'Convention map',
    shortLabel: 'Map',
    imageUrl,
    width: null,
    height: null,
  };
}

export function validateMapManifest(value: unknown): MapManifest {
  if (!value || typeof value !== 'object') {
    throw new Error('Map manifest must be an object.');
  }

  const data = value as Record<string, unknown>;
  const id = stringValue(data['id']).trim();
  const displayName = stringValue(data['displayName']).trim();
  const defaultMapId = stringValue(data['defaultMapId']).trim();
  const rawMaps = data['maps'];

  if (
    !id ||
    !displayName ||
    !validMapId(defaultMapId) ||
    !Array.isArray(rawMaps) ||
    !rawMaps.length
  ) {
    throw new Error('Map manifest is missing required fields.');
  }

  const maps = rawMaps.map(validateMapDefinition);
  const ids = new Set(maps.map((map) => map.id));

  if (ids.size !== maps.length || !ids.has(defaultMapId)) {
    throw new Error('Map manifest contains duplicate ids or an unknown default map.');
  }

  return { id, displayName, defaultMapId, maps };
}

function validateMapDefinition(value: unknown): MapDefinition {
  if (!value || typeof value !== 'object') {
    throw new Error('Map entry must be an object.');
  }

  const data = value as Record<string, unknown>;
  const id = stringValue(data['id']).trim();
  const label = stringValue(data['label']).trim();
  const shortLabel = stringValue(data['shortLabel']).trim();
  const imageUrl = stringValue(data['imageUrl']).trim();
  const width = positiveInteger(data['width']);
  const height = positiveInteger(data['height']);

  if (!validMapId(id) || !label || !shortLabel || !imageUrl || width === null || height === null) {
    throw new Error('Map entry is invalid.');
  }

  return { id, label, shortLabel, imageUrl, width, height };
}

function validMapId(value: unknown): boolean {
  return typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function positiveInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
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

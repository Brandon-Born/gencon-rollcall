export interface AppConfig {
  mapManifestUrl: string;
  mapImageUrl: string;
  mapDisplayName: string;
  defaultMapId: string;
  maps: MapDefinition[];
  updatedAt: Date;
}

export interface MapDefinition {
  id: string;
  label: string;
  shortLabel: string;
  imageUrl: string;
  width: number | null;
  height: number | null;
}

export interface MapManifest {
  id: string;
  displayName: string;
  defaultMapId: string;
  maps: MapDefinition[];
}

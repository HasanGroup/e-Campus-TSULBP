export type CameraPresetId =
  | 'overview'
  | 'rectorate'
  | 'building5'
  | 'stadium'
  | 'topdown';

export type LightingMode = 'day' | 'sunset' | 'night';

export interface LayerVisibility {
  satelliteGround: boolean;
  osmContext: boolean;
  buildingLabels: boolean;
  miniMap: boolean;
}

export interface CampusBuildingMeta {
  id: string;
  code: string;
  nameTj: string;
  nameRu: string;
  nameEn: string;
  category: string;
  stories: number;
  departmentsTj: string[];
  departmentsRu: string[];
  descriptionEn: string;
  /** Local Three.js meters [x, z] */
  localPos: [number, number];
  /** Geographic WGS84 coordinates */
  lat: number;
  lng: number;
  /** Recommended camera position and target when flying to this building */
  cameraView: {
    position: [number, number, number];
    target: [number, number, number];
  };
  searchQuery: string;
  accentColor: string;
}

export interface CameraPreset {
  id: CameraPresetId;
  label: string;
  shortLabel: string;
  position: [number, number, number];
  target: [number, number, number];
}

export interface OsmPolygon {
  id: string;
  kind: 'building' | 'road' | 'pitch';
  name?: string;
  points: Array<[number, number]>; // [x, z] in local meters
  height?: number;
  width?: number;
}

export interface OsmDataset {
  source: 'overpass' | 'fallback';
  buildings: OsmPolygon[];
  roads: OsmPolygon[];
  fetchedAt: number;
}

export interface ProjectedLabel {
  id: string;
  nameTj: string;
  nameRu: string;
  code: string;
  x: number;
  y: number;
  visible: boolean;
  selected: boolean;
}

export interface CampusSearchSource {
  title: string;
  uri: string;
}

export interface CampusSearchResult {
  summary: string;
  sources: CampusSearchSource[];
}

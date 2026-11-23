import {
  CAMPUS_ORIGIN,
  getFallbackOsmDataset,
  latLonToLocal,
} from '../data/campusData';
import type { OsmDataset, OsmPolygon } from '../types/campus';

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  nodes?: number[];
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements?: OverpassElement[];
}

/**
 * Checks whether a local [x, z] centroid falls inside the detailed TSULBP hero
 * architectural reconstruction perimeter so OSM context buildings surround the
 * campus cleanly without Z-fighting or double-rendering hero buildings.
 */
function isInsideHeroCampus(x: number, z: number): boolean {
  // SW Rectorate + Main Gate block
  if (x >= -126 && x <= -35 && z >= 10 && z <= 104) return true;
  // Central Stadium + Square + Flanking buildings
  if (x >= -50 && x <= 78 && z >= -18 && z <= 96) return true;
  // NE Sector + New 5th Building + Innovation Pavilion
  if (x >= -58 && x <= 118 && z >= -116 && z <= -18) return true;
  return false;
}

function polygonCentroid(points: Array<[number, number]>): [number, number] {
  let sx = 0;
  let sz = 0;
  for (const [x, z] of points) {
    sx += x;
    sz += z;
  }
  const n = Math.max(1, points.length);
  return [sx / n, sz / n];
}

function estimateHeight(tags?: Record<string, string>): number {
  if (!tags) return 10;
  if (tags.height) {
    const parsed = parseFloat(tags.height);
    if (!Number.isNaN(parsed) && parsed > 2) return parsed;
  }
  if (tags['building:levels']) {
    const levels = parseFloat(tags['building:levels']);
    if (!Number.isNaN(levels) && levels > 0) return levels * 3.4;
  }
  return 10.5;
}

function estimateRoadWidth(tags?: Record<string, string>): number {
  const hw = tags?.highway || '';
  if (hw === 'trunk' || hw === 'primary') return 16;
  if (hw === 'secondary') return 12;
  if (hw === 'tertiary') return 9;
  if (hw === 'footway' || hw === 'path') return 3.2;
  return 7;
}

/**
 * Queries OpenStreetMap Overpass API within 350m of [40.3125, 69.6225].
 * Falls back transparently to the calibrated local dataset on timeout or network error.
 */
export async function fetchCampusOsmData(): Promise<OsmDataset> {
  const fallback = getFallbackOsmDataset();
  const radius = 350;
  const query = `
    [out:json][timeout:6];
    (
      way["building"](around:${radius},${CAMPUS_ORIGIN.lat},${CAMPUS_ORIGIN.lng});
      way["highway"](around:${radius},${CAMPUS_ORIGIN.lat},${CAMPUS_ORIGIN.lng});
      way["leisure"="pitch"](around:${radius},${CAMPUS_ORIGIN.lat},${CAMPUS_ORIGIN.lng});
    );
    (._;>;);
    out body;
  `.trim();

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 5500);

  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });
    window.clearTimeout(timer);

    if (!res.ok) {
      return fallback;
    }

    const json = (await res.json()) as OverpassResponse;
    const elements = json.elements ?? [];
    if (elements.length === 0) {
      return fallback;
    }

    const nodeLookup: Record<number, [number, number]> = {};
    for (const el of elements) {
      if (el.type === 'node' && el.lat !== undefined && el.lon !== undefined) {
        nodeLookup[el.id] = latLonToLocal(el.lat, el.lon);
      }
    }

    const buildings: OsmPolygon[] = [];
    const roads: OsmPolygon[] = [];

    for (const el of elements) {
      if (el.type !== 'way' || !el.nodes || el.nodes.length < 2) continue;
      const pts: Array<[number, number]> = [];
      for (const nid of el.nodes) {
        const coord = nodeLookup[nid];
        if (coord) pts.push(coord);
      }
      if (pts.length < 2) continue;

      const tags = el.tags ?? {};
      if (tags.building && pts.length >= 3) {
        const [cx, cz] = polygonCentroid(pts);
        if (!isInsideHeroCampus(cx, cz)) {
          buildings.push({
            id: `osm-b-${el.id}`,
            kind: 'building',
            name: tags.name || tags['name:ru'] || tags['name:tg'],
            points: pts,
            height: estimateHeight(tags),
          });
        }
      } else if (tags.highway) {
        roads.push({
          id: `osm-r-${el.id}`,
          kind: 'road',
          name: tags.name || tags['name:ru'],
          points: pts,
          width: estimateRoadWidth(tags),
        });
      }
    }

    // Merge fallback roads if Overpass returned few roads, and combine cleanly
    return {
      source: 'overpass',
      buildings: buildings.length >= 4 ? buildings : fallback.buildings,
      roads: roads.length >= 3 ? roads : fallback.roads,
      fetchedAt: Date.now(),
    };
  } catch {
    window.clearTimeout(timer);
    return fallback;
  }
}

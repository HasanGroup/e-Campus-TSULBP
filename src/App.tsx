/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BuildingInspector } from './components/BuildingInspector';
import { CampusViewport } from './components/CampusViewport';
import { ControlDock } from './components/ControlDock';
import { GoogleMapsMiniMap } from './components/GoogleMapsMiniMap';
import {
  CAMERA_PRESETS,
  CAMPUS_BUILDINGS,
  CAMPUS_ORIGIN,
  getFallbackOsmDataset,
  latLonToLocal,
} from './data/campusData';
import { fetchCampusOsmData } from './services/overpassService';
import type {
  CameraPresetId,
  CampusBuildingMeta,
  LayerVisibility,
  LightingMode,
  OsmDataset,
} from './types/campus';

export default function App() {
  const [gmpQuotaExceeded, setGmpQuotaExceeded] = useState(false);
  const [lightingMode, setLightingMode] = useState<LightingMode>('day');
  const [activePreset, setActivePreset] = useState<CameraPresetId>('overview');
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(
    null
  );
  const [layers, setLayers] = useState<LayerVisibility>({
    satelliteGround: true,
    osmContext: true,
    buildingLabels: true,
    miniMap: true,
  });

  const [osmData, setOsmData] = useState<OsmDataset>(() =>
    getFallbackOsmDataset()
  );
  const [mapCenterCoords, setMapCenterCoords] = useState<{
    lat: number;
    lng: number;
  }>({
    lat: CAMPUS_ORIGIN.lat,
    lng: CAMPUS_ORIGIN.lng,
  });

  const [cameraCommand, setCameraCommand] = useState<{
    position: [number, number, number];
    target: [number, number, number];
    nonce: number;
  } | null>(null);

  // Listen for Google Maps quota exceeded event
  useEffect(() => {
    const onQuotaExceeded = () => setGmpQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuotaExceeded);
    return () =>
      window.removeEventListener('gmp-quota-exceeded', onQuotaExceeded);
  }, []);

  // Fetch real OSM footprints around [40.3125, 69.6225] asynchronously
  useEffect(() => {
    let active = true;
    fetchCampusOsmData().then((data) => {
      if (active) setOsmData(data);
    });
    return () => {
      active = false;
    };
  }, []);

  // Keyboard shortcut 'H' to toggle HUD dock
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() === 'h' &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        setDockCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const selectedBuilding = useMemo(
    () => CAMPUS_BUILDINGS.find((b) => b.id === selectedBuildingId) ?? null,
    [selectedBuildingId]
  );

  const handleSelectPreset = useCallback((presetId: CameraPresetId) => {
    setActivePreset(presetId);
    const preset = CAMERA_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setCameraCommand({
      position: preset.position,
      target: preset.target,
      nonce: Date.now(),
    });
  }, []);

  const handleFlyToBuilding = useCallback((building: CampusBuildingMeta) => {
    setCameraCommand({
      position: building.cameraView.position,
      target: building.cameraView.target,
      nonce: Date.now(),
    });
  }, []);

  const handleToggleLayer = useCallback((key: keyof LayerVisibility) => {
    setLayers((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, []);

  const handleMiniMapCoordClick = useCallback(
    (coords: { lat: number; lng: number }) => {
      const [lx, lz] = latLonToLocal(coords.lat, coords.lng);
      setCameraCommand({
        position: [lx - 20, 75, lz + 85],
        target: [lx, 4, lz],
        nonce: Date.now(),
      });
    },
    []
  );

  const handleSelectBuildingFromMiniMap = useCallback((id: string) => {
    setSelectedBuildingId(id);
    const b = CAMPUS_BUILDINGS.find((item) => item.id === id);
    if (b) {
      setCameraCommand({
        position: b.cameraView.position,
        target: b.cameraView.target,
        nonce: Date.now(),
      });
    }
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0b1322] select-none">
      {/* Demo Key Quota Banner (triggered only on gmp-quota-exceeded) */}
      {gmpQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {/* Full-Bleed 3D Digital Twin Viewport */}
      <CampusViewport
        lightingMode={lightingMode}
        layers={layers}
        selectedBuildingId={selectedBuildingId}
        cameraCommand={cameraCommand}
        osmData={osmData}
        onSelectBuilding={setSelectedBuildingId}
        onCameraTargetChange={setMapCenterCoords}
      />

      {/* Minimal Top-Left Campus Identity Lockup */}
      <header className="pointer-events-none fixed top-4 left-4 z-20 max-w-[min(460px,calc(100vw-2rem))]">
        <div className="pointer-events-auto rounded-lg border border-white/15 bg-[rgba(15,23,42,0.88)] px-3.5 py-2.5 shadow-xl">
          <h1 className="text-sm md:text-[15px] font-semibold text-white tracking-tight leading-snug">
            ДДҲБСТ · TSULBP Khujand 3D Twin
          </h1>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-300 font-mono-tabular">
            <span>40.3125° N, 69.6225° E</span>
            <span aria-hidden="true">·</span>
            <span>17th Microdistrict</span>
            <span aria-hidden="true">·</span>
            <span>
              {osmData.source === 'overpass'
                ? 'OSM Live Footprints'
                : 'Calibrated Campus Plan'}
            </span>
          </div>
        </div>
      </header>

      {/* Top-Right Selected Building Inspector */}
      {selectedBuilding && (
        <div className="fixed top-4 right-4 z-20">
          <BuildingInspector
            building={selectedBuilding}
            onClose={() => setSelectedBuildingId(null)}
            onFlyTo={handleFlyToBuilding}
          />
        </div>
      )}

      {/* Bottom-Right Synced Google Maps Satellite Mini-Map */}
      {layers.miniMap && !dockCollapsed && (
        <div className="hidden sm:block fixed bottom-20 right-4 z-20">
          <GoogleMapsMiniMap
            centerCoords={mapCenterCoords}
            selectedBuildingId={selectedBuildingId}
            onSelectBuilding={handleSelectBuildingFromMiniMap}
            onMapCoordinateClick={handleMiniMapCoordClick}
          />
        </div>
      )}

      {/* Collapsible Bottom Control Dock */}
      <ControlDock
        collapsed={dockCollapsed}
        onToggleCollapse={() => setDockCollapsed((prev) => !prev)}
        activePreset={activePreset}
        onSelectPreset={handleSelectPreset}
        lightingMode={lightingMode}
        onSelectLighting={setLightingMode}
        layers={layers}
        onToggleLayer={handleToggleLayer}
      />
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import {
  APIProvider,
  AdvancedMarker,
  Map as GoogleMap,
  Pin,
  useMap,
} from '@vis.gl/react-google-maps';
import { Maximize2, Minimize2, MapPin } from 'lucide-react';
import { CAMPUS_BUILDINGS, CAMPUS_ORIGIN } from '../data/campusData';

interface GoogleMapsMiniMapProps {
  centerCoords: { lat: number; lng: number };
  selectedBuildingId: string | null;
  onSelectBuilding: (id: string) => void;
  onMapCoordinateClick: (coords: { lat: number; lng: number }) => void;
}

const CameraSyncHelper: React.FC<{
  centerCoords: { lat: number; lng: number };
}> = ({ centerCoords }) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    map.panTo(centerCoords);
  }, [map, centerCoords.lat, centerCoords.lng]);

  return null;
};

export const GoogleMapsMiniMap: React.FC<GoogleMapsMiniMapProps> = ({
  centerCoords,
  selectedBuildingId,
  onSelectBuilding,
  onMapCoordinateClick,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [apiKey, setApiKey] = useState<string>(
    () => import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
  );
  const [keyChecked, setKeyChecked] = useState<boolean>(
    () => Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY)
  );

  useEffect(() => {
    if (apiKey) return;
    let active = true;
    fetch('/api/maps-config')
      .then((res) => (res.ok ? res.json() : { apiKey: '' }))
      .then((data: { apiKey?: string }) => {
        if (!active) return;
        if (data.apiKey) setApiKey(data.apiKey);
        setKeyChecked(true);
      })
      .catch(() => {
        if (active) setKeyChecked(true);
      });
    return () => {
      active = false;
    };
  }, [apiKey]);

  const widthClass = expanded ? 'w-[340px]' : 'w-[244px]';
  const heightClass = expanded ? 'h-[250px]' : 'h-[168px]';

  return (
    <div
      className={`${widthClass} rounded-lg border border-white/15 bg-[rgba(15,23,42,0.92)] shadow-2xl overflow-hidden transition-[width] duration-200`}
    >
      {/* Header strip */}
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-white/10 text-[11px] text-slate-200">
        <div className="flex items-center gap-1.5 font-medium whitespace-nowrap">
          <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>Khujand Satellite Sync</span>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          title={expanded ? 'Compact mini-map' : 'Expand mini-map'}
          className="p-1 rounded hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
        >
          {expanded ? (
            <Minimize2 className="w-3.5 h-3.5" />
          ) : (
            <Maximize2 className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Map canvas container with explicit height (CF2) */}
      <div className={`${heightClass} w-full relative bg-slate-900`}>
        {apiKey ? (
          <APIProvider apiKey={apiKey} libraries={['marker']}>
            <GoogleMap
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
              mapId="DEMO_MAP_ID"
              defaultCenter={CAMPUS_ORIGIN}
              defaultZoom={17}
              mapTypeId="satellite"
              disableDefaultUI={true}
              gestureHandling="greedy"
              onClick={(ev) => {
                if (ev.detail.latLng) {
                  onMapCoordinateClick({
                    lat: ev.detail.latLng.lat,
                    lng: ev.detail.latLng.lng,
                  });
                }
              }}
              style={{ width: '100%', height: '100%' }}
            >
              <CameraSyncHelper centerCoords={centerCoords} />
              {CAMPUS_BUILDINGS.map((b) => {
                const isSelected = b.id === selectedBuildingId;
                return (
                  <AdvancedMarker
                    key={b.id}
                    position={{ lat: b.lat, lng: b.lng }}
                    title={`${b.nameTj} / ${b.nameRu}`}
                    onClick={() => onSelectBuilding(b.id)}
                  >
                    <Pin
                      background={isSelected ? '#f59e0b' : '#1e293b'}
                      borderColor={isSelected ? '#fef3c7' : '#e2e8f0'}
                      glyphColor={isSelected ? '#0f172a' : '#f8fafc'}
                      scale={isSelected ? 1.05 : 0.78}
                    >
                      <span className="text-[9px] font-bold">{b.code}</span>
                    </Pin>
                  </AdvancedMarker>
                );
              })}
            </GoogleMap>
          </APIProvider>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center text-xs text-slate-300">
            <span>
              {keyChecked
                ? 'Google Maps key not available in environment.'
                : 'Connecting to Google Maps Platform...'}
            </span>
          </div>
        )}
      </div>

      {/* Footer coordinates */}
      <div className="px-2.5 py-1 bg-slate-950/80 border-t border-white/10 flex items-center justify-between text-[10px] text-slate-400 font-mono-tabular">
        <span>
          {centerCoords.lat.toFixed(5)}° N, {centerCoords.lng.toFixed(5)}° E
        </span>
        <span>Click map to fly</span>
      </div>
    </div>
  );
};

import React from 'react';
import {
  Building2,
  Camera,
  ChevronDown,
  ChevronUp,
  Layers,
  Map as MapIcon,
  Moon,
  Satellite,
  Sun,
  Sunrise,
  Tag,
} from 'lucide-react';
import { CAMERA_PRESETS } from '../data/campusData';
import type {
  CameraPresetId,
  LayerVisibility,
  LightingMode,
} from '../types/campus';

interface ControlDockProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  activePreset: CameraPresetId;
  onSelectPreset: (presetId: CameraPresetId) => void;
  lightingMode: LightingMode;
  onSelectLighting: (mode: LightingMode) => void;
  layers: LayerVisibility;
  onToggleLayer: (key: keyof LayerVisibility) => void;
}

export const ControlDock: React.FC<ControlDockProps> = ({
  collapsed,
  onToggleCollapse,
  activePreset,
  onSelectPreset,
  lightingMode,
  onSelectLighting,
  layers,
  onToggleLayer,
}) => {
  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center max-w-[min(960px,95vw)]">
      {/* Collapse / Expand Handle */}
      <button
        type="button"
        onClick={onToggleCollapse}
        title="Toggle Controls (H)"
        className="pointer-events-auto mb-1.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-md border border-white/15 bg-[rgba(15,23,42,0.9)] text-[11px] font-medium text-slate-200 hover:text-white hover:border-white/30 transition-colors shadow-lg whitespace-nowrap cursor-pointer"
      >
        {collapsed ? (
          <>
            <ChevronUp className="w-3.5 h-3.5 text-amber-400" />
            <span>Show Controls</span>
          </>
        ) : (
          <>
            <ChevronDown className="w-3.5 h-3.5 text-amber-400" />
            <span>Hide Controls</span>
          </>
        )}
      </button>

      {/* Main Unified Bottom Dock */}
      {!collapsed && (
        <div className="pointer-events-auto w-full rounded-lg border border-white/15 bg-[rgba(15,23,42,0.92)] px-3 py-2 shadow-2xl flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
          {/* Camera Presets */}
          <div className="flex items-center gap-1">
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 mr-1 whitespace-nowrap">
              <Camera className="w-3.5 h-3.5" />
            </span>
            <div className="flex items-center gap-1 bg-slate-950/70 p-0.5 rounded-md border border-white/10">
              {CAMERA_PRESETS.map((preset) => {
                const active = activePreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => onSelectPreset(preset.id)}
                    title={preset.label}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-amber-500 text-slate-950 font-semibold'
                        : 'text-slate-300 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {preset.shortLabel}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="hidden md:block h-5 w-px bg-white/15" />

          {/* Atmosphere / Lighting Presets */}
          <div className="flex items-center gap-1 bg-slate-950/70 p-0.5 rounded-md border border-white/10">
            {(
              [
                { id: 'day', label: 'Day', icon: Sun },
                { id: 'sunset', label: 'Sunset', icon: Sunrise },
                { id: 'night', label: 'Night', icon: Moon },
              ] as const
            ).map(({ id, label, icon: Icon }) => {
              const active = lightingMode === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSelectLighting(id)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-sky-500 text-slate-950 font-semibold'
                      : 'text-slate-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Icon className="w-3 h-3 shrink-0" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          <div className="hidden md:block h-5 w-px bg-white/15" />

          {/* Layer Toggles */}
          <div className="flex items-center gap-1">
            <span className="inline-flex items-center text-[11px] text-slate-400 mr-0.5">
              <Layers className="w-3.5 h-3.5" />
            </span>
            {(
              [
                {
                  key: 'satelliteGround',
                  label: 'Satellite',
                  icon: Satellite,
                },
                {
                  key: 'osmContext',
                  label: 'OSM City',
                  icon: Building2,
                },
                {
                  key: 'buildingLabels',
                  label: 'Labels',
                  icon: Tag,
                },
                {
                  key: 'miniMap',
                  label: 'Mini-Map',
                  icon: MapIcon,
                },
              ] as const
            ).map(({ key, label, icon: Icon }) => {
              const enabled = layers[key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onToggleLayer(key)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md border text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    enabled
                      ? 'bg-slate-800 border-amber-400/60 text-amber-200'
                      : 'bg-slate-950/50 border-white/10 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-3 h-3 shrink-0" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

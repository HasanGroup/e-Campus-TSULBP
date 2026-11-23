import React, { useEffect, useState } from 'react';
import {
  Compass,
  ExternalLink,
  Globe,
  Loader2,
  X,
} from 'lucide-react';
import type {
  CampusBuildingMeta,
  CampusSearchResult,
} from '../types/campus';

interface BuildingInspectorProps {
  building: CampusBuildingMeta;
  onClose: () => void;
  onFlyTo: (building: CampusBuildingMeta) => void;
}

export const BuildingInspector: React.FC<BuildingInspectorProps> = ({
  building,
  onClose,
  onFlyTo,
}) => {
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<CampusSearchResult | null>(
    null
  );
  const [searchError, setSearchError] = useState<string | null>(null);

  // Reset search state when switching buildings
  useEffect(() => {
    setSearching(false);
    setSearchResult(null);
    setSearchError(null);
  }, [building.id]);

  const handleLiveSearch = async () => {
    setSearching(true);
    setSearchError(null);
    try {
      const res = await fetch('/api/campus-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buildingNameTj: building.nameTj,
          buildingNameRu: building.nameRu,
          buildingNameEn: building.nameEn,
          searchQuery: building.searchQuery,
        }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(
          'Live Google Search requires the Express backend server (unavailable on static hosting).'
        );
      }
      const data = (await res.json()) as CampusSearchResult & { error?: string };
      if (!res.ok) {
        throw new Error(data.error || `Search failed (${res.status})`);
      }
      setSearchResult({
        summary: data.summary || '',
        sources: Array.isArray(data.sources) ? data.sources : [],
      });
    } catch (err) {
      setSearchError(
        err instanceof Error
          ? err.message
          : 'Unable to retrieve live Google Search results.'
      );
    } finally {
      setSearching(false);
    }
  };

  return (
    <aside
      aria-label="Building Inspector"
      className="w-[340px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-140px)] flex flex-col rounded-lg border border-white/15 bg-[rgba(15,23,42,0.92)] text-slate-100 shadow-2xl overflow-hidden"
    >
      {/* Card Header */}
      <div className="px-4 pt-3.5 pb-3 border-b border-white/10 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono-tabular">
            <span className="text-amber-400 font-semibold">{building.code}</span>
            <span aria-hidden="true">·</span>
            <span>{building.stories} {building.stories === 1 ? 'level' : 'floors'}</span>
            <span aria-hidden="true">·</span>
            <span className="truncate">{building.category}</span>
          </div>
          <h2 className="mt-1 text-base font-semibold text-white leading-snug">
            {building.nameTj}
          </h2>
          <p className="text-xs text-slate-300 leading-snug mt-0.5">
            {building.nameRu}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close inspector"
          className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable Body */}
      <div className="px-4 py-3 space-y-3.5 overflow-y-auto inspector-scroll text-xs">
        <p className="text-slate-300 leading-relaxed">{building.descriptionEn}</p>

        {/* Coordinates */}
        <div className="text-[11px] text-slate-400 font-mono-tabular flex items-center justify-between pt-1 border-t border-white/10">
          <span>Coordinates</span>
          <span className="text-slate-200">
            {building.lat.toFixed(5)}° N, {building.lng.toFixed(5)}° E
          </span>
        </div>

        {/* Departments / Faculties (Bilingual Tajik & Russian) */}
        <div className="pt-2 border-t border-white/10 space-y-2">
          <div className="text-[11px] font-semibold text-slate-300">
            Faculties & Units (Тоҷикӣ / Русский)
          </div>
          <ul className="space-y-1.5">
            {building.departmentsTj.map((deptTj, idx) => (
              <li key={deptTj} className="leading-snug">
                <div className="text-slate-100 font-medium">{deptTj}</div>
                {building.departmentsRu[idx] && (
                  <div className="text-slate-400 text-[11px]">
                    {building.departmentsRu[idx]}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 border-t border-white/10 flex items-center gap-2">
          <button
            type="button"
            onClick={() => onFlyTo(building)}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-colors whitespace-nowrap cursor-pointer"
          >
            <Compass className="w-3.5 h-3.5 shrink-0" />
            <span>Fly to Building</span>
          </button>
          <button
            type="button"
            onClick={handleLiveSearch}
            disabled={searching}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-slate-800 hover:bg-slate-700 border border-white/15 text-slate-100 font-medium text-xs transition-colors whitespace-nowrap disabled:opacity-60 cursor-pointer"
          >
            {searching ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
            ) : (
              <Globe className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            )}
            <span>{searching ? 'Searching...' : 'Search Live Info'}</span>
          </button>
        </div>

        {/* Live Google Search Grounded Results */}
        {searchError && (
          <div className="p-2.5 rounded-md bg-rose-950/70 border border-rose-500/30 text-rose-200 text-[11px] leading-relaxed">
            {searchError}
          </div>
        )}

        {searchResult && (
          <div className="pt-2.5 border-t border-white/10 space-y-2">
            <div className="text-[11px] font-semibold text-sky-300">
              Live Google Search Context
            </div>
            <p className="text-slate-200 leading-relaxed whitespace-pre-line text-[11.5px]">
              {searchResult.summary}
            </p>
            {searchResult.sources.length > 0 && (
              <div className="pt-1 space-y-1">
                <div className="text-[10px] text-slate-400">Sources</div>
                <ul className="space-y-1">
                  {searchResult.sources.slice(0, 4).map((src) => (
                    <li key={src.uri}>
                      <a
                        href={src.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 underline truncate max-w-full"
                      >
                        <ExternalLink className="w-3 h-3 shrink-0" />
                        <span className="truncate">{src.title}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  CAMPUS_BUILDINGS,
  localToLatLon,
} from '../data/campusData';
import {
  buildCampusArchitecture,
  buildOsmContextGroup,
  type CampusBuildArtifacts,
} from '../three/campusBuilders';
import {
  TextureRegistry,
  createArchitecturalBaseTexture,
  loadAlignedSatelliteOverlay,
} from '../three/textures';
import type {
  CameraPreset,
  LayerVisibility,
  LightingMode,
  OsmDataset,
  ProjectedLabel,
} from '../types/campus';

interface CampusViewportProps {
  lightingMode: LightingMode;
  layers: LayerVisibility;
  selectedBuildingId: string | null;
  cameraCommand: {
    position: [number, number, number];
    target: [number, number, number];
    nonce: number;
  } | null;
  osmData: OsmDataset;
  onSelectBuilding: (id: string | null) => void;
  onCameraTargetChange: (coords: { lat: number; lng: number }) => void;
}

// Pre-allocated scratch math objects (zero GC inside tick loop)
const _projVec = new THREE.Vector3();
const _targetPos = new THREE.Vector3();
const _targetLook = new THREE.Vector3();
const _skyColor = new THREE.Color();
const _fogColor = new THREE.Color();
const _sunColor = new THREE.Color();
const _hemiSky = new THREE.Color();
const _hemiGround = new THREE.Color();

const _sunFromVec = new THREE.Vector3();
const _sunToVec = new THREE.Vector3();
const _rimColor = new THREE.Color();

interface LightingStateSnapshot {
  skyColor: THREE.Color;
  sunColor: THREE.Color;
  sunIntensity: number;
  sunPos: THREE.Vector3;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiIntensity: number;
  rimColor: THREE.Color;
  rimIntensity: number;
  envIntensity: number;
  windowEmissive: number;
  lampEmissive: number;
  plazaGlow: number;
  fogDensity: number;
  exposure: number;
}

interface LightingPresetSpec {
  skyHex: number;
  sunHex: number;
  sunIntensity: number;
  sunPos: [number, number, number];
  hemiSkyHex: number;
  hemiGroundHex: number;
  hemiIntensity: number;
  rimHex: number;
  rimIntensity: number;
  envIntensity: number;
  windowEmissive: number;
  lampEmissive: number;
  plazaGlow: number;
  fogDensity: number;
  exposure: number;
}

const LIGHTING_PRESETS: Record<LightingMode, LightingPresetSpec> = {
  day: {
    skyHex: 0xc8ddf2,
    sunHex: 0xfff5e4,
    sunIntensity: 2.35,
    sunPos: [145, 190, 120],
    hemiSkyHex: 0x93c5fd,
    hemiGroundHex: 0x7c6f5d,
    hemiIntensity: 0.95,
    rimHex: 0x93c5fd,
    rimIntensity: 0.38,
    envIntensity: 1.0,
    windowEmissive: 0.0,
    lampEmissive: 0.08,
    plazaGlow: 0,
    fogDensity: 0.00085,
    exposure: 1.08,
  },
  sunset: {
    skyHex: 0xd98a6c,
    sunHex: 0xff9a52,
    sunIntensity: 2.1,
    sunPos: [-190, 62, 115],
    hemiSkyHex: 0xfdba74,
    hemiGroundHex: 0x3f2e3e,
    hemiIntensity: 0.78,
    rimHex: 0xfb923c,
    rimIntensity: 0.48,
    envIntensity: 0.68,
    windowEmissive: 0.65,
    lampEmissive: 1.6,
    plazaGlow: 80,
    fogDensity: 0.00115,
    exposure: 1.05,
  },
  night: {
    skyHex: 0x0b1528,
    sunHex: 0x8bb4e8,
    sunIntensity: 0.55,
    sunPos: [-90, 145, -110],
    hemiSkyHex: 0x1e3a5f,
    hemiGroundHex: 0x0f172a,
    hemiIntensity: 0.55,
    rimHex: 0x60a5fa,
    rimIntensity: 0.28,
    envIntensity: 0.24,
    windowEmissive: 1.45,
    lampEmissive: 2.8,
    plazaGlow: 240,
    fogDensity: 0.00135,
    exposure: 1.02,
  },
};

function createSnapshotFromPreset(preset: LightingPresetSpec): LightingStateSnapshot {
  return {
    skyColor: new THREE.Color(preset.skyHex),
    sunColor: new THREE.Color(preset.sunHex),
    sunIntensity: preset.sunIntensity,
    sunPos: new THREE.Vector3(...preset.sunPos),
    hemiSky: new THREE.Color(preset.hemiSkyHex),
    hemiGround: new THREE.Color(preset.hemiGroundHex),
    hemiIntensity: preset.hemiIntensity,
    rimColor: new THREE.Color(preset.rimHex),
    rimIntensity: preset.rimIntensity,
    envIntensity: preset.envIntensity,
    windowEmissive: preset.windowEmissive,
    lampEmissive: preset.lampEmissive,
    plazaGlow: preset.plazaGlow,
    fogDensity: preset.fogDensity,
    exposure: preset.exposure,
  };
}

function copySnapshot(
  dst: LightingStateSnapshot,
  src: LightingStateSnapshot
): void {
  dst.skyColor.copy(src.skyColor);
  dst.sunColor.copy(src.sunColor);
  dst.sunIntensity = src.sunIntensity;
  dst.sunPos.copy(src.sunPos);
  dst.hemiSky.copy(src.hemiSky);
  dst.hemiGround.copy(src.hemiGround);
  dst.hemiIntensity = src.hemiIntensity;
  dst.rimColor.copy(src.rimColor);
  dst.rimIntensity = src.rimIntensity;
  dst.envIntensity = src.envIntensity;
  dst.windowEmissive = src.windowEmissive;
  dst.lampEmissive = src.lampEmissive;
  dst.plazaGlow = src.plazaGlow;
  dst.fogDensity = src.fogDensity;
  dst.exposure = src.exposure;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export const CampusViewport: React.FC<CampusViewportProps> = ({
  lightingMode,
  layers,
  selectedBuildingId,
  cameraCommand,
  osmData,
  onSelectBuilding,
  onCameraTargetChange,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [labels, setLabels] = useState<ProjectedLabel[]>([]);
  const [contextLost, setContextLost] = useState(false);

  // Mutable refs so React UI updates never re-initialize the WebGL canvas
  const lightingRef = useRef<LightingMode>(lightingMode);
  const layersRef = useRef<LayerVisibility>(layers);
  const selectedIdRef = useRef<string | null>(selectedBuildingId);
  const onSelectRef = useRef(onSelectBuilding);
  const onTargetChangeRef = useRef(onCameraTargetChange);

  lightingRef.current = lightingMode;
  layersRef.current = layers;
  selectedIdRef.current = selectedBuildingId;
  onSelectRef.current = onSelectBuilding;
  onTargetChangeRef.current = onCameraTargetChange;

  const flyStateRef = useRef<{
    active: boolean;
    position: [number, number, number];
    target: [number, number, number];
  }>({
    active: false,
    position: [-25, 165, 198],
    target: [6, 4, -6],
  });

  const osmLayerUpdaterRef = useRef<((data: OsmDataset) => void) | null>(null);
  const visibilitySyncRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!cameraCommand) return;
    flyStateRef.current = {
      active: true,
      position: cameraCommand.position,
      target: cameraCommand.target,
    };
  }, [cameraCommand]);

  useEffect(() => {
    osmLayerUpdaterRef.current?.(osmData);
  }, [osmData]);

  useEffect(() => {
    visibilitySyncRef.current?.();
  }, [layers, selectedBuildingId]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    const initialPreset = LIGHTING_PRESETS[lightingRef.current];
    scene.background = new THREE.Color(initialPreset.skyHex);
    scene.fog = new THREE.FogExp2(
      initialPreset.skyHex,
      initialPreset.fogDensity
    );

    const camera = new THREE.PerspectiveCamera(46, width / height, 1, 1800);
    camera.position.set(-25, 165, 198);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = initialPreset.exposure;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(renderer.domElement);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const handleContextRestored = () => {
      setContextLost(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener(
      'webglcontextrestored',
      handleContextRestored
    );

    // Procedural Studio PMREM Environment Map
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envMap = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envMap;
    scene.environmentIntensity = initialPreset.envIntensity;
    pmremGenerator.dispose();

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    const textureRegistry = new TextureRegistry();

    // Lighting Rig
    const hemiLight = new THREE.HemisphereLight(
      initialPreset.hemiSkyHex,
      initialPreset.hemiGroundHex,
      initialPreset.hemiIntensity
    );
    hemiLight.position.set(0, 120, 0);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(
      initialPreset.sunHex,
      initialPreset.sunIntensity
    );
    sunLight.position.set(...initialPreset.sunPos);
    sunLight.castShadow = !isSoftwareGl;
    sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.camera.near = 20;
    sunLight.shadow.camera.far = 560;
    sunLight.shadow.camera.left = -185;
    sunLight.shadow.camera.right = 185;
    sunLight.shadow.camera.top = 185;
    sunLight.shadow.camera.bottom = -185;
    sunLight.shadow.radius = 2.5;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(
      initialPreset.rimHex,
      initialPreset.rimIntensity
    );
    rimLight.position.set(-140, 80, -180);
    scene.add(rimLight);

    // Nighttime plaza & stele accent point lights (intensity animated smoothly)
    const rectorateNightLight = new THREE.PointLight(0xffb74d, 0, 95, 1.6);
    rectorateNightLight.position.set(-64, 18, 82);
    scene.add(rectorateNightLight);

    const b5NightLight = new THREE.PointLight(0xffcf70, 0, 95, 1.6);
    b5NightLight.position.set(64, 18, -74);
    scene.add(b5NightLight);

    const steleNightLight = new THREE.PointLight(0xffd27d, 0, 75, 1.6);
    steleNightLight.position.set(134, 14, 76);
    scene.add(steleNightLight);

    // Ground Terrain Base Plane (Architectural Base)
    const baseTerrainGeo = new THREE.PlaneGeometry(1400, 1400);
    const baseTerrainMat = new THREE.MeshStandardMaterial({
      map: createArchitecturalBaseTexture(textureRegistry, maxAnisotropy),
      roughness: 0.94,
      metalness: 0.02,
    });
    const baseTerrainMesh = new THREE.Mesh(baseTerrainGeo, baseTerrainMat);
    baseTerrainMesh.rotation.x = -Math.PI * 0.5;
    baseTerrainMesh.position.y = 0;
    baseTerrainMesh.receiveShadow = true;
    scene.add(baseTerrainMesh);

    // Satellite Tile Ground Overlay Mesh (async ESRI World Imagery alignment)
    let satOverlayMesh: THREE.Mesh | null = null;
    let satOverlayGeo: THREE.PlaneGeometry | null = null;
    let satOverlayMat: THREE.MeshStandardMaterial | null = null;
    let disposed = false;

    loadAlignedSatelliteOverlay(textureRegistry, maxAnisotropy).then(
      (overlay) => {
        if (disposed) return;
        satOverlayGeo = new THREE.PlaneGeometry(
          overlay.widthMeters,
          overlay.depthMeters
        );
        satOverlayMat = new THREE.MeshStandardMaterial({
          map: overlay.texture,
          roughness: 0.95,
          metalness: 0.02,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        });
        satOverlayMesh = new THREE.Mesh(satOverlayGeo, satOverlayMat);
        satOverlayMesh.rotation.x = -Math.PI * 0.5;
        satOverlayMesh.position.set(overlay.centerX, 0.03, overlay.centerZ);
        satOverlayMesh.receiveShadow = true;
        satOverlayMesh.visible = layersRef.current.satelliteGround;
        scene.add(satOverlayMesh);
      }
    );

    // Hero Campus Architectural Reconstruction
    const campusArtifacts: CampusBuildArtifacts = buildCampusArchitecture(
      textureRegistry,
      maxAnisotropy,
      isSoftwareGl
    );
    scene.add(campusArtifacts.campusRoot);

    // Selection Highlight Ring on the Ground
    const ringGeo = new THREE.RingGeometry(16, 18.5, 48);
    ringGeo.rotateX(-Math.PI * 0.5);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const selectionRing = new THREE.Mesh(ringGeo, ringMat);
    selectionRing.position.y = 0.28;
    selectionRing.visible = false;
    scene.add(selectionRing);

    // Surrounding OSM Context Group
    let currentOsmContext: ReturnType<typeof buildOsmContextGroup> | null = null;
    const rebuildOsmContext = (dataset: OsmDataset) => {
      if (currentOsmContext) {
        scene.remove(currentOsmContext.group);
        currentOsmContext.dispose();
      }
      currentOsmContext = buildOsmContextGroup(
        dataset,
        textureRegistry,
        maxAnisotropy
      );
      currentOsmContext.group.visible = layersRef.current.osmContext;
      scene.add(currentOsmContext.group);
    };
    osmLayerUpdaterRef.current = rebuildOsmContext;
    rebuildOsmContext(osmData);

    const syncVisibilityAndSelection = () => {
      if (satOverlayMesh) {
        satOverlayMesh.visible = layersRef.current.satelliteGround;
      }
      if (currentOsmContext) {
        currentOsmContext.group.visible = layersRef.current.osmContext;
      }
      const selId = selectedIdRef.current;
      if (selId) {
        const meta = CAMPUS_BUILDINGS.find((b) => b.id === selId);
        if (meta) {
          selectionRing.position.set(meta.localPos[0], 0.32, meta.localPos[1]);
          selectionRing.visible = true;
        }
      } else {
        selectionRing.visible = false;
      }
    };
    visibilitySyncRef.current = syncVisibilityAndSelection;
    syncVisibilityAndSelection();

    // OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(6, 4, -6);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2.06;
    controls.minDistance = 24;
    controls.maxDistance = 440;
    controls.update();

    controls.addEventListener('start', () => {
      // Immediately cancel any automated camera fly-to when user takes control
      flyStateRef.current.active = false;
    });

    // Pointer click raycasting (ignoring drags > 6px)
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    let downX = 0;
    let downY = 0;

    const handlePointerDown = (e: PointerEvent) => {
      downX = e.clientX;
      downY = e.clientY;
    };

    const handlePointerUp = (e: PointerEvent) => {
      const dist = Math.hypot(e.clientX - downX, e.clientY - downY);
      if (dist > 6) return;

      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(
        campusArtifacts.clickableMeshes,
        false
      );
      if (hits.length > 0) {
        const bId = hits[0].object.userData.buildingId as string | undefined;
        if (bId) {
          onSelectRef.current(bId);
          return;
        }
      }
      onSelectRef.current(null);
    };

    const handlePointerMove = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(
        campusArtifacts.clickableMeshes,
        false
      );
      renderer.domElement.style.cursor = hits.length > 0 ? 'pointer' : 'grab';
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);
    renderer.domElement.addEventListener('pointermove', handlePointerMove);

    // Pre-warm shaders once on GPU
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Handle Resize
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Animation Loop with Software-WebGL pacing
    let frameId = 0;
    let lastTime = performance.now();
    let labelFrameCounter = 0;
    let targetEmitCounter = 0;
    let lastEmittedLat = 0;
    let lastEmittedLng = 0;

    // Cross-fade lighting state (1.15s smooth ease-in-out cubic transition)
    const CROSSFADE_DURATION = 1.15;
    let activeLightingMode: LightingMode = lightingRef.current;
    let crossfadeElapsed = CROSSFADE_DURATION;
    const fromLighting = createSnapshotFromPreset(initialPreset);
    const currentLighting = createSnapshotFromPreset(initialPreset);
    const toLighting = createSnapshotFromPreset(initialPreset);

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const tick = () => {
      if (disposed) return;
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      const elapsed = now * 0.001;

      // 1. Detect lighting mode change and start smooth cross-fade from live state
      if (lightingRef.current !== activeLightingMode) {
        activeLightingMode = lightingRef.current;
        copySnapshot(fromLighting, currentLighting);
        const nextSpec = LIGHTING_PRESETS[activeLightingMode];
        toLighting.skyColor.setHex(nextSpec.skyHex);
        toLighting.sunColor.setHex(nextSpec.sunHex);
        toLighting.sunIntensity = nextSpec.sunIntensity;
        toLighting.sunPos.set(...nextSpec.sunPos);
        toLighting.hemiSky.setHex(nextSpec.hemiSkyHex);
        toLighting.hemiGround.setHex(nextSpec.hemiGroundHex);
        toLighting.hemiIntensity = nextSpec.hemiIntensity;
        toLighting.rimColor.setHex(nextSpec.rimHex);
        toLighting.rimIntensity = nextSpec.rimIntensity;
        toLighting.envIntensity = nextSpec.envIntensity;
        toLighting.windowEmissive = nextSpec.windowEmissive;
        toLighting.lampEmissive = nextSpec.lampEmissive;
        toLighting.plazaGlow = nextSpec.plazaGlow;
        toLighting.fogDensity = nextSpec.fogDensity;
        toLighting.exposure = nextSpec.exposure;
        crossfadeElapsed = 0;
      }

      if (crossfadeElapsed < CROSSFADE_DURATION) {
        crossfadeElapsed = Math.min(CROSSFADE_DURATION, crossfadeElapsed + dt);
        const rawT = crossfadeElapsed / CROSSFADE_DURATION;
        const t = easeInOutCubic(rawT);

        // Interpolate colors and scalar channels smoothly
        _skyColor.copy(fromLighting.skyColor).lerp(toLighting.skyColor, t);
        _sunColor.copy(fromLighting.sunColor).lerp(toLighting.sunColor, t);
        _hemiSky.copy(fromLighting.hemiSky).lerp(toLighting.hemiSky, t);
        _hemiGround.copy(fromLighting.hemiGround).lerp(toLighting.hemiGround, t);
        _rimColor.copy(fromLighting.rimColor).lerp(toLighting.rimColor, t);

        currentLighting.skyColor.copy(_skyColor);
        currentLighting.sunColor.copy(_sunColor);
        currentLighting.hemiSky.copy(_hemiSky);
        currentLighting.hemiGround.copy(_hemiGround);
        currentLighting.rimColor.copy(_rimColor);

        // Spherical-arc solar elevation boost mid-crossfade to avoid flat shadow sweeps
        _sunFromVec.copy(fromLighting.sunPos);
        _sunToVec.copy(toLighting.sunPos);
        currentLighting.sunPos.lerpVectors(_sunFromVec, _sunToVec, t);
        currentLighting.sunPos.y += Math.sin(rawT * Math.PI) * 34;

        currentLighting.sunIntensity = THREE.MathUtils.lerp(
          fromLighting.sunIntensity,
          toLighting.sunIntensity,
          t
        );
        currentLighting.hemiIntensity = THREE.MathUtils.lerp(
          fromLighting.hemiIntensity,
          toLighting.hemiIntensity,
          t
        );
        currentLighting.rimIntensity = THREE.MathUtils.lerp(
          fromLighting.rimIntensity,
          toLighting.rimIntensity,
          t
        );
        currentLighting.envIntensity = THREE.MathUtils.lerp(
          fromLighting.envIntensity,
          toLighting.envIntensity,
          t
        );
        currentLighting.windowEmissive = THREE.MathUtils.lerp(
          fromLighting.windowEmissive,
          toLighting.windowEmissive,
          t
        );
        currentLighting.lampEmissive = THREE.MathUtils.lerp(
          fromLighting.lampEmissive,
          toLighting.lampEmissive,
          t
        );
        currentLighting.plazaGlow = THREE.MathUtils.lerp(
          fromLighting.plazaGlow,
          toLighting.plazaGlow,
          t
        );
        currentLighting.fogDensity = THREE.MathUtils.lerp(
          fromLighting.fogDensity,
          toLighting.fogDensity,
          t
        );
        currentLighting.exposure = THREE.MathUtils.lerp(
          fromLighting.exposure,
          toLighting.exposure,
          t
        );

        // Apply cross-faded values to scene, lights, renderer, and emissives
        if (scene.background instanceof THREE.Color) {
          scene.background.copy(currentLighting.skyColor);
        }
        if (scene.fog instanceof THREE.FogExp2) {
          _fogColor.copy(currentLighting.skyColor);
          scene.fog.color.copy(_fogColor);
          scene.fog.density = currentLighting.fogDensity;
        }
        scene.environmentIntensity = currentLighting.envIntensity;
        renderer.toneMappingExposure = currentLighting.exposure;

        sunLight.color.copy(currentLighting.sunColor);
        sunLight.intensity = currentLighting.sunIntensity;
        sunLight.position.copy(currentLighting.sunPos);

        hemiLight.color.copy(currentLighting.hemiSky);
        hemiLight.groundColor.copy(currentLighting.hemiGround);
        hemiLight.intensity = currentLighting.hemiIntensity;

        rimLight.color.copy(currentLighting.rimColor);
        rimLight.intensity = currentLighting.rimIntensity;

        for (const mat of campusArtifacts.nightEmissiveMaterials) {
          mat.emissiveIntensity = currentLighting.windowEmissive;
        }
        campusArtifacts.lampHeadMaterial.emissiveIntensity =
          currentLighting.lampEmissive;

        rectorateNightLight.intensity = currentLighting.plazaGlow;
        b5NightLight.intensity = currentLighting.plazaGlow;
        steleNightLight.intensity = currentLighting.plazaGlow * 0.75;
      }

      // 2. Smooth Damped Camera Fly-To
      if (flyStateRef.current.active) {
        _targetPos.set(...flyStateRef.current.position);
        _targetLook.set(...flyStateRef.current.target);

        camera.position.x = THREE.MathUtils.damp(
          camera.position.x,
          _targetPos.x,
          6.0,
          dt
        );
        camera.position.y = THREE.MathUtils.damp(
          camera.position.y,
          _targetPos.y,
          6.0,
          dt
        );
        camera.position.z = THREE.MathUtils.damp(
          camera.position.z,
          _targetPos.z,
          6.0,
          dt
        );

        controls.target.x = THREE.MathUtils.damp(
          controls.target.x,
          _targetLook.x,
          6.0,
          dt
        );
        controls.target.y = THREE.MathUtils.damp(
          controls.target.y,
          _targetLook.y,
          6.0,
          dt
        );
        controls.target.z = THREE.MathUtils.damp(
          controls.target.z,
          _targetLook.z,
          6.0,
          dt
        );

        if (
          camera.position.distanceTo(_targetPos) < 0.35 &&
          controls.target.distanceTo(_targetLook) < 0.25
        ) {
          flyStateRef.current.active = false;
        }
      }

      controls.update();

      // 3. Waving Tajikistan Flag Animation
      const flagPosAttr = campusArtifacts.flagMesh.geometry.attributes
        .position as THREE.BufferAttribute;
      const base = campusArtifacts.flagBasePositions;
      for (let i = 0; i < flagPosAttr.count; i++) {
        const bx = base[i * 3];
        const by = base[i * 3 + 1];
        const distRatio = Math.max(0, bx / 7.2);
        const waveZ =
          Math.sin(bx * 0.9 - elapsed * 4.5 + by * 0.4) * 0.48 * distRatio;
        const droopY = Math.cos(bx * 0.6 - elapsed * 3.0) * 0.08 * distRatio;
        flagPosAttr.setXYZ(i, bx, by + droopY, waveZ);
      }
      flagPosAttr.needsUpdate = true;

      // 4. Gentle Fountain Pool Water Ripple
      campusArtifacts.waterMesh.position.y =
        0.73 + Math.sin(elapsed * 2.4) * 0.02;

      // 5. Selection Ring Subtle Rotation
      if (selectionRing.visible) {
        const pulse = 1 + Math.sin(elapsed * 3.2) * 0.04;
        selectionRing.scale.set(pulse, 1, pulse);
      }

      renderer.render(scene, camera);

      // 6. Throttled Screen-Projected Bilingual Building Labels
      labelFrameCounter++;
      if (layersRef.current.buildingLabels && labelFrameCounter % 3 === 0) {
        const vw = renderer.domElement.clientWidth;
        const vh = renderer.domElement.clientHeight;
        const nextLabels: ProjectedLabel[] = [];
        for (const b of CAMPUS_BUILDINGS) {
          const yOffset = b.stories * 3.6 + 5;
          _projVec.set(b.localPos[0], yOffset, b.localPos[1]);
          _projVec.project(camera);
          const inFront = _projVec.z >= -1 && _projVec.z <= 1;
          const sx = ((_projVec.x + 1) * 0.5) * vw;
          const sy = ((-_projVec.y + 1) * 0.5) * vh;
          const onScreen =
            inFront && sx > 60 && sx < vw - 60 && sy > 60 && sy < vh - 95;
          nextLabels.push({
            id: b.id,
            nameTj: b.nameTj,
            nameRu: b.nameRu,
            code: b.code,
            x: sx,
            y: sy,
            visible: onScreen,
            selected: b.id === selectedIdRef.current,
          });
        }
        setLabels(nextLabels);
      }

      // 7. Throttled Mini-Map Sync
      targetEmitCounter++;
      if (targetEmitCounter % 15 === 0) {
        const geo = localToLatLon(controls.target.x, controls.target.z);
        if (
          Math.abs(geo.lat - lastEmittedLat) > 0.00004 ||
          Math.abs(geo.lng - lastEmittedLng) > 0.00004
        ) {
          lastEmittedLat = geo.lat;
          lastEmittedLng = geo.lng;
          onTargetChangeRef.current(geo);
        }
      }

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener(
        'webglcontextlost',
        handleContextLost
      );
      renderer.domElement.removeEventListener(
        'webglcontextrestored',
        handleContextRestored
      );
      controls.dispose();
      campusArtifacts.dispose();
      if (currentOsmContext) currentOsmContext.dispose();
      baseTerrainGeo.dispose();
      baseTerrainMat.dispose();
      if (satOverlayGeo) satOverlayGeo.dispose();
      if (satOverlayMat) satOverlayMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      envMap.dispose();
      textureRegistry.disposeAll();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Isolated WebGL mount container */}
      <div ref={mountRef} className="w-full h-full" />

      {/* Projected Floating Bilingual Building Labels */}
      {layers.buildingLabels && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden z-10">
          {labels.map((lbl) =>
            lbl.visible ? (
              <button
                key={lbl.id}
                type="button"
                onClick={() => onSelectBuilding(lbl.id)}
                style={{
                  transform: `translate3d(${lbl.x.toFixed(1)}px, ${lbl.y.toFixed(1)}px, 0) translate(-50%, -100%)`,
                }}
                className={`pointer-events-auto absolute top-0 left-0 px-2.5 py-1 rounded-md border text-left transition-colors shadow-md cursor-pointer ${
                  lbl.selected
                    ? 'bg-[#d99b26] border-amber-200 text-slate-950'
                    : 'bg-[rgba(15,23,42,0.88)] border-white/15 text-slate-100 hover:border-amber-400/70'
                }`}
              >
                <div className="flex items-center gap-1.5 text-[11px] font-semibold leading-tight whitespace-nowrap">
                  <span className="font-mono-tabular opacity-75">{lbl.code}</span>
                  <span aria-hidden="true">·</span>
                  <span>{lbl.nameTj}</span>
                </div>
                <div
                  className={`text-[10px] leading-tight whitespace-nowrap ${
                    lbl.selected ? 'text-slate-900/85' : 'text-slate-300'
                  }`}
                >
                  {lbl.nameRu}
                </div>
              </button>
            ) : null
          )}
        </div>
      )}

      {contextLost && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/90 text-slate-200 text-sm">
          WebGL rendering context paused. Restoring 3D viewport...
        </div>
      )}
    </div>
  );
};

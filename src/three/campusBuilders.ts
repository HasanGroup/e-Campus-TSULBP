import * as THREE from 'three';
import {
  CAMPUS_TILT_RAD,
  latLonToLocal,
} from '../data/campusData';
import type { OsmDataset } from '../types/campus';
import {
  TextureRegistry,
  createBlueBannerTexture,
  createCrosswalkTexture,
  createFacadeTextures,
  createGateOrnamentTexture,
  createPoolMosaicTexture,
  createRectorateSignTexture,
  createRunningTrackTexture,
  createStadiumPitchTexture,
  createTajikistanFlagTexture,
} from './textures';

export interface CampusBuildArtifacts {
  campusRoot: THREE.Group;
  buildingGroups: Record<string, THREE.Group>;
  clickableMeshes: THREE.Object3D[];
  nightEmissiveMaterials: THREE.MeshStandardMaterial[];
  lampHeadMaterial: THREE.MeshStandardMaterial;
  flagMesh: THREE.Mesh;
  flagBasePositions: Float32Array;
  waterMesh: THREE.Mesh;
  dispose: () => void;
}

function registerClickable(
  group: THREE.Group,
  buildingId: string,
  clickableMeshes: THREE.Object3D[]
): void {
  group.userData.buildingId = buildingId;
  group.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.userData.buildingId = buildingId;
      child.castShadow = child.castShadow ?? true;
      child.receiveShadow = true;
      clickableMeshes.push(child);
    }
  });
}

function createPitchedRoofGeometry(
  width: number,
  depth: number,
  height: number
): THREE.BufferGeometry {
  const hw = width * 0.5;
  const hd = depth * 0.5;
  const ridgeHalf = Math.max(0.5, hw - hd * 0.72);

  // Hipped pitched roof geometry
  const vertices = new Float32Array([
    // Front slope
    -hw, 0, hd,
    hw, 0, hd,
    ridgeHalf, height, 0,
    -hw, 0, hd,
    ridgeHalf, height, 0,
    -ridgeHalf, height, 0,
    // Back slope
    hw, 0, -hd,
    -hw, 0, -hd,
    -ridgeHalf, height, 0,
    hw, 0, -hd,
    -ridgeHalf, height, 0,
    ridgeHalf, height, 0,
    // Right hip
    hw, 0, hd,
    hw, 0, -hd,
    ridgeHalf, height, 0,
    // Left hip
    -hw, 0, -hd,
    -hw, 0, hd,
    -ridgeHalf, height, 0,
  ]);

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geom.computeVertexNormals();
  return geom;
}

export function buildCampusArchitecture(
  registry: TextureRegistry,
  maxAnisotropy: number,
  isSoftwareGl: boolean
): CampusBuildArtifacts {
  const campusRoot = new THREE.Group();
  campusRoot.name = 'tsulbp-campus-root';

  const buildingGroups: Record<string, THREE.Group> = {};
  const clickableMeshes: THREE.Object3D[] = [];
  const nightEmissiveMaterials: THREE.MeshStandardMaterial[] = [];
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  // Shared architectural materials
  const stoneWhiteMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.78,
      metalness: 0.04,
    })
  );
  const concretePlinthMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      roughness: 0.88,
      metalness: 0.05,
    })
  );
  const redRoofMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x9e2a22,
      roughness: 0.52,
      metalness: 0.22,
    })
  );
  const redPlinthMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x8d2d26,
      roughness: 0.82,
      metalness: 0.06,
    })
  );
  const darkIronMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.35,
      metalness: 0.82,
    })
  );
  const goldAccentMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xeab308,
      roughness: 0.28,
      metalness: 0.86,
    })
  );
  const glassCyanMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x67b7dc,
      roughness: 0.14,
      metalness: 0.15,
      clearcoat: 1.0,
      clearcoatRoughness: 0.12,
      transparent: true,
      opacity: isSoftwareGl ? 0.65 : 0.78,
    })
  );
  const pavedWalkwayMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd9d5cc,
      roughness: 0.9,
      metalness: 0.02,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
  );
  const turfGreenMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x4b8f48,
      roughness: 0.92,
      metalness: 0.0,
    })
  );

  // =========================================================================
  // 1. MAIN RECTORATE BUILDING (Southwest block along Tashkent Avenue)
  // =========================================================================
  const rectorateGroup = new THREE.Group();
  rectorateGroup.position.set(-82, 0, 62);
  rectorateGroup.rotation.y = CAMPUS_TILT_RAD;

  const rectTex = createFacadeTextures(registry, maxAnisotropy, {
    wallHex: '#e4bd6b',
    corniceHex: '#f8fafc',
    plinthHex: '#cbd5e1',
    windowHex: '#2f6090',
    stories: 6,
    bays: 14,
    pilasters: true,
    seed: 101,
  });
  const rectSideTex = createFacadeTextures(registry, maxAnisotropy, {
    wallHex: '#e4bd6b',
    corniceHex: '#f8fafc',
    plinthHex: '#cbd5e1',
    windowHex: '#2f6090',
    stories: 6,
    bays: 4,
    pilasters: false,
    seed: 102,
  });

  const rectFrontMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: rectTex.map,
      emissiveMap: rectTex.emissiveMap,
      emissive: new THREE.Color(0xffd27a),
      emissiveIntensity: 0,
      roughness: 0.74,
      metalness: 0.04,
    })
  );
  const rectSideMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: rectSideTex.map,
      emissiveMap: rectSideTex.emissiveMap,
      emissive: new THREE.Color(0xffd27a),
      emissiveIntensity: 0,
      roughness: 0.76,
      metalness: 0.04,
    })
  );
  const rectRoofSlabMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd8c392,
      roughness: 0.85,
      metalness: 0.04,
    })
  );
  nightEmissiveMaterials.push(rectFrontMat, rectSideMat);

  // Main 6-story rectangular mass
  const rectBody = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(68, 22, 18)), [
    rectSideMat,
    rectSideMat,
    rectRoofSlabMat,
    concretePlinthMat,
    rectFrontMat,
    rectFrontMat,
  ]);
  rectBody.position.set(0, 11.4, 0);
  rectBody.castShadow = true;
  rectorateGroup.add(rectBody);

  // Base terrace plinth
  const rectBase = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(70.5, 0.8, 20.5)),
    concretePlinthMat
  );
  rectBase.position.set(0, 0.4, 0);
  rectorateGroup.add(rectBase);

  // White inter-floor cornice ledges & rooftop cornice
  for (let i = 1; i <= 6; i++) {
    const ledge = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(68.7, 0.34, 18.6)),
      stoneWhiteMat
    );
    ledge.position.set(0, 0.8 + i * 3.58, 0);
    rectorateGroup.add(ledge);
  }

  // Vertical white pilasters on left & center bays
  for (let px = -30; px <= 6; px += 9) {
    const pilaster = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.75, 22, 0.5)),
      stoneWhiteMat
    );
    pilaster.position.set(px, 11.4, 9.15);
    rectorateGroup.add(pilaster);
  }

  // Raised rooftop parapet + red Tajik signage board
  const parapet = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(66, 2.2, 1.2)),
    stoneWhiteMat
  );
  parapet.position.set(0, 23.5, 8.2);
  parapet.castShadow = true;
  rectorateGroup.add(parapet);

  const signMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: createRectorateSignTexture(registry, maxAnisotropy),
      roughness: 0.45,
      metalness: 0.05,
    })
  );
  const signMesh = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(58, 1.9)),
    signMat
  );
  signMesh.position.set(0, 23.55, 8.83);
  rectorateGroup.add(signMesh);

  // Large blue banner on upper-right facade
  const bannerMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: createBlueBannerTexture(registry, maxAnisotropy),
      roughness: 0.38,
      metalness: 0.1,
    })
  );
  const bannerMesh = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(8.5, 9.2, 0.28)),
    bannerMat
  );
  bannerMesh.position.set(24.5, 16.2, 9.25);
  rectorateGroup.add(bannerMesh);

  // East/South entrance canopy & wide steps (matching Image 4 top-left)
  const canopyDeck = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(5.8, 5.8, 0.7, 24, 1, false, -Math.PI * 0.5, Math.PI)),
    stoneWhiteMat
  );
  canopyDeck.rotation.y = Math.PI * 0.5;
  canopyDeck.position.set(27, 4.4, 9.2);
  rectorateGroup.add(canopyDeck);

  for (let col = -3.8; col <= 3.8; col += 3.8) {
    const pillar = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.32, 0.36, 4.2, 12)),
      stoneWhiteMat
    );
    pillar.position.set(27 + col, 2.2, 12.6);
    rectorateGroup.add(pillar);
  }

  // Wide staircase leading south from Rectorate entrance
  for (let s = 0; s < 5; s++) {
    const step = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(11.5, 0.25, 0.9 + s * 0.65)),
      concretePlinthMat
    );
    step.position.set(27, 0.12 + (4 - s) * 0.18, 12.5 + s * 0.65);
    rectorateGroup.add(step);
  }

  // Rooftop flagpole & waving Tajikistan flag
  const flagpole = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.1, 0.16, 11.5, 10)),
    stoneWhiteMat
  );
  flagpole.position.set(0, 28.5, 8.2);
  rectorateGroup.add(flagpole);

  const flagFinial = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.28, 12, 12)),
    goldAccentMat
  );
  flagFinial.position.set(0, 34.35, 8.2);
  rectorateGroup.add(flagFinial);

  const flagGeom = trackGeo(new THREE.PlaneGeometry(7.2, 3.6, 20, 10));
  flagGeom.translate(3.6, 0, 0);
  const flagBasePositions = Float32Array.from(
    flagGeom.attributes.position.array as Float32Array
  );
  const flagMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: createTajikistanFlagTexture(registry, maxAnisotropy),
      roughness: 0.6,
      metalness: 0.05,
      side: THREE.DoubleSide,
    })
  );
  const flagMesh = new THREE.Mesh(flagGeom, flagMat);
  flagMesh.position.set(0.05, 32.1, 8.2);
  flagMesh.castShadow = true;
  rectorateGroup.add(flagMesh);

  registerClickable(rectorateGroup, 'rectorate', clickableMeshes);
  campusRoot.add(rectorateGroup);
  buildingGroups.rectorate = rectorateGroup;

  // =========================================================================
  // 2. MONUMENTAL TRIPLE-ARCHED GATE, FOUNTAIN POOL & CROSSWALK (main_gate)
  // =========================================================================
  const gateGroup = new THREE.Group();
  gateGroup.position.set(-60, 0, 96);
  gateGroup.rotation.y = CAMPUS_TILT_RAD;

  // Paved plaza linking Rectorate steps to Tashkent Ave
  const plazaSlab = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(56, 0.16, 30)),
    pavedWalkwayMat
  );
  plazaSlab.position.set(-10, 0.08, -10);
  gateGroup.add(plazaSlab);

  // Rectangular blue tiled pool / fountain in front of Rectorate
  const poolOuter = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(22, 0.75, 10.5)),
    stoneWhiteMat
  );
  poolOuter.position.set(-22, 0.38, -14);
  poolOuter.castShadow = true;
  gateGroup.add(poolOuter);

  const poolMosaicMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: createPoolMosaicTexture(registry, maxAnisotropy),
      roughness: 0.25,
      metalness: 0.1,
    })
  );
  const poolFloor = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(20.4, 8.9)),
    poolMosaicMat
  );
  poolFloor.rotation.x = -Math.PI * 0.5;
  poolFloor.position.set(-22, 0.66, -14);
  gateGroup.add(poolFloor);

  const waterMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      roughness: 0.08,
      metalness: 0.1,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
    })
  );
  const waterMesh = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(20.2, 8.7, 24, 12)),
    waterMat
  );
  waterMesh.rotation.x = -Math.PI * 0.5;
  waterMesh.position.set(-22, 0.73, -14);
  waterMesh.renderOrder = 2;
  gateGroup.add(waterMesh);

  // Fountain centerpiece nozzles
  for (const fx of [-27, -22, -17]) {
    const nozzle = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.25, 0.45, 0.9, 12)),
      stoneWhiteMat
    );
    nozzle.position.set(fx, 0.95, -14);
    gateGroup.add(nozzle);
  }

  // Monumental Triple-Arched Entrance Portal along Tashkent Avenue
  const gatePortalMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd9822b,
      roughness: 0.62,
      metalness: 0.08,
    })
  );
  const gateFriezeMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: createGateOrnamentTexture(registry, maxAnisotropy),
      roughness: 0.52,
      metalness: 0.08,
    })
  );

  // 4 monumental piers forming 3 arches
  const pierXs = [-11.5, -5.2, 5.2, 11.5];
  for (const px of pierXs) {
    const pier = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(2.1, 8.2, 2.4)),
      gatePortalMat
    );
    pier.position.set(px, 4.1, 5.5);
    pier.castShadow = true;
    gateGroup.add(pier);

    const cap = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(2.6, 0.55, 2.9)),
      stoneWhiteMat
    );
    cap.position.set(px, 8.45, 5.5);
    gateGroup.add(cap);

    const finial = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.45, 12, 12)),
      goldAccentMat
    );
    finial.position.set(px, 9.1, 5.5);
    gateGroup.add(finial);
  }

  // Ornate triple-arch entablature beam with Tajik geometric frieze
  const friezeBeam = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(26.2, 2.8, 2.5)),
    [
      gatePortalMat,
      gatePortalMat,
      stoneWhiteMat,
      gatePortalMat,
      gateFriezeMat,
      gateFriezeMat,
    ]
  );
  friezeBeam.position.set(0, 8.6, 5.5);
  friezeBeam.castShadow = true;
  gateGroup.add(friezeBeam);

  // Arched spandrel headers (center wide arch + 2 flanking arches)
  const centerCrown = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(10.4, 1.5, 2.2)),
    stoneWhiteMat
  );
  centerCrown.position.set(0, 10.6, 5.5);
  gateGroup.add(centerCrown);

  // Wrought-iron entrance gates
  for (let gx = -9.5; gx <= 9.5; gx += 0.95) {
    if (Math.abs(gx) < 3.6) continue; // Center drive-through open
    const bar = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.05, 0.05, 4.2, 6)),
      darkIronMat
    );
    bar.position.set(gx, 2.1, 5.5);
    gateGroup.add(bar);
  }

  // Perimeter wrought-iron campus fence extending left & right along Tashkent Ave
  for (const side of [-1, 1]) {
    const startX = side === -1 ? -46 : 13;
    const len = side === -1 ? 33 : 22;
    const fenceRailTop = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(len, 0.14, 0.14)),
      darkIronMat
    );
    fenceRailTop.position.set(startX + len * 0.5, 2.4, 5.5);
    gateGroup.add(fenceRailTop);

    const fenceBase = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(len, 0.65, 0.45)),
      gatePortalMat
    );
    fenceBase.position.set(startX + len * 0.5, 0.33, 5.5);
    gateGroup.add(fenceBase);

    for (let x = startX; x <= startX + len; x += 4.5) {
      const post = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.55, 2.9, 0.55)),
        gatePortalMat
      );
      post.position.set(x, 1.45, 5.5);
      gateGroup.add(post);
    }
  }

  // Zebra crosswalk on Tashkent Avenue directly outside main gate
  const crosswalkMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: createCrosswalkTexture(registry, maxAnisotropy),
      roughness: 0.85,
      metalness: 0.04,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    })
  );
  const crosswalk = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(11, 5.2)),
    crosswalkMat
  );
  crosswalk.rotation.x = -Math.PI * 0.5;
  crosswalk.position.set(0, 0.18, 12.2);
  gateGroup.add(crosswalk);

  registerClickable(gateGroup, 'main_gate', clickableMeshes);
  campusRoot.add(gateGroup);
  buildingGroups.main_gate = gateGroup;

  // =========================================================================
  // 3. CENTRAL TSULBP STADIUM (Стадион ТГУ)
  // =========================================================================
  const stadiumGroup = new THREE.Group();
  stadiumGroup.position.set(-8, 0, 12);
  stadiumGroup.rotation.y = CAMPUS_TILT_RAD;

  // Raised stadium terrace platform
  const stadiumDeck = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(62, 1.1, 88)),
    concretePlinthMat
  );
  stadiumDeck.position.set(0, 0.55, 0);
  stadiumDeck.castShadow = true;
  stadiumGroup.add(stadiumDeck);

  // Terracotta oval running track via ExtrudeGeometry with rounded ends
  const trackShape = new THREE.Shape();
  const tw = 26.5;
  const th = 22.5;
  trackShape.moveTo(-tw, -th);
  trackShape.lineTo(tw, -th);
  trackShape.absarc(tw, 0, th, -Math.PI * 0.5, Math.PI * 0.5, false);
  trackShape.lineTo(-tw, th);
  trackShape.absarc(-tw, 0, th, Math.PI * 0.5, Math.PI * 1.5, false);

  const trackGeo2 = trackGeo(
    new THREE.ExtrudeGeometry(trackShape, {
      depth: 0.25,
      bevelEnabled: false,
      curveSegments: 24,
    })
  );
  trackGeo2.rotateX(-Math.PI * 0.5);
  trackGeo2.rotateY(Math.PI * 0.5); // Orient track N-S
  const runningTrackMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: createRunningTrackTexture(registry, maxAnisotropy),
      roughness: 0.85,
      metalness: 0.03,
    })
  );
  const trackMesh = new THREE.Mesh(trackGeo2, runningTrackMat);
  trackMesh.position.set(0, 1.05, 0);
  stadiumGroup.add(trackMesh);

  // Emerald football pitch with crisp markings
  const pitchMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: createStadiumPitchTexture(registry, maxAnisotropy),
      roughness: 0.9,
      metalness: 0.0,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
  );
  const pitchMesh = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(34, 58)),
    pitchMat
  );
  pitchMesh.rotation.x = -Math.PI * 0.5;
  pitchMesh.position.set(0, 1.34, 0);
  stadiumGroup.add(pitchMesh);

  // Football goal posts at north and south ends
  for (const gz of [-26.5, 26.5]) {
    const crossbar = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(5.6, 0.16, 0.16)),
      stoneWhiteMat
    );
    crossbar.position.set(0, 3.2, gz);
    stadiumGroup.add(crossbar);

    for (const gx of [-2.8, 2.8]) {
      const post = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.08, 0.08, 1.9, 8)),
        stoneWhiteMat
      );
      post.position.set(gx, 2.25, gz);
      stadiumGroup.add(post);
    }
  }

  // Stadium perimeter curb wall
  for (const sx of [-30.6, 30.6]) {
    const curb = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.8, 1.5, 88)),
      stoneWhiteMat
    );
    curb.position.set(sx, 0.75, 0);
    stadiumGroup.add(curb);
  }

  registerClickable(stadiumGroup, 'stadium', clickableMeshes);
  campusRoot.add(stadiumGroup);
  buildingGroups.stadium = stadiumGroup;

  // =========================================================================
  // 4. LANDSCAPED GREEN SQUARE & SECONDARY ARCH (green_square)
  // =========================================================================
  const squareGroup = new THREE.Group();
  squareGroup.position.set(0, 0, 68);
  squareGroup.rotation.y = CAMPUS_TILT_RAD;

  // Paved promenade floor
  const squareBase = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(66, 0.25, 40)),
    pavedWalkwayMat
  );
  squareBase.position.set(0, 0.12, 0);
  squareGroup.add(squareBase);

  // Four symmetrical landscaped lawn quadrants
  for (const qx of [-18, 18]) {
    for (const qz of [-8.5, 6.5]) {
      const bedRim = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(22, 0.45, 11)),
        concretePlinthMat
      );
      bedRim.position.set(qx, 0.24, qz);
      squareGroup.add(bedRim);

      const turf = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(21, 0.5, 10)),
        turfGreenMat
      );
      turf.position.set(qx, 0.26, qz);
      squareGroup.add(turf);
    }
  }

  // Secondary entrance arch between square and stadium axis (Image 4 center)
  for (const ax of [-4.2, 4.2]) {
    const col = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.55, 0.65, 5.2, 14)),
      gatePortalMat
    );
    col.position.set(ax, 2.6, -15.5);
    col.castShadow = true;
    squareGroup.add(col);
  }
  const archLintel = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(10.8, 1.45, 2.2)),
    gatePortalMat
  );
  archLintel.position.set(0, 5.8, -15.5);
  archLintel.castShadow = true;
  squareGroup.add(archLintel);

  const archRoofCap = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(11.4, 0.35, 2.6)),
    stoneWhiteMat
  );
  archRoofCap.position.set(0, 6.7, -15.5);
  squareGroup.add(archRoofCap);

  // Southern steps down to Tashkent Ave sidewalk
  for (let s = 0; s < 4; s++) {
    const step = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(11.5, 0.22, 0.8 + s * 0.5)),
      concretePlinthMat
    );
    step.position.set(0, 0.1 + (3 - s) * 0.14, 19 + s * 0.5);
    squareGroup.add(step);
  }

  registerClickable(squareGroup, 'green_square', clickableMeshes);
  campusRoot.add(squareGroup);
  buildingGroups.green_square = squareGroup;

  // =========================================================================
  // 5. EAST STADIUM HALL WITH SEMICIRCULAR SOUTH BAY (east_rotunda_hall)
  // =========================================================================
  const eastHallGroup = new THREE.Group();
  eastHallGroup.position.set(44, 0, 14);
  eastHallGroup.rotation.y = CAMPUS_TILT_RAD;

  const eastTex = createFacadeTextures(registry, maxAnisotropy, {
    wallHex: '#e2c179',
    corniceHex: '#f8fafc',
    plinthHex: '#94a3b8',
    windowHex: '#336699',
    stories: 2,
    bays: 8,
    pilasters: false,
    seed: 204,
  });
  const eastMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: eastTex.map,
      emissiveMap: eastTex.emissiveMap,
      emissive: new THREE.Color(0xffd27a),
      emissiveIntensity: 0,
      roughness: 0.72,
      metalness: 0.04,
    })
  );
  nightEmissiveMaterials.push(eastMat);

  const eastBody = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(12.5, 8.2, 32)),
    [eastMat, eastMat, concretePlinthMat, concretePlinthMat, eastMat, eastMat]
  );
  eastBody.position.set(0, 4.1, -2);
  eastBody.castShadow = true;
  eastHallGroup.add(eastBody);

  // Signature semicircular south bay (matching Images 2 & 4)
  const southBay = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(6.25, 6.25, 7.8, 24, 1, false, -Math.PI * 0.5, Math.PI)),
    eastMat
  );
  southBay.position.set(0, 3.9, 14);
  southBay.castShadow = true;
  eastHallGroup.add(southBay);

  const bayCornice = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(6.6, 6.6, 0.45, 24, 1, false, -Math.PI * 0.5, Math.PI)),
    stoneWhiteMat
  );
  bayCornice.position.set(0, 7.9, 14);
  eastHallGroup.add(bayCornice);

  // Red pitched roof + semicircular cone cap
  const eastRoof = new THREE.Mesh(
    trackGeo(createPitchedRoofGeometry(32.8, 13.4, 3.6)),
    redRoofMat
  );
  eastRoof.rotation.y = Math.PI * 0.5;
  eastRoof.position.set(0, 8.2, -2);
  eastRoof.castShadow = true;
  eastHallGroup.add(eastRoof);

  const bayConeRoof = new THREE.Mesh(
    trackGeo(new THREE.ConeGeometry(6.5, 3.6, 24, 1, false, -Math.PI * 0.5, Math.PI)),
    redRoofMat
  );
  bayConeRoof.position.set(0, 9.9, 14);
  bayConeRoof.castShadow = true;
  eastHallGroup.add(bayConeRoof);

  registerClickable(eastHallGroup, 'east_rotunda_hall', clickableMeshes);
  campusRoot.add(eastHallGroup);
  buildingGroups.east_rotunda_hall = eastHallGroup;

  // =========================================================================
  // 6. SOUTH STADIUM PAVILION (south_stadium_pavilion)
  // =========================================================================
  const southPavGroup = new THREE.Group();
  southPavGroup.position.set(26, 0, 44);
  southPavGroup.rotation.y = CAMPUS_TILT_RAD;

  const southPavBody = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(20, 6.4, 9)),
    [eastMat, eastMat, concretePlinthMat, concretePlinthMat, eastMat, eastMat]
  );
  southPavBody.position.set(0, 3.2, 0);
  southPavBody.castShadow = true;
  southPavGroup.add(southPavBody);

  const southPavRoof = new THREE.Mesh(
    trackGeo(createPitchedRoofGeometry(20.8, 9.8, 2.8)),
    redRoofMat
  );
  southPavRoof.position.set(0, 6.4, 0);
  southPavRoof.castShadow = true;
  southPavGroup.add(southPavRoof);

  registerClickable(southPavGroup, 'south_stadium_pavilion', clickableMeshes);
  campusRoot.add(southPavGroup);
  buildingGroups.south_stadium_pavilion = southPavGroup;

  // =========================================================================
  // 7. WEST CAMPUS RED-ROOF ANNEXES (west_campus_annexes)
  // =========================================================================
  const westGroup = new THREE.Group();
  westGroup.position.set(-64, 0, 24);
  westGroup.rotation.y = CAMPUS_TILT_RAD;

  // North-of-rectorate elongated red-roof block (Image 2 bottom-left)
  const westLongBody = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(28, 7.2, 12)),
    eastMat
  );
  westLongBody.position.set(-18, 3.6, 12);
  westLongBody.castShadow = true;
  westGroup.add(westLongBody);

  const westLongRoof = new THREE.Mesh(
    trackGeo(createPitchedRoofGeometry(28.8, 12.8, 3.2)),
    redRoofMat
  );
  westLongRoof.position.set(-18, 7.2, 12);
  westLongRoof.castShadow = true;
  westGroup.add(westLongRoof);

  // Two small twin red-roof buildings flanking west edge of stadium
  for (const [bx, bz, bw, bd] of [
    [6, -4, 7.5, 13],
    [15, -3, 7.2, 16],
  ]) {
    const smallBody = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(bw, 5.4, bd)),
      eastMat
    );
    smallBody.position.set(bx, 2.7, bz);
    smallBody.castShadow = true;
    westGroup.add(smallBody);

    const smallRoof = new THREE.Mesh(
      trackGeo(createPitchedRoofGeometry(bd + 0.6, bw + 0.6, 2.5)),
      redRoofMat
    );
    smallRoof.rotation.y = Math.PI * 0.5;
    smallRoof.position.set(bx, 5.4, bz);
    smallRoof.castShadow = true;
    westGroup.add(smallRoof);
  }

  registerClickable(westGroup, 'west_campus_annexes', clickableMeshes);
  campusRoot.add(westGroup);
  buildingGroups.west_campus_annexes = westGroup;

  // =========================================================================
  // 8. NORTHEAST MULTI-STORY ACADEMIC HALL (northeast_main_hall)
  // =========================================================================
  const neHallGroup = new THREE.Group();
  neHallGroup.position.set(54, 0, -46);
  neHallGroup.rotation.y = CAMPUS_TILT_RAD;

  const neTex = createFacadeTextures(registry, maxAnisotropy, {
    wallHex: '#e3bf72',
    corniceHex: '#f8fafc',
    plinthHex: '#cbd5e1',
    windowHex: '#2f5f8f',
    stories: 5,
    bays: 16,
    pilasters: true,
    seed: 301,
  });
  const neMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: neTex.map,
      emissiveMap: neTex.emissiveMap,
      emissive: new THREE.Color(0xffd27a),
      emissiveIntensity: 0,
      roughness: 0.74,
      metalness: 0.04,
    })
  );
  nightEmissiveMaterials.push(neMat);

  // Main horizontal 5-story block
  const neMainBody = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(74, 18.5, 17)),
    [neMat, neMat, rectRoofSlabMat, concretePlinthMat, neMat, neMat]
  );
  neMainBody.position.set(0, 9.25, 0);
  neMainBody.castShadow = true;
  neHallGroup.add(neMainBody);

  // Right-hand projecting front wing (Image 2 right side of NE building)
  const neFrontWing = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(15, 14.5, 12)),
    [neMat, neMat, rectRoofSlabMat, concretePlinthMat, neMat, neMat]
  );
  neFrontWing.position.set(27.5, 7.25, 13.5);
  neFrontWing.castShadow = true;
  neHallGroup.add(neFrontWing);

  // Semicircular eastern entrance pavilion
  const neEastRotunda = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(6.8, 6.8, 12.5, 24, 1, false, 0, Math.PI)),
    neMat
  );
  neEastRotunda.position.set(37, 6.25, 0);
  neEastRotunda.castShadow = true;
  neHallGroup.add(neEastRotunda);

  // West step-down entrance annex
  const neWestAnnex = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(8, 7.5, 9)),
    concretePlinthMat
  );
  neWestAnnex.position.set(-40, 3.75, 2);
  neHallGroup.add(neWestAnnex);

  // Courtyard lawn bed in front of NE hall
  const neCourtyardBed = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(52, 0.3, 18)),
    turfGreenMat
  );
  neCourtyardBed.position.set(-4, 0.15, 19);
  neHallGroup.add(neCourtyardBed);

  registerClickable(neHallGroup, 'northeast_main_hall', clickableMeshes);
  campusRoot.add(neHallGroup);
  buildingGroups.northeast_main_hall = neHallGroup;

  // =========================================================================
  // 9. NEW 5TH BUILDING (ТГУ 5 корпус новый) + ORANGE ANNEX (building_5_new)
  // =========================================================================
  const b5Group = new THREE.Group();
  b5Group.position.set(64, 0, -88);
  b5Group.rotation.y = CAMPUS_TILT_RAD;

  const b5Tex = createFacadeTextures(registry, maxAnisotropy, {
    wallHex: '#edd07b',
    corniceHex: '#ffffff',
    plinthHex: '#9e2a22',
    windowHex: '#4f8ec4',
    stories: 3,
    bays: 10,
    pilasters: true,
    seed: 505,
  });
  const b5Mat = trackMat(
    new THREE.MeshStandardMaterial({
      map: b5Tex.map,
      emissiveMap: b5Tex.emissiveMap,
      emissive: new THREE.Color(0xffe08a),
      emissiveIntensity: 0,
      roughness: 0.68,
      metalness: 0.05,
    })
  );
  nightEmissiveMaterials.push(b5Mat);

  // Red plinth base
  const b5Plinth = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(50, 1.4, 19.5)),
    redPlinthMat
  );
  b5Plinth.position.set(0, 0.7, 0);
  b5Group.add(b5Plinth);

  // Main 3-story yellow academic palace
  const b5Main = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(48, 12.5, 18)),
    [b5Mat, b5Mat, concretePlinthMat, redPlinthMat, b5Mat, b5Mat]
  );
  b5Main.position.set(0, 7.65, 0);
  b5Main.castShadow = true;
  b5Group.add(b5Main);

  // Red pitched roof
  const b5Roof = new THREE.Mesh(
    trackGeo(createPitchedRoofGeometry(49.4, 19.2, 4.4)),
    redRoofMat
  );
  b5Roof.position.set(0, 13.9, 0);
  b5Roof.castShadow = true;
  b5Group.add(b5Roof);

  // Twin front dormer / pediment projections (clearly visible in Image 2 top-right)
  for (const dx of [-11.5, 11.5]) {
    const dormer = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(10.5, 14.2, 3.6)),
      b5Mat
    );
    dormer.position.set(dx, 8.2, 9.6);
    dormer.castShadow = true;
    b5Group.add(dormer);

    const dormerCap = new THREE.Mesh(
      trackGeo(createPitchedRoofGeometry(11.2, 4.2, 2.2)),
      redRoofMat
    );
    dormerCap.position.set(dx, 15.3, 9.6);
    b5Group.add(dormerCap);

    // Tall central stained-glass window bay
    const stainedGlass = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(6.8, 9.8, 0.35)),
      glassCyanMat
    );
    stainedGlass.position.set(dx, 8.4, 11.42);
    b5Group.add(stainedGlass);
  }

  // Central entrance portico & stained-glass atrium
  const b5CentralGlass = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(7.2, 10.6, 1.4)),
    glassCyanMat
  );
  b5CentralGlass.position.set(0, 7.4, 9.1);
  b5Group.add(b5CentralGlass);

  // Signature semicircular glass entrance rotunda with white columns on RIGHT (east) end
  const rotundaRadius = 7.4;
  const rotundaGlass = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(rotundaRadius, rotundaRadius, 11.8, 28, 1, false, 0, Math.PI)),
    glassCyanMat
  );
  rotundaGlass.position.set(24, 6.8, 0);
  b5Group.add(rotundaGlass);

  // White columns ringing the semicircular rotunda
  for (let i = 0; i <= 6; i++) {
    const ang = (i / 6) * Math.PI - Math.PI * 0.5;
    const cx = 24 + Math.cos(ang) * (rotundaRadius + 0.35);
    const cz = Math.sin(ang) * (rotundaRadius + 0.35);
    const column = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.32, 0.38, 12.2, 12)),
      stoneWhiteMat
    );
    column.position.set(cx, 6.9, cz);
    column.castShadow = true;
    b5Group.add(column);
  }

  // Rotunda cornice ring & conical red roof cap
  const rotundaCornice = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(rotundaRadius + 0.8, rotundaRadius + 0.8, 0.7, 28, 1, false, 0, Math.PI)),
    stoneWhiteMat
  );
  rotundaCornice.position.set(24, 13.0, 0);
  b5Group.add(rotundaCornice);

  const rotundaRoof = new THREE.Mesh(
    trackGeo(new THREE.ConeGeometry(rotundaRadius + 0.9, 3.6, 28, 1, false, 0, Math.PI)),
    redRoofMat
  );
  rotundaRoof.position.set(24, 15.1, 0);
  rotundaRoof.castShadow = true;
  b5Group.add(rotundaRoof);

  // Adjacent two-story orange-ochre building to the left (west) + skybridge connector (Image 2)
  const bridge = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(10, 4.5, 5.5)),
    b5Mat
  );
  bridge.position.set(-28.5, 9.2, -3);
  b5Group.add(bridge);

  const orangeAnnexTex = createFacadeTextures(registry, maxAnisotropy, {
    wallHex: '#e5a356',
    corniceHex: '#fff7ed',
    plinthHex: '#9e2a22',
    windowHex: '#3b82b6',
    stories: 2,
    bays: 6,
    pilasters: true,
    seed: 506,
  });
  const orangeAnnexMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: orangeAnnexTex.map,
      emissiveMap: orangeAnnexTex.emissiveMap,
      emissive: new THREE.Color(0xffd27a),
      emissiveIntensity: 0,
      roughness: 0.72,
      metalness: 0.04,
    })
  );
  nightEmissiveMaterials.push(orangeAnnexMat);

  const westOrangeAnnex = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(18, 9.5, 22)),
    orangeAnnexMat
  );
  westOrangeAnnex.position.set(-41, 4.75, 0);
  westOrangeAnnex.castShadow = true;
  b5Group.add(westOrangeAnnex);

  const westAnnexGable = new THREE.Mesh(
    trackGeo(createPitchedRoofGeometry(18.6, 22.6, 3.8)),
    redRoofMat
  );
  westAnnexGable.position.set(-41, 9.5, 0);
  westAnnexGable.castShadow = true;
  b5Group.add(westAnnexGable);

  registerClickable(b5Group, 'building_5_new', clickableMeshes);
  campusRoot.add(b5Group);
  buildingGroups.building_5_new = b5Group;

  // =========================================================================
  // 10. L-SHAPED TERRACOTTA INNOVATION PAVILION (innovation_pavilion)
  // =========================================================================
  const pavGroup = new THREE.Group();
  pavGroup.position.set(-28, 0, -42);
  pavGroup.rotation.y = CAMPUS_TILT_RAD;

  const terraWallMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x9c6644,
      roughness: 0.78,
      metalness: 0.05,
    })
  );

  // Horizontal leg of L-pavilion
  const pavMain = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(36, 6.2, 10)),
    terraWallMat
  );
  pavMain.position.set(0, 3.1, 2);
  pavMain.castShadow = true;
  pavGroup.add(pavMain);

  // Northward L-wing
  const pavWing = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(10, 6.2, 14)),
    terraWallMat
  );
  pavWing.position.set(13, 3.1, -9);
  pavWing.castShadow = true;
  pavGroup.add(pavWing);

  // Large panoramic cyan glass bays along south facade
  for (let gx = -13.5; gx <= 13.5; gx += 6.75) {
    const windowBay = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(5.2, 3.8, 0.35)),
      glassCyanMat
    );
    windowBay.position.set(gx, 2.8, 7.1);
    pavGroup.add(windowBay);
  }

  // Twin green tree beds directly south of L-pavilion
  for (const bx of [-4, 18]) {
    const bed = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(18, 0.3, 6.5)),
      turfGreenMat
    );
    bed.position.set(bx - 10, 0.15, 13.5);
    pavGroup.add(bed);
  }

  registerClickable(pavGroup, 'innovation_pavilion', clickableMeshes);
  campusRoot.add(pavGroup);
  buildingGroups.innovation_pavilion = pavGroup;

  // =========================================================================
  // 11. MOGOLTAU MOUNTAIN RIDGE SILHOUETTE (Northern Background)
  // =========================================================================
  const mountainGroup = new THREE.Group();
  mountainGroup.name = 'mogoltau-mountains';

  const ridgeSpecs = [
    { x: -380, z: -420, w: 340, h: 78, d: 170, col: 0x6b7280 },
    { x: -110, z: -460, w: 380, h: 108, d: 190, col: 0x64748b },
    { x: 185, z: -440, w: 360, h: 94, d: 180, col: 0x5f6b7a },
    { x: 430, z: -410, w: 310, h: 72, d: 160, col: 0x6b7280 },
  ];

  for (const spec of ridgeSpecs) {
    const mGeo = trackGeo(new THREE.ConeGeometry(spec.w * 0.52, spec.h, 7, 2));
    const mMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: spec.col,
        roughness: 0.94,
        metalness: 0.02,
        flatShading: true,
      })
    );
    const mMesh = new THREE.Mesh(mGeo, mMat);
    mMesh.position.set(spec.x, spec.h * 0.45, spec.z);
    mMesh.scale.set(1.2, 1, spec.d / spec.w);
    mountainGroup.add(mMesh);
  }
  campusRoot.add(mountainGroup);

  // =========================================================================
  // 12. INSTANCED CAMPUS CYPRESS / PINE TREES & STREETLAMPS
  // =========================================================================
  const treePositions: Array<[number, number, number]> = [];
  const pushLocalTree = (
    originX: number,
    originZ: number,
    lx: number,
    lz: number,
    scale = 1
  ) => {
    const cos = Math.cos(-CAMPUS_TILT_RAD);
    const sin = Math.sin(-CAMPUS_TILT_RAD);
    const wx = originX + lx * cos - lz * sin;
    const wz = originZ + lx * sin + lz * cos;
    treePositions.push([wx, wz, scale]);
  };

  // University square gridded tree quadrants
  for (const qx of [-24, -18, -12, 12, 18, 24]) {
    for (const qz of [-11, -6, 3, 8]) {
      pushLocalTree(0, 68, qx, qz, 0.85 + ((Math.abs(qx + qz) % 5) * 0.07));
    }
  }
  // NE Courtyard dense tree grove in front of long hall
  for (let tx = -26; tx <= 18; tx += 5.5) {
    for (let tz = 13; tz <= 24; tz += 5.5) {
      pushLocalTree(54, -46, tx, tz, 0.92 + ((Math.abs(tx) % 3) * 0.08));
    }
  }
  // Cypress trees beside East Stadium Hall
  for (let tz = -14; tz <= 16; tz += 5) {
    pushLocalTree(44, 14, -10.5, tz, 1.05);
    pushLocalTree(44, 14, -14.5, tz + 2, 0.95);
  }
  // Trees in front of L-shaped Innovation Pavilion
  for (let tx = -21; tx <= 14; tx += 5) {
    pushLocalTree(-28, -42, tx, 13.5, 0.88);
  }
  // Tashkent Avenue boulevard trees
  for (let tx = -125; tx <= 110; tx += 14) {
    const [rx, rz] = latLonToLocal(40.31145, 69.6225 + tx * 0.000012);
    treePositions.push([rx, rz + 4, 1.0]);
  }

  const treeCount = treePositions.length;
  const trunkGeo = trackGeo(new THREE.CylinderGeometry(0.18, 0.28, 2.2, 6));
  const trunkMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.92 })
  );
  const crownGeo = trackGeo(new THREE.ConeGeometry(1.7, 6.2, 7));
  const crownMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff, // Tinted per-instance via setColorAt
      roughness: 0.86,
      metalness: 0.02,
    })
  );

  const trunkInstances = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
  const crownInstances = new THREE.InstancedMesh(crownGeo, crownMat, treeCount);
  trunkInstances.castShadow = !isSoftwareGl;
  crownInstances.castShadow = !isSoftwareGl;
  crownInstances.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const foliagePalette = [0x2d6a3e, 0x357a46, 0x245934, 0x3f854d];

  for (let i = 0; i < treeCount; i++) {
    const [tx, tz, sc] = treePositions[i];
    dummy.position.set(tx, 1.1 * sc, tz);
    dummy.scale.set(sc, sc, sc);
    dummy.rotation.y = (i * 1.17) % (Math.PI * 2);
    dummy.updateMatrix();
    trunkInstances.setMatrixAt(i, dummy.matrix);

    dummy.position.set(tx, 4.8 * sc, tz);
    dummy.scale.set(sc, sc * (0.95 + (i % 3) * 0.12), sc);
    dummy.updateMatrix();
    crownInstances.setMatrixAt(i, dummy.matrix);

    color.setHex(foliagePalette[i % foliagePalette.length]);
    crownInstances.setColorAt(i, color);
  }
  trunkInstances.instanceMatrix.needsUpdate = true;
  crownInstances.instanceMatrix.needsUpdate = true;
  if (crownInstances.instanceColor) {
    crownInstances.instanceColor.needsUpdate = true;
  }
  trunkInstances.computeBoundingSphere();
  crownInstances.computeBoundingSphere();
  campusRoot.add(trunkInstances, crownInstances);

  // Streetlamps along Tashkent Avenue & Campus Walkways
  const lampPositions: Array<[number, number]> = [];
  for (let lx = -120; lx <= 105; lx += 22) {
    lampPositions.push([lx, 102 - lx * 0.14]);
  }
  for (let lz = -70; lz <= 65; lz += 25) {
    lampPositions.push([-38, lz]);
    lampPositions.push([28, lz]);
  }

  const lampCount = lampPositions.length;
  const poleGeo = trackGeo(new THREE.CylinderGeometry(0.09, 0.13, 6.2, 8));
  const lampHeadGeo = trackGeo(new THREE.SphereGeometry(0.38, 10, 10));
  const lampHeadMaterial = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfef9c3,
      emissive: new THREE.Color(0xffb74d),
      emissiveIntensity: 0.1,
      roughness: 0.25,
      metalness: 0.1,
    })
  );

  const poleInstances = new THREE.InstancedMesh(poleGeo, darkIronMat, lampCount);
  const headInstances = new THREE.InstancedMesh(
    lampHeadGeo,
    lampHeadMaterial,
    lampCount
  );

  for (let i = 0; i < lampCount; i++) {
    const [lx, lz] = lampPositions[i];
    dummy.position.set(lx, 3.1, lz);
    dummy.scale.set(1, 1, 1);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    poleInstances.setMatrixAt(i, dummy.matrix);

    dummy.position.set(lx, 6.3, lz);
    dummy.updateMatrix();
    headInstances.setMatrixAt(i, dummy.matrix);
  }
  poleInstances.instanceMatrix.needsUpdate = true;
  headInstances.instanceMatrix.needsUpdate = true;
  poleInstances.computeBoundingSphere();
  headInstances.computeBoundingSphere();
  campusRoot.add(poleInstances, headInstances);

  return {
    campusRoot,
    buildingGroups,
    clickableMeshes,
    nightEmissiveMaterials,
    lampHeadMaterial,
    flagMesh,
    flagBasePositions,
    waterMesh,
    dispose: () => {
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
    },
  };
}

/**
 * Builds surrounding 17th Microdistrict OSM context buildings and roads (including
 * Tashkent Avenue and its eastern roundabout).
 */
export function buildOsmContextGroup(dataset: OsmDataset): {
  group: THREE.Group;
  dispose: () => void;
} {
  const group = new THREE.Group();
  group.name = 'osm-context-layer';

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  const contextBuildingMat = new THREE.MeshStandardMaterial({
    color: 0xc4c9d1,
    roughness: 0.86,
    metalness: 0.04,
  });
  const roadMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.9,
    metalness: 0.04,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const roadMarkingMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.7,
    metalness: 0.02,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  materials.push(contextBuildingMat, roadMat, roadMarkingMat);

  // Extrude surrounding context buildings
  for (const b of dataset.buildings) {
    if (b.points.length < 3) continue;
    const shape = new THREE.Shape();
    shape.moveTo(b.points[0][0], -b.points[0][1]);
    for (let i = 1; i < b.points.length; i++) {
      shape.lineTo(b.points[i][0], -b.points[i][1]);
    }
    shape.closePath();

    const height = b.height ?? 10;
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: height,
      bevelEnabled: true,
      bevelSize: 0.2,
      bevelThickness: 0.2,
      bevelSegments: 1,
    });
    geo.rotateX(-Math.PI * 0.5);
    geometries.push(geo);

    const mesh = new THREE.Mesh(geo, contextBuildingMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // Render roads as flat extruded ribbons along polylines
  for (const r of dataset.roads) {
    const pts = r.points;
    if (pts.length < 2) continue;
    const halfW = (r.width ?? 8) * 0.5;

    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, z1] = pts[i];
      const [x2, z2] = pts[i + 1];
      const dx = x2 - x1;
      const dz = z2 - z1;
      const segLen = Math.hypot(dx, dz);
      if (segLen < 0.5) continue;

      const segGeo = new THREE.PlaneGeometry(segLen + halfW * 0.4, halfW * 2);
      geometries.push(segGeo);

      const segMesh = new THREE.Mesh(segGeo, roadMat);
      segMesh.rotation.x = -Math.PI * 0.5;
      segMesh.rotation.z = -Math.atan2(dz, dx);
      segMesh.position.set((x1 + x2) * 0.5, 0.06, (z1 + z2) * 0.5);
      segMesh.receiveShadow = true;
      group.add(segMesh);

      // Centerline dash on major avenues
      if ((r.width ?? 8) >= 12 && segLen > 8) {
        const dashGeo = new THREE.PlaneGeometry(segLen * 0.72, 0.28);
        geometries.push(dashGeo);
        const dashMesh = new THREE.Mesh(dashGeo, roadMarkingMat);
        dashMesh.rotation.x = -Math.PI * 0.5;
        dashMesh.rotation.z = -Math.atan2(dz, dx);
        dashMesh.position.set((x1 + x2) * 0.5, 0.08, (z1 + z2) * 0.5);
        group.add(dashMesh);
      }
    }
  }

  return {
    group,
    dispose: () => {
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
    },
  };
}

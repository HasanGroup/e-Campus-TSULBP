import * as THREE from 'three';
import { CAMPUS_TILT_RAD } from '../data/campusData';
import type { OsmDataset } from '../types/campus';
import {
  TextureRegistry,
  createAsphaltTexture,
  createBlueBannerTexture,
  createCrosswalkTexture,
  createFacadeTextures,
  createGateOrnamentTexture,
  createPavingTileTexture,
  createPoolMosaicTexture,
  createRectorateSignTexture,
  createRoofTileTexture,
  createRunningTrackTexture,
  createStadiumPitchTexture,
  createStuccoWallTexture,
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

  // Hipped pitched roof geometry with world-scaled planar UVs for standing-seam tiles
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

  const uvs = new Float32Array((vertices.length / 3) * 2);
  for (let i = 0, u = 0; i < vertices.length; i += 3, u += 2) {
    uvs[u] = (vertices[i] + hw) / 8;
    uvs[u + 1] = (vertices[i + 2] + hd) / 8;
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geom.computeVertexNormals();
  return geom;
}

function createArchSpanGeometry(
  spanWidth: number,
  totalHeight: number,
  archRadius: number,
  archSpringY: number,
  depth: number
): THREE.BufferGeometry {
  const hw = spanWidth * 0.5;
  const shape = new THREE.Shape();
  shape.moveTo(-hw, 0);
  shape.lineTo(-archRadius, 0);
  shape.lineTo(-archRadius, archSpringY);
  shape.absarc(0, archSpringY, archRadius, Math.PI, 0, true);
  shape.lineTo(archRadius, 0);
  shape.lineTo(hw, 0);
  shape.lineTo(hw, totalHeight);
  shape.lineTo(-hw, totalHeight);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.08,
    bevelSegments: 2,
    curveSegments: 20,
  });
  geo.translate(0, 0, -depth * 0.5);
  return geo;
}

function campusLocalToWorld(
  ox: number,
  oz: number,
  lx: number,
  lz: number
): [number, number] {
  const cos = Math.cos(CAMPUS_TILT_RAD);
  const sin = Math.sin(CAMPUS_TILT_RAD);
  return [ox + lx * cos + lz * sin, oz - lx * sin + lz * cos];
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

  // Shared PBR architectural materials (varied roughness/metalness for realism)
  const stoneWhiteMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.72,
      metalness: 0.05,
    })
  );
  const concretePlinthMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      roughness: 0.88,
      metalness: 0.04,
    })
  );
  const redRoofMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: createRoofTileTexture(registry, maxAnisotropy),
      roughness: 0.42,
      metalness: 0.28,
    })
  );
  const redPlinthMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x8d2d26,
      roughness: 0.84,
      metalness: 0.05,
    })
  );
  const ochreStuccoMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: createStuccoWallTexture(registry, maxAnisotropy, '#e4bd6b'),
      roughness: 0.78,
      metalness: 0.03,
    })
  );
  const darkIronMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.32,
      metalness: 0.84,
    })
  );
  const goldAccentMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xeab308,
      roughness: 0.24,
      metalness: 0.88,
    })
  );
  const glassCyanMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x3b82b6,
      roughness: 0.08,
      metalness: 0.22,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      reflectivity: 0.95,
      transparent: true,
      opacity: isSoftwareGl ? 0.78 : 0.86,
    })
  );
  const pavedWalkwayMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: createPavingTileTexture(registry, maxAnisotropy),
      roughness: 0.88,
      metalness: 0.02,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
  );
  const asphaltMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: createAsphaltTexture(registry, maxAnisotropy),
      roughness: 0.92,
      metalness: 0.03,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
  );
  const turfGreenMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x4b8f48,
      roughness: 0.93,
      metalness: 0.0,
    })
  );
  const rectRoofSlabMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd8c392,
      roughness: 0.85,
      metalness: 0.04,
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
    windowHex: '#255585',
    stories: 6,
    bays: 14,
    pilasters: true,
    seed: 101,
  });
  const rectSideTex = createFacadeTextures(registry, maxAnisotropy, {
    wallHex: '#e4bd6b',
    corniceHex: '#f8fafc',
    plinthHex: '#cbd5e1',
    windowHex: '#255585',
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
    trackGeo(new THREE.BoxGeometry(70.5, 0.9, 20.5)),
    concretePlinthMat
  );
  rectBase.position.set(0, 0.45, 0);
  rectorateGroup.add(rectBase);

  // Protruding white inter-floor cornice ledges & rooftop cornice
  for (let i = 1; i <= 6; i++) {
    const ledge = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(68.8, 0.38, 18.7)),
      stoneWhiteMat
    );
    ledge.position.set(0, 0.8 + i * 3.58, 0);
    rectorateGroup.add(ledge);
  }

  // Vertical 3D white pilasters across front & back bays
  for (let px = -30; px <= 30; px += 10) {
    for (const pz of [9.18, -9.18]) {
      const pilaster = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.82, 22, 0.55)),
        stoneWhiteMat
      );
      pilaster.position.set(px, 11.4, pz);
      rectorateGroup.add(pilaster);
    }
  }

  // Raised rooftop parapet + red Tajik signage board
  const parapet = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(66.5, 2.3, 1.2)),
    stoneWhiteMat
  );
  parapet.position.set(0, 23.5, 8.2);
  parapet.castShadow = true;
  rectorateGroup.add(parapet);

  const backParapet = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(66.5, 1.1, 0.7)),
    stoneWhiteMat
  );
  backParapet.position.set(0, 22.9, -8.4);
  rectorateGroup.add(backParapet);

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
    trackGeo(new THREE.BoxGeometry(8.5, 9.2, 0.3)),
    bannerMat
  );
  bannerMesh.position.set(24.5, 16.2, 9.28);
  rectorateGroup.add(bannerMesh);

  // Entrance recessed glass portal + semicircular white canopy + steps
  const rectDoorGlass = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(6.8, 3.6, 0.4)),
    glassCyanMat
  );
  rectDoorGlass.position.set(27, 2.5, 9.15);
  rectorateGroup.add(rectDoorGlass);

  const canopyDeck = new THREE.Mesh(
    trackGeo(
      new THREE.CylinderGeometry(
        6.0,
        6.0,
        0.75,
        24,
        1,
        false,
        -Math.PI * 0.5,
        Math.PI
      )
    ),
    stoneWhiteMat
  );
  canopyDeck.rotation.y = Math.PI * 0.5;
  canopyDeck.position.set(27, 4.45, 9.2);
  canopyDeck.castShadow = true;
  rectorateGroup.add(canopyDeck);

  for (let col = -4.0; col <= 4.0; col += 4.0) {
    const pillar = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.32, 0.38, 4.2, 12)),
      stoneWhiteMat
    );
    pillar.position.set(27 + col, 2.2, 12.7);
    pillar.castShadow = true;
    rectorateGroup.add(pillar);
  }

  for (let s = 0; s < 5; s++) {
    const step = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(11.8, 0.24, 0.9 + s * 0.65)),
      concretePlinthMat
    );
    step.position.set(27, 0.12 + (4 - s) * 0.18, 12.5 + s * 0.65);
    rectorateGroup.add(step);
  }

  // Staircase side cheek walls
  for (const cw of [-6.0, 6.0]) {
    const cheek = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.45, 0.95, 4.2)),
      stoneWhiteMat
    );
    cheek.position.set(27 + cw, 0.48, 13.8);
    rectorateGroup.add(cheek);
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

  // Paved granite plaza linking Rectorate steps to Tashkent Ave
  const plazaSlab = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(56, 0.16, 30)),
    pavedWalkwayMat
  );
  plazaSlab.position.set(-10, 0.08, -10);
  gateGroup.add(plazaSlab);

  // Rectangular blue tiled pool / fountain in front of Rectorate
  const poolOuter = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(22.4, 0.78, 10.9)),
    stoneWhiteMat
  );
  poolOuter.position.set(-22, 0.39, -14);
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
  poolFloor.position.set(-22, 0.68, -14);
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
  waterMesh.position.set(-22, 0.75, -14);
  waterMesh.renderOrder = 2;
  gateGroup.add(waterMesh);

  for (const fx of [-27, -22, -17]) {
    const nozzle = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.25, 0.45, 0.95, 12)),
      stoneWhiteMat
    );
    nozzle.position.set(fx, 0.98, -14);
    gateGroup.add(nozzle);
  }

  // Monumental Triple-Arched Entrance Portal along Tashkent Avenue
  const gatePortalMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: createStuccoWallTexture(registry, maxAnisotropy, '#d9822b'),
      roughness: 0.64,
      metalness: 0.06,
    })
  );
  const gateFriezeMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: createGateOrnamentTexture(registry, maxAnisotropy),
      roughness: 0.5,
      metalness: 0.08,
    })
  );

  // True beveled ExtrudeGeometry arches spanning the 4 piers
  const centerArchGeo = trackGeo(createArchSpanGeometry(9.0, 4.2, 3.8, 0.2, 2.0));
  const centerArchMesh = new THREE.Mesh(centerArchGeo, gatePortalMat);
  centerArchMesh.position.set(0, 4.4, 5.5);
  centerArchMesh.castShadow = true;
  gateGroup.add(centerArchMesh);

  for (const sideX of [-8.35, 8.35]) {
    const sideArchGeo = trackGeo(createArchSpanGeometry(4.4, 3.6, 1.9, 0.2, 1.9));
    const sideArchMesh = new THREE.Mesh(sideArchGeo, gatePortalMat);
    sideArchMesh.position.set(sideX, 4.4, 5.5);
    sideArchMesh.castShadow = true;
    gateGroup.add(sideArchMesh);
  }

  // 4 monumental piers with stone plinth bases & capitals
  const pierXs = [-11.5, -5.2, 5.2, 11.5];
  for (const px of pierXs) {
    const pierPlinth = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(2.5, 1.1, 2.8)),
      concretePlinthMat
    );
    pierPlinth.position.set(px, 0.55, 5.5);
    gateGroup.add(pierPlinth);

    const pier = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(2.1, 8.2, 2.4)),
      gatePortalMat
    );
    pier.position.set(px, 4.1, 5.5);
    pier.castShadow = true;
    gateGroup.add(pier);

    const cap = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(2.65, 0.55, 2.95)),
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
    trackGeo(new THREE.BoxGeometry(26.2, 2.6, 2.5)),
    [
      gatePortalMat,
      gatePortalMat,
      stoneWhiteMat,
      gatePortalMat,
      gateFriezeMat,
      gateFriezeMat,
    ]
  );
  friezeBeam.position.set(0, 8.9, 5.5);
  friezeBeam.castShadow = true;
  gateGroup.add(friezeBeam);

  const centerCrown = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(10.6, 1.4, 2.2)),
    stoneWhiteMat
  );
  centerCrown.position.set(0, 10.75, 5.5);
  gateGroup.add(centerCrown);

  // Wrought-iron entrance gates in flanking portals
  for (let gx = -9.6; gx <= 9.6; gx += 0.85) {
    if (Math.abs(gx) < 3.9) continue; // Center carriageway open
    const bar = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.05, 0.05, 4.1, 6)),
      darkIronMat
    );
    bar.position.set(gx, 2.05, 5.5);
    gateGroup.add(bar);
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
    trackGeo(new THREE.PlaneGeometry(11.5, 5.2)),
    crosswalkMat
  );
  crosswalk.rotation.x = -Math.PI * 0.5;
  crosswalk.position.set(0, 0.16, 11.4);
  gateGroup.add(crosswalk);

  registerClickable(gateGroup, 'main_gate', clickableMeshes);
  campusRoot.add(gateGroup);
  buildingGroups.main_gate = gateGroup;

  // =========================================================================
  // 3. CENTRAL TSULBP STADIUM (Стадион ТГУ)
  // =========================================================================
  const stadiumGroup = new THREE.Group();
  stadiumGroup.position.set(-8, 0, 4);
  stadiumGroup.rotation.y = CAMPUS_TILT_RAD;

  // Raised stadium terrace platform (62w x 84d)
  const stadiumDeck = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(62, 1.1, 84)),
    concretePlinthMat
  );
  stadiumDeck.position.set(0, 0.55, 0);
  stadiumDeck.castShadow = true;
  stadiumGroup.add(stadiumDeck);

  // Terracotta oval running track via ExtrudeGeometry with rounded ends
  const trackShape = new THREE.Shape();
  const tw = 24.5;
  const th = 22.0;
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
  trackGeo2.rotateY(Math.PI * 0.5);
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
    trackGeo(new THREE.PlaneGeometry(34, 54)),
    pitchMat
  );
  pitchMesh.rotation.x = -Math.PI * 0.5;
  pitchMesh.position.set(0, 1.34, 0);
  stadiumGroup.add(pitchMesh);

  // Football goal posts at north and south ends
  for (const gz of [-24.5, 24.5]) {
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

  // Stadium perimeter curb walls + west spectator bleacher tiers (on deck, clear of track)
  for (const sx of [-30.6, 30.6]) {
    const curb = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.8, 1.5, 84)),
      stoneWhiteMat
    );
    curb.position.set(sx, 0.75, 0);
    stadiumGroup.add(curb);
  }
  for (let tier = 0; tier < 3; tier++) {
    const bleacher = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(1.4, 0.45 + tier * 0.42, 42)),
      concretePlinthMat
    );
    bleacher.position.set(-28.4 + tier * 1.45, 1.2 + tier * 0.21, 0);
    stadiumGroup.add(bleacher);
  }

  registerClickable(stadiumGroup, 'stadium', clickableMeshes);
  campusRoot.add(stadiumGroup);
  buildingGroups.stadium = stadiumGroup;

  // =========================================================================
  // 4. LANDSCAPED GREEN SQUARE & SECONDARY ARCH (green_square)
  // =========================================================================
  const squareGroup = new THREE.Group();
  squareGroup.position.set(2, 0, 72);
  squareGroup.rotation.y = CAMPUS_TILT_RAD;

  // Paved granite-tile promenade floor (66w x 34d -> north edge at z=55, clear of stadium south edge z=46)
  const squareBase = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(66, 0.24, 34)),
    pavedWalkwayMat
  );
  squareBase.position.set(0, 0.12, 0);
  squareGroup.add(squareBase);

  // Walkway bridge & steps connecting Square north arch cleanly up to Stadium south terrace
  const stadiumBridge = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(12, 0.3, 10)),
    pavedWalkwayMat
  );
  stadiumBridge.position.set(-4, 0.15, -21);
  squareGroup.add(stadiumBridge);

  for (let s = 0; s < 4; s++) {
    const step = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(12, 0.24, 1.1)),
      concretePlinthMat
    );
    step.position.set(-4, 0.24 + s * 0.21, -24.2 - s * 0.75);
    squareGroup.add(step);
  }

  // Four symmetrical landscaped lawn quadrants
  for (const qx of [-18, 18]) {
    for (const qz of [-7.5, 6.5]) {
      const bedRim = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(22, 0.44, 10)),
        concretePlinthMat
      );
      bedRim.position.set(qx, 0.22, qz);
      squareGroup.add(bedRim);

      const turf = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(21, 0.5, 9)),
        turfGreenMat
      );
      turf.position.set(qx, 0.25, qz);
      squareGroup.add(turf);
    }
  }

  // Secondary entrance arch at north edge of Square (completely clear of stadium deck)
  for (const ax of [-4.2, 4.2]) {
    const col = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.55, 0.65, 5.2, 14)),
      gatePortalMat
    );
    col.position.set(ax, 2.6, -15.5);
    col.castShadow = true;
    squareGroup.add(col);
  }
  const archSpan = new THREE.Mesh(
    trackGeo(createArchSpanGeometry(10.8, 2.2, 3.6, 0.1, 2.1)),
    gatePortalMat
  );
  archSpan.position.set(0, 4.4, -15.5);
  archSpan.castShadow = true;
  squareGroup.add(archSpan);

  const archRoofCap = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(11.4, 0.35, 2.5)),
    stoneWhiteMat
  );
  archRoofCap.position.set(0, 6.78, -15.5);
  squareGroup.add(archRoofCap);

  // Southern steps down to Tashkent Ave sidewalk
  for (let s = 0; s < 4; s++) {
    const step = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(11.5, 0.22, 0.8 + s * 0.5)),
      concretePlinthMat
    );
    step.position.set(0, 0.1 + (3 - s) * 0.14, 16.5 + s * 0.5);
    squareGroup.add(step);
  }

  registerClickable(squareGroup, 'green_square', clickableMeshes);
  campusRoot.add(squareGroup);
  buildingGroups.green_square = squareGroup;

  // =========================================================================
  // 5. LIBRARY (Библиотека / Китобхона - formerly B3)
  // =========================================================================
  const libraryGroup = new THREE.Group();
  libraryGroup.position.set(48, 0, 10);
  libraryGroup.rotation.y = CAMPUS_TILT_RAD;

  const libTex = createFacadeTextures(registry, maxAnisotropy, {
    wallHex: '#e4bd6b',
    corniceHex: '#f8fafc',
    plinthHex: '#8d2d26',
    windowHex: '#255585',
    stories: 2,
    bays: 8,
    pilasters: true,
    seed: 204,
  });
  const libMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: libTex.map,
      emissiveMap: libTex.emissiveMap,
      emissive: new THREE.Color(0xffd27a),
      emissiveIntensity: 0,
      roughness: 0.72,
      metalness: 0.04,
    })
  );
  nightEmissiveMaterials.push(libMat);

  // Red terracotta plinth
  const libPlinth = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(13.8, 0.9, 33.0)),
    redPlinthMat
  );
  libPlinth.position.set(0, 0.45, -1.5);
  libraryGroup.add(libPlinth);

  const libBody = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(12.8, 8.2, 32)),
    [libMat, libMat, concretePlinthMat, redPlinthMat, libMat, libMat]
  );
  libBody.position.set(0, 4.9, -1.5);
  libBody.castShadow = true;
  libraryGroup.add(libBody);

  // Inter-floor & roof white cornices + vertical pilasters
  for (const cy of [4.8, 9.0]) {
    const ledge = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(13.4, 0.34, 32.6)),
      stoneWhiteMat
    );
    ledge.position.set(0, cy, -1.5);
    libraryGroup.add(ledge);
  }
  for (let pz = -15; pz <= 11; pz += 6.5) {
    for (const px of [-6.55, 6.55]) {
      const pil = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.42, 8.2, 0.65)),
        stoneWhiteMat
      );
      pil.position.set(px, 4.9, pz);
      libraryGroup.add(pil);
    }
  }

  // Signature semicircular southern reading rotunda with reflective glass & columns
  const southBay = new THREE.Mesh(
    trackGeo(
      new THREE.CylinderGeometry(
        6.4,
        6.4,
        8.2,
        24,
        1,
        false,
        -Math.PI * 0.5,
        Math.PI
      )
    ),
    glassCyanMat
  );
  southBay.position.set(0, 4.7, 14.5);
  southBay.castShadow = true;
  libraryGroup.add(southBay);

  for (let i = 0; i <= 4; i++) {
    const ang = (i / 4) * Math.PI - Math.PI * 0.5;
    const cx = Math.sin(ang) * 6.65;
    const cz = 14.5 + Math.cos(ang) * 6.65;
    const col = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.28, 0.32, 8.4, 10)),
      stoneWhiteMat
    );
    col.position.set(cx, 4.7, cz);
    libraryGroup.add(col);
  }

  const bayCornice = new THREE.Mesh(
    trackGeo(
      new THREE.CylinderGeometry(
        6.9,
        6.9,
        0.48,
        24,
        1,
        false,
        -Math.PI * 0.5,
        Math.PI
      )
    ),
    stoneWhiteMat
  );
  bayCornice.position.set(0, 9.0, 14.5);
  libraryGroup.add(bayCornice);

  // Pitched textured terracotta roof + semicircular cone cap
  const libRoof = new THREE.Mesh(
    trackGeo(createPitchedRoofGeometry(32.8, 13.6, 3.6)),
    redRoofMat
  );
  libRoof.rotation.y = Math.PI * 0.5;
  libRoof.position.set(0, 9.15, -1.5);
  libRoof.castShadow = true;
  libraryGroup.add(libRoof);

  const bayConeRoof = new THREE.Mesh(
    trackGeo(
      new THREE.ConeGeometry(
        6.8,
        3.6,
        24,
        1,
        false,
        -Math.PI * 0.5,
        Math.PI
      )
    ),
    redRoofMat
  );
  bayConeRoof.position.set(0, 10.95, 14.5);
  bayConeRoof.castShadow = true;
  libraryGroup.add(bayConeRoof);

  registerClickable(libraryGroup, 'east_rotunda_hall', clickableMeshes);
  campusRoot.add(libraryGroup);
  buildingGroups.east_rotunda_hall = libraryGroup;

  // =========================================================================
  // 6. TECHNOPARK (Технопарк ДДҲБСТ / Парки технологии - formerly B4)
  // =========================================================================
  const technoparkGroup = new THREE.Group();
  technoparkGroup.position.set(46, 0, 48);
  technoparkGroup.rotation.y = CAMPUS_TILT_RAD;

  const techTex = createFacadeTextures(registry, maxAnisotropy, {
    wallHex: '#e4bd6b',
    corniceHex: '#f8fafc',
    plinthHex: '#8d2d26',
    windowHex: '#255585',
    stories: 2,
    bays: 6,
    pilasters: true,
    seed: 212,
  });
  const techMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: techTex.map,
      emissiveMap: techTex.emissiveMap,
      emissive: new THREE.Color(0xffd27a),
      emissiveIntensity: 0,
      roughness: 0.72,
      metalness: 0.04,
    })
  );
  nightEmissiveMaterials.push(techMat);

  const techPlinth = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(22.8, 0.85, 11.2)),
    redPlinthMat
  );
  techPlinth.position.set(0, 0.42, 0);
  technoparkGroup.add(techPlinth);

  const techBody = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(21.6, 7.2, 10.2)),
    [techMat, techMat, concretePlinthMat, redPlinthMat, techMat, techMat]
  );
  techBody.position.set(0, 4.4, 0);
  techBody.castShadow = true;
  technoparkGroup.add(techBody);

  for (const cy of [4.3, 8.0]) {
    const ledge = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(22.2, 0.32, 10.8)),
      stoneWhiteMat
    );
    ledge.position.set(0, cy, 0);
    technoparkGroup.add(ledge);
  }
  for (let px = -9; px <= 9; px += 4.5) {
    const pil = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.55, 7.2, 0.4)),
      stoneWhiteMat
    );
    pil.position.set(px, 4.4, 5.2);
    technoparkGroup.add(pil);
  }

  // Front glass vestibule & columned entrance portico
  const techGlassVestibule = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(5.6, 5.4, 1.1)),
    glassCyanMat
  );
  techGlassVestibule.position.set(0, 3.6, 5.3);
  technoparkGroup.add(techGlassVestibule);

  const techCanopy = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(6.8, 0.38, 2.2)),
    stoneWhiteMat
  );
  techCanopy.position.set(0, 6.4, 5.8);
  technoparkGroup.add(techCanopy);

  for (const cx of [-2.8, 2.8]) {
    const pCol = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.24, 0.28, 5.8, 10)),
      stoneWhiteMat
    );
    pCol.position.set(cx, 3.3, 6.6);
    technoparkGroup.add(pCol);
  }

  const techRoof = new THREE.Mesh(
    trackGeo(createPitchedRoofGeometry(22.6, 11.2, 3.1)),
    redRoofMat
  );
  techRoof.position.set(0, 8.15, 0);
  techRoof.castShadow = true;
  technoparkGroup.add(techRoof);

  registerClickable(technoparkGroup, 'south_stadium_pavilion', clickableMeshes);
  campusRoot.add(technoparkGroup);
  buildingGroups.south_stadium_pavilion = technoparkGroup;

  // =========================================================================
  // REUSABLE ARCHITECTURAL TWIN BUILDER (Building 5 K5 & Sports Hall Twin)
  // =========================================================================
  const buildPalaceTwin = (opts: {
    group: THREE.Group;
    width: number;
    depth: number;
    wallHeight: number;
    rotundaRadius: number;
    seed: number;
  }) => {
    const { group, width, depth, wallHeight, rotundaRadius, seed } = opts;

    const palTex = createFacadeTextures(registry, maxAnisotropy, {
      wallHex: '#edd07b',
      corniceHex: '#ffffff',
      plinthHex: '#9e2a22',
      windowHex: '#3c7db6',
      stories: 3,
      bays: Math.max(8, Math.round(width / 4.6)),
      pilasters: true,
      seed,
    });
    const palMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: palTex.map,
        emissiveMap: palTex.emissiveMap,
        emissive: new THREE.Color(0xffe08a),
        emissiveIntensity: 0,
        roughness: 0.68,
        metalness: 0.05,
      })
    );
    nightEmissiveMaterials.push(palMat);

    const plinthH = 1.35;

    // Red terracotta plinth
    const plinth = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(width + 2.0, plinthH, depth + 1.5)),
      redPlinthMat
    );
    plinth.position.set(0, plinthH * 0.5, 0);
    group.add(plinth);

    // Main 3-story yellow academic palace body
    const mainBody = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(width, wallHeight, depth)),
      [palMat, palMat, concretePlinthMat, redPlinthMat, palMat, palMat]
    );
    mainBody.position.set(0, plinthH + wallHeight * 0.5, 0);
    mainBody.castShadow = true;
    group.add(mainBody);

    // Horizontal white inter-floor & roof eaves cornices
    const roofBaseY = plinthH + wallHeight;
    for (const frac of [0.34, 0.67, 1.0]) {
      const ledge = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(width + 0.8, 0.36, depth + 0.7)),
        stoneWhiteMat
      );
      ledge.position.set(0, plinthH + wallHeight * frac, 0);
      group.add(ledge);
    }

    // Physical 3D white vertical pilasters along front & rear facades
    const pilasterStep = width / 6;
    for (let px = -width * 0.44; px <= width * 0.44 + 0.1; px += pilasterStep) {
      for (const pz of [depth * 0.5 + 0.18, -depth * 0.5 - 0.18]) {
        const pil = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(0.68, wallHeight, 0.42)),
          stoneWhiteMat
        );
        pil.position.set(px, plinthH + wallHeight * 0.5, pz);
        group.add(pil);
      }
    }

    // Textured red pitched hipped roof
    const roofH = Math.max(3.4, depth * 0.24);
    const roof = new THREE.Mesh(
      trackGeo(createPitchedRoofGeometry(width + 1.5, depth + 1.3, roofH)),
      redRoofMat
    );
    roof.position.set(0, roofBaseY + 0.15, 0);
    roof.castShadow = true;
    group.add(roof);

    // Twin front pediment / dormer bays with recessed 3D glass & white mullions
    const dormerOffset = width * 0.24;
    const dormerW = width * 0.22;
    const dormerH = wallHeight + 1.5;
    for (const dx of [-dormerOffset, dormerOffset]) {
      const dormer = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(dormerW, dormerH, 3.4)),
        palMat
      );
      dormer.position.set(dx, plinthH + dormerH * 0.5, depth * 0.5 + 0.7);
      dormer.castShadow = true;
      group.add(dormer);

      const dormerCap = new THREE.Mesh(
        trackGeo(createPitchedRoofGeometry(dormerW + 0.7, 4.0, 2.1)),
        redRoofMat
      );
      dormerCap.position.set(dx, plinthH + dormerH, depth * 0.5 + 0.7);
      group.add(dormerCap);

      const glassW = dormerW * 0.64;
      const glassH = wallHeight * 0.76;
      const stainedGlass = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(glassW, glassH, 0.32)),
        glassCyanMat
      );
      stainedGlass.position.set(
        dx,
        plinthH + wallHeight * 0.54,
        depth * 0.5 + 2.42
      );
      group.add(stainedGlass);

      // 3D white mullions on dormer glass
      const vMullion = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.18, glassH, 0.42)),
        stoneWhiteMat
      );
      vMullion.position.copy(stainedGlass.position);
      group.add(vMullion);
    }

    // Central entrance portico, stairs & stained-glass atrium
    const centralW = Math.max(5.6, width * 0.15);
    const centralGlass = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(centralW, wallHeight * 0.82, 1.4)),
      glassCyanMat
    );
    centralGlass.position.set(0, plinthH + wallHeight * 0.46, depth * 0.5 + 0.1);
    group.add(centralGlass);

    for (let s = 0; s < 3; s++) {
      const step = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(centralW + 1.4, 0.38, 0.9 + s * 0.55)),
        concretePlinthMat
      );
      step.position.set(0, 0.2 + (2 - s) * 0.36, depth * 0.5 + 1.1 + s * 0.55);
      group.add(step);
    }

    // Signature semicircular glass entrance rotunda with white columns on EAST (+X) end
    const rotundaX = width * 0.5;
    const rotundaGlass = new THREE.Mesh(
      trackGeo(
        new THREE.CylinderGeometry(
          rotundaRadius,
          rotundaRadius,
          wallHeight - 0.6,
          28,
          1,
          false,
          0,
          Math.PI
        )
      ),
      glassCyanMat
    );
    rotundaGlass.position.set(rotundaX, plinthH + (wallHeight - 0.6) * 0.5, 0);
    group.add(rotundaGlass);

    const rotundaPlinth = new THREE.Mesh(
      trackGeo(
        new THREE.CylinderGeometry(
          rotundaRadius + 0.9,
          rotundaRadius + 0.9,
          plinthH,
          28,
          1,
          false,
          0,
          Math.PI
        )
      ),
      redPlinthMat
    );
    rotundaPlinth.position.set(rotundaX, plinthH * 0.5, 0);
    group.add(rotundaPlinth);

    for (let i = 0; i <= 6; i++) {
      const ang = (i / 6) * Math.PI - Math.PI * 0.5;
      const cx = rotundaX + Math.cos(ang) * (rotundaRadius + 0.38);
      const cz = Math.sin(ang) * (rotundaRadius + 0.38);
      const column = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.3, 0.36, wallHeight, 12)),
        stoneWhiteMat
      );
      column.position.set(cx, plinthH + wallHeight * 0.5, cz);
      column.castShadow = true;
      group.add(column);
    }

    const rotundaCornice = new THREE.Mesh(
      trackGeo(
        new THREE.CylinderGeometry(
          rotundaRadius + 0.85,
          rotundaRadius + 0.85,
          0.65,
          28,
          1,
          false,
          0,
          Math.PI
        )
      ),
      stoneWhiteMat
    );
    rotundaCornice.position.set(rotundaX, roofBaseY - 0.1, 0);
    group.add(rotundaCornice);

    const rotundaRoof = new THREE.Mesh(
      trackGeo(
        new THREE.ConeGeometry(
          rotundaRadius + 0.95,
          3.4,
          28,
          1,
          false,
          0,
          Math.PI
        )
      ),
      redRoofMat
    );
    rotundaRoof.position.set(rotundaX, roofBaseY + 1.85, 0);
    rotundaRoof.castShadow = true;
    group.add(rotundaRoof);

    return palMat;
  };

  // =========================================================================
  // 7. SPORTS HALL (Спортивный зал / Толори варзишӣ) — Architectural Twin of K5
  // =========================================================================
  const sportsHallGroup = new THREE.Group();
  sportsHallGroup.position.set(-80, 0, 32);
  sportsHallGroup.rotation.y = CAMPUS_TILT_RAD;

  buildPalaceTwin({
    group: sportsHallGroup,
    width: 36,
    depth: 15,
    wallHeight: 11.0,
    rotundaRadius: 6.1,
    seed: 511,
  });

  registerClickable(sportsHallGroup, 'sports_hall', clickableMeshes);
  campusRoot.add(sportsHallGroup);
  buildingGroups.sports_hall = sportsHallGroup;

  // Unlabeled background utility sheds flanking west edge of stadium (cleanly separated)
  const bgUtilGroup = new THREE.Group();
  bgUtilGroup.position.set(-48, 0, 21);
  bgUtilGroup.rotation.y = CAMPUS_TILT_RAD;

  for (const [bx, bz, bw, bd] of [
    [-2.5, 0, 7.2, 12.5],
    [6.2, 0.5, 7.0, 15.0],
  ]) {
    const body = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(bw, 5.2, bd)),
      ochreStuccoMat
    );
    body.position.set(bx, 2.6, bz);
    body.castShadow = true;
    body.receiveShadow = true;
    bgUtilGroup.add(body);

    const roof = new THREE.Mesh(
      trackGeo(createPitchedRoofGeometry(bd + 0.7, bw + 0.7, 2.3)),
      redRoofMat
    );
    roof.rotation.y = Math.PI * 0.5;
    roof.position.set(bx, 5.2, bz);
    roof.castShadow = true;
    bgUtilGroup.add(roof);
  }
  campusRoot.add(bgUtilGroup);

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
    windowHex: '#255585',
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

  const nePlinth = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(75.5, 0.85, 18.4)),
    concretePlinthMat
  );
  nePlinth.position.set(0, 0.42, 0);
  neHallGroup.add(nePlinth);

  const neMainBody = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(74, 18.5, 17)),
    [neMat, neMat, rectRoofSlabMat, concretePlinthMat, neMat, neMat]
  );
  neMainBody.position.set(0, 9.65, 0);
  neMainBody.castShadow = true;
  neHallGroup.add(neMainBody);

  // Horizontal cornices + vertical pilasters + roof parapet
  for (let i = 1; i <= 5; i++) {
    const ledge = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(74.6, 0.34, 17.6)),
      stoneWhiteMat
    );
    ledge.position.set(0, 0.85 + i * 3.65, 0);
    neHallGroup.add(ledge);
  }
  for (let px = -32; px <= 32; px += 10.5) {
    const pil = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.75, 18.5, 0.45)),
      stoneWhiteMat
    );
    pil.position.set(px, 9.65, 8.65);
    neHallGroup.add(pil);
  }

  // Right-hand projecting front wing
  const neFrontWing = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(15, 14.5, 12)),
    [neMat, neMat, rectRoofSlabMat, concretePlinthMat, neMat, neMat]
  );
  neFrontWing.position.set(27.5, 7.65, 13.5);
  neFrontWing.castShadow = true;
  neHallGroup.add(neFrontWing);

  const wingCanopy = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(7.2, 0.4, 2.4)),
    stoneWhiteMat
  );
  wingCanopy.position.set(27.5, 4.2, 20.5);
  neHallGroup.add(wingCanopy);

  // Semicircular eastern entrance pavilion with glass & cornice
  const neEastRotunda = new THREE.Mesh(
    trackGeo(
      new THREE.CylinderGeometry(6.8, 6.8, 12.5, 24, 1, false, 0, Math.PI)
    ),
    neMat
  );
  neEastRotunda.position.set(37, 6.65, 0);
  neEastRotunda.castShadow = true;
  neHallGroup.add(neEastRotunda);

  const neRotundaCornice = new THREE.Mesh(
    trackGeo(
      new THREE.CylinderGeometry(7.2, 7.2, 0.55, 24, 1, false, 0, Math.PI)
    ),
    stoneWhiteMat
  );
  neRotundaCornice.position.set(37, 13.0, 0);
  neHallGroup.add(neRotundaCornice);

  // West step-down entrance annex
  const neWestAnnex = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(8, 7.5, 9)),
    concretePlinthMat
  );
  neWestAnnex.position.set(-40, 3.75, 2);
  neHallGroup.add(neWestAnnex);

  // Courtyard lawn bed in front of NE hall (kept strictly clear of wing x>=20)
  const neBedRim = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(47, 0.34, 15.5)),
    concretePlinthMat
  );
  neBedRim.position.set(-8.5, 0.17, 19);
  neHallGroup.add(neBedRim);

  const neCourtyardBed = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(46, 0.38, 14.5)),
    turfGreenMat
  );
  neCourtyardBed.position.set(-8.5, 0.2, 19);
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

  const b5Mat = buildPalaceTwin({
    group: b5Group,
    width: 48,
    depth: 18,
    wallHeight: 12.5,
    rotundaRadius: 7.4,
    seed: 505,
  });

  // Adjacent two-story orange-ochre building to the left (west) + skybridge connector
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
    trackGeo(createPitchedRoofGeometry(18.8, 22.8, 3.8)),
    redRoofMat
  );
  westAnnexGable.position.set(-41, 9.5, 0);
  westAnnexGable.castShadow = true;
  b5Group.add(westAnnexGable);

  registerClickable(b5Group, 'building_5_new', clickableMeshes);
  campusRoot.add(b5Group);
  buildingGroups.building_5_new = b5Group;

  // =========================================================================
  // 10. UNLABELED BACKGROUND STRUCTURE (formerly Павильон — NO label/marker/inspector)
  // =========================================================================
  const bgPavGroup = new THREE.Group();
  bgPavGroup.position.set(-32, 0, -56);
  bgPavGroup.rotation.y = CAMPUS_TILT_RAD;

  const terraWallMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: createStuccoWallTexture(registry, maxAnisotropy, '#9c6644'),
      roughness: 0.78,
      metalness: 0.05,
    })
  );

  const pavMain = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(34, 6.0, 10)),
    terraWallMat
  );
  pavMain.position.set(0, 3.0, 2);
  pavMain.castShadow = true;
  pavMain.receiveShadow = true;
  bgPavGroup.add(pavMain);

  const pavWing = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(10, 6.0, 13)),
    terraWallMat
  );
  pavWing.position.set(12, 3.0, -8.5);
  pavWing.castShadow = true;
  pavWing.receiveShadow = true;
  bgPavGroup.add(pavWing);

  const pavCornice = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(34.6, 0.35, 10.6)),
    stoneWhiteMat
  );
  pavCornice.position.set(0, 6.1, 2);
  bgPavGroup.add(pavCornice);

  for (let gx = -12.5; gx <= 12.5; gx += 6.25) {
    const windowBay = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(4.8, 3.6, 0.35)),
      glassCyanMat
    );
    windowBay.position.set(gx, 2.8, 7.1);
    bgPavGroup.add(windowBay);
  }

  for (const bx of [-12, 8]) {
    const bed = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(16, 0.3, 6.2)),
      turfGreenMat
    );
    bed.position.set(bx, 0.15, 13.5);
    bgPavGroup.add(bed);
  }
  campusRoot.add(bgPavGroup);

  // =========================================================================
  // 11. SOUTHEAST ROUNDABOUT & MONUMENTAL STELE (Adjacent to Campus SE Corner)
  // =========================================================================
  const steleCenter: [number, number] = [134, 76];
  const roundaboutGroup = new THREE.Group();
  roundaboutGroup.position.set(steleCenter[0], 0, steleCenter[1]);

  // Circular asphalt traffic ring (outer 23.5m, inner 12.5m)
  const roadRingGeo = trackGeo(new THREE.RingGeometry(12.2, 23.8, 48));
  roadRingGeo.rotateX(-Math.PI * 0.5);
  const roadRingMesh = new THREE.Mesh(roadRingGeo, asphaltMat);
  roadRingMesh.position.y = 0.08;
  roadRingMesh.receiveShadow = true;
  roundaboutGroup.add(roadRingMesh);

  // Dashed lane circle on roundabout asphalt
  const laneRingGeo = trackGeo(new THREE.RingGeometry(17.8, 18.25, 48));
  laneRingGeo.rotateX(-Math.PI * 0.5);
  const laneRingMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.72,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    })
  );
  const laneRing = new THREE.Mesh(laneRingGeo, laneRingMat);
  laneRing.position.y = 0.1;
  roundaboutGroup.add(laneRing);

  // Raised white granite island curb & landscaped central turf
  const islandCurb = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(12.4, 12.6, 0.45, 40)),
    stoneWhiteMat
  );
  islandCurb.position.y = 0.22;
  islandCurb.receiveShadow = true;
  roundaboutGroup.add(islandCurb);

  const islandTurf = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(11.6, 11.6, 0.48, 40)),
    turfGreenMat
  );
  islandTurf.position.y = 0.24;
  islandTurf.receiveShadow = true;
  roundaboutGroup.add(islandTurf);

  // 3-tier octagonal marble podium
  for (let tier = 0; tier < 3; tier++) {
    const r = 6.2 - tier * 1.4;
    const h = 0.75;
    const step = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(r, r + 0.25, h, 8)),
      concretePlinthMat
    );
    step.position.y = 0.48 + tier * 0.72 + h * 0.5;
    step.castShadow = true;
    step.receiveShadow = true;
    roundaboutGroup.add(step);
  }

  // Monumental white & gold fluted Tajik Stele obelisk (~20m tall)
  const steleShaft = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.95, 1.85, 15.5, 6)),
    stoneWhiteMat
  );
  steleShaft.position.y = 10.4;
  steleShaft.castShadow = true;
  roundaboutGroup.add(steleShaft);

  // Architectural collar rings + gold emblem crown summit
  for (const ry of [5.5, 12.2, 17.8]) {
    const collar = new THREE.Mesh(
      trackGeo(
        new THREE.CylinderGeometry(
          ry > 15 ? 1.25 : 1.7,
          ry > 15 ? 1.25 : 1.7,
          0.42,
          12
        )
      ),
      goldAccentMat
    );
    collar.position.y = ry;
    roundaboutGroup.add(collar);
  }

  const steleCrown = new THREE.Mesh(
    trackGeo(new THREE.OctahedronGeometry(1.45, 0)),
    goldAccentMat
  );
  steleCrown.position.y = 19.6;
  steleCrown.castShadow = true;
  roundaboutGroup.add(steleCrown);

  campusRoot.add(roundaboutGroup);

  // =========================================================================
  // 12. SNAPPED CAMPUS PERIMETER FENCE (Cleanly Following Campus Boundary)
  // =========================================================================
  const fenceGroup = new THREE.Group();
  fenceGroup.name = 'campus-perimeter-fence';

  const addFenceSegment = (
    x1: number,
    z1: number,
    x2: number,
    z2: number,
    pierSpacing = 6.0
  ) => {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    if (len < 1) return;
    const angle = -Math.atan2(dz, dx);
    const cx = (x1 + x2) * 0.5;
    const cz = (z1 + z2) * 0.5;

    // Low masonry wall plinth
    const plinth = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(len, 0.72, 0.42)),
      gatePortalMat
    );
    plinth.position.set(cx, 0.36, cz);
    plinth.rotation.y = angle;
    plinth.castShadow = true;
    fenceGroup.add(plinth);

    // Wrought-iron top & mid rails
    for (const ry of [1.2, 2.35]) {
      const rail = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(len, 0.1, 0.1)),
        darkIronMat
      );
      rail.position.set(cx, ry, cz);
      rail.rotation.y = angle;
      fenceGroup.add(rail);
    }

    // Masonry fence piers spaced evenly along segment
    const count = Math.max(1, Math.round(len / pierSpacing));
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      const px = x1 + dx * t;
      const pz = z1 + dz * t;
      const pier = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.54, 2.75, 0.54)),
        gatePortalMat
      );
      pier.position.set(px, 1.38, pz);
      pier.castShadow = true;
      fenceGroup.add(pier);

      const cap = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.68, 0.2, 0.68)),
        stoneWhiteMat
      );
      cap.position.set(px, 2.82, pz);
      fenceGroup.add(cap);
    }
  };

  // South frontage along Tashkent Ave (leaving clean openings at Main Gate & Square steps)
  const [swX, swZ] = [-122, 110.5];
  const [gateWestX, gateWestZ] = campusLocalToWorld(-60, 96, -12.6, 5.5);
  const [gateEastX, gateEastZ] = campusLocalToWorld(-60, 96, 12.6, 5.5);
  const [sqWestX, sqWestZ] = campusLocalToWorld(2, 72, -7.2, 18.2);
  const [sqEastX, sqEastZ] = campusLocalToWorld(2, 72, 7.2, 18.2);
  const [seX, seZ] = [74, 81];

  addFenceSegment(swX, swZ, gateWestX, gateWestZ);
  addFenceSegment(gateEastX, gateEastZ, sqWestX, sqWestZ);
  addFenceSegment(sqEastX, sqEastZ, seX, seZ);

  // East, North & West campus perimeter boundary
  addFenceSegment(seX, seZ, 82, 24);
  addFenceSegment(82, 24, 106, -42);
  addFenceSegment(106, -42, 108, -106);
  addFenceSegment(108, -106, -62, -124);
  addFenceSegment(-62, -124, -68, -32);
  addFenceSegment(-68, -32, -120, -18);
  addFenceSegment(-120, -18, swX, swZ);

  campusRoot.add(fenceGroup);

  // =========================================================================
  // 13. MOGOLTAU MOUNTAIN RIDGE SILHOUETTE (Northern Background)
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
  // 14. AUDITED INSTANCED PROPS (Trees, Lamps, Benches, Flowerbeds, Cars)
  //     Every prop sits flush at its surface elevation with zero road/pitch overlap
  // =========================================================================
  interface GroundedProp {
    x: number;
    y: number;
    z: number;
    scale: number;
    rot?: number;
  }

  const treeList: GroundedProp[] = [];
  const pushLocalTree = (
    originX: number,
    originZ: number,
    lx: number,
    lz: number,
    yBase: number,
    scale = 1
  ) => {
    const [wx, wz] = campusLocalToWorld(originX, originZ, lx, lz);
    treeList.push({ x: wx, y: yBase, z: wz, scale });
  };

  // A. University Square 4 lawn quadrants (flush on turf top y=0.50)
  for (const qx of [-24, -18, -12, 12, 18, 24]) {
    for (const qz of [-10, -5, 4, 9]) {
      pushLocalTree(2, 72, qx, qz, 0.48, 0.85 + ((Math.abs(qx + qz) % 4) * 0.06));
    }
  }
  // B. NE Courtyard lawn bed in front of 5-story hall (flush on turf y=0.38)
  for (let tx = -28; tx <= 12; tx += 5.7) {
    for (let tz = 14.5; tz <= 24; tz += 4.75) {
      pushLocalTree(54, -46, tx, tz, 0.36, 0.9 + ((Math.abs(Math.round(tx)) % 3) * 0.08));
    }
  }
  // C. Neat cypress rows along Library west garden (strictly clear of stadium curb & library wall)
  for (let tz = -14; tz <= 16; tz += 5.0) {
    pushLocalTree(48, 10, -11.5, tz, 0, 1.04);
    pushLocalTree(48, 10, -16.0, tz + 2.0, 0, 0.94);
  }
  // D. Unlabeled pavilion twin front lawn beds (flush on turf y=0.30)
  for (const tx of [-17, -12, -7, 3, 8, 13]) {
    pushLocalTree(-32, -56, tx, 13.5, 0.28, 0.88);
  }
  // E. Tashkent Avenue north sidewalk boulevard (strictly north of asphalt road & south of fence,
  //    skipping Main Gate & Square entrances & Roundabout throat)
  const tashkentNorthVergeZ = (wx: number): number => {
    // Matches Tashkent Ave centerline minus 10.6m north to sidewalk verge
    if (wx < -140) return 134 - ((wx + 260) / 120) * 16 - 10.6;
    if (wx < -30) return 118 - ((wx + 140) / 110) * 14 - 10.6;
    return 104 - ((wx + 30) / 105) * 14 - 10.6;
  };
  for (let tx = -126; tx <= 96; tx += 15) {
    // Skip Main Gate opening [-75..-45] and Square Steps opening [-12..14]
    if ((tx > -76 && tx < -44) || (tx > -13 && tx < 15)) continue;
    treeList.push({
      x: tx,
      y: 0,
      z: tashkentNorthVergeZ(tx) + 1.5,
      scale: 0.96,
    });
  }

  // Build 2-tier instanced trees (trunk + lower wide cone + upper tapered spire)
  const treeCount = treeList.length;
  const trunkGeo = trackGeo(new THREE.CylinderGeometry(0.16, 0.26, 2.2, 6));
  const trunkMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.92 })
  );
  const crownGeoLower = trackGeo(new THREE.ConeGeometry(1.75, 4.2, 7));
  const crownGeoUpper = trackGeo(new THREE.ConeGeometry(1.25, 3.8, 7));
  const crownMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.86,
      metalness: 0.02,
    })
  );

  const trunkInstances = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
  const crownLowerInstances = new THREE.InstancedMesh(
    crownGeoLower,
    crownMat,
    treeCount
  );
  const crownUpperInstances = new THREE.InstancedMesh(
    crownGeoUpper,
    crownMat,
    treeCount
  );
  trunkInstances.castShadow = !isSoftwareGl;
  crownLowerInstances.castShadow = !isSoftwareGl;
  crownUpperInstances.castShadow = !isSoftwareGl;
  crownLowerInstances.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const foliagePalette = [0x2d6a3e, 0x357a46, 0x245934, 0x3f854d];

  for (let i = 0; i < treeCount; i++) {
    const t = treeList[i];
    dummy.position.set(t.x, t.y + 1.1 * t.scale, t.z);
    dummy.scale.set(t.scale, t.scale, t.scale);
    dummy.rotation.set(0, (i * 1.17) % (Math.PI * 2), 0);
    dummy.updateMatrix();
    trunkInstances.setMatrixAt(i, dummy.matrix);

    dummy.position.set(t.x, t.y + 3.6 * t.scale, t.z);
    dummy.scale.set(t.scale, t.scale, t.scale);
    dummy.updateMatrix();
    crownLowerInstances.setMatrixAt(i, dummy.matrix);

    dummy.position.set(t.x, t.y + 5.7 * t.scale, t.z);
    dummy.scale.set(t.scale, t.scale * (0.95 + (i % 3) * 0.1), t.scale);
    dummy.updateMatrix();
    crownUpperInstances.setMatrixAt(i, dummy.matrix);

    color.setHex(foliagePalette[i % foliagePalette.length]);
    crownLowerInstances.setColorAt(i, color);
    crownUpperInstances.setColorAt(i, color.clone().offsetHSL(0, 0, 0.04));
  }
  trunkInstances.instanceMatrix.needsUpdate = true;
  crownLowerInstances.instanceMatrix.needsUpdate = true;
  crownUpperInstances.instanceMatrix.needsUpdate = true;
  if (crownLowerInstances.instanceColor) {
    crownLowerInstances.instanceColor.needsUpdate = true;
  }
  if (crownUpperInstances.instanceColor) {
    crownUpperInstances.instanceColor.needsUpdate = true;
  }
  trunkInstances.computeBoundingSphere();
  crownLowerInstances.computeBoundingSphere();
  crownUpperInstances.computeBoundingSphere();
  campusRoot.add(trunkInstances, crownLowerInstances, crownUpperInstances);

  // Streetlamps (strictly placed on sidewalks & walkways, NEVER inside buildings or roads)
  const lampList: GroundedProp[] = [];
  for (let lx = -118; lx <= 102; lx += 22) {
    if (lx > -72 && lx < -48) continue;
    lampList.push({ x: lx, y: 0, z: tashkentNorthVergeZ(lx), scale: 1 });
  }
  // Campus promenade walkways (between stadium & east buildings, between stadium & square, NE avenue)
  for (const [wx, wz] of [
    campusLocalToWorld(48, 10, -20.5, -12),
    campusLocalToWorld(48, 10, -20.5, 12),
    campusLocalToWorld(2, 72, -10, -20),
    campusLocalToWorld(2, 72, 10, -20),
    campusLocalToWorld(2, 72, -10, 14),
    campusLocalToWorld(2, 72, 10, 14),
    campusLocalToWorld(54, -46, -24, -18),
    campusLocalToWorld(54, -46, 0, -18),
    campusLocalToWorld(54, -46, 24, -18),
    campusLocalToWorld(-60, 96, -34, -8),
    campusLocalToWorld(-60, 96, -10, -8),
  ]) {
    lampList.push({ x: wx, y: 0, z: wz, scale: 1 });
  }

  const lampCount = lampList.length;
  const poleGeo = trackGeo(new THREE.CylinderGeometry(0.09, 0.14, 6.0, 8));
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
    const lp = lampList[i];
    dummy.position.set(lp.x, lp.y + 3.0, lp.z);
    dummy.scale.set(1, 1, 1);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    poleInstances.setMatrixAt(i, dummy.matrix);

    dummy.position.set(lp.x, lp.y + 6.1, lp.z);
    dummy.updateMatrix();
    headInstances.setMatrixAt(i, dummy.matrix);
  }
  poleInstances.instanceMatrix.needsUpdate = true;
  headInstances.instanceMatrix.needsUpdate = true;
  poleInstances.computeBoundingSphere();
  headInstances.computeBoundingSphere();
  campusRoot.add(poleInstances, headInstances);

  // Park Benches along University Square & Main Gate Fountain Plaza
  const benchList: GroundedProp[] = [];
  const pushBench = (
    ox: number,
    oz: number,
    lx: number,
    lz: number,
    yBase: number,
    rotOffset = 0
  ) => {
    const [wx, wz] = campusLocalToWorld(ox, oz, lx, lz);
    benchList.push({
      x: wx,
      y: yBase,
      z: wz,
      scale: 1,
      rot: CAMPUS_TILT_RAD + rotOffset,
    });
  };
  for (const bz of [-8, 0, 8]) {
    pushBench(2, 72, -5.2, bz, 0.24, Math.PI * 0.5);
    pushBench(2, 72, 5.2, bz, 0.24, -Math.PI * 0.5);
  }
  for (const bx of [-26, -18]) {
    pushBench(-60, 96, bx, -6.8, 0.16, 0);
  }
  for (const bx of [-22, -6, 10]) {
    pushBench(54, -46, bx, 10.5, 0, 0);
  }

  const benchCount = benchList.length;
  const benchSeatGeo = trackGeo(new THREE.BoxGeometry(2.4, 0.14, 0.68));
  const benchLegGeo = trackGeo(new THREE.BoxGeometry(2.2, 0.42, 0.52));
  const benchWoodMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.8 })
  );
  const benchSeats = new THREE.InstancedMesh(
    benchSeatGeo,
    benchWoodMat,
    benchCount
  );
  const benchLegs = new THREE.InstancedMesh(
    benchLegGeo,
    darkIronMat,
    benchCount
  );

  for (let i = 0; i < benchCount; i++) {
    const b = benchList[i];
    dummy.position.set(b.x, b.y + 0.44, b.z);
    dummy.rotation.set(0, b.rot ?? 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    benchSeats.setMatrixAt(i, dummy.matrix);

    dummy.position.set(b.x, b.y + 0.21, b.z);
    dummy.updateMatrix();
    benchLegs.setMatrixAt(i, dummy.matrix);
  }
  benchSeats.instanceMatrix.needsUpdate = true;
  benchLegs.instanceMatrix.needsUpdate = true;
  benchSeats.computeBoundingSphere();
  benchLegs.computeBoundingSphere();
  campusRoot.add(benchSeats, benchLegs);

  // Ornamental Flowerbeds (Main Gate plaza, Square entrance, Roundabout Stele island)
  const flowerList: GroundedProp[] = [];
  const pushFlower = (
    ox: number,
    oz: number,
    lx: number,
    lz: number,
    yBase: number,
    scale = 1
  ) => {
    const [wx, wz] = campusLocalToWorld(ox, oz, lx, lz);
    flowerList.push({ x: wx, y: yBase, z: wz, scale });
  };
  pushFlower(-60, 96, -15, -3, 0.16, 1.1);
  pushFlower(-60, 96, 9, -3, 0.16, 1.1);
  pushFlower(2, 72, -6.5, 13.5, 0.24, 1.0);
  pushFlower(2, 72, 6.5, 13.5, 0.24, 1.0);
  // Concentric flower planters on SE Roundabout Stele island (flush on turf y=0.48)
  for (let a = 0; a < 8; a++) {
    const ang = (a / 8) * Math.PI * 2;
    flowerList.push({
      x: steleCenter[0] + Math.cos(ang) * 8.6,
      y: 0.46,
      z: steleCenter[1] + Math.sin(ang) * 8.6,
      scale: 1.2,
    });
  }

  const flowerCount = flowerList.length;
  const planterGeo = trackGeo(new THREE.CylinderGeometry(1.35, 1.45, 0.42, 12));
  const bloomGeo = trackGeo(new THREE.CylinderGeometry(1.15, 1.15, 0.28, 12));
  const bloomMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 })
  );
  const planterMeshes = new THREE.InstancedMesh(
    planterGeo,
    concretePlinthMat,
    flowerCount
  );
  const bloomMeshes = new THREE.InstancedMesh(bloomGeo, bloomMat, flowerCount);
  const bloomColors = [0xe11d48, 0xf59e0b, 0xdb2777, 0xf97316];

  for (let i = 0; i < flowerCount; i++) {
    const f = flowerList[i];
    dummy.position.set(f.x, f.y + 0.21, f.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(f.scale, 1, f.scale);
    dummy.updateMatrix();
    planterMeshes.setMatrixAt(i, dummy.matrix);

    dummy.position.set(f.x, f.y + 0.46, f.z);
    dummy.updateMatrix();
    bloomMeshes.setMatrixAt(i, dummy.matrix);

    color.setHex(bloomColors[i % bloomColors.length]);
    bloomMeshes.setColorAt(i, color);
  }
  planterMeshes.instanceMatrix.needsUpdate = true;
  bloomMeshes.instanceMatrix.needsUpdate = true;
  if (bloomMeshes.instanceColor) bloomMeshes.instanceColor.needsUpdate = true;
  planterMeshes.computeBoundingSphere();
  bloomMeshes.computeBoundingSphere();
  campusRoot.add(planterMeshes, bloomMeshes);

  // Grounded Cars (along Tashkent Avenue traffic lanes only — never floating or hitting curbs/buildings)
  const carList: Array<{ x: number; z: number; rot: number; colorHex: number }> =
    [
      { x: -110, z: 111, rot: 0.13, colorHex: 0xf8fafc },
      { x: -42, z: 109, rot: 0.13 - Math.PI, colorHex: 0x1e293b },
      { x: 18, z: 95, rot: 0.13, colorHex: 0x94a3b8 },
      { x: 72, z: 94, rot: 0.15 - Math.PI, colorHex: 0xb91c1c },
      { x: 152, z: 79, rot: Math.PI * 0.5, colorHex: 0x0f172a },
      { x: 117, z: 72, rot: -Math.PI * 0.45, colorHex: 0xe2e8f0 },
    ];

  const carCount = carList.length;
  const carChassisGeo = trackGeo(new THREE.BoxGeometry(4.2, 0.85, 1.85));
  const carCabinGeo = trackGeo(new THREE.BoxGeometry(2.2, 0.65, 1.55));
  const carChassisMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.25,
      metalness: 0.65,
    })
  );
  const carChassisInst = new THREE.InstancedMesh(
    carChassisGeo,
    carChassisMat,
    carCount
  );
  const carCabinInst = new THREE.InstancedMesh(
    carCabinGeo,
    glassCyanMat,
    carCount
  );
  carChassisInst.castShadow = !isSoftwareGl;

  for (let i = 0; i < carCount; i++) {
    const c = carList[i];
    dummy.position.set(c.x, 0.52, c.z);
    dummy.rotation.set(0, c.rot, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    carChassisInst.setMatrixAt(i, dummy.matrix);

    dummy.position.set(c.x, 1.24, c.z);
    dummy.updateMatrix();
    carCabinInst.setMatrixAt(i, dummy.matrix);

    color.setHex(c.colorHex);
    carChassisInst.setColorAt(i, color);
  }
  carChassisInst.instanceMatrix.needsUpdate = true;
  carCabinInst.instanceMatrix.needsUpdate = true;
  if (carChassisInst.instanceColor) {
    carChassisInst.instanceColor.needsUpdate = true;
  }
  carChassisInst.computeBoundingSphere();
  carCabinInst.computeBoundingSphere();
  campusRoot.add(carChassisInst, carCabinInst);

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
 * Tashkent Avenue and its southeast roundabout).
 */
export function buildOsmContextGroup(
  dataset: OsmDataset,
  registry: TextureRegistry,
  maxAnisotropy: number
): {
  group: THREE.Group;
  dispose: () => void;
} {
  const group = new THREE.Group();
  group.name = 'osm-context-layer';

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  const contextBuildingMat = new THREE.MeshStandardMaterial({
    map: createStuccoWallTexture(registry, maxAnisotropy, '#cbd5e1'),
    roughness: 0.86,
    metalness: 0.04,
  });
  const roadMat = new THREE.MeshStandardMaterial({
    map: createAsphaltTexture(registry, maxAnisotropy),
    roughness: 0.92,
    metalness: 0.03,
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

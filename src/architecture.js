import * as THREE from 'three';
import { at, domes, ground, line, randomGenerator, ring } from './site.js';

const materials = {
  timber: new THREE.MeshStandardMaterial({ color: 0x93795e, roughness: .92 }),
  support: new THREE.MeshStandardMaterial({ color: 0x4d4738, roughness: .89 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x404844, metalness: .45, roughness: .53 }),
  linen: new THREE.MeshStandardMaterial({ color: 0xe4d8bd, roughness: 1 }),
  fabric: new THREE.MeshStandardMaterial({ color: 0x477778, side: THREE.DoubleSide, roughness: .94 }),
  frame: new THREE.MeshStandardMaterial({ color: 0x394945, roughness: .65, metalness: .22 }),
  path: new THREE.MeshStandardMaterial({ color: 0xa6876c, roughness: 1 }),
  poolRim: new THREE.MeshStandardMaterial({ color: 0xd4ccaf, roughness: .78 }),
};
const cube = new THREE.BoxGeometry(1, 1, 1);

function box(group, material, size, position, shadows = true) {
  const mesh = new THREE.Mesh(cube, material);
  mesh.scale.set(...size);
  mesh.position.set(...position);
  mesh.castShadow = shadows;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function cylinder(group, material, top, bottom, height, position, count = 12) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, height, count), material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function boardTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const random = randomGenerator(1338);
  for (let x = 0; x < canvas.width; x += 16) {
    const tone = 95 + Math.round(random() * 46);
    ctx.fillStyle = 'rgb(' + [tone + 15, tone + 7, tone].join(',') + ')';
    ctx.fillRect(x, 0, 15, 512);
    ctx.fillStyle = '#392f29';
    ctx.fillRect(x + 15, 0, 1, 512);
    for (let i = 0; i < 58; i++) {
      ctx.strokeStyle = random() > .54 ? '#f4dec337' : '#33231b54';
      ctx.beginPath();
      const start = x + random() * 14;
      const y = random() * 512;
      ctx.moveTo(start, y);
      ctx.lineTo(start + random() * .5, y + 15 + random() * 158);
      ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

function deck(group, texture, width, length, x, y, z) {
  box(group, materials.support, [width, .27, length], [x, y - .14, z]);
  const map = texture.clone();
  map.repeat.set(width / 2.5, length / 3.2);
  const material = new THREE.MeshStandardMaterial({ map, color: 0xe6ceab, roughness: .88 });
  const top = new THREE.Mesh(new THREE.PlaneGeometry(width, length), material);
  top.rotation.x = -Math.PI / 2;
  top.position.set(x, y, z);
  top.receiveShadow = true;
  group.add(top);
}

function chair(group, x, z, angle = 0) {
  const seat = new THREE.Group();
  seat.position.set(x, .02, z);
  seat.rotation.y = angle;
  box(seat, materials.timber, [.63, .09, 1.57], [0, .25, .04]);
  box(seat, materials.linen, [.55, .08, 1.0], [0, .32, .24]);
  const back = box(seat, materials.linen, [.56, .08, .65], [0, .48, -.57]);
  back.rotation.x = .54;
  for (const dx of [-.24, .24]) {
    for (const dz of [-.5, .55]) box(seat, materials.support, [.064, .26, .073], [dx, .12, dz]);
  }
  group.add(seat);
}

function parasol(group, x, z, height = 2.06) {
  cylinder(group, materials.timber, .026, .043, height, [x, height / 2, z], 7);
  cylinder(group, materials.timber, .23, .25, .06, [x, .03, z], 10);
  const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.13, .31, 8, 1, true), materials.fabric);
  canopy.position.set(x, height, z);
  canopy.rotation.y = .21;
  canopy.castShadow = true;
  group.add(canopy);
}

const roofs = new Map();
function roofGeometry(model, radius, height) {
  if (roofs.has(model)) return roofs.get(model);
  const sphere = new THREE.IcosahedronGeometry(1, model === 'Event 13' ? 4 : 3);
  const points = sphere.attributes.position;
  const batches = { cover: [], glass: [], frame: [], seams: [] };
  const colors = [];
  const seen = new Set();
  const cutoff = -.11;
  const random = randomGenerator(75);
  const positionFor = (vector) => [
    vector.x * radius,
    (vector.y - cutoff) * height / (1 - cutoff),
    vector.z * radius,
  ];
  const keyFor = (p) => p.map((n) => Math.round(n * 1000)).join(',');
  const edge = (a, b, type) => {
    const id = [keyFor(a), keyFor(b)].sort().join(':');
    if (seen.has(id)) return;
    seen.add(id);
    batches[type].push(...a.map((n) => n * 1.0015), ...b.map((n) => n * 1.0015));
  };
  for (let i = 0; i < points.count; i += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(points, i);
    const b = new THREE.Vector3().fromBufferAttribute(points, i + 1);
    const c = new THREE.Vector3().fromBufferAttribute(points, i + 2);
    const center = a.clone().add(b).add(c).divideScalar(3);
    const isGlass = center.z > .29 && Math.abs(Math.atan2(center.x, center.z)) < .94 && center.y < .56;
    const border = [];
    const vertices = [a, b, c];
    vertices.forEach((entry, k) => {
      const exit = vertices[(k + 1) % vertices.length];
      if (entry.y >= cutoff) border.push(positionFor(entry));
      if ((entry.y >= cutoff) !== (exit.y >= cutoff)) {
        border.push(positionFor(entry.clone().lerp(exit, (cutoff - entry.y) / (exit.y - entry.y))));
      }
    });
    const tint = .85 + random() * .15;
    for (let j = 1; j < border.length - 1; j++) {
      batches[isGlass ? 'glass' : 'cover'].push(...border[0], ...border[j], ...border[j + 1]);
      if (!isGlass) for (let k = 0; k < 3; k++) colors.push(tint, tint * .992, tint * .977);
    }
    for (let j = 0; j < border.length; j++) edge(border[j], border[(j + 1) % border.length], isGlass ? 'frame' : 'seams');
  }
  sphere.dispose();
  const result = Object.fromEntries(Object.entries(batches).map(([key, vertices]) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    if (key === 'cover') geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    if (key === 'cover' || key === 'glass') geometry.computeVertexNormals();
    return [key, geometry];
  }));
  roofs.set(model, result);
  return result;
}

function buildDome(root, texture, spec, windowMaterials) {
  const [x, z] = at(spec.id);
  const dims = { E7: [3.5, 4.1], E8: [4, 4], 'Event 13': [6.5, 6] };
  const [radius, height] = dims[spec.model];
  const restaurant = spec.id === 'REST';
  const group = new THREE.Group();
  group.name = spec.id;
  group.position.set(x, ground(x, z) + (restaurant ? .3 : .53), z);
  group.rotation.y = Math.PI / 2 - spec.rotation;
  root.add(group);

  const deckLength = radius * 2 + (restaurant ? 3.6 : 3);
  deck(group, texture, radius * 2 + 1.37, deckLength, 0, 0, .95);
  for (const dx of [-1, 1]) {
    for (const dz of [-1, 1]) {
      box(group, materials.support, [.14, .63, .16], [dx * radius, -.43, dz * radius]);
    }
  }
  for (let index = 0; index < 3; index++) {
    box(group, materials.timber, [restaurant ? 3.4 : 1.65, .07, .28], [0, -.10 - index * .125, deckLength / 2 + .98 + index * .23]);
  }
  cylinder(group, materials.support, radius * .993, radius * .993, .08, [0, .035, 0], 40);

  const solid = new THREE.MeshStandardMaterial({ color: 0xf4eee2, vertexColors: true, roughness: .9, flatShading: true });
  const window = new THREE.MeshPhysicalMaterial({
    color: 0x4f7976, transparent: true, depthWrite: false, opacity: .42, roughness: .16, metalness: .16,
    side: THREE.FrontSide, emissive: 0x814b16, emissiveIntensity: .025, clearcoat: .85,
  });
  windowMaterials.push(window);
  const roof = roofGeometry(spec.model, radius, height);
  const cover = new THREE.Mesh(roof.cover, solid);
  cover.castShadow = true;
  cover.receiveShadow = true;
  const glass = new THREE.Mesh(roof.glass, window);
  group.add(cover, glass,
    new THREE.LineSegments(roof.seams, new THREE.LineBasicMaterial({ color: 0x9b9688, transparent: true, opacity: .29 })),
    new THREE.LineSegments(roof.frame, new THREE.LineBasicMaterial({ color: 0x334641, transparent: true, opacity: .84 })));

  const interior = new THREE.MeshStandardMaterial({
    color: spec.accent, emissive: 0xd99245, emissiveIntensity: .032, roughness: .96,
  });
  windowMaterials.push(interior);
  if (restaurant) {
    for (const dx of [-2.25, -.75, .75, 2.25]) {
      box(group, materials.timber, [1.0, .075, 1.2], [dx, .81, 2.08]);
      box(group, materials.support, [.1, .79, .1], [dx, .41, 2.08]);
      box(group, interior, [.9, .4, .42], [dx, .3, 3.13]);
      box(group, materials.linen, [.86, .43, .10], [dx, .58, 3.31]);
    }
    box(group, interior, [6.5, .25, 4], [0, 2.35, -1.76]);
  } else {
    box(group, materials.timber, [2.05, .25, 2.07], [.5, .17, .4]);
    box(group, materials.linen, [2.03, .32, 2.03], [.5, .44, .4]);
    box(group, interior, [2.05, .063, 1.35], [.5, .62, .75]);
    box(group, materials.linen, [1.6, .16, .4], [.5, .69, -.31]);
    box(group, materials.frame, [.7, 1.4, 1.6], [-radius * .51, .74, -.66]);
    chair(group, -radius * .43, radius + .61, .08);
    chair(group, radius * .39, radius + .50, -.1);
    if (spec.id !== 'SEA05') parasol(group, radius * .65, radius + .69);
  }
  box(group, materials.timber, [restaurant ? 1.5 : .87, restaurant ? 2.35 : 1.98, .11], [0, restaurant ? 1.2 : 1.01, -radius * .99]);
  cylinder(group, materials.metal, .105, .115, 1.45, [radius * .44, height * .86, -radius * .21]);
  cylinder(group, materials.metal, .17, .17, .08, [radius * .44, height * .86 + .76, -radius * .21]);
}

function addPath(root, points, width, material = materials.path) {
  const coords = [];
  const index = [];
  points.forEach(([x, z], i) => {
    const [px, pz] = points[Math.max(0, i - 1)];
    const [nx, nz] = points[Math.min(points.length - 1, i + 1)];
    const length = Math.hypot(nx - px, nz - pz) || 1;
    const sx = (nz - pz) / length * width / 2;
    const sz = (px - nx) / length * width / 2;
    coords.push(x + sx, ground(x + sx, z + sz) + .052, z + sz,
      x - sx, ground(x - sx, z - sz) + .052, z - sz);
    if (i > 0) index.push(2*i-2, 2*i-1, 2*i, 2*i-1, 2*i+1, 2*i);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(coords, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true;
  root.add(mesh);
}

function addPool(root, texture) {
  const outline = ring('POOL').slice(0, -1);
  const center = outline.reduce(([x, z], [cx, cz]) => [x + cx / 4, z + cz / 4], [0, 0]);
  const width = Math.hypot(outline[1][0]-outline[0][0], outline[1][1]-outline[0][1]);
  const length = Math.hypot(outline[2][0]-outline[1][0], outline[2][1]-outline[1][1]);
  const angle = Math.atan2(outline[1][1]-outline[2][1], outline[1][0]-outline[2][0]);
  const pool = new THREE.Group();
  pool.position.set(center[0], ground(...center) + .22, center[1]);
  pool.rotation.y = -angle + Math.PI / 2;
  root.add(pool);
  deck(pool, texture, width + 4.7, length + 4, -1, 0, .15);
  box(pool, materials.poolRim, [width + .47, .11, length + .47], [0, .07, 0]);
  const poolWater = new THREE.MeshStandardMaterial({ color: 0x32c6bd, roughness: .13, metalness: .14, emissive: 0x0a9999, emissiveIntensity: .14 });
  box(pool, poolWater, [width, .029, length], [0, .127, 0], false);
  for (let i = 0; i < 4; i++) {
    chair(pool, -width / 2 - 1.47, -length / 2 + 1.4 + i * 1.76, Math.PI / 2);
    if (i % 2 === 0) parasol(pool, -width / 2 - 2, -length / 2 + .52 + i * 1.76);
  }
  for (const dx of [-.35, .35]) cylinder(pool, materials.metal, .024, .024, .71, [dx, .43, length / 2 + .07], 7);
}

function addSpa(root, texture) {
  const [x, z] = at('SPA01');
  const spa = new THREE.Group();
  spa.position.set(x, ground(x, z) + .22, z);
  spa.rotation.y = .72;
  root.add(spa);
  deck(spa, texture, 7.3, 4.25, -.1, 0, 0);
  const barrel = cylinder(spa, materials.timber, 1.22, 1.22, 2.92, [-1.74, 1.29, -.24], 28);
  barrel.rotation.x = Math.PI / 2;
  for (const dz of [-1.21, .68]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(1.225, .033, 5, 28), materials.metal);
    band.position.set(-1.74, 1.29, dz);
    spa.add(band);
  }
  box(spa, materials.frame, [.72, 1.78, .055], [-1.74, .98, 1.25]);
  cylinder(spa, materials.metal, .13, .13, 1, [-2.35, 2.47, -.79]);
  cylinder(spa, materials.timber, 1.0, .9, .73, [1.58, .37, .28], 28);
  cylinder(spa, new THREE.MeshStandardMaterial({ color: 0x537d72, roughness: .25 }), .86, .86, .025, [1.58, .755, .28], 28);
  box(spa, materials.timber, [.82, .26, .4], [1.56, .13, 1.4]);
}

function addPier(root, texture) {
  const [start, originalTip] = line('PIER');
  const angle = Math.atan2(originalTip[0] - start[0], originalTip[1] - start[1]);
  const length = Math.hypot(originalTip[0] - start[0], originalTip[1] - start[1]) + 7;
  const pier = new THREE.Group();
  pier.position.set(start[0], .48, start[1]);
  pier.rotation.y = angle;
  root.add(pier);
  deck(pier, texture, 1.6, length, 0, 0, length / 2);
  deck(pier, texture, 3.9, 2.15, 0, 0, length - .55);
  for (let z = .8; z < length; z += 2.25) {
    for (const x of [-.65, .65]) {
      cylinder(pier, materials.support, .075, .09, .99, [x, -.36, z], 8);
    }
  }
}

function batchBoxes(root) {
  const groups = new Map();
  root.updateMatrixWorld(true);
  root.traverse((mesh) => {
    if (mesh.geometry !== cube) return;
    const id = mesh.material.uuid + mesh.castShadow;
    const group = groups.get(id) || [];
    group.push(mesh);
    groups.set(id, group);
  });
  for (const meshes of groups.values()) {
    if (meshes.length < 4) continue;
    const first = meshes[0];
    const batch = new THREE.InstancedMesh(cube, first.material, meshes.length);
    batch.castShadow = first.castShadow;
    batch.receiveShadow = true;
    meshes.forEach((mesh, index) => {
      batch.setMatrixAt(index, mesh.matrixWorld);
      mesh.removeFromParent();
    });
    root.add(batch);
  }
}

export function addArchitecture(root) {
  const wood = boardTexture();
  const glowing = [];
  const path = line('PATH_MAIN');
  addPath(root, [at('ENTRY'), [8.2, .2], [8.7, 6.4], ...path], 1.9);
  addPath(root, [at('ENTRY'), [4, 6.4], [-3.4, 4.8], [-7, 1.7], [-10.0, -6]], 2.45);
  for (const spec of domes) {
    const [x, z] = at(spec.id);
    const nearest = path.reduce((best, point) => (
      Math.hypot(x - point[0], z - point[1]) < Math.hypot(x - best[0], z - best[1]) ? point : best
    ), path[0]);
    addPath(root, [nearest, [x - 1.4, z]], .91);
    buildDome(root, wood, spec, glowing);
  }
  buildDome(root, wood, { id: 'REST', model: 'Event 13', accent: 0xb58155, rotation: .39 }, glowing);
  addPool(root, wood);
  addSpa(root, wood);
  addPier(root, wood);
  batchBoxes(root);
  return {
    update(dusk) {
      for (const material of glowing) material.emissiveIntensity = .035 + dusk * .49;
    },
  };
}

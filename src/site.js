import site from './site-geometry.json';

const features = new Map(site.features.map(({ id, properties }) => [id, properties.local_en_m]));
const toXZ = ([east, north]) => [east, -north];

export const at = (id) => toXZ(features.get(id));
export const line = (id) => features.get(id).map(toXZ);
export const ring = (id) => features.get(id)[0].map(toXZ);
export const shore = [[82, -125], [67, -80], [68, -36], [59, -10], [52, 7], ...line('SHORE'),
  [-26, 103], [-36, 127], [-57, 167], [-94, 228], [-143, 340], [-185, 470], [-220, 640]];

export function shoreX(z) {
  const end = shore.findIndex((point) => point[1] > z);
  if (end === -1) return shore.at(-1)[0];
  if (end === 0) return shore[0][0];
  const [left, right] = [shore[end - 1], shore[end]];
  return left[0] + (right[0] - left[0]) * (z - left[1]) / (right[1] - left[1]);
}

export function ground(x, z) {
  const inland = shoreX(z) - x;
  if (inland < 3) return -0.13 + inland * 0.095;
  const bank = Math.max(0, Math.min(1, (inland - 3) / 9));
  const inlandRise = Math.max(0, inland - 72) * 0.025;
  return 0.18 + bank * (1.12 + 0.1 * Math.sin(z * 0.17 + x * 0.13)) + inlandRise;
}

export function randomGenerator(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

// Left-to-right IDs here are geographic slots, independent of the final guest names.
export const domes = [
  { id: 'SEA01', model: 'E8', accent: 0xc2864c, rotation: 0.40 },
  { id: 'SEA02', model: 'E7', accent: 0x6e858e, rotation: 0.23 },
  { id: 'SEA03', model: 'E7', accent: 0x779489, rotation: 0.32 },
  { id: 'SEA04', model: 'E7', accent: 0x8d5145, rotation: 0.39 },
  { id: 'SEA05', model: 'E7', accent: 0x786878, rotation: 0.37 },
  { id: 'SEA06', model: 'E7', accent: 0x617d56, rotation: 0.44 },
  { id: 'BACK01', model: 'E8', accent: 0x7c8a65, rotation: 0.61 },
  { id: 'BACK02', model: 'E8', accent: 0x8c877a, rotation: 0.52 },
];

export const chapters = [
  { id: 'shore', position: [83, 23, 103], look: [-4, 2, 39], phone: [90, 46, 99], phoneLook: [4, -8, 38] },
  { id: 'domes', position: [36, 7, 67], look: [-14, 2.3, 41], phone: [30, 19, 68], phoneLook: [-2, -3, 41] },
  { id: 'restaurant', position: [18, 7.1, 19], look: [-2.7, 2.3, 4.3], phone: [20, 16, 20], phoneLook: [0, -3, 2] },
  { id: 'relax', position: [2.4, 6.4, 23.7], look: [-12.6, 1.4, 15], phone: [7, 17, 26], phoneLook: [-6, -5, 12] },
  { id: 'pier', position: [31, 4.3, 67], look: [-5, 1.2, 43], phone: [32, 14, 59], phoneLook: [8, -4, 43] },
];

export const markerSites = {
  domes: [...at('SEA04'), 6.5],
  restaurant: [...at('REST'), 9.6],
  relax: [...at('SPA01'), 4.7],
};

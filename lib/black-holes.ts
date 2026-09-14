import { KM_PER_UNIT, BODIES, bodyDimensions } from './planets.ts';

// IAU nominal solar mass parameter (m³/s²), exact c (m/s).
export const SOLAR_HORIZON_RADIUS_KM = 2 * 1.3271244e20 / 299792458 ** 2 / 1000;
export const SHADOW_RADIUS_RATIO = Math.sqrt(27) / 2;
export const DISK_INNER_RADIUS = 3; // Schwarzschild ISCO, in horizon radii.
export const DISK_OUTER_RADIUS = 8; // Illustrative inner disk extent, not an observed outer edge.
export const BLACK_HOLES = [
  { id: 'xte', name: 'XTE J1650−500', short: 'XTE J1650', mass: 3.8, kind: 'STELLAR · UNCERTAIN ESTIMATE', description: 'A city-sized horizon. A small-end candidate, using the published 3.8-solar-mass estimate—not a definitive smallest record.', source: 'https://imagine.gsfc.nasa.gov/news/02apr08.html' },
  { id: 'cygnus', name: 'Cygnus X-1', short: 'Cygnus X-1', mass: 21.2, kind: 'STELLAR BLACK HOLE', description: 'Twenty-one Suns of mass in a horizon only about 125 km across. An accreting black hole in our own galaxy.', source: 'https://arxiv.org/abs/2102.09091' },
  { id: 'gw190521', name: 'GW190521', short: 'GW190521', mass: 142, kind: 'MERGER REMNANT', description: 'The estimated remnant of a black-hole merger detected through gravitational waves. The disk shown here is illustrative.', source: 'https://ligo.org/science-summaries/gw190521/' },
  { id: 'rgg118', name: 'RGG 118', short: 'RGG 118', mass: 50000, kind: 'INTERMEDIATE MASS', description: 'The central black hole of a dwarf galaxy. Its horizon is wider than Jupiter, but still smaller than the Sun.', source: 'https://www.nasa.gov/news-release/oxymoronic-black-hole-provides-clues-to-growth/' },
  { id: 'sgr', name: 'Sagittarius A*', short: 'Sgr A*', mass: 4.3e6, kind: 'OUR GALACTIC CENTER', description: 'The black hole at the heart of the Milky Way. Its equivalent horizon spans roughly eighteen Suns.', source: 'https://science.nasa.gov/universe/black-holes/supermassive-black-holes/new-nasa-black-hole-visualization-takes-viewers-beyond-the-brink/' },
  { id: 'm87', name: 'M87*', short: 'M87*', mass: 6.5e9, kind: 'SUPERMASSIVE', description: 'The first black hole imaged by the Event Horizon Telescope. Its horizon alone dwarfs the planetary solar system.', source: 'https://www.eso.org/public/news/eso1907/' },
  { id: 'ton618', name: 'TON 618', short: 'TON 618', mass: 66e9, kind: 'ULTRAMASSIVE · ESTIMATE', description: 'One of the largest known black holes. This view uses NASA’s 66-billion-solar-mass estimate; quasar mass estimates vary.', source: 'https://science.nasa.gov/universe/black-holes/' },
] as const;
export type BlackHoleId = typeof BLACK_HOLES[number]['id'];
export function blackHoleRadius(mass: number) { return mass * SOLAR_HORIZON_RADIUS_KM / KM_PER_UNIT; }
// A conservative shadow-sized clearance envelope, not a physical surface:
// the apparent shadow depends on the observer. A small additional margin
// keeps bodies clear while letting the shadow loom across the sky.
export const EXHIBITION_CLEARANCE_RATIO = SHADOW_RADIUS_RATIO + .15;
export function blackHolePosition(mass: number) {
  const radius = blackHoleRadius(mass);
  let z = -108;
  for (const body of BODIES) {
    const dimensions = bodyDimensions(body);
    const clearance = EXHIBITION_CLEARANCE_RATIO * radius + dimensions.radius + 30;
    const vertical = radius - dimensions.height;
    const offset = Math.sqrt(Math.max(0, clearance ** 2 - vertical ** 2 - body.x ** 2));
    z = Math.min(z, body.z - offset);
    // Large disks can overhang the entire exhibition. Only require lateral
    // clearance when the disk plane actually intersects a body's height.
    if (Math.abs(vertical) < dimensions.radius + 10) {
      z = Math.min(z, body.z - (DISK_OUTER_RADIUS * radius + dimensions.radius + 30));
    }
  }
  return { x: 0, y: radius, z };
}

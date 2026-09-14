// Kilometers, from NASA NSSDCA planetary fact sheets. All geometry uses this one scale.
export const KM_PER_UNIT = 6378.1;
export const BODIES = [
  { id: 'mercury', orbitKm: 57900000, name: 'Mercury', number: '01', kind: 'TERRESTRIAL PLANET', equatorial: 2439.7, polar: 2439.7, x: -4.5, z: 1.5, color: '#b7aba1', texture: '2k_mercury.jpg', description: 'The smallest planet. A world of quiet extremes.' },
  { id: 'venus', orbitKm: 108200000, name: 'Venus', number: '02', kind: 'TERRESTRIAL PLANET', equatorial: 6051.8, polar: 6051.8, x: -7.8, z: -3, color: '#d9bd83', texture: '2k_venus_atmosphere.jpg', description: 'Almost our size. An entirely different world.' },
  { id: 'earth', orbitKm: 149600000, name: 'Earth', number: '03', kind: 'TERRESTRIAL PLANET', equatorial: 6378.1, polar: 6356.8, x: 0, z: 0, color: '#88bffa', texture: '2k_earth_daymap.jpg', description: 'Our home. The measure of everything around us.' },
  { id: 'mars', orbitKm: 228000000, name: 'Mars', number: '04', kind: 'TERRESTRIAL PLANET', equatorial: 3396.2, polar: 3376.2, x: 4.5, z: 0.8, color: '#c87756', texture: '2k_mars.jpg', description: 'A familiar neighbor, just over half our width.' },
  { id: 'jupiter', orbitKm: 778500000, name: 'Jupiter', number: '05', kind: 'GAS GIANT', equatorial: 71492, polar: 66854, x: 20, z: -33, color: '#d1b394', texture: '2k_jupiter.jpg', description: 'Eleven Earths across. And still dwarfed by a star.' },
  { id: 'saturn', orbitKm: 1432000000, name: 'Saturn', number: '06', kind: 'GAS GIANT', equatorial: 60268, polar: 54364, x: -37, z: -48, color: '#d3c397', texture: '2k_saturn.jpg', description: 'A giant world, surrounded by an extraordinary halo.' },
  { id: 'uranus', orbitKm: 2867000000, name: 'Uranus', number: '07', kind: 'ICE GIANT', equatorial: 25559, polar: 24973, x: 47, z: -10, color: '#97cdd2', texture: '2k_uranus.jpg', description: 'Four Earths wide, wrapped in a pale blue atmosphere.' },
  { id: 'neptune', orbitKm: 4515000000, name: 'Neptune', number: '08', kind: 'ICE GIANT', equatorial: 24764, polar: 24341, x: -61, z: -10, color: '#668ded', texture: '2k_neptune.jpg', description: 'The outermost planet. A distant, windswept giant.' },
  { id: 'sun', orbitKm: 0, name: 'Sun', number: '00', kind: 'G-TYPE STAR', equatorial: 695700, polar: 695700, x: 0, z: -108, color: '#ffbc63', texture: '2k_sun.jpg', description: '109 Earths across. Suddenly, everything feels small.' },
] as const;
export type BodyId = typeof BODIES[number]['id'];
export function bodyDimensions(body: typeof BODIES[number]) {
  return { radius: body.equatorial / KM_PER_UNIT, height: body.polar / KM_PER_UNIT };
}

export type LayoutMode = 'compact' | 'distances';
export const AU_KM = 149_597_870.7;
export function bodyPosition(body: typeof BODIES[number], layout: LayoutMode) {
  // Straight-line alignment preserves mean center-to-center solar distances;
  // it deliberately does not claim to be a snapshot of the planets' orbits.
  if (layout === 'compact') return { x: body.x, z: body.z };
  if (body.id === 'sun') return { x: 0, z: 0 };
  const verticalSeparation = (695700 - body.polar) / KM_PER_UNIT;
  return { x: Math.sqrt((body.orbitKm / KM_PER_UNIT) ** 2 - verticalSeparation ** 2), z: 0 };
}

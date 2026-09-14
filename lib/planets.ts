// Kilometers, from NASA NSSDCA planetary fact sheets. All geometry uses this one scale.
export const KM_PER_UNIT = 6378.1;
export const BODIES = [
  { id: 'mercury', name: 'Mercury', number: '01', kind: 'TERRESTRIAL PLANET', equatorial: 2439.7, polar: 2439.7, x: -4.5, z: 1.5, color: '#b7aba1', texture: '2k_mercury.jpg', description: 'The smallest planet. A world of quiet extremes.' },
  { id: 'venus', name: 'Venus', number: '02', kind: 'TERRESTRIAL PLANET', equatorial: 6051.8, polar: 6051.8, x: -7.8, z: -3, color: '#d9bd83', texture: '2k_venus_atmosphere.jpg', description: 'Almost our size. An entirely different world.' },
  { id: 'earth', name: 'Earth', number: '03', kind: 'TERRESTRIAL PLANET', equatorial: 6378.1, polar: 6356.8, x: 0, z: 0, color: '#88bffa', texture: '2k_earth_daymap.jpg', description: 'Our home. The measure of everything around us.' },
  { id: 'mars', name: 'Mars', number: '04', kind: 'TERRESTRIAL PLANET', equatorial: 3396.2, polar: 3376.2, x: 4.5, z: 0.8, color: '#c87756', texture: '2k_mars.jpg', description: 'A familiar neighbor, just over half our width.' },
  { id: 'jupiter', name: 'Jupiter', number: '05', kind: 'GAS GIANT', equatorial: 71492, polar: 66854, x: 20, z: -33, color: '#d1b394', texture: '2k_jupiter.jpg', description: 'Eleven Earths across. And still dwarfed by a star.' },
  { id: 'saturn', name: 'Saturn', number: '06', kind: 'GAS GIANT', equatorial: 60268, polar: 54364, x: -37, z: -48, color: '#d3c397', texture: '2k_saturn.jpg', description: 'A giant world, surrounded by an extraordinary halo.' },
  { id: 'uranus', name: 'Uranus', number: '07', kind: 'ICE GIANT', equatorial: 25559, polar: 24973, x: 47, z: -10, color: '#97cdd2', texture: '2k_uranus.jpg', description: 'Four Earths wide, wrapped in a pale blue atmosphere.' },
  { id: 'neptune', name: 'Neptune', number: '08', kind: 'ICE GIANT', equatorial: 24764, polar: 24341, x: -61, z: -10, color: '#668ded', texture: '2k_neptune.jpg', description: 'The outermost planet. A distant, windswept giant.' },
  { id: 'sun', name: 'Sun', number: '00', kind: 'G-TYPE STAR', equatorial: 695700, polar: 695700, x: -115, z: -255, color: '#ffbc63', texture: '2k_sun.jpg', description: '109 Earths across. Suddenly, everything feels small.' },
] as const;
export type BodyId = typeof BODIES[number]['id'];
export function bodyDimensions(body: typeof BODIES[number]) {
  return { radius: body.equatorial / KM_PER_UNIT, height: body.polar / KM_PER_UNIT };
}

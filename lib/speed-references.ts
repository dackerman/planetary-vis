// Rounded benchmarks: reference frames and conditions are part of each label.
export const SPEED_REFERENCES = [
  { name: '9 mm bullet', kms: 0.362712, detail: 'Winchester 115-grain · muzzle speed', source: 'https://www.ableammo.com/catalog/ammo_charts/Winchester_Ammunition_Ballistic.pdf' },
  { name: 'Moon orbiting Earth', kms: 1.023, detail: 'Mean orbital speed relative to Earth', source: 'https://ntrs.nasa.gov/api/citations/20140003573/downloads/20140003573.pdf' },
  { name: 'Space Shuttle', kms: 7.74317984, detail: 'Orbital speed relative to Earth', source: 'https://www.nasa.gov/reference/the-space-shuttle/' },
  { name: 'Voyager 1', kms: 17, detail: 'Approximate cruise speed relative to the Sun', source: 'https://science.nasa.gov/mission/voyager/voyager-1/' },
  { name: 'Parker Solar Probe', kms: 192.2272, detail: 'December 2024 solar flyby · relative to the Sun', source: 'https://science.nasa.gov/science-research/heliophysics/nasas-parker-solar-probe-makes-history-with-closest-pass-to-sun/' },
  { name: 'Light', kms: 299792.458, detail: 'In a vacuum · exact', source: 'https://physics.nist.gov/cuu/Constants/Value/c.html' },
];
export function speedComparison(kms: number) {
  const reference = SPEED_REFERENCES.reduce((best, ref) => Math.abs(Math.log(kms / ref.kms)) < Math.abs(Math.log(kms / best.kms)) ? ref : best);
  const ratio = kms / reference.kms;
  const amount = (ratio < 1 ? 1 / ratio : ratio).toLocaleString('en-US', { maximumFractionDigits: 1 });
  const text = Math.abs(ratio - 1) < 0.000001 ? `The speed of ${reference.name}` : ratio < 1 ? `1/${amount} the speed of ${reference.name}` : `${amount} × the speed of ${reference.name}`;
  return { reference, text };
}

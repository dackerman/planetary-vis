// Rounded benchmarks: reference frames and conditions are part of each label.
export const SPEED_REFERENCES = [
  { name: '9 mm bullet', kms: 0.362712, detail: 'Winchester 115-grain · muzzle speed', source: 'https://www.ableammo.com/catalog/ammo_charts/Winchester_Ammunition_Ballistic.pdf' },
  { name: 'Moon orbiting Earth', kms: 1.023, detail: 'Mean orbital speed relative to Earth', source: 'https://ntrs.nasa.gov/api/citations/20140003573/downloads/20140003573.pdf' },
  { name: 'Space Shuttle', kms: 7.74317984, detail: 'Orbital speed relative to Earth', source: 'https://www.nasa.gov/reference/the-space-shuttle/' },
  { name: 'Voyager 1', kms: 17, detail: 'Approximate cruise speed relative to the Sun', source: 'https://science.nasa.gov/mission/voyager/voyager-1/' },
  { name: 'Parker Solar Probe', kms: 192.2272, detail: 'December 2024 solar flyby · relative to the Sun', source: 'https://science.nasa.gov/science-research/heliophysics/nasas-parker-solar-probe-makes-history-with-closest-pass-to-sun/' },
  { name: 'Sun orbiting the Milky Way', kms: 230, detail: 'Approximate speed around the galactic center', source: 'https://starchild.gsfc.nasa.gov/docs/StarChild/questions/question18.html' },
  { name: 'Typical solar wind', kms: 400, detail: 'Outflow from the Sun near Earth’s orbit', source: 'https://science.nasa.gov/learn/basics-of-space-flight/chapter1-1/' },
  { name: 'Fast solar wind', kms: 800, detail: 'Approximate outflow over coronal holes', source: 'https://solarscience.msfc.nasa.gov/SolarWind.shtml' },
  { name: 'Cannonball pulsar J0002', kms: 1117.6, detail: 'Approximate motion away from its supernova remnant', source: 'https://www.nasa.gov/universe/nasas-fermi-satellite-clocks-cannonball-pulsar-speeding-through-space/' },
  { name: 'Star S2 near Sagittarius A*', kms: 7650, detail: '2018 closest approach · relative to the black hole', source: 'https://arxiv.org/abs/1807.09409' },
  { name: 'Supernova ejecta', kms: 10000, detail: 'Typical early expansion · order-of-magnitude benchmark', source: 'https://heasarc.gsfc.nasa.gov/docs/objects/snrs/snrstext.html' },
  { name: 'Neutron-star merger outflow', kms: 29979.2458, detail: '2017 Swift observations · approximately 10% of light speed', source: 'https://swift.gsfc.nasa.gov/news/2017/' },
  { name: 'SS 433 plasma jets', kms: 77946.03908, detail: 'About 26% of light speed · relative to the system', source: 'https://www.jpl.nasa.gov/news/object-emitting-high-energy-gamma-radiation-found-in-the-milky-way/' },
  { name: 'Relativistic supernova jet', kms: 149896.229, detail: '50% of light speed · reported lower bound for fast ejecta', source: 'https://www.nasa.gov/news-release/newborn-black-holes-boost-explosive-power-of-supernovae/' },
  { name: 'Light', kms: 299792.458, detail: 'In a vacuum · exact', source: 'https://physics.nist.gov/cuu/Constants/Value/c.html' },
];
export function speedComparison(kms: number) {
  const reference = SPEED_REFERENCES.reduce((best, ref) => Math.abs(Math.log(kms / ref.kms)) < Math.abs(Math.log(kms / best.kms)) ? ref : best);
  const ratio = kms / reference.kms;
  const amount = (ratio < 1 ? 1 / ratio : ratio).toLocaleString('en-US', { maximumFractionDigits: 1 });
  const text = Math.abs(ratio - 1) < 0.000001 ? `The speed of ${reference.name}` : ratio < 1 ? `1/${amount} the speed of ${reference.name}` : `${amount} × the speed of ${reference.name}`;
  return { reference, text };
}

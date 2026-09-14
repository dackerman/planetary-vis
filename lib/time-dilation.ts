// Stationary Schwarzschild observer versus a clock at infinity.
// r is the areal radius from the center; r_s is the horizon radius.
export function gravitationalClockRate(radiusRatio: number) {
  if (!(radiusRatio > 1)) return null; // No stationary observer at/inside the horizon.
  return Math.sqrt(1 - 1 / radiusRatio);
}
export function clockDuration(seconds: number) {
  const rounded = Math.round(seconds);
  const days = Math.floor(rounded / 86400);
  const hours = Math.floor(rounded % 86400 / 3600);
  const minutes = Math.floor(rounded % 3600 / 60);
  const rest = rounded % 60;
  return [days ? `${days} d` : '', hours ? `${hours} h` : '', minutes ? `${minutes} min` : '', rest ? `${rest} s` : ''].filter(Boolean).join(' ') || '0 s';
}

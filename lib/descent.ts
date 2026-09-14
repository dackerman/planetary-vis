export const DESCENT_SECONDS = 35;
export function descentFrame(seconds: number) {
  const progress=Math.max(0,Math.min(1,seconds/DESCENT_SECONDS));
  // Ease toward the horizon without evaluating the static-observer shader at r_s.
  const radiusRatio=1.0001+1.9999*(1-progress)**3;
  const fade=Math.max(0,Math.min(1,(progress-.88)/.12));
  return { progress, radiusRatio, fade: fade*fade*(3-2*fade) };
}

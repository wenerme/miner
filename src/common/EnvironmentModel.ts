import { RENDER_DIST } from './types';

export type MineWebWeather = 'clear' | 'rain' | 'snow';

export interface EnvironmentSnapshot {
  skyColor: number;
  fogColor: number;
  cloudColor: number;
  cloudOpacity: number;
  ambientIntensity: number;
  sunIntensity: number;
  fogNear: number;
  fogFar: number;
  dayBrightness: number;
  /** 0–1 star layer opacity (dusk through night, fades at dawn). */
  starVisibility: number;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function mixColor(a: number, b: number, t: number) {
  const tt = clamp01(t);
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  const rr = Math.round(lerp(ar, br, tt));
  const rg = Math.round(lerp(ag, bg, tt));
  const rb = Math.round(lerp(ab, bb, tt));
  return (rr << 16) | (rg << 8) | rb;
}

function normalizeTimeOfDay(timeOfDay: number) {
  const normalized = timeOfDay % 1;
  return normalized < 0 ? normalized + 1 : normalized;
}

/** MC-style: 24000 ticks / day; normalized timeOfDay = tick / 24000. */
export const TICKS_PER_DAY = 24_000;
const DAWN_END = 1000;
const DAY_END = 12_000;
const DUSK_END = 13_000;

function smoothstep01(t: number) {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

function computeMcSkyBaseColor(tick: number): number {
  const dawnPink = 0xffb7c5;
  const dawnOrange = 0xff8f5a;
  const dayBlue = 0x87ceeb;
  const duskRed = 0xd94a3b;
  const duskPurple = 0x6b3d5c;
  const nightSky = 0x050816;

  if (tick < DAWN_END) {
    const u = smoothstep01(tick / DAWN_END);
    const warm = mixColor(dawnPink, dawnOrange, 0.45);
    return mixColor(warm, dayBlue, u);
  }
  if (tick < DAY_END) {
    return dayBlue;
  }
  if (tick < DUSK_END) {
    const u = smoothstep01((tick - DAY_END) / (DUSK_END - DAY_END));
    return mixColor(dayBlue, mixColor(duskRed, duskPurple, 0.35), u);
  }
  const nightBlend = smoothstep01((tick - DUSK_END) / 1800);
  const atDuskEnd = mixColor(dayBlue, mixColor(duskRed, duskPurple, 0.35), 1);
  return mixColor(atDuskEnd, nightSky, nightBlend);
}

function computeStarVisibility(tick: number): number {
  if (tick >= DAWN_END && tick < DAY_END) return 0;
  if (tick < DAWN_END) return 1 - smoothstep01(tick / DAWN_END);
  if (tick >= DAY_END && tick < DUSK_END) return smoothstep01((tick - DAY_END) / (DUSK_END - DAY_END));
  return 1;
}

export function computeEnvironmentSnapshot(input: {
  timeOfDay: number;
  weather: MineWebWeather;
  renderDistance?: number;
}): EnvironmentSnapshot {
  const timeOfDay = normalizeTimeOfDay(input.timeOfDay);
  const renderDistance = input.renderDistance ?? RENDER_DIST;
  const tick = timeOfDay * TICKS_PER_DAY;
  // MC-style sun arc: 0 = sunrise horizon, 0.25 = noon, 0.5 = sunset, 0.75 = nadir.
  const sunPhase = timeOfDay * Math.PI * 2;
  const sunElevation = Math.sin(sunPhase);
  const dayBrightness = Math.max(0, sunElevation);

  const baseSkyColor = computeMcSkyBaseColor(tick);
  const starVisibility = computeStarVisibility(tick);

  const weatherBlend = {
    clear: 0,
    rain: 0.62,
    snow: 0.48,
  }[input.weather];
  const stormSky = input.weather === 'snow' ? 0xcad7e5 : 0x596578;
  const skyColor = mixColor(baseSkyColor, stormSky, weatherBlend);

  const clearFogBase = mixColor(skyColor, 0xd8f0ff, 0.28);
  const stormFog = input.weather === 'snow' ? 0xe6edf4 : 0x728196;
  const fogColor = mixColor(clearFogBase, stormFog, input.weather === 'clear' ? 0 : 0.5);

  const cloudColor = mixColor(
    0xffffff,
    input.weather === 'snow' ? 0xf7fbff : 0xc7d0da,
    input.weather === 'clear' ? 0.06 : 0.68,
  );
  const cloudOpacity = clamp01(
    lerp(0.58, 0.76, dayBrightness)
      * (input.weather === 'clear' ? 1 : input.weather === 'rain' ? 1.28 : 1.18),
  );

  const fogDistance = renderDistance * 16;
  const fogNearFactor = input.weather === 'clear' ? 0.6 : input.weather === 'rain' ? 0.3 : 0.26;
  const fogFarFactor = input.weather === 'clear' ? 1.0 : input.weather === 'rain' ? 0.68 : 0.62;

  const weatherLightScale = input.weather === 'clear' ? 1 : input.weather === 'rain' ? 0.58 : 0.66;
  const ambientBoost = input.weather === 'snow' ? 0.02 : 0;

  return {
    skyColor,
    fogColor,
    cloudColor,
    cloudOpacity,
    ambientIntensity: (0.08 + dayBrightness * 0.32) * weatherLightScale + ambientBoost,
    sunIntensity: (0.12 + dayBrightness * 0.72) * weatherLightScale,
    fogNear: fogDistance * fogNearFactor,
    fogFar: fogDistance * fogFarFactor,
    dayBrightness,
    starVisibility,
  };
}

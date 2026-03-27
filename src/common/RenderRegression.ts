export interface FrameAnalysisInput {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array;
}

export interface FrameAnalysisResult {
  avgLuma: number;
  uniqueBuckets: number;
  nonSkyRatio: number;
  signature: string;
}

export function analyzeFrame(input: FrameAnalysisInput): FrameAnalysisResult {
  const { data, width, height } = input;
  let totalLuma = 0;
  let lowerHalfNonSky = 0;
  let lowerHalfSamples = 0;
  const buckets = new Set<string>();
  const signature: string[] = [];

  const quantize = (v: number) => Math.max(0, Math.min(15, Math.round(v / 17))).toString(16);

  for (let y = 0; y < height; y += 4) {
    for (let x = 0; x < width; x += 4) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const luma = r * 0.2126 + g * 0.7152 + b * 0.0722;
      totalLuma += luma;
      buckets.add(`${quantize(r)}${quantize(g)}${quantize(b)}`);

      if (y > height / 2) {
        lowerHalfSamples++;
        const looksLikeSky = b > r && b > g && luma > 80;
        if (!looksLikeSky) lowerHalfNonSky++;
      }
    }
  }

  for (let gy = 0; gy < 4; gy++) {
    for (let gx = 0; gx < 8; gx++) {
      const sx = Math.floor(width * (0.18 + gx * 0.09));
      const sy = Math.floor(height * (0.28 + gy * 0.12));
      const idx = (sy * width + sx) * 4;
      signature.push(
        `${quantize(data[idx])}${quantize(data[idx + 1])}${quantize(data[idx + 2])}`,
      );
    }
  }

  const sampleCount = Math.ceil(width / 4) * Math.ceil(height / 4);
  return {
    avgLuma: totalLuma / sampleCount,
    uniqueBuckets: buckets.size,
    nonSkyRatio: lowerHalfNonSky / Math.max(1, lowerHalfSamples),
    signature: signature.join('.'),
  };
}

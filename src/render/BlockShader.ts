import * as THREE from 'three';
import { RENDER_DIST } from '#/common/types';

const vertexShader = `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  attribute float aLight;
  attribute float aAnimated;
  varying vec2 vUv;
  varying float vLight;
  varying float vFogDepth;
  varying float vAnimated;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  void main() {
    vUv = uv;
    vLight = aLight;
    vAnimated = aAnimated;
    vNormal = normalize(normalMatrix * normal);
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    vec4 mvPosition = viewMatrix * worldPos;
    vFogDepth = -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;
    #include <logdepthbuf_vertex>
  }
`;

const fragmentShader = `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform sampler2D uAtlas;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform float uTime;
  uniform float uSunIntensity;

  varying vec2 vUv;
  varying float vLight;
  varying float vFogDepth;
  varying float vAnimated;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  void main() {
    #include <logdepthbuf_fragment>
    vec2 uv = vUv;
    if (vAnimated > 0.5) {
      uv.y += sin(uv.x * 10.0 + uTime * 2.0) * 0.02;
      uv.x += cos(uv.y * 8.0 + uTime * 1.5) * 0.015;
    }
    vec4 texColor = texture2D(uAtlas, uv);
    if (texColor.a < 0.5) discard;

    float directional = max(0.0, dot(vNormal, normalize(vec3(0.3, 1.0, 0.2)))) * 0.35 * uSunIntensity;
    float ambient = 0.65 + (1.0 - uSunIntensity) * 0.15;
    float lighting = vLight * (ambient + directional);

    vec3 lit = texColor.rgb * lighting;
    float fogFactor = smoothstep(uFogNear, uFogFar, vFogDepth);
    gl_FragColor = vec4(mix(lit, uFogColor, fogFactor), texColor.a);
  }
`;

export function createBlockMaterial(atlas: THREE.Texture, renderDist: number = RENDER_DIST): THREE.ShaderMaterial {
  const fogDist = renderDist * 16;
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uAtlas: { value: atlas },
      uFogColor: { value: new THREE.Color(0x87ceeb) },
      uFogNear: { value: fogDist * 0.6 },
      uFogFar: { value: fogDist },
      uTime: { value: 0.0 },
      uSunIntensity: { value: 1.0 },
    },
    transparent: false,
    alphaTest: 0.5,
    side: THREE.FrontSide,
  });
}

const waterFragmentShader = `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform sampler2D uAtlas;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform float uTime;
  uniform vec3 uWaterTint;
  uniform float uWaterAlpha;
  uniform float uSunIntensity;
  uniform vec3 uCameraPos;

  varying vec2 vUv;
  varying float vLight;
  varying float vFogDepth;
  varying float vAnimated;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  void main() {
    #include <logdepthbuf_fragment>
    vec2 worldUV = vWorldPosition.xz * 0.15;
    float wave1 = sin(worldUV.x * 3.0 + uTime * 0.8) * 0.005;
    float wave2 = cos(worldUV.y * 2.5 + uTime * 0.6) * 0.004;
    float wave3 = sin((worldUV.x + worldUV.y) * 2.0 + uTime * 0.5) * 0.003;
    vec2 uv = vUv + vec2(wave1 + wave3, wave2 + wave3);
    vec4 texColor = texture2D(uAtlas, uv);

    vec3 viewDir = normalize(uCameraPos - vWorldPosition);
    float fresnel = pow(1.0 - max(0.0, dot(vNormal, viewDir)), 3.0);
    fresnel = mix(0.15, 0.8, fresnel);

    vec3 lightDir = normalize(vec3(0.3, 1.0, 0.2));
    vec3 halfDir = normalize(viewDir + lightDir);
    float spec = pow(max(0.0, dot(vNormal, halfDir)), 32.0) * 0.4 * uSunIntensity;
    float caustic = (sin(worldUV.x * 8.0 + uTime * 1.2) * cos(worldUV.y * 6.0 + uTime * 0.9) + 1.0) * 0.03;

    float lighting = vLight * (0.65 + 0.35 * uSunIntensity);
    vec3 deepColor = uWaterTint * 0.6;
    vec3 shallowColor = uWaterTint * 1.2;
    vec3 waterColor = mix(deepColor, shallowColor, fresnel) * texColor.rgb * lighting;
    waterColor += vec3(spec) + vec3(caustic * uSunIntensity);

    float alpha = mix(uWaterAlpha, 0.85, fresnel);
    float fogFactor = smoothstep(uFogNear, uFogFar, vFogDepth);
    gl_FragColor = vec4(mix(waterColor, uFogColor, fogFactor), alpha);
  }
`;

const glassFragmentShader = `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform sampler2D uAtlas;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform float uTime;
  uniform float uSunIntensity;

  varying vec2 vUv;
  varying float vLight;
  varying float vFogDepth;
  varying float vAnimated;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  void main() {
    #include <logdepthbuf_fragment>
    vec4 texColor = texture2D(uAtlas, vUv);
    if (texColor.a < 0.01) discard;

    float directional = max(0.0, dot(vNormal, normalize(vec3(0.3, 1.0, 0.2)))) * 0.35 * uSunIntensity;
    float ambient = 0.65 + (1.0 - uSunIntensity) * 0.15;
    float lighting = vLight * (ambient + directional);

    vec3 lit = texColor.rgb * lighting;
    float fogFactor = smoothstep(uFogNear, uFogFar, vFogDepth);
    gl_FragColor = vec4(mix(lit, uFogColor, fogFactor), texColor.a);
  }
`;

export function createGlassMaterial(atlas: THREE.Texture, renderDist: number = RENDER_DIST): THREE.ShaderMaterial {
  const fogDist = renderDist * 16;
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader: glassFragmentShader,
    uniforms: {
      uAtlas: { value: atlas },
      uFogColor: { value: new THREE.Color(0x87ceeb) },
      uFogNear: { value: fogDist * 0.6 },
      uFogFar: { value: fogDist },
      uTime: { value: 0.0 },
      uSunIntensity: { value: 1.0 },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

const lavaFragmentShader = `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform sampler2D uAtlas;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform float uTime;
  uniform float uSunIntensity;

  varying vec2 vUv;
  varying float vLight;
  varying float vFogDepth;
  varying vec3 vWorldPosition;

  void main() {
    #include <logdepthbuf_fragment>
    vec2 worldUV = vWorldPosition.xz * 0.12;
    float flow1 = sin(worldUV.x * 2.0 + uTime * 0.3) * 0.006;
    float flow2 = cos(worldUV.y * 1.8 + uTime * 0.25) * 0.005;
    vec2 uv = vUv + vec2(flow1, flow2);
    vec4 texColor = texture2D(uAtlas, uv);

    float pulse = (sin(uTime * 1.5 + worldUV.x * 4.0 + worldUV.y * 3.0) + 1.0) * 0.15;
    vec3 lavaColor = texColor.rgb * vec3(1.0, 0.35, 0.05) * (1.5 + pulse);
    lavaColor += vec3(0.3, 0.05, 0.0) * vLight;

    float fogFactor = smoothstep(uFogNear, uFogFar, vFogDepth);
    gl_FragColor = vec4(mix(lavaColor, uFogColor, fogFactor), 1.0);
  }
`;

export function createLavaMaterial(atlas: THREE.Texture, renderDist: number = RENDER_DIST): THREE.ShaderMaterial {
  const fogDist = renderDist * 16;
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader: lavaFragmentShader,
    uniforms: {
      uAtlas: { value: atlas },
      uFogColor: { value: new THREE.Color(0x87ceeb) },
      uFogNear: { value: fogDist * 0.6 },
      uFogFar: { value: fogDist },
      uTime: { value: 0.0 },
      uSunIntensity: { value: 1.0 },
    },
    transparent: false,
    depthWrite: true,
    side: THREE.DoubleSide,
  });
}

export function createWaterMaterial(atlas: THREE.Texture, renderDist: number = RENDER_DIST): THREE.ShaderMaterial {
  const fogDist = renderDist * 16;
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader: waterFragmentShader,
    uniforms: {
      uAtlas: { value: atlas },
      uFogColor: { value: new THREE.Color(0x87ceeb) },
      uFogNear: { value: fogDist * 0.6 },
      uFogFar: { value: fogDist },
      uTime: { value: 0.0 },
      uWaterTint: { value: new THREE.Color(0x3f76e4) },
      uWaterAlpha: { value: 0.6 },
      uSunIntensity: { value: 1.0 },
      uCameraPos: { value: new THREE.Vector3() },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

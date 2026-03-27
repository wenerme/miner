import * as THREE from 'three';

export type WeatherType = 'clear' | 'rain' | 'snow';

export function createWeatherPointsMaterial(isSnow: boolean): THREE.PointsMaterial {
  return new THREE.PointsMaterial({
    color: isSnow ? 0xffffff : 0x8888cc,
    size: isSnow ? 0.15 : 0.05,
    transparent: true,
    opacity: isSnow ? 0.8 : 0.5,
    depthWrite: false,
  });
}

export class WeatherRenderer {
  private scene: THREE.Scene;
  private particles: THREE.Points | null = null;
  private positions: Float32Array | null = null;
  private velocities: Float32Array | null = null;
  private type: WeatherType = 'clear';
  private particleCount = 3000;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  setWeather(type: WeatherType) {
    if (this.type === type) return;
    this.type = type;
    this.removeParticles();
    if (type !== 'clear') this.createParticles();
  }

  private createParticles() {
    const count = this.particleCount;
    this.positions = new Float32Array(count * 3);
    this.velocities = new Float32Array(count * 3);

    const isSnow = this.type === 'snow';

    for (let i = 0; i < count; i++) {
      this.positions[i * 3] = (Math.random() - 0.5) * 80;
      this.positions[i * 3 + 1] = Math.random() * 60;
      this.positions[i * 3 + 2] = (Math.random() - 0.5) * 80;

      this.velocities[i * 3] = isSnow ? (Math.random() - 0.5) * 0.5 : (Math.random() - 0.5) * 0.3;
      this.velocities[i * 3 + 1] = isSnow ? -(1 + Math.random() * 1.5) : -(8 + Math.random() * 8);
      this.velocities[i * 3 + 2] = isSnow ? (Math.random() - 0.5) * 0.5 : (Math.random() - 0.5) * 0.3;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));

    const mat = createWeatherPointsMaterial(isSnow);

    this.particles = new THREE.Points(geo, mat);
    this.scene.add(this.particles);
  }

  tick(dt: number, cameraPos: THREE.Vector3) {
    if (!this.particles || !this.positions || !this.velocities) return;

    for (let i = 0; i < this.particleCount; i++) {
      const i3 = i * 3;
      this.positions[i3] += this.velocities[i3] * dt;
      this.positions[i3 + 1] += this.velocities[i3 + 1] * dt;
      this.positions[i3 + 2] += this.velocities[i3 + 2] * dt;

      if (this.positions[i3 + 1] < -5) {
        this.positions[i3] = cameraPos.x + (Math.random() - 0.5) * 80;
        this.positions[i3 + 1] = cameraPos.y + 30 + Math.random() * 30;
        this.positions[i3 + 2] = cameraPos.z + (Math.random() - 0.5) * 80;
      }
    }

    this.particles.position.copy(cameraPos);
    (this.particles.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  }

  private removeParticles() {
    if (this.particles) {
      this.scene.remove(this.particles);
      this.particles.geometry.dispose();
      (this.particles.material as THREE.Material).dispose();
      this.particles = null;
    }
    this.positions = null;
    this.velocities = null;
  }

  dispose() {
    this.removeParticles();
  }
}

'use client';

const CROSSHAIR = '/mc/assets/minecraft/textures/gui/sprites/hud/crosshair.png';

export function CrosshairUI() {
  return (
    <div className='pointer-events-none absolute inset-0 flex items-center justify-center'>
      <img src={CROSSHAIR} alt='' className='h-4 w-4' style={{ imageRendering: 'pixelated' }} />
    </div>
  );
}

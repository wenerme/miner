/** renderOrder for chunk layer meshes (opaque default is 0). Keep water before glass so alpha-sorted draws stack sensibly. */
export const CHUNK_RENDER_ORDER_OPAQUE = 0;
/** Lava is drawn as opaque; same ordering as solid terrain. */
export const CHUNK_RENDER_ORDER_LAVA = CHUNK_RENDER_ORDER_OPAQUE;
export const CHUNK_RENDER_ORDER_WATER = 1;
export const CHUNK_RENDER_ORDER_GLASS = 2;

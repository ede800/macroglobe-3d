// Build-time stand-ins for modules that react-globe.gl imports but MacroGlobe never executes:
//  - three/webgpu + three/tsl: WebGPU renderer and GPU-computed heatmaps (we render with WebGL, no heatmap layer)
//  - h3-js: hexbin / hexed-polygon layers (unused)
// Aliased in vite.config.ts; they save ~2 MB of raw JavaScript. Calling any of them fails loudly.

function unavailable(name: string): never {
  throw new Error(`${name} n'est pas inclus dans MacroGlobe 3D (fonctionnalité de react-globe.gl non utilisée).`);
}

// three/webgpu
export class WebGPURenderer {
  constructor() {
    unavailable('WebGPURenderer');
  }
}

export class StorageInstancedBufferAttribute {
  constructor() {
    unavailable('StorageInstancedBufferAttribute');
  }
}

// three/tsl (destructured inside three-globe's heatmap compute function only)
const tslFn = (name: string) => () => unavailable(`three/tsl ${name}`);
export const Fn = tslFn('Fn');
export const If = tslFn('If');
export const uniform = tslFn('uniform');
export const storage = tslFn('storage');
export const float = tslFn('float');
export const instanceIndex = tslFn('instanceIndex');
export const Loop = tslFn('Loop');
export const sqrt = tslFn('sqrt');
export const sin = tslFn('sin');
export const cos = tslFn('cos');
export const asin = tslFn('asin');
export const exp = tslFn('exp');
export const negate = tslFn('negate');

// h3-js
export const latLngToCell = tslFn('h3 latLngToCell');
export const cellToLatLng = tslFn('h3 cellToLatLng');
export const cellToBoundary = tslFn('h3 cellToBoundary');
export const polygonToCells = tslFn('h3 polygonToCells');

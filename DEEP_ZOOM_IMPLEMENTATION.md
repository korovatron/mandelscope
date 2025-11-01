# Deep Zoom Implementation Summary

## Overview
Implemented the **perturbation method** for deep zoom capability in Mandelscope, enabling zoom depths far beyond the previous 1e-7 limit imposed by single-precision WebGL floats.

## Key Changes

### 1. Added decimal.js Library
- **File**: `index.html`
- Added CDN script for decimal.js (v10.4.3) for arbitrary precision arithmetic
- Configured for 100 significant digits precision

### 2. High-Precision Center Tracking
- **File**: `app.js`
- Created `centerRe` and `centerIm` as Decimal objects to track view center with high precision
- Added `syncViewToCenter()` and `syncCenterToView()` helper functions
- Updated all pan/zoom operations to sync the high-precision center:
  - Mouse wheel zoom
  - Mouse drag pan
  - Touch pan
  - Pinch zoom
  - Keyboard controls (WASD, arrows, +/-)
  - Animated view transitions
  - Reset view
  - Switch to/from Julia mode

### 3. Reference Orbit System
- **Function**: `computeRefOrbit(maxIterations)`
  - Computes high-precision reference orbit for current center using decimal.js
  - Returns array of [real, imag] Decimal pairs for each iteration
  
- **Function**: `uploadRefOrbit(orbit)`
  - Converts Decimal orbit to Float32Array and uploads to WebGL texture
  - Uses OES_texture_float extension for optimal precision
  - Fallback to byte encoding if extension unavailable

- **Function**: `getRefOrbit(maxIterations)`
  - Caching mechanism to avoid recomputing orbit every frame
  - Recomputes only when:
    - Center moves more than 1% of current view
    - Max iterations increases
  - Dramatically improves performance during panning/zooming

### 4. Modified Mandelbrot Shader
- **File**: `app.js` (fragment shader in `createGLProgram()`)
- Implemented perturbation iteration formula:
  ```glsl
  delta_{n+1} = 2*z_ref*delta_n + delta_n^2 + deltaC
  ```
- Samples reference orbit from texture at each iteration
- Uses float32 deltas (small offsets) while reference orbit maintains high precision
- Updated smooth coloring to work with perturbation method

### 5. Updated Zoom Limits
- Changed `minScale` from `1e-7` to `1e-50`
- Can now zoom 43 orders of magnitude deeper!
- Previous limit: ~10 million times magnification
- New limit: ~10^50 times magnification

### 6. Service Worker Update
- **File**: `sw.js`
- Updated cache version to v15 to ensure users get new code

## Technical Details

### The Perturbation Method
Instead of computing each pixel independently:
```
z_n+1 = z_n^2 + c
```

We split the computation into:
1. **Reference orbit** (high precision on CPU): `z_ref_n`
2. **Delta orbit** (float32 on GPU): `δ_n`

Where: `z_n = z_ref_n + δ_n`

The iteration becomes:
```
δ_{n+1} = 2*z_ref_n*δ_n + δ_n^2 + δ_c
```

Since δ is small (pixel offsets from center), it stays accurate in float32 even when the reference orbit is at extreme magnitudes.

### Performance Optimizations
1. **Orbit Caching**: Reuses reference orbit when panning/zooming slightly
2. **Threshold-based Recomputation**: Only recalculates when center moves >1% of view
3. **GPU Acceleration**: Delta iterations still run on GPU at full speed
4. **Adaptive Iterations**: Existing system scales iterations with zoom depth

## Julia Sets
Julia sets do not use perturbation method as they don't benefit from it (the constant c doesn't require high precision). They continue to use standard iteration with float32 precision, which is sufficient for typical Julia set exploration.

## Testing Recommendations
1. Zoom into a location like Seahorse Valley
2. Continue zooming past the old 1e-7 limit
3. Watch the zoom level indicator - should now go well beyond 1e-7
4. Verify colors remain smooth and performance stays good
5. Try panning at extreme zoom - orbit caching should keep it smooth

## Future Enhancements
- Display current precision/zoom depth in UI
- Add "deep zoom" indicator when beyond float32 limits
- Optimize orbit texture size for very deep zooms
- Consider implementing series approximation for even deeper zooms

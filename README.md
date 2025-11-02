Mandelscope — Interactive Mandelbrot & Julia Set Explorer

A fractal visualiser featuring WebGL rendering, deep zoom capabilities using perturbation theory, and automatic iteration optimisation.

## Features

### Rendering Methods
- **Standard Mode** (zoom < 10⁻⁷): Direct GPU iteration for fast rendering
- **Deep Zoom Mode** (zoom ≥ 10⁻⁷): Perturbation method with arbitrary-precision arithmetic (Decimal.js)
  - Reaches zoom depths of 10⁻³⁸ and beyond
  - Automatic iteration optimisation targeting 92-99.5% orbit quality
  - Visual indicators for orbit quality and optimisation status

### Interactive Exploration
- **Mandelbrot Set**: Explore the main set with smooth zooming
- **Julia Sets**: View Julia sets for any point in the Mandelbrot set
- **Preset Locations**: Famous locations including Seahorse Valley, Elephant Valley, Mini Mandelbrot, and more
- **Save & Share**: Save custom locations and share via URL

### User Experience
- Smooth colour gradients with periodic wave colouring
- Touch-optimised for mobile and tablet devices
- Responsive UI with settings panel and information overlays
- Progressive Web App (PWA) support for offline use

## Files
- `index.html` — Application entry point with semantic HTML structure
- `styles.css` — Responsive UI styling with mobile optimisations
- `app.js` — Core renderer, WebGL shaders, perturbation method, and interaction handlers
- `sw.js` — Service worker for PWA functionality
- `manifest.json` — PWA manifest for installability

## How to Run

**Recommended**: Run a local server to avoid CORS issues with the service worker.

### Using PowerShell (in project folder):

```powershell
# Python 3 simple HTTP server
python -m http.server 8000
# Then open http://localhost:8000
```

Or with Node.js http-server:

```powershell
npx http-server -c-1 . -p 8000
```

Alternatively, open `index.html` directly in your browser (some PWA features may be unavailable).

## Controls

### Mouse
- **Left-click and drag**: Pan
- **Mouse wheel**: Zoom in/out centered at cursor
- **Double-click**: Zoom in
- **Right-click**: Context menu (save location, view Julia set, share)

### Touch (Mobile/Tablet)
- **Pinch**: Zoom
- **Double-tap**: Zoom in
- **Drag**: Pan
- **Long tap**: Context menu

### Keyboard
- **Arrow keys** or **WASD**: Pan
- **+/-**: Zoom in/out
- **R**: Reset view
- **Escape**: Return to title screen

## Deep Zoom Implementation

### Perturbation Theory
At zoom depths beyond 10⁻⁷, standard floating-point precision becomes insufficient. Mandelscope uses perturbation theory:

1. **Reference Orbit**: Calculate one high-precision orbit (100 significant digits) on the CPU using Decimal.js
2. **Delta Calculations**: For each pixel, compute small differences (deltas) from the reference orbit using GPU float32
3. **Orbit Composition**: Final orbit = reference_orbit + delta

This technique allows extreme zoom depths while maintaining smooth GPU performance.

### Automatic Iteration Optimisation
In deep zoom mode, the app automatically optimises the iteration count:

- **Three-phase search**: Coarse (40 samples) → Fine (steps of 5) → Ultra-fine (±50 range)
- **Target**: 92-99.5% orbit quality for optimal detail
- **Visual feedback**: Orange "⚙️ Optimising..." indicator
- **Manual override**: Slider always available for fine-tuning

### Orbit Quality
The orbit quality indicator shows how well the perturbation approximation is working:
- **90-100% (Green)**: Excellent - zoom away with confidence
- **60-89% (Amber)**: Acceptable - consider panning for better quality
- **<60% (Red)**: Poor - pan to black areas for better results

**Tip**: For best deep zoom results, center on black areas (points deep inside the set).

## Platform Differences

### Desktop
- Iteration range: 50-20,000
- Full coordinate display with arbitrary precision
- Reaches 10⁻³⁸ zoom depth with aggressive iteration scaling

### Mobile/Tablet
- Iteration range: 50-4,000 (conservative for smooth performance)
- Optimised for touch interactions
- Device pixel ratio capped at 2× for better performance

## Technical Stack

- **WebGL**: GPU-accelerated rendering with custom fragment shaders
- **Decimal.js**: 100-digit arbitrary-precision arithmetic
- **Perturbation Method**: Deep zoom via reference orbit + delta calculation
- **Progressive Web App**: Installable with offline support
- **Vanilla JavaScript**: No framework dependencies

## Browser Compatibility

- Chrome/Edge 90+ (recommended)
- Firefox 88+
- Safari 14+
- Mobile browsers with WebGL support

## Credits

Written by Neil Kendall, 2025
More at [www.korovatron.co.uk](https://www.korovatron.co.uk/)

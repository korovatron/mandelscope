Mandelscope — Mandelbrot explorer

Files
- index.html — app entry
- styles.css — simple UI
- app.js — renderer + interactions

How to run
- Easiest: open `index.html` in your browser (Chrome/Edge/Firefox). For full features/avoid CORS issues, run a simple local server.

Using PowerShell (in project folder):

```powershell
# run Python simple HTTP server (works with Python 3)
python -m http.server 8000; Start-Process "http://localhost:8000"
```

Or with Node.js http-server (if installed):

```powershell
npx http-server -c-1 . -p 8000; Start-Process "http://localhost:8000"
```

Controls
- Mouse wheel: zoom centered at cursor
- Drag: pan
- Shift + drag: draw zoom rectangle and release to zoom to rectangle
- Double-click: zoom in
- Slider: adjust max iterations
- Reset button: reset view

Notes and next steps
- The renderer is progressive (chunked by rows) to keep UI responsive.
- Future improvements: Web Worker rendering, smoother palette, arbitrary-precision zoom, performance optimizations.

(function(){
  // Title screen handling
  const titleScreen = document.getElementById('title-screen');
  const startBtn = document.getElementById('start-btn');
  const controlsBtn = document.getElementById('controls-btn');
  const controlsOverlay = document.getElementById('controls-overlay');
  const closeControlsBtn = document.getElementById('close-controls-btn');
  const titleLogoCanvas = document.getElementById('title-logo-canvas');
  
  // Load and draw title image with high-quality smoothing
  const titleImage = new Image();
  titleImage.src = 'titleImage.png';
  titleImage.onload = function(){
    const width = titleImage.width * 0.75;
    const height = titleImage.height * 0.75;
    
    titleLogoCanvas.width = width;
    titleLogoCanvas.height = height;
    titleLogoCanvas.style.width = width + 'px';
    titleLogoCanvas.style.height = height + 'px';
    
    const ctx = titleLogoCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(titleImage, 0, 0, width, height);
  };
  
  function dismissTitleScreen(){
    titleScreen.classList.add('hidden');
    setTimeout(() => {
      titleScreen.style.display = 'none';
    }, 300);
  }
  
  // Controls overlay handlers
  controlsBtn.addEventListener('click', function(){
    controlsOverlay.classList.remove('hidden');
  });
  
  closeControlsBtn.addEventListener('click', function(){
    controlsOverlay.classList.add('hidden');
  });
  
  // Click overlay background to close
  controlsOverlay.addEventListener('click', function(e){
    if(e.target === controlsOverlay){
      controlsOverlay.classList.add('hidden');
    }
  });
  
  // Click/tap button to start
  startBtn.addEventListener('click', dismissTitleScreen);
  
  // Space or Enter to start
  document.addEventListener('keydown', function onKeyDown(e){
    if(e.key === ' ' || e.key === 'Enter'){
      e.preventDefault();
      dismissTitleScreen();
      document.removeEventListener('keydown', onKeyDown);
    }
  });

  // Mandelbrot explorer with WebGL
  const canvasGL = document.getElementById('canvas-gl');
  let gl = null;
  try { gl = canvasGL.getContext('webgl') || canvasGL.getContext('webgl2'); } catch(e) { gl = null; }
  const iterSlider = document.getElementById('iter');
  const iterVal = document.getElementById('iterVal');
  const autoIterCheckbox = document.getElementById('auto-iter');
  const resetBtn = document.getElementById('reset');
  const backToMandelbrotBtn = document.getElementById('back-to-mandelbrot');
  const zoomLevelSpan = document.getElementById('zoom-level');
  const scaleValueSpan = document.getElementById('scale-value');
  const juliaInfo = document.getElementById('julia-info');
  const juliaCSpan = document.getElementById('julia-c');
  const contextMenu = document.getElementById('context-menu');
  const menuZoomRect = document.getElementById('menu-zoom-rect');
  const menuShowJulia = document.getElementById('menu-show-julia');
  const menuToggle = document.getElementById('menu-toggle');
  const settingsPanel = document.getElementById('settings-panel');

  // Detect GPU capabilities
  let hasDiscreteGPU = false;
  let gpuInfo = 'Unknown';
  if(gl){
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if(debugInfo){
      const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      gpuInfo = renderer;
      
      // Check if it's a discrete GPU vs integrated/software
      // Discrete: NVIDIA GeForce/RTX/GTX/Quadro, AMD Radeon RX/Vega (desktop), Intel Arc
      const isDiscreteGPU = /geforce|rtx|gtx|quadro|radeon rx|radeon pro|vega 56|vega 64|rx \d{3,4}|arc a\d{3}/i.test(renderer);
      const isSoftwareRenderer = /software|swiftshader|llvmpipe|mesa/i.test(renderer);
      const isIntegrated = /intel.*hd|intel.*uhd|vega \d{1,2}[^\d]|intel.*iris|radeon.*graphics/i.test(renderer);
      
      hasDiscreteGPU = isDiscreteGPU && !isSoftwareRenderer && !isIntegrated;
      
      console.log('GPU Detected:', renderer);
      console.log('Discrete GPU:', hasDiscreteGPU);
    }
  }

  // No UI controls needed

  // View parameters: keep center and scale (units per pixel)
  let view = {
    cx: -0.75,
    cy: 0,
    scale: 3.5 / 800 // default units per pixel (will be reset on resize)
  };

  // Zoom limits: maxScale is most zoomed out (large value), minScale is most zoomed in (small value)
  let maxScale = 0.01; // will be set properly on resize (prevent zooming out too far)
  const minScale = 1e-7; // WebGL single precision limit (~7 significant digits)

  let maxIter = Number(iterSlider.value);
  let isAutoIter = autoIterCheckbox.checked;
  iterVal.textContent = maxIter;

  // Julia set mode
  let isJuliaMode = false;
  let juliaC = {x: -0.7, y: 0.27}; // Default interesting Julia set

  // Calculate adaptive iteration count based on zoom level
  function calculateAdaptiveIter(){
    const zoomDepth = Math.log10(1 / view.scale);
    
    if(hasDiscreteGPU){
      // Powerful GPU: Start high, scale up aggressively to 2000
      // At scale 1e-2: ~500 iterations
      // At scale 1e-5: ~1250 iterations
      // At scale 1e-7: ~2000 iterations (maximum quality)
      const iter = Math.min(2000, Math.max(100, Math.floor(200 + zoomDepth * 250)));
      return iter;
    } else {
      // Integrated/Software GPU: Start lower, more conservative
      // At scale 1e-2: ~150 iterations
      // At scale 1e-7: ~400 iterations
      const iter = Math.min(2000, Math.max(50, Math.floor(50 + zoomDepth * 50)));
      return iter;
    }
  }

  // Update max iterations (either from slider or auto-calculated)
  function updateMaxIter(){
    if(isAutoIter){
      maxIter = calculateAdaptiveIter();
      iterSlider.value = maxIter;
      iterVal.textContent = maxIter;
      iterSlider.disabled = true;
    } else {
      maxIter = Number(iterSlider.value);
      iterVal.textContent = maxIter;
      iterSlider.disabled = false;
    }
  }

  // Update zoom level display
  function updateZoomDisplay(){
    // Calculate zoom magnification relative to initial scale
    const initialScale = maxScale; // maxScale is set to initial "fit all" scale
    const magnification = initialScale / view.scale;
    
    // Format zoom level
    let zoomText;
    if(magnification < 1000){
      zoomText = magnification.toFixed(1) + '×';
    } else if(magnification < 1e6){
      zoomText = (magnification / 1000).toFixed(1) + 'K×';
    } else if(magnification < 1e9){
      zoomText = (magnification / 1e6).toFixed(1) + 'M×';
    } else {
      zoomText = (magnification / 1e9).toFixed(1) + 'G×';
    }
    
    zoomLevelSpan.textContent = zoomText;
    
    // Format scale in scientific notation
    scaleValueSpan.textContent = view.scale.toExponential(2);
    
    // Show zoom info and set fade-out timer
    const zoomInfo = document.getElementById('zoom-info');
    zoomInfo.classList.remove('fade-out');
    
    // Clear existing timer
    if(updateZoomDisplay.fadeTimer){
      clearTimeout(updateZoomDisplay.fadeTimer);
    }
    
    // Fade out after 2.5 seconds of inactivity
    updateZoomDisplay.fadeTimer = setTimeout(function(){
      zoomInfo.classList.add('fade-out');
    }, 2500);
  }

  let devicePixelRatio = window.devicePixelRatio || 1;
  // Cap DPR at 2 on touch devices for better performance
  const isTouchDevice = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
  if(isTouchDevice) {
    devicePixelRatio = Math.min(devicePixelRatio, 2);
  }

  let rendering = false;
  let abortRender = false;

  let animating = false;
  let animStart = null;
  let animFrom = null;
  let animTo = null;

  // Touch handling
  let lastTap = 0;
  let lastTapPos = {x: 0, y: 0};
  let touchStart = null;
  let initialDistance = null;
  let initialScale = null;
  let lastPinchEnd = 0; // Track when pinch ended to prevent accidental pan

  function animateView(targetCx, targetCy, targetScale, duration = 300){
    if(animating) return; // or cancel previous?
    animating = true;
    animStart = performance.now();
    animFrom = {cx: view.cx, cy: view.cy, scale: view.scale};
    animTo = {cx: targetCx, cy: targetCy, scale: targetScale};
    function step(now){
      const elapsed = now - animStart;
      const t = Math.min(elapsed / duration, 1);
      // ease in out
      const easeT = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      view.cx = animFrom.cx + (animTo.cx - animFrom.cx) * easeT;
      view.cy = animFrom.cy + (animTo.cy - animFrom.cy) * easeT;
      view.scale = animFrom.scale + (animTo.scale - animFrom.scale) * easeT;
      updateMaxIter(); // Update iterations during animation
      updateZoomDisplay(); // Update zoom level display
      requestRender();
      if(t < 1){
        requestAnimationFrame(step);
      } else {
        animating = false;
      }
    }
    requestAnimationFrame(step);
  }

  function resetView(){
    if(isJuliaMode){
      // Julia sets are centered at origin with smaller initial view
      view.cx = 0;
      view.cy = 0;
      view.scale = Math.max(4.0 / canvasGL.width, 4.0 / canvasGL.height);
    } else {
      // Mandelbrot set centered at -0.75, 0
      view.cx = -0.75;
      view.cy = 0;
      view.scale = Math.max(3.5 / canvasGL.width, 2.5 / canvasGL.height);
    }
    maxScale = view.scale; // Update maximum scale to current "fit all" scale
    updateMaxIter();
    updateZoomDisplay();
    requestRender();
  }

  // Resize canvas to fill parent and set scale (called initially and on DPR changes)
  function resize(){
    // re-evaluate devicePixelRatio in case window moved between screens or zoom changed
    devicePixelRatio = window.devicePixelRatio || 1;
    // Cap DPR at 2 on touch devices for better performance
    if(isTouchDevice) {
      devicePixelRatio = Math.min(devicePixelRatio, 2);
    }

    console.log('resize() called. dpr=', devicePixelRatio);

    const availW = window.innerWidth;
    const availH = window.innerHeight;

    // Mandelbrot aspect: real 3.5, imag 2, ratio 1.75
    const mandelbrotAspect = 3.5 / 2;

    // set canvas size to match window for full coverage and dynamic resolution
    canvasGL.width = Math.floor(availW * devicePixelRatio);
    canvasGL.height = Math.floor(availH * devicePixelRatio);
    canvasGL.style.width = availW + 'px';
    canvasGL.style.height = availH + 'px';
    canvasGL.style.left = '0px';
    canvasGL.style.top = '0px';

    // adjust view.scale so the entire Mandelbrot set fits the canvas
    if(!resize._initialized){
      // store baseScale for human-friendly magnification display
      resize.baseScale = view.scale;
      resize._initialized = true;
    }

    resetView();
  }

  // Redraw on resize and other environment changes
  // Maintain Mandelbrot aspect ratio (3.5:2) with letterboxing, scale bitmap during resize
  function onResizeImmediate(){
    devicePixelRatio = window.devicePixelRatio || 1;
    // Cap DPR at 2 on touch devices for better performance
    if(isTouchDevice) {
      devicePixelRatio = Math.min(devicePixelRatio, 2);
    }

    const availW = window.innerWidth;
    const availH = window.innerHeight;

    // Mandelbrot aspect: real 3.5, imag 2, ratio 1.75
    const mandelbrotAspect = 3.5 / 2;

    // update CSS sizes for full window coverage
    canvasGL.style.width = availW + 'px';
    canvasGL.style.height = availH + 'px';
    canvasGL.style.left = '0px';
    canvasGL.style.top = '0px';

    // debounce the device size update and render
    if(onResizeImmediate._t) clearTimeout(onResizeImmediate._t);
    onResizeImmediate._t = setTimeout(()=>{ resize(); }, 200);
  }

  window.addEventListener('resize', onResizeImmediate);
  window.addEventListener('orientationchange', onResizeImmediate);
  window.addEventListener('fullscreenchange', onResizeImmediate);

  // Watch for DPR changes via matchMedia (fires when devicePixelRatio changes)
  let dprMql = null;
  function watchDPR(){
    try{
      if(dprMql) dprMql.removeEventListener('change', onDprChange);
      dprMql = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      dprMql.addEventListener('change', onDprChange);
    }catch(e){
      // matchMedia with resolution may not be supported; fall back to polling
      if(watchDPR._poll) return;
      watchDPR._poll = setInterval(()=>{
        if(window.devicePixelRatio !== devicePixelRatio){
          resize();
        }
      }, 500);
    }
  }
  function onDprChange(){
    resize();
    // re-register to watch the new DPR value
    watchDPR();
  }

  watchDPR();
  resize();

  // Mapping pixel -> complex
  function pixelToComplex(px, py){
    // Note: screen Y increases downward; map screen Y to complex plane with Y increasing upward
    const cx = view.cx + (px - canvasGL.width / 2) * view.scale;
    const cy = view.cy - (py - canvasGL.height / 2) * view.scale;
    return {x: cx, y: cy};
  }

  function complexToPixel(x, y){
    const px = (x - view.cx) / view.scale + canvasGL.width / 2;
    // invert Y mapping to convert complex Y back to screen Y (device pixels)
    const py = (view.cy - y) / view.scale + canvasGL.height / 2;
    return {px, py};
  }

  // Escape-time algorithm
  function mandelbrot(cx, cy, maxIter){
    let x = 0, y = 0, xx = 0, yy = 0;
    let iter = 0;
    while (xx + yy <= 4 && iter < maxIter) {
      y = 2 * x * y + cy;
      x = xx - yy + cx;
      xx = x * x;
      yy = y * y;
      iter++;
    }
    if (iter === maxIter) return maxIter;
    // smooth iteration count
    const log_zn = Math.log(xx + yy) / 2;
    const nu = Math.log(log_zn / Math.log(2)) / Math.log(2);
    return iter + 1 - (nu || 0);
  }

  // Color mapping from normalized iteration
  function colorForIter(iter, maxIter){
    if (iter >= maxIter) return [0,0,0];
    const t = iter / maxIter;
    // hue cycle and contrast boost
    const hue = 360 * (0.95 + 10 * t) % 360;
    const sat = 1.0;
    const light = 0.5 + 0.45 * (1 - Math.exp(-1 * t));
    return hsvToRgb(hue, sat, light);
  }

  function hsvToRgb(h, s, v){
    h = ((h % 360) + 360) % 360;
    const c = v * s;
    const hh = h / 60;
    const x = c * (1 - Math.abs(hh % 2 - 1));
    let r=0,g=0,b=0;
    if (hh >= 0 && hh < 1){ r=c; g=x; b=0 }
    else if (hh < 2){ r=x; g=c; b=0 }
    else if (hh < 3){ r=0; g=c; b=x }
    else if (hh < 4){ r=0; g=x; b=c }
    else if (hh < 5){ r=x; g=0; b=c }
    else { r=c; g=0; b=x }
    const m = v - c;
    return [Math.round((r + m)*255), Math.round((g + m)*255), Math.round((b + m)*255)];
  }

  // Progressive renderer (chunked by rows)
  // Two rendering paths: WebGL (fast) and Worker (CPU fallback)
  // WebGL renderer: fragment shader computes color per pixel
  // Helper to split a double into high and low 32-bit floats (Veltkamp-Dekker splitting)
  // Use var here to avoid temporal-dead-zone errors when calling render synchronously during startup/resize
  var glProgram = null;
  var glProgramJulia = null;
  
  function createGLProgram(){
    if(!gl) return null;
  const vs = `
  attribute vec2 a_pos;
  varying vec2 v_pos;
  void main(){ v_pos = a_pos; gl_Position = vec4(a_pos,0.0,1.0); }`;
    const fs = `#ifdef GL_ES
    precision highp float;
    #endif
    varying vec2 v_pos;
    uniform vec2 u_center;
    uniform float u_scale;
    uniform int u_iter;
    uniform vec2 u_resolution;

    // hsv to rgb
    vec3 hsv2rgb(float h, float s, float v){
      float c = v * s;
      float hp = mod(h/60.0,6.0);
      float x = c * (1.0 - abs(mod(hp,2.0)-1.0));
      vec3 rgb;
      if(hp < 1.0) rgb = vec3(c,x,0.0);
      else if(hp < 2.0) rgb = vec3(x,c,0.0);
      else if(hp < 3.0) rgb = vec3(0.0,c,x);
      else if(hp < 4.0) rgb = vec3(0.0,x,c);
      else if(hp < 5.0) rgb = vec3(x,0.0,c);
      else rgb = vec3(c,0.0,x);
      float m = v - c;
      return rgb + vec3(m);
    }

    void main(){
      // map gl coords (-1..1) to pixel coords
      vec2 uv = (v_pos * 0.5 + 0.5) * u_resolution;
      float x0 = u_center.x + (uv.x - u_resolution.x * 0.5) * u_scale;
      float y0 = u_center.y + (uv.y - u_resolution.y * 0.5) * u_scale;
      float x = 0.0; float y = 0.0; float xx = 0.0; float yy = 0.0;
      const int MAX_ITERS = 2000;
      int iter = u_iter;
      for(int i = 0; i < MAX_ITERS; i++){
        if(i >= u_iter) break;
        y = 2.0*x*y + y0;
        x = xx - yy + x0;
        xx = x*x; yy = y*y;
        if(xx + yy > 4.0){ iter = i; break; }
      }
      if(iter == u_iter){ gl_FragColor = vec4(0.0,0.0,0.0,1.0); return; }
      float it = float(iter);
      // smooth iteration
      float log_zn = log(xx+yy)/2.0;
      float nu = log(log_zn / log(2.0))/log(2.0);
      it = it + 1.0 - nu;
      
      // Periodic wave coloring that scales with max iterations
      float bands = float(u_iter) / 50.0; // number of color bands scales with iterations
      float wave = mod(it / bands, 2.0);
      float t = (wave < 1.0) ? wave : (2.0 - wave);
      t = pow(t, 0.7);
      
      float hue = mod(240.0 + it * 3.0, 360.0);
      float sat = 0.85 + 0.15 * t;
      float light = 0.3 + 0.5 * t;
      vec3 col = hsv2rgb(hue, sat, light);
      gl_FragColor = vec4(col,1.0);
    }`;

    function compile(src, type){
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      const ok = gl.getShaderParameter(s, gl.COMPILE_STATUS);
      if(!ok){
        const log = gl.getShaderInfoLog(s);
        console.error('Shader compile error:', log);
        gl.deleteShader(s);
        return null;
      }
      return s;
    }
    const vsS = compile(vs, gl.VERTEX_SHADER);
    const fsS = compile(fs, gl.FRAGMENT_SHADER);
    if(!vsS || !fsS) return null;
    const prog = gl.createProgram(); gl.attachShader(prog, vsS); gl.attachShader(prog, fsS);
    gl.bindAttribLocation(prog, 0, 'a_pos');
    gl.linkProgram(prog);
    if(!gl.getProgramParameter(prog, gl.LINK_STATUS)){ console.error(gl.getProgramInfoLog(prog)); return null; }
    return prog;
  }

  function createGLProgramJulia(){
    if(!gl) return null;
    const vs = `
  attribute vec2 a_pos;
  varying vec2 v_pos;
  void main(){ v_pos = a_pos; gl_Position = vec4(a_pos,0.0,1.0); }`;
    const fsJulia = `#ifdef GL_ES
    precision highp float;
    #endif
    varying vec2 v_pos;
    uniform vec2 u_center;
    uniform float u_scale;
    uniform int u_iter;
    uniform vec2 u_resolution;
    uniform vec2 u_juliaC;

    // hsv to rgb
    vec3 hsv2rgb(float h, float s, float v){
      float c = v * s;
      float hp = mod(h/60.0,6.0);
      float x = c * (1.0 - abs(mod(hp,2.0)-1.0));
      vec3 rgb;
      if(hp < 1.0) rgb = vec3(c,x,0.0);
      else if(hp < 2.0) rgb = vec3(x,c,0.0);
      else if(hp < 3.0) rgb = vec3(0.0,c,x);
      else if(hp < 4.0) rgb = vec3(0.0,x,c);
      else if(hp < 5.0) rgb = vec3(x,0.0,c);
      else rgb = vec3(c,0.0,x);
      float m = v - c;
      return rgb + vec3(m);
    }

    void main(){
      // map gl coords (-1..1) to pixel coords
      vec2 uv = (v_pos * 0.5 + 0.5) * u_resolution;
      // Julia: z starts at pixel, c is constant
      float x = u_center.x + (uv.x - u_resolution.x * 0.5) * u_scale;
      float y = u_center.y + (uv.y - u_resolution.y * 0.5) * u_scale;
      float xx = x*x; float yy = y*y;
      const int MAX_ITERS = 2000;
      int iter = u_iter;
      for(int i = 0; i < MAX_ITERS; i++){
        if(i >= u_iter) break;
        y = 2.0*x*y + u_juliaC.y;
        x = xx - yy + u_juliaC.x;
        xx = x*x; yy = y*y;
        if(xx + yy > 4.0){ iter = i; break; }
      }
      if(iter == u_iter){ gl_FragColor = vec4(0.0,0.0,0.0,1.0); return; }
      float it = float(iter);
      // smooth iteration
      float log_zn = log(xx+yy)/2.0;
      float nu = log(log_zn / log(2.0))/log(2.0);
      it = it + 1.0 - nu;
      
      // Periodic wave coloring that scales with max iterations
      float bands = float(u_iter) / 50.0; // number of color bands scales with iterations
      float wave = mod(it / bands, 2.0);
      float t = (wave < 1.0) ? wave : (2.0 - wave);
      t = pow(t, 0.7);
      
      float hue = mod(240.0 + it * 3.0, 360.0);
      float sat = 0.85 + 0.15 * t;
      float light = 0.3 + 0.5 * t;
      vec3 col = hsv2rgb(hue, sat, light);
      gl_FragColor = vec4(col,1.0);
    }`;

    function compile(src, type){
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      const ok = gl.getShaderParameter(s, gl.COMPILE_STATUS);
      if(!ok){
        const log = gl.getShaderInfoLog(s);
        console.error('Shader compile error:', log);
        gl.deleteShader(s);
        return null;
      }
      return s;
    }
    const vsS = compile(vs, gl.VERTEX_SHADER);
    const fsS = compile(fsJulia, gl.FRAGMENT_SHADER);
    if(!vsS || !fsS) return null;
    const prog = gl.createProgram(); gl.attachShader(prog, vsS); gl.attachShader(prog, fsS);
    gl.bindAttribLocation(prog, 0, 'a_pos');
    gl.linkProgram(prog);
    if(!gl.getProgramParameter(prog, gl.LINK_STATUS)){ console.error(gl.getProgramInfoLog(prog)); return null; }
    return prog;
  }

  function glRender(){
    if(!gl) return false;
    
    // Choose program based on mode
    let program;
    if(isJuliaMode){
      program = glProgramJulia || (glProgramJulia = createGLProgramJulia());
    } else {
      program = glProgram || (glProgram = createGLProgram());
    }
    
    if(!program){
      console.warn('WebGL program not available');
      return false;
    }
    
    // show gl canvas
    canvasGL.style.zIndex = 1; canvasGL.style.display = 'block';

    gl.viewport(0,0,canvasGL.width, canvasGL.height);
    gl.useProgram(program);
    
    // quad
    const posBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    const verts = new Float32Array([-1,-1, 1,-1, -1,1, 1,1]);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);

    // Set shader uniforms
    const u_center = gl.getUniformLocation(program, 'u_center');
    const u_scale = gl.getUniformLocation(program, 'u_scale');
    const u_iter = gl.getUniformLocation(program, 'u_iter');
    const u_resolution = gl.getUniformLocation(program, 'u_resolution');

    gl.uniform2f(u_center, view.cx, view.cy);
    gl.uniform1f(u_scale, view.scale);
    gl.uniform1i(u_iter, maxIter);
    gl.uniform2f(u_resolution, canvasGL.width, canvasGL.height);

    // Julia mode needs the c parameter
    if(isJuliaMode){
      const u_juliaC = gl.getUniformLocation(program, 'u_juliaC');
      gl.uniform2f(u_juliaC, juliaC.x, juliaC.y);
    }
    
    // clear first for a deterministic visual baseline
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    // ensure commands are flushed and check for GL errors
    try{ gl.flush(); }catch(e){ console.warn('gl.flush() threw', e); }
    const glErr = gl.getError ? gl.getError() : -1;
    if(typeof glErr !== 'undefined' && glErr !== gl.NO_ERROR){ console.error('WebGL error after drawArrays:', glErr); }
    
    return true;
  }

  async function render(){
    glRender();
    updateZoomDisplay();
  }

  function requestRender(){
    // tiny debounce to avoid spamming
    if(requestRender._t) clearTimeout(requestRender._t);
    requestRender._t = setTimeout(()=>{ render(); }, 10);
  }

  // Interaction: zoom with wheel
  // add wheel/pointer listeners to the canvas
  function getClientPos(e, canvasElem){
    const rect = canvasElem.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * devicePixelRatio;
    const my = (e.clientY - rect.top) * devicePixelRatio;
    return {mx,my,rect};
  }

  canvasGL.addEventListener('wheel', function(e){
    e.preventDefault();
    const {mx,my} = getClientPos(e, canvasGL);
    const before = pixelToComplex(mx, my);

  // Normalize: positive deltaY means wheel down; make wheel down zoom out
  const delta = e.deltaY;
  const zoomFactor = Math.exp(delta * 0.0015);
    view.scale *= zoomFactor;
    // Clamp scale to prevent zooming out too far or in too deep
    view.scale = Math.max(minScale, Math.min(maxScale, view.scale));

    const after = pixelToComplex(mx, my);
    // adjust center so the point under cursor stays fixed
    view.cx += before.x - after.x;
    view.cy += before.y - after.y;

    updateMaxIter(); // Update iterations when zooming
    updateZoomDisplay(); // Update zoom level display
    requestRender();
  }, {passive:false});
  

  // Drag to pan, right-click drag to draw zoom rectangle
  let isDragging = false;
  let dragStart = null;
  let lastMouse = null;
  let zoomRect = null;

  canvasGL.addEventListener('contextmenu', e => e.preventDefault());

  // Helper to start zoom rectangle
  function startZoomRect(mx_css, my_css){
    const rect = canvasGL.getBoundingClientRect();
    isDragging = true;
    dragStart = {x: mx_css, y: my_css};
    lastMouse = {x: mx_css, y: my_css};
    
    zoomRect = document.createElement('div');
    zoomRect.className = 'zoom-rect';
    zoomRect.style.position = 'absolute';
    zoomRect.style.zIndex = '9999';
    zoomRect.style.border = '2px dashed #8af';
    zoomRect.style.background = 'rgba(138,170,255,0.06)';
    zoomRect.style.pointerEvents = 'none';
    const cssX = dragStart.x + rect.left;
    const cssY = dragStart.y + rect.top;
    zoomRect.style.left = cssX + 'px';
    zoomRect.style.top = cssY + 'px';
    zoomRect.style.width = '0px';
    zoomRect.style.height = '0px';
    document.body.appendChild(zoomRect);
  }

  canvasGL.addEventListener('mousedown', function(e){
    // If zoom rect is active, don't interfere - any click will complete it on mouseup
    if(zoomRect) return;
    
    if(e.button !== 0 && e.button !== 2) return;
    const rect = canvasGL.getBoundingClientRect();
    const mx_css = (e.clientX - rect.left);
    const my_css = (e.clientY - rect.top);
    
    if(e.button === 0){
      // Left click - pan
      isDragging = true;
      dragStart = {x: mx_css, y: my_css};
      lastMouse = {x: mx_css, y: my_css};
    }
    // Right click handled by contextmenu event
  });

  // Right-click context menu
  canvasGL.addEventListener('contextmenu', function(e){
    e.preventDefault();
    hideContextMenu();
    
    const rect = canvasGL.getBoundingClientRect();
    const mx_css = (e.clientX - rect.left);
    const my_css = (e.clientY - rect.top);
    const mx = mx_css * devicePixelRatio;
    const my = my_css * devicePixelRatio;
    const complex = pixelToComplex(mx, my);
    
    // Show context menu at click position
    const menuX = e.clientX;
    const menuY = e.clientY;
    
    showContextMenu(menuX, menuY, complex.x, complex.y, mx_css, my_css);
  });

  window.addEventListener('mousemove', function(e){
    if(!isDragging) return;
    // use whichever canvas is visible for rect
    const rect = canvasGL.getBoundingClientRect();
    const mx_css = (e.clientX - rect.left);
    const my_css = (e.clientY - rect.top);

    if(zoomRect){
      // clamp to canvas bounds and convert to CSS px
      const xStart = Math.min(dragStart.x, mx_css);
      const xEnd = Math.max(dragStart.x, mx_css);
      const yStart = Math.min(dragStart.y, my_css);
      const yEnd = Math.max(dragStart.y, my_css);
      const cssLeft = xStart + rect.left;
      const cssTop = yStart + rect.top;
      const cssW = Math.max(1, (xEnd - xStart));
      const cssH = Math.max(1, (yEnd - yStart));
      zoomRect.style.left = cssLeft + 'px';
      zoomRect.style.top = cssTop + 'px';
      zoomRect.style.width = cssW + 'px';
      zoomRect.style.height = cssH + 'px';
    } else {
      // pan
      const dx_css = mx_css - lastMouse.x;
      const dy_css = my_css - lastMouse.y;
      const dx = dx_css * devicePixelRatio;
      const dy = dy_css * devicePixelRatio;
      // horizontal pan: move center opposite to pointer movement
      view.cx -= dx * view.scale;
      // vertical pan: update so dragging down moves the image down (natural feel)
      view.cy += dy * view.scale;
      lastMouse = {x: mx_css, y: my_css};
      requestRender();
    }
  });

  window.addEventListener('mouseup', function(e){
    if(!isDragging) return;
    isDragging = false;
    const rect = canvasGL.getBoundingClientRect();
    const mx_css = (e.clientX - rect.left);
    const my_css = (e.clientY - rect.top);
    const mx = mx_css * devicePixelRatio;
    const my = my_css * devicePixelRatio;
    if(zoomRect){
  // compute new view to match rectangle (use device pixels)
  let x1 = Math.min(dragStart.x, mx);
  let x2 = Math.max(dragStart.x, mx);
  let y1 = Math.min(dragStart.y, my);
  let y2 = Math.max(dragStart.y, my);
  // clamp to canvas bounds (device pixels)
  x1 = Math.max(0, Math.min(x1, canvasGL.width));
  x2 = Math.max(0, Math.min(x2, canvasGL.width));
  y1 = Math.max(0, Math.min(y1, canvasGL.height));
  y2 = Math.max(0, Math.min(y2, canvasGL.height));
      // prevent very small rectangles
      if(Math.abs(x2 - x1) > 6 && Math.abs(y2 - y1) > 6){
        // new center is rectangle center (device pixels)
        const cx_px = (x1 + x2) / 2;
        const cy_px = (y1 + y2) / 2;
        const centerComplex = pixelToComplex(cx_px, cy_px);

        // compute new scale so the rectangle fills the canvas in the larger dimension
  const rectW = (x2 - x1); // device pixels
  const rectH = (y2 - y1);
  // avoid division by zero
  const cw = canvasGL.width || 1;
  const ch = canvasGL.height || 1;
  // compute scaleFactor according to selected mode: 'fit' (show whole rect) or 'fill' (rect fills viewport)
  const mode = (typeof modeSelect !== 'undefined' && modeSelect.value) ? modeSelect.value : 'fit';
  const scaleFactor = (mode === 'fill') ? Math.max(rectW / cw, rectH / ch) : Math.min(rectW / cw, rectH / ch);
  let newScale = view.scale * scaleFactor;
  // Clamp to zoom limits
  newScale = Math.max(minScale, Math.min(maxScale, newScale));
        console.log('Zoom-rect -> rectW,rectH,cw,ch,oldScale,newScale:', rectW, rectH, cw, ch, view.scale, newScale);
        // Animate to the new view
        animateView(centerComplex.x, centerComplex.y, newScale);
      }
      zoomRect.remove();
      zoomRect = null;
    }
  });

  // Double-click to zoom in with animation
  canvasGL.addEventListener('dblclick', function(e){
    const rect = canvasGL.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * devicePixelRatio;
    const my = (e.clientY - rect.top) * devicePixelRatio;
    const complex = pixelToComplex(mx, my);
    let newScale = view.scale * 0.5;
    // Clamp to zoom limits
    newScale = Math.max(minScale, Math.min(maxScale, newScale));
    // Only animate if scale actually changes (prevents pan-only when at zoom limit)
    // Use relative threshold for deep zooms
    if(Math.abs(newScale - view.scale) > view.scale * 0.001){
      animateView(complex.x, complex.y, newScale);
    }
  });

  // Touch events for mobile
  // Long press support for touch
  let longPressTimer = null;
  let longPressPos = null;

  canvasGL.addEventListener('touchstart', function(e){
    e.preventDefault();
    const touches = e.touches;
    if(touches.length === 1){
      // Single touch: start pan
      const rect = canvasGL.getBoundingClientRect();
      const tx = touches[0].clientX - rect.left;
      const ty = touches[0].clientY - rect.top;
      touchStart = {x: tx, y: ty};
      
      // Start long press timer
      const mx = tx * devicePixelRatio;
      const my = ty * devicePixelRatio;
      const complex = pixelToComplex(mx, my);
      longPressPos = {x: touches[0].clientX, y: touches[0].clientY, cx: complex.x, cy: complex.y, mx_css: tx, my_css: ty};
      longPressTimer = setTimeout(function(){
        // Long press detected - show context menu (only in Mandelbrot mode)
        if(longPressPos && !isJuliaMode){
          showContextMenu(longPressPos.x, longPressPos.y, longPressPos.cx, longPressPos.cy, longPressPos.mx_css, longPressPos.my_css);
          touchStart = null; // Cancel pan
        }
      }, 500); // 500ms long press
      
      // Check for double tap
      const now = Date.now();
      if(now - lastTap < 300 && Math.abs(tx - lastTapPos.x) < 30 && Math.abs(ty - lastTapPos.y) < 30){
        // Double tap
        clearTimeout(longPressTimer); // Cancel long press
        longPressTimer = null;
        const complex = pixelToComplex(mx, my);
        let newScale = view.scale * 0.5;
        // Clamp to zoom limits
        newScale = Math.max(minScale, Math.min(maxScale, newScale));
        // Only animate if scale actually changes (prevents pan-only when at zoom limit)
        // Use relative threshold for deep zooms
        if(Math.abs(newScale - view.scale) > view.scale * 0.001){
          animateView(complex.x, complex.y, newScale);
        }
        lastTap = 0; // reset
      } else {
        lastTap = now;
        lastTapPos = {x: tx, y: ty};
      }
    } else if(touches.length === 2){
      // Cancel long press on multi-touch
      if(longPressTimer){
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
      // Two touches: start pinch
      const rect = canvasGL.getBoundingClientRect();
      const t1 = touches[0], t2 = touches[1];
      const dx = t1.clientX - t2.clientX;
      const dy = t1.clientY - t2.clientY;
      initialDistance = Math.sqrt(dx*dx + dy*dy);
      initialScale = view.scale;
      // Center of pinch (not used for pan)
      const cx = (t1.clientX + t2.clientX) / 2 - rect.left;
      const cy = (t1.clientY + t2.clientY) / 2 - rect.top;
      touchStart = {x: cx * devicePixelRatio, y: cy * devicePixelRatio};
    }
  }, {passive: false});

  canvasGL.addEventListener('touchmove', function(e){
    e.preventDefault();
    // Cancel long press if finger moves
    if(longPressTimer){
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    const touches = e.touches;
    if(touches.length === 1 && touchStart){
      // Pan - but only if we're not right after a pinch gesture
      const now = Date.now();
      if(now - lastPinchEnd > 100){
        const rect = canvasGL.getBoundingClientRect();
        const tx = touches[0].clientX - rect.left;
        const ty = touches[0].clientY - rect.top;
        const dx = (tx - touchStart.x) * devicePixelRatio;
        const dy = (ty - touchStart.y) * devicePixelRatio;
        view.cx -= dx * view.scale;
        view.cy += dy * view.scale;
        touchStart = {x: tx, y: ty};
        requestRender();
      }
    } else if(touches.length === 2 && initialDistance && touchStart){
      // Pinch zoom: keep the point between fingers fixed
      const t1 = touches[0], t2 = touches[1];
      const dx = t1.clientX - t2.clientX;
      const dy = t1.clientY - t2.clientY;
      const distance = Math.sqrt(dx*dx + dy*dy);
      
      // Calculate new scale
      const scaleFactor = distance / initialDistance;
      let newScale = initialScale / scaleFactor;
      // Clamp scale to prevent zooming out too far or in too deep
      newScale = Math.max(minScale, Math.min(maxScale, newScale));
      
      // Get complex coordinates at pinch center BEFORE scale change
      const beforeComplex = pixelToComplex(touchStart.x, touchStart.y);
      
      // Update scale
      view.scale = newScale;
      
      // Get complex coordinates at same pixel position AFTER scale change
      const afterComplex = pixelToComplex(touchStart.x, touchStart.y);
      
      // Adjust view center to compensate (keep pinch point fixed)
      view.cx += beforeComplex.x - afterComplex.x;
      view.cy += beforeComplex.y - afterComplex.y;
      
      updateMaxIter(); // Update iterations when pinch zooming
      updateZoomDisplay(); // Update zoom level display
      requestRender();
    }
  }, {passive: false});

  canvasGL.addEventListener('touchend', function(e){
    e.preventDefault();
    // Cancel long press timer
    if(longPressTimer){
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    // Track when a pinch gesture ends
    if(e.touches.length < 2 && initialDistance !== null){
      lastPinchEnd = Date.now();
      initialDistance = null;
      initialScale = null;
    }
    if(e.touches.length === 1){
      // One finger remains after pinch - reset touchStart to that finger's position
      const rect = canvasGL.getBoundingClientRect();
      touchStart = {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    } else if(e.touches.length === 0){
      touchStart = null;
      initialDistance = null;
      initialScale = null;
    }
  }, {passive: false});

  // UI controls
  autoIterCheckbox.addEventListener('change', function(){
    isAutoIter = autoIterCheckbox.checked;
    updateMaxIter();
    requestRender();
  });

  iterSlider.addEventListener('input', function(){
    if(!isAutoIter){
      maxIter = Number(iterSlider.value);
      iterVal.textContent = maxIter;
      requestRender();
    }
  });

  resetBtn.addEventListener('click', function(){
    resetView();
  });

  // Settings menu toggle
  menuToggle.addEventListener('click', function(){
    settingsPanel.classList.toggle('hidden');
    menuToggle.classList.toggle('active');
  });

  // Close settings panel when clicking outside
  document.addEventListener('click', function(e){
    if(!settingsPanel.contains(e.target) && !menuToggle.contains(e.target)){
      settingsPanel.classList.add('hidden');
      menuToggle.classList.remove('active');
    }
  });

  // Mode toggle
  function switchToJulia(cx, cy){
    juliaC.x = cx;
    juliaC.y = cy;
    isJuliaMode = true;
    juliaInfo.classList.remove('hidden');
    backToMandelbrotBtn.classList.remove('hidden');
    updateJuliaDisplay();
    resetView();
    requestRender();
  }

  function switchToMandelbrot(){
    isJuliaMode = false;
    juliaInfo.classList.add('hidden');
    backToMandelbrotBtn.classList.add('hidden');
    resetView();
    requestRender();
  }

  function updateJuliaDisplay(){
    const real = juliaC.x.toFixed(4);
    const imag = juliaC.y.toFixed(4);
    const sign = juliaC.y >= 0 ? '+' : '';
    juliaCSpan.textContent = `${real} ${sign} ${imag}i`;
  }

  // Back to Mandelbrot button
  backToMandelbrotBtn.addEventListener('click', switchToMandelbrot);

  // Context menu state
  let contextMenuPos = {x: 0, y: 0, cx: 0, cy: 0, mx_css: 0, my_css: 0};

  function showContextMenu(x, y, cx, cy, mx_css, my_css){
    contextMenuPos = {x, y, cx, cy, mx_css, my_css};
    
    // Show/hide menu items based on mode and device
    const isTouchOnly = isTouchDevice && !window.matchMedia('(pointer: fine)').matches;
    if(isTouchOnly){
      // Touch device: only show Julia option, hide zoom rect
      menuZoomRect.style.display = 'none';
      menuShowJulia.style.display = 'block';
    } else if(isJuliaMode){
      // Julia mode: only show zoom rect, hide Julia option
      menuShowJulia.style.display = 'none';
      menuZoomRect.style.display = 'block';
    } else {
      // Mandelbrot mode on desktop: show both
      menuShowJulia.style.display = 'block';
      menuZoomRect.style.display = 'block';
    }
    
    contextMenu.classList.remove('hidden');
    
    // Position menu so cursor is over the center of the first menu item
    // Menu is ~180px wide, ~40px per item tall
    // Offset to center: left by ~90px (half width), up by ~20px (half item height + menu padding)
    contextMenu.style.left = (x - 18) + 'px';
    contextMenu.style.top = (y - 70) + 'px';
  }

  function hideContextMenu(){
    contextMenu.classList.add('hidden');
  }

  // Hide context menu when clicking elsewhere
  document.addEventListener('click', function(e){
    if(!contextMenu.contains(e.target)){
      hideContextMenu();
    }
  });

  // Context menu actions
  menuZoomRect.addEventListener('click', function(){
    hideContextMenu();
    // Start zoom rect at the saved canvas-relative position
    startZoomRect(contextMenuPos.mx_css, contextMenuPos.my_css);
  });

  menuShowJulia.addEventListener('click', function(){
    hideContextMenu();
    if(!isJuliaMode){
      switchToJulia(contextMenuPos.cx, contextMenuPos.cy);
    }
  });

  // Helpers
  function debounce(fn, t){
    let id = null; return (...a)=>{ if(id) clearTimeout(id); id = setTimeout(()=>fn(...a), t); };
  }

  // Initialize adaptive iterations and zoom display
  updateMaxIter();
  updateZoomDisplay();
  updateJuliaDisplay();

  // initial render
  requestRender();

})();

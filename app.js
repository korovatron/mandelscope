(function(){
  // Debug overlay logging
  const debugStartTime = Date.now();
  let debugEventCount = 0;
  
  function logDebug(label) {
    const elapsed = Date.now() - debugStartTime;
    debugEventCount++;
    
    setTimeout(() => {
      const debugTime = document.getElementById('debug-time');
      const debugWindow = document.getElementById('debug-window');
      const debugVhVar = document.getElementById('debug-vh-var');
      const debugCanvasCss = document.getElementById('debug-canvas-css');
      const debugBody = document.getElementById('debug-body');
      const debugSafeTop = document.getElementById('debug-safe-top');
      const debugSafeBot = document.getElementById('debug-safe-bot');
      const debugEvents = document.getElementById('debug-events');
      
      const isPWA = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
      
      if(debugTime) debugTime.textContent = elapsed + 'ms [' + label + ']';
      if(debugWindow) debugWindow.textContent = window.innerWidth + 'x' + window.innerHeight;
      
      const debugScreen = document.getElementById('debug-screen');
      const debugDiff = document.getElementById('debug-diff');
      const debugPwa = document.getElementById('debug-pwa');
      
      if(debugScreen && window.screen) debugScreen.textContent = window.screen.width + 'x' + window.screen.height;
      if(debugDiff && window.screen) debugDiff.textContent = (window.screen.height - window.innerHeight) + 'px';
      if(debugPwa) debugPwa.textContent = isPWA ? 'YES' : 'NO';
      
      if(debugVhVar) debugVhVar.textContent = getComputedStyle(document.documentElement).getPropertyValue('--actual-vh');
      if(debugBody) debugBody.textContent = document.body.offsetWidth + 'x' + document.body.offsetHeight;
      if(debugSafeTop) debugSafeTop.textContent = getComputedStyle(document.documentElement).getPropertyValue('--safe-area-top') || '0px';
      if(debugSafeBot) debugSafeBot.textContent = getComputedStyle(document.documentElement).getPropertyValue('--safe-area-bottom') || '0px';
      if(debugEvents) debugEvents.textContent = debugEventCount;
      
      const canvas = document.getElementById('canvas-gl');
      if(canvas && debugCanvasCss) {
        debugCanvasCss.textContent = canvas.style.width + ' x ' + canvas.style.height;
      }
      
      const debugCanvasSize = document.getElementById('debug-canvas-size');
      if(canvas && debugCanvasSize) {
        debugCanvasSize.textContent = canvas.width + 'x' + canvas.height;
      }
    }, 0);
  }
  
  // Comprehensive fix for iOS PWA viewport height and safe area inset race conditions
  let lastKnownHeight = 0;
  
  function setActualVH(){
    // Force layout recalculation to ensure CSS changes are applied
    document.body.offsetHeight;
    
    // iOS PWA bug: window.innerHeight excludes safe areas on initial load
    // Try visualViewport first (more reliable), fallback to innerHeight
    let viewportHeight = window.innerHeight;
    if(window.visualViewport && window.visualViewport.height) {
      viewportHeight = window.visualViewport.height;
    }
    
    // iOS PWA bug workaround: iOS sometimes incorrectly subtracts safe-area-top from innerHeight
    // Detect this and manually compensate by adding it back
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                  window.navigator.standalone === true;
    
    if(isPWA && window.screen && window.screen.height) {
      const difference = window.screen.height - viewportHeight;
      // In PWA mode, detect iOS bug where safe-area-top is incorrectly subtracted from innerHeight
      // iPhone: diff ~59px, iPad Pro: diff ~32px, Normal: diff should be ~0-5px
      // Use threshold of 15px to catch both iPhone and iPad cases without false positives
      if(difference > 15) {
        // Try to get safe-area-top from CSS
        const computedStyle = getComputedStyle(document.documentElement);
        const safeTop = computedStyle.getPropertyValue('--safe-area-top');
        const safeTopPx = parseInt(safeTop) || 0;
        
        if(safeTopPx > 0) {
          logDebug('compensate');
          viewportHeight += safeTopPx;
          // Set compensation status in debug overlay
          setTimeout(() => {
            const debugComp = document.getElementById('debug-comp');
            if(debugComp) debugComp.textContent = 'YES +' + safeTopPx + 'px';
          }, 0);
        }
      }
    }
    
    const vh = viewportHeight * 0.01;
    document.documentElement.style.setProperty('--actual-vh', `${viewportHeight}px`);
    
    // Detect if height changed significantly (iOS finally calculated safe areas correctly)
    if(lastKnownHeight > 0 && Math.abs(viewportHeight - lastKnownHeight) > 30) {
      // Height changed significantly - trigger resize to update canvas
      logDebug('heightChange');
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 50);
    }
    
    lastKnownHeight = viewportHeight;
    logDebug('setVH');
  }
  
  // Initial calculation
  setActualVH();
  
  // Multiple delayed recalculations to catch iOS safe area insets whenever they become available
  // iOS may not have calculated safe areas immediately on load
  // Extended delays as iOS can report incorrect innerHeight initially (873 vs 932 in testing)
  setTimeout(setActualVH, 50);
  setTimeout(setActualVH, 150);
  setTimeout(setActualVH, 300);
  setTimeout(setActualVH, 500);
  setTimeout(setActualVH, 800);
  setTimeout(setActualVH, 1200);
  
  // Force layout recalculation after viewport settles (fixes iOS WebGL bottom border issue)
  // Trigger a resize event to force canvas to recalculate dimensions with proper viewport height
  setTimeout(() => {
    logDebug('resizeEvt');
    window.dispatchEvent(new Event('resize'));
  }, 1300);
  
  // Standard event listeners
  window.addEventListener('resize', setActualVH);
  window.addEventListener('orientationchange', setActualVH);
  
  // visualViewport API for better PWA support (more reliable than window resize on iOS)
  if(window.visualViewport){
    window.visualViewport.addEventListener('resize', setActualVH);
  }
  
  // Handle app switching / visibility changes (catches cases when returning to app)
  document.addEventListener('visibilitychange', function(){
    if(!document.hidden){
      setActualVH();
      setTimeout(setActualVH, 50);
    }
  });

  // Register service worker for PWA
  if('serviceWorker' in navigator){
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('Service Worker registered:', reg))
        .catch(err => console.log('Service Worker registration failed:', err));
    });
  }

  // Title screen handling
  const titleScreen = document.getElementById('title-screen');
  const startBtn = document.getElementById('start-btn');
  const titleLogoCanvas = document.getElementById('title-logo-canvas');
  let appStarted = false; // Flag to prevent rendering before title screen dismissal
  const controlsOverlay = document.getElementById('controls-overlay');
  const closeControlsBtn = document.getElementById('close-controls-btn');
  const showControlsBtn = document.getElementById('show-controls-btn');
  const implementationOverlay = document.getElementById('implementation-overlay');
  const closeImplementationBtn = document.getElementById('close-implementation-btn');
  const showImplementationBtn = document.getElementById('show-implementation-btn');
  
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
    appStarted = true; // Enable rendering
    
    // Force viewport recalculation when app actually starts
    // iOS may still have incorrect innerHeight at this point
    logDebug('appStart');
    setActualVH();
    setTimeout(() => {
      setActualVH();
      setTimeout(() => {
        logDebug('appStartResize');
        window.dispatchEvent(new Event('resize'));
      }, 100);
    }, 100);
    
    // Always start in Mandelbrot mode
    if(isJuliaMode){
      isJuliaMode = false;
      juliaInfo.classList.add('hidden');
      backToMandelbrotBtn.classList.add('hidden');
    }
    
    // Show Julia Set button in Mandelbrot mode
    juliaSetButtonWrap.classList.remove('hidden');
    
    // Start from extremely zoomed out view (practically invisible)
    view.cx = -0.75;
    view.cy = 0;
    view.scale = Math.min(maxScale, Math.max(50.0 / canvasGL.width, 50.0 / canvasGL.height));
    syncViewToCenter();
    updateMaxIter();
    updateZoomDisplay();
    
    // Hide title screen
    titleScreen.classList.add('hidden');
    setTimeout(() => {
      titleScreen.style.display = 'none';
    }, 300);
    
    // Start animation immediately - the animation will handle rendering
    const targetScale = Math.min(maxScale, Math.max(3.5 / canvasGL.width, 2.5 / canvasGL.height));
    animateView(-0.75, 0, targetScale, 1500); // 1.5 second smooth zoom
  }
  
  // Controls overlay handlers
  showControlsBtn.addEventListener('click', function(){
    controlsOverlay.classList.remove('hidden');
    // Close settings panel
    settingsPanel.classList.add('hidden');
    menuToggle.classList.remove('active');
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

  // Implementation overlay handlers
  showImplementationBtn.addEventListener('click', function(){
    implementationOverlay.classList.remove('hidden');
    // Close settings panel
    settingsPanel.classList.add('hidden');
    menuToggle.classList.remove('active');
  });
  
  closeImplementationBtn.addEventListener('click', function(){
    implementationOverlay.classList.add('hidden');
  });
  
  // Click overlay background to close
  implementationOverlay.addEventListener('click', function(e){
    if(e.target === implementationOverlay){
      implementationOverlay.classList.add('hidden');
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
  const returnToTitleBtn = document.getElementById('return-to-title');
  const backToMandelbrotBtn = document.getElementById('back-to-mandelbrot');
  const zoomLevelSpan = document.getElementById('zoom-level');
  const scaleValueSpan = document.getElementById('scale-value');
  const juliaInfo = document.getElementById('julia-info');
  const contextMenu = document.getElementById('context-menu');
  const menuShowJulia = document.getElementById('menu-show-julia');
  const menuShareLocation = document.getElementById('menu-share-location');
  const menuToggle = document.getElementById('menu-toggle');
  const settingsPanel = document.getElementById('settings-panel');
  const orbitQualityInfo = document.getElementById('orbit-quality-info');
  const orbitQualityValue = document.getElementById('orbit-quality-value');
  const optimizationStatus = document.getElementById('optimization-status');
  const coordDisplaySetting = document.getElementById('coord-display-setting');
  const coordValuePanel = document.getElementById('coord-value-panel');
  const juliaSetButtonWrap = document.getElementById('julia-set-button-wrap');
  const showJuliaBtn = document.getElementById('show-julia-btn');

  // Deep Zoom Modal
  const deepZoomModal = document.getElementById('deep-zoom-modal');
  const deepZoomOkBtn = document.getElementById('deep-zoom-ok-btn');
  
  function showDeepZoomModal(){
    deepZoomModal.classList.remove('hidden');
  }
  
  function hideDeepZoomModal(){
    deepZoomModal.classList.add('hidden');
  }
  
  deepZoomOkBtn.addEventListener('click', hideDeepZoomModal);

  // Detect mobile/tablet devices
  const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                         (navigator.maxTouchPoints && navigator.maxTouchPoints > 2);

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
      console.log('Mobile Device:', isMobileDevice);
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
  let maxScale = 8e-2; // Maximum zoom out level (0.08)
  const minScale = 1e-50; // Deep zoom limit with perturbation method (Mandelbrot only)
  const minScaleJulia = 1e-7; // Julia set limit (no perturbation available)
  const deepZoomThreshold = 1e-7; // Switch to perturbation method below this scale
  let useDeepZoom = false; // Track if we're in deep zoom mode
  let hasShownDeepZoomWarning = false; // Show warning only once per session
  
  // Get current minimum scale based on mode
  function getMinScale(){
    return isJuliaMode ? minScaleJulia : minScale;
  }

  let maxIter = Number(iterSlider.value);
  let isAutoIter = autoIterCheckbox.checked;
  iterVal.textContent = maxIter;

  // Julia set mode
  let isJuliaMode = false;
  let juliaC = {x: -0.7, y: 0.27}; // Default interesting Julia set
  let savedMandelbrotView = null; // Save Mandelbrot view when switching to Julia

  // Deep Zoom (Perturbation Method) Infrastructure
  // High-precision center using decimal.js
  const Decimal = window.Decimal;
  Decimal.set({ precision: 100 }); // 100 significant digits
  let centerRe = new Decimal(-0.75);
  let centerIm = new Decimal(0);
  
  // Reference orbit caching for smooth panning/zooming
  let cachedOrbit = null;
  let cachedCenterRe = centerRe;
  let cachedCenterIm = centerIm;
  let cachedScale = view.scale;
  let lastOrbitQuality = null; // Track orbit quality for automatic iteration adjustment
  let isOptimizingIterations = false; // Prevent recursive optimization
  let optimizedIterValue = null; // Store optimizer's result to preserve during zoom
  let justLoadedSavedLocation = false; // Flag to prevent auto-optimization right after loading saved location
  let justCompletedZoomAnimation = false; // Flag to prevent auto-optimization right after zoom animation
  
  // Reference orbit texture for GPU
  let refOrbitTexture = null;
  
  // Compute high-precision reference orbit for perturbation method
  function computeRefOrbit(maxIterations){
    let zr = new Decimal(0), zi = new Decimal(0);
    const orbit = [];
    for(let i = 0; i < maxIterations; i++){
      orbit.push([zr, zi]);
      const zr2 = zr.mul(zr).sub(zi.mul(zi)).add(centerRe);
      const zi2 = zr.mul(zi).mul(2).add(centerIm);
      zr = zr2; zi = zi2;
      if(zr.mul(zr).add(zi.mul(zi)).gt(4)) break;
    }
    return orbit;
  }
  
  // Get WebGL maximum texture size (cached)
  let maxTextureSize = null;
  function getMaxTextureSize(){
    if(maxTextureSize === null && gl){
      maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      console.log(`📏 WebGL MAX_TEXTURE_SIZE: ${maxTextureSize}`);
    }
    return maxTextureSize || 16384;
  }

  // Upload reference orbit to GPU texture
  function uploadRefOrbit(orbit){
    if(!gl) return 0;
    
    // Use actual WebGL texture size limit
    const MAX_TEXTURE_SIZE = getMaxTextureSize();
    const len = Math.min(orbit.length, MAX_TEXTURE_SIZE);
    
    if(orbit.length > MAX_TEXTURE_SIZE){
      console.warn(`⚠️ Reference orbit truncated: ${orbit.length} → ${MAX_TEXTURE_SIZE} (WebGL texture size limit)`);
    }
    
    const data = new Float32Array(len * 4);
    for(let i = 0; i < len; i++){
      data[4*i] = parseFloat(orbit[i][0].toString());
      data[4*i+1] = parseFloat(orbit[i][1].toString());
      data[4*i+2] = 0.0;
      data[4*i+3] = 0.0;
    }
    
    if(!refOrbitTexture){
      refOrbitTexture = gl.createTexture();
    }
    gl.bindTexture(gl.TEXTURE_2D, refOrbitTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    
    // Check if OES_texture_float extension is available
    const extFloat = gl.getExtension('OES_texture_float');
    if(extFloat){
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, len, 1, 0, gl.RGBA, gl.FLOAT, data);
    } else {
      // Fallback: encode as RGBA bytes (less precise but compatible)
      console.warn('OES_texture_float not available, using byte encoding');
      const byteData = new Uint8Array(len * 4);
      for(let i = 0; i < len * 4; i++){
        byteData[i] = Math.floor((data[i] + 2) * 63.75); // Simple encoding
      }
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, len, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, byteData);
    }
    
    return len;
  }
  
  // Get or compute cached reference orbit
  function getRefOrbit(maxIterations){
    // Check if we need to recompute orbit
    const deltaRe = centerRe.sub(cachedCenterRe).abs();
    const deltaIm = centerIm.sub(cachedCenterIm).abs();
    
    // At extreme zoom, use much tighter threshold to avoid artifacts during panning
    // At e-20 zoom, 0.1% of view is still meaningful
    const thresholdPercent = view.scale < 1e-15 ? 0.001 : 0.01; // 0.1% for extreme zoom, 1% for normal
    const threshold = new Decimal(view.scale).mul(thresholdPercent);
    
    // Also recompute if scale changed significantly or max iterations increased
    const scaleRatio = cachedScale > 0 ? Math.abs(Math.log(view.scale / cachedScale)) : Infinity;
    const needsRecompute = !cachedOrbit || 
                          deltaRe.gt(threshold) || 
                          deltaIm.gt(threshold) || 
                          scaleRatio > 0.1 || // Recompute if scale changed by >10%
                          maxIterations > cachedOrbit.length;
    
    if(needsRecompute){
      cachedOrbit = computeRefOrbit(maxIterations);
      cachedCenterRe = centerRe;
      cachedCenterIm = centerIm;
      cachedScale = view.scale;
    }
    
    return cachedOrbit;
  }

  // Helper: Check orbit tail stability (detects chaotic behavior)
  function checkOrbitStability(orbit, logDetails = false){
    if(orbit.length < 10) return 1.0; // Too short to analyze
    
    // CRITICAL: computeRefOrbit() pushes values BEFORE iterating, then breaks on escape
    // So orbit.length IS the escape point - all values in the array have mag ≤ 2.0
    // The orbit "escaped" if it broke early (length < maxIterations tested)
    
    // Check stability of the last 10 values (these are all pre-escape by definition)
    const tailLength = Math.min(10, orbit.length);
    const tail = orbit.slice(-tailLength);
    
    // Calculate maximum delta between consecutive tail values
    let maxDelta = 0;
    for(let i = 1; i < tail.length; i++){
      const deltaRe = Math.abs(tail[i][0].minus(tail[i-1][0]).toNumber());
      const deltaIm = Math.abs(tail[i][1].minus(tail[i-1][1]).toNumber());
      const delta = Math.sqrt(deltaRe * deltaRe + deltaIm * deltaIm);
      maxDelta = Math.max(maxDelta, delta);
    }
    
    // Get last value magnitude to determine if near escape
    const lastVal = orbit[orbit.length - 1];
    const lastMag = Math.sqrt(
      lastVal[0].mul(lastVal[0]).add(lastVal[1].mul(lastVal[1])).toNumber()
    );
    
    // Diagnostic logging
    if(logDetails){
      console.log(`   📐 Orbit length: ${orbit.length}, Last mag: ${lastMag.toFixed(2)}, Max delta: ${maxDelta.toFixed(2)}`);
    }
    
    // CRITICAL: If orbit is growing (mag > 1.0), use relaxed thresholds
    // Once |z| > 1, values grow exponentially - larger deltas are expected, not "unstable"
    const isNearEscape = lastMag > 1.0;
    
    if(isNearEscape){
      // Escaping or near-escaping orbits can have larger deltas - that's expected exponential growth
      if(maxDelta > 10.0) return 0.0; // Extremely chaotic
      if(maxDelta > 5.0) return 0.5; // Moderately chaotic
      return 1.0; // Normal escape behavior
    } else {
      // Deep-in-set orbits should be stable
      if(maxDelta > 2.0) return 0.0; // Extremely unstable
      if(maxDelta > 1.0) return 0.5; // Moderately unstable
      return 1.0; // Stable
    }
  }

  // Optimize maxIter to achieve best orbit quality (100% if possible)
  function optimizeIterations(){
    if(isOptimizingIterations || !useDeepZoom) return;
    
    isOptimizingIterations = true;
    const optimizationStartTime = Date.now();
    
    // Show optimization status indicator
    if(optimizationStatus){
      optimizationStatus.classList.remove('hidden');
    }
    
    console.log('🔍 Optimizing iterations for best orbit quality...');
    
    // Run optimization asynchronously to avoid blocking interaction
    setTimeout(() => {
      const currentIter = maxIter;
      let bestIter = currentIter;
      let bestQuality = 0;
      let bestStability = 0;
      let minEscapeAt100Percent = Infinity;  // Track lowest escape point when quality = 100%
      let maxEscapeAt100Percent = 0;  // Track highest escape point when quality = 100%
    
    // Phase 0: Quick check - is the orbit escaping early?
    // If current quality is low, we need to search DOWNWARD, not upward
    const currentOrbit = computeRefOrbit(currentIter);
    const currentQuality = currentOrbit.length / currentIter;
    
    console.log(`📊 Initial orbit quality: ${(currentQuality*100).toFixed(1)}% (${currentOrbit.length}/${currentIter})`);
    
    // Phase 1: Coarse search over wide range
    // Allow searching down to 50 iterations minimum (for deep-in-set locations)
    // Use slider max as limit (allows going beyond texture size for extreme zoom)
    const MAX_ITER_LIMIT = parseInt(iterSlider.max);
    
    // Smart search range: if orbit escapes early (quality < 50%), focus search BELOW current value
    let minIter, maxIterSearch;
    let earlyEscapeMode = false; // Track if we're in early escape mode
    if(currentQuality < 0.5){
      // Orbit escaping early - search from just above escape point to current value
      const escapePoint = currentOrbit.length;
      minIter = Math.max(50, Math.floor(escapePoint * 0.8));
      maxIterSearch = Math.min(currentIter, Math.floor(escapePoint * 1.5));
      earlyEscapeMode = true;
      console.log(`🎯 Early escape detected - focusing search near escape point (${escapePoint})`);
    } else {
      // Normal case - search wider range around current value
      minIter = Math.max(50, Math.floor(currentIter * 0.2));
      maxIterSearch = Math.min(MAX_ITER_LIMIT, Math.floor(currentIter * 3));
    }
    
    const coarseStep = Math.max(10, Math.floor((maxIterSearch - minIter) / 40));
    
    console.log(`Phase 1: Coarse search ${minIter} to ${maxIterSearch} (step ${coarseStep})`);
    console.log(`Current escape point: ${currentOrbit.length} iterations`);
    
    // Store coarse search results for later analysis
    const coarseResults = [];
    
    for(let testIter = minIter; testIter <= maxIterSearch; testIter += coarseStep){
      const orbit = computeRefOrbit(testIter);
      let quality = orbit.length / testIter;
      
      // Check orbit stability (with detailed logging for iterations near escape point)
      const currentEscapePoint = currentOrbit.length;
      const isNearEscape = Math.abs(testIter - currentEscapePoint) < 20;
      const stability = checkOrbitStability(orbit, isNearEscape);
      
      // Log every test value for debugging
      console.log(`  Testing ${testIter}: escape=${orbit.length}, quality=${(quality*100).toFixed(1)}%, stability=${(stability*100).toFixed(0)}%`);
      
      // Store result for later analysis
      coarseResults.push({
        iter: testIter,
        escapePoint: orbit.length,
        quality: quality,
        stability: stability
      });
      
      // Track minimum and maximum escape points when we see 100% quality
      // (Multiple values can all have 100% quality - we want the range)
      if(quality >= 0.999){
        minEscapeAt100Percent = Math.min(minEscapeAt100Percent, orbit.length);
        maxEscapeAt100Percent = Math.max(maxEscapeAt100Percent, orbit.length);
      }
      
      // Penalize unstable orbits
      if(stability < 1.0){
        quality *= (0.5 + stability * 0.5); // Reduce quality by up to 50%
        if(stability < 0.5){
          console.log(`⚠️  Unstable orbit at ${testIter} iter (stability: ${stability.toFixed(2)})`);
          if(isNearEscape) checkOrbitStability(orbit, true); // Log details for near-escape values
        }
      }
      
      // KEY INSIGHT: We want max_iterations to be CLOSE TO the escape point
      // - If testIter = escapePoint → quality 100% (orbit escapes exactly at max)
      // - If testIter > escapePoint → quality <100% (we're allowing extra iterations)
      // 
      // GOAL: Find testIter where quality is in range 92-99.5%
      // Prefer values with HIGHER quality (closer to 99.5%) over lower quality
      const escapePoint = orbit.length;
      
      // We want quality in the sweet spot (92-99.5%)
      // Within that range, prefer higher quality (orbit escapes closer to max_iterations)
      if(quality >= 0.92 && quality <= 0.995){
        // In the sweet spot - prefer higher quality within the range
        if(bestQuality === 0 || quality > bestQuality){
          bestQuality = quality;
          bestIter = testIter;
          bestStability = stability;
        }
      } else if(bestQuality === 0){
        // Haven't found anything in sweet spot yet - take the value with quality closest to 0.95
        const targetQuality = 0.95;
        const currentDist = Math.abs(quality - targetQuality);
        const bestDist = Math.abs(bestQuality - targetQuality);
        if(quality <= 1.0 && currentDist < bestDist){
          bestQuality = quality;
          bestIter = testIter;
          bestStability = stability;
        }
      }
    }
    
    // If we found multiple 100% quality values (common deep in set),
    // test which direction (lower vs upper bound) gives better actual rendering quality
    if(maxEscapeAt100Percent > 0 && minEscapeAt100Percent < Infinity && maxEscapeAt100Percent > minEscapeAt100Percent){
      const range = maxEscapeAt100Percent - minEscapeAt100Percent;
      
      // Test a point near the lower bound and upper bound to see which direction is better
      const testLower = Math.round(minEscapeAt100Percent + range * 0.2);
      const testUpper = Math.round(maxEscapeAt100Percent - range * 0.2);
      
      // Compute actual orbit quality at these test points (not just escape quality)
      // We need to actually render and measure orbit quality
      const orbitLower = computeRefOrbit(testLower);
      const orbitUpper = computeRefOrbit(testUpper);
      
      // Calculate actual render quality by checking how many pixels would have valid orbits
      // For now, use escape point as a proxy: closer to the test value = better quality
      const qualityLower = orbitLower.length / testLower;
      const qualityUpper = orbitUpper.length / testUpper;
      
      console.log(`🔍 Testing direction: lower=${testLower} (${(qualityLower*100).toFixed(1)}%) vs upper=${testUpper} (${(qualityUpper*100).toFixed(1)}%)`);
      
      let preferredIter;
      // If both are still 100%, prefer the upper bound (more iterations = more detail visible)
      // If one is lower quality, prefer the one that's closer to 100%
      if(qualityLower >= 0.999 && qualityUpper >= 0.999){
        // Both still 100% - but optimal value might be just beyond our tested range
        // Check if there's a value just above maxEscapeAt100Percent that still gives 100%
        // Look for the first test in coarse search that dropped below 100% quality
        let firstDropIter = null;
        let firstDropEscape = null;
        
        // Scan through coarse search results to find where quality first dropped
        for(let i = 0; i < coarseResults.length; i++){
          if(coarseResults[i].quality < 0.999){
            firstDropIter = coarseResults[i].iter;
            firstDropEscape = coarseResults[i].escapePoint;
            break;
          }
        }
        
        // If we found a drop, and the escape point is close to the test iterations,
        // that escape point might be the sweet spot (orbit escapes right at max iterations)
        if(firstDropEscape && firstDropEscape > maxEscapeAt100Percent && 
           firstDropEscape < firstDropIter && 
           (firstDropEscape / firstDropIter) >= 0.95){
          // The escape point from the first degraded test might be optimal
          // Test it to confirm
          const orbitAtEscape = computeRefOrbit(firstDropEscape);
          const qualityAtEscape = orbitAtEscape.length / firstDropEscape;
          
          if(qualityAtEscape >= 0.999){
            preferredIter = firstDropEscape;
            console.log(`📍 Found sweet spot at escape point ${firstDropEscape} (just beyond 100% range, before quality drops at ${firstDropIter})`);
          } else {
            // Didn't work, use upper bound
            preferredIter = maxEscapeAt100Percent;
            console.log(`📍 Both directions show 100% quality, using upper bound ${preferredIter} for maximum detail`);
          }
        } else {
          // No nearby drop point, use upper bound
          preferredIter = maxEscapeAt100Percent;
          console.log(`📍 Both directions show 100% quality, using upper bound ${preferredIter} for maximum detail`);
        }
      } else if(qualityLower < qualityUpper){
        // Upper is better quality
        preferredIter = maxEscapeAt100Percent;
        console.log(`📍 Upper bound gives better quality, using ${preferredIter}`);
      } else {
        // Lower is better quality (or equal)
        preferredIter = minEscapeAt100Percent;
        console.log(`📍 Lower bound gives better quality, using ${preferredIter}`);
      }
      
      bestIter = preferredIter;
      bestQuality = 1.0;
      bestStability = 1.0; // Assume stable since we found 100% quality
    }
    
    console.log(`Phase 1 result: ${bestIter} iterations (${(bestQuality*100).toFixed(1)}% quality, ${(bestStability*100).toFixed(0)}% stability)`);
    
    // SPECIAL CASE: Still 100% quality at upper bound - need to search higher
    // This happens when we're deep inside the set and need many more iterations
    if(bestQuality >= 0.999 && bestIter >= maxIterSearch * 0.95){
      console.log(`⚠️  Still 100% quality at upper search bound (${bestIter}) - extending search...`);
      
      // Extend search up to 10x current value or MAX_ITER_LIMIT
      const extendedMax = Math.min(MAX_ITER_LIMIT, bestIter * 10);
      const extendedStep = Math.max(50, Math.floor((extendedMax - bestIter) / 40));
      
      console.log(`Phase 1b: Extended search ${bestIter} to ${extendedMax} (step ${extendedStep})`);
      
      let foundEscape = false;
      for(let testIter = bestIter + extendedStep; testIter <= extendedMax; testIter += extendedStep){
        const orbit = computeRefOrbit(testIter);
        const quality = orbit.length / testIter;
        
        console.log(`  Testing ${testIter}: escape=${orbit.length}, quality=${(quality*100).toFixed(1)}%`);
        
        // Stop when we find quality dropping below 100% (orbit starting to escape)
        if(quality < 0.999){
          // Found the transition point - use this value
          bestIter = testIter;
          bestQuality = quality;
          bestStability = checkOrbitStability(orbit, false);
          foundEscape = true;
          console.log(`✓ Found escape point at ${testIter} iterations (${(quality*100).toFixed(1)}% quality)`);
          break;
        } else if(quality >= 0.92 && quality <= 0.995){
          // Found sweet spot
          bestIter = testIter;
          bestQuality = quality;
          bestStability = checkOrbitStability(orbit, false);
          foundEscape = true;
          console.log(`✓ Found sweet spot at ${testIter} iterations (${(quality*100).toFixed(1)}% quality)`);
          break;
        }
      }
      
      if(!foundEscape){
        // Still 100% at extended max - use that value
        bestIter = extendedMax;
        console.log(`⚠️  Still 100% at ${extendedMax} - using maximum available`);
      }
    }
    
    // SPECIAL CASE: Deep inside the set (orbit never escapes)
    // If we found 100% quality in early escape mode AND the orbit escapes very early
    // compared to current iterations, we're viewing the set from deep inside
    // The orbit escaping at (say) 217 means we need ~300-600 iterations for detail, not 3000+
    // BUT: Skip this if we already found a good 100% quality range (detected by having both min and max bounds)
    const foundQualityRange = (maxEscapeAt100Percent > 0 && minEscapeAt100Percent < Infinity && maxEscapeAt100Percent > minEscapeAt100Percent);
    if(earlyEscapeMode && bestQuality >= 0.999 && currentOrbit.length < 500 && currentIter > 1000 && !foundQualityRange){
      console.log(`⚠️  Deep-in-set view detected: orbit escapes at ${currentOrbit.length}, current iterations ${currentIter}`);
      console.log(`🔍 Searching for optimal detail range...`);
      
      // Start from a bit above the escape point and search upward
      const searchStart = Math.max(Math.floor(currentOrbit.length * 1.5), 300);
      const searchMax = Math.min(MAX_ITER_LIMIT, Math.max(2000, currentIter));
      const searchStep = Math.max(20, Math.floor((searchMax - searchStart) / 40));
      
      let foundDetail = false;
      
      for(let testIter = searchStart; testIter <= searchMax; testIter += searchStep){
        const orbit = computeRefOrbit(testIter);
        const quality = orbit.length / testIter;
        
        // Look for quality in the 20-70% range (orbit escapes but shows layered detail)
        if(quality >= 0.20 && quality <= 0.70){
          bestIter = testIter;
          bestQuality = quality;
          foundDetail = true;
          console.log(`✓ Found detail at ${testIter} iterations (${(quality*100).toFixed(1)}% quality)`);
          break;
        }
      }
      
      if(!foundDetail){
        // Use a reasonable multiple of the escape point
        bestIter = Math.floor(currentOrbit.length * 3);
        const testOrbit = computeRefOrbit(bestIter);
        bestQuality = testOrbit.length / bestIter;
        console.log(`⚠️  Using ${bestIter} iterations (3× escape point, ${(bestQuality*100).toFixed(1)}% quality)`);
      }
    }
    
    // Phase 2: Fine search around the best value found
    // Search both below (to find highest escaping value) and above (in case we're too low)
    if(bestQuality < 0.999){
      const fineMin = Math.max(50, bestIter - coarseStep);
      const fineMax = Math.min(MAX_ITER_LIMIT, bestIter + coarseStep);
      // Use smaller step for better precision (was /10, now /30)
      const fineStep = Math.max(1, Math.floor(coarseStep / 30));
      
      console.log(`Phase 2: Fine search ${fineMin} to ${fineMax} (step ${fineStep})`);
      
      let allValuesComplete = true; // Track if ALL values show 100% quality
      let phase2BestQuality = 0;
      let phase2BestIter = bestIter;
      
      for(let testIter = fineMin; testIter <= fineMax; testIter += fineStep){
        const orbit = computeRefOrbit(testIter);
        let quality = orbit.length / testIter;
        
        // Check orbit stability (no detailed logging by default)
        const stability = checkOrbitStability(orbit, false);
        
        // Track if any value has orbit that doesn't complete
        if(quality < 1.0) allValuesComplete = false;
        
        // Penalize unstable orbits
        if(stability < 1.0){
          quality *= (0.5 + stability * 0.5);
        }
        
        // CRITICAL: Prefer values in the 92-99.5% sweet spot
        // Don't replace a good value (92-99.5%) with 100% quality!
        const inSweetSpot = quality >= 0.92 && quality <= 0.995;
        const currentInSweetSpot = bestQuality >= 0.92 && bestQuality <= 0.995;
        
        if(inSweetSpot){
          // Value in sweet spot - prefer higher quality within range
          if(!currentInSweetSpot || quality > bestQuality){
            bestQuality = quality;
            bestIter = testIter;
            bestStability = stability;
            phase2BestQuality = quality;
            phase2BestIter = testIter;
          }
        } else if(!currentInSweetSpot && quality <= 1.0 && quality > bestQuality){
          // Only update if current value isn't already in sweet spot
          bestQuality = quality;
          bestIter = testIter;
          bestStability = stability;
          phase2BestQuality = quality;
          phase2BestIter = testIter;
        }
        
        // If we found very close to 100% quality (but not over), stop searching
        if(quality >= 0.98 && quality < 0.999) break;
      }
      
      // CRITICAL: If ALL Phase 2 values show 100% quality, we're searching TOO LOW
      // The actual escape point must be much higher - keep original value
      if(allValuesComplete){
        console.log(`⚠️  Phase 2: All values complete without escaping - keeping current ${currentIter} iterations`);
        bestIter = currentIter;
        bestQuality = currentOrbit.length / currentIter;
        bestStability = 0.5;
      }
    }
    
    // Phase 3: Ultra-fine search if we're close but not optimal (95-99%)
    if(bestQuality >= 0.95 && bestQuality < 0.99){
      const ultraFineMin = Math.max(50, bestIter - 50);
      const ultraFineMax = Math.min(MAX_ITER_LIMIT, bestIter + 50);
      
      console.log(`Phase 3: Ultra-fine search ${ultraFineMin} to ${ultraFineMax} (step 5)`);
      
      for(let testIter = ultraFineMin; testIter <= ultraFineMax; testIter += 5){
        const orbit = computeRefOrbit(testIter);
        let quality = orbit.length / testIter;
        
        // Check orbit stability
        const stability = checkOrbitStability(orbit);
        
        // Penalize unstable orbits
        if(stability < 1.0){
          quality *= (0.5 + stability * 0.5);
        }
        
        // Only accept if quality is ≤100% and better than current
        if(quality <= 1.0 && quality > bestQuality){
          bestQuality = quality;
          bestIter = testIter;
          bestStability = stability;
        }
        
        // Stop if we hit the sweet spot (98-99.5%)
        if(quality >= 0.98 && quality < 0.995) break;
      }
    }
    
    // Phase 4: Stability boundary test for near-optimal results (98%+)
    if(bestQuality >= 0.98 && bestQuality < 1.0){
      console.log('Phase 4: Stability boundary test (±1 iteration)');
      
      // Test iterations just above and below
      const testIterations = [bestIter - 1, bestIter + 1].filter(i => i >= 50 && i <= MAX_ITER_LIMIT);
      
      for(const testIter of testIterations){
        const orbit = computeRefOrbit(testIter);
        const quality = orbit.length / testIter;
        const stability = checkOrbitStability(orbit);
        
        // Check for large quality jumps (indicates unstable zone)
        const qualityDelta = Math.abs(quality - bestQuality);
        
        if(qualityDelta > 0.05){
          console.log(`⚠️  Unstable boundary detected: ${bestIter} ±1 iter has ${(qualityDelta*100).toFixed(1)}% quality swing`);
          
          // Back off from the edge
          if(bestIter > 100){
            const saferIter = Math.max(50, bestIter - 5);
            const saferOrbit = computeRefOrbit(saferIter);
            const saferQuality = saferOrbit.length / saferIter;
            const saferStability = checkOrbitStability(saferOrbit);
            
            // Only use safer value if it's still reasonably good
            if(saferQuality >= 0.92 && saferStability >= bestStability){
              console.log(`✓ Backing off to safer value: ${bestIter} → ${saferIter}`);
              bestIter = saferIter;
              bestQuality = saferQuality;
              bestStability = saferStability;
            }
          }
          break;
        }
      }
    }
    
    // If we ended up with >100% quality (orbit never escapes), search DOWNWARD aggressively
    if(bestQuality > 1.0){
      console.log(`⚠️ Orbit doesn't escape at ${bestIter} iterations (${(bestQuality*100).toFixed(1)}%), searching lower...`);
      
      // Binary search downward to find the escape point efficiently
      let low = 50;
      let high = bestIter;
      let foundEscaping = null;
      
      while(high - low > 50){
        const mid = Math.floor((low + high) / 2);
        const orbit = computeRefOrbit(mid);
        const quality = orbit.length / mid;
        
        console.log(`   🔍 Testing ${mid} iter: ${(quality*100).toFixed(1)}% quality`);
        
        if(quality <= 1.0){
          // Orbit escapes - search higher for best value
          foundEscaping = {iter: mid, quality: quality};
          low = mid;
        } else {
          // Orbit doesn't escape - search lower
          high = mid;
        }
      }
      
      // Fine-tune around the found escape point
      if(foundEscaping){
        console.log(`   ✓ Found escape point near ${foundEscaping.iter} iterations`);
        
        // Search in detail around this point
        const searchMin = Math.max(50, foundEscaping.iter - 50);
        const searchMax = Math.min(bestIter, foundEscaping.iter + 200);
        
        for(let testIter = searchMin; testIter <= searchMax; testIter += 5){
          const orbit = computeRefOrbit(testIter);
          const quality = orbit.length / testIter;
          const stability = checkOrbitStability(orbit);
          
          if(quality <= 1.0 && quality > foundEscaping.quality){
            foundEscaping = {iter: testIter, quality: quality};
            bestIter = testIter;
            bestQuality = quality;
            bestStability = stability;
          }
        }
      } else {
        // Fallback: linear search from current value downward
        for(let testIter = high; testIter >= 50; testIter -= 10){
          const orbit = computeRefOrbit(testIter);
          const quality = orbit.length / testIter;
          if(quality <= 1.0){
            bestQuality = quality;
            bestIter = testIter;
            break;
          }
        }
      }
      
      console.log(`   → Adjusted to ${bestIter} iterations (${(bestQuality*100).toFixed(1)}% quality)`);
    }
    
    // Safety check: if orbit never escapes AND quality is too low, we need MORE iterations
    // BUT: Only run this if we haven't already found a good value (92-99.5% range)
    // If Phase 1 found a value in the target range, trust it!
    // ALSO: Don't run in early escape mode - we already searched the right range
    // ALSO: Don't run if we found a quality range (directional test passed) - trust that result
    const alreadyFoundGoodValue = bestQuality >= 0.92 && bestQuality < 0.995;
    const foundQualityRangeAgain = (maxEscapeAt100Percent > 0 && minEscapeAt100Percent < Infinity && maxEscapeAt100Percent > minEscapeAt100Percent);
    
    if(!alreadyFoundGoodValue && !earlyEscapeMode && !foundQualityRangeAgain && bestQuality >= 0.999){
      // Check if orbit actually stayed bounded (didn't escape)
      const finalOrbit = computeRefOrbit(bestIter);
      const lastVal = finalOrbit[finalOrbit.length - 1];
      const lastMag = Math.sqrt(lastVal[0].mul(lastVal[0]).add(lastVal[1].mul(lastVal[1])).toNumber());
      const orbitStayedBounded = lastMag < 1.0; // Lower threshold - orbit truly stayed bounded
      
      if(orbitStayedBounded){
        console.log(`⚠️ Orbit stayed bounded (mag ${lastMag.toFixed(2)}) at ${bestIter} iterations, searching higher...`);
        let foundBetter = false;
        
        // Search upward from current best in larger steps
        for(let testIter = bestIter * 2; testIter <= MAX_ITER_LIMIT; testIter += Math.max(100, Math.floor(bestIter * 0.5))){
          const orbit = computeRefOrbit(testIter);
          const quality = orbit.length / testIter;
          
          // Look for 92-99% quality (maximum detail without going over 100%)
          if(quality >= 0.92 && quality < 0.995){
            bestQuality = quality;
            bestIter = testIter;
            foundBetter = true;
            console.log(`✓ Found better value: ${testIter} iterations (${(quality*100).toFixed(1)}% quality)`);
            break;
          }
        }
        
        // If we couldn't find anything better, at least double the iterations
        if(!foundBetter && bestIter < MAX_ITER_LIMIT / 2){
          bestIter = Math.min(MAX_ITER_LIMIT, bestIter * 4);
          const orbit = computeRefOrbit(bestIter);
          bestQuality = orbit.length / bestIter;
          console.log(`⬆️ Increasing iterations: → ${bestIter} (${(bestQuality*100).toFixed(1)}% quality)`);
        }
      }
    }
    
      // Final stability report
      let stabilityEmoji = '✅';
      let stabilityMsg = 'stable';
      if(bestStability < 0.5){
        stabilityEmoji = '⚠️ ';
        stabilityMsg = 'UNSTABLE';
      } else if(bestStability < 1.0){
        stabilityEmoji = '⚡';
        stabilityMsg = 'moderate';
      }
      
      console.log(`${stabilityEmoji} Optimization complete: ${currentIter} → ${bestIter} iterations`);
      console.log(`   Quality: ${(bestQuality*100).toFixed(1)}% | Stability: ${(bestStability*100).toFixed(0)}% (${stabilityMsg})`);
      
      // Ensure indicator is visible for at least 500ms so users see it
      const optimizationDuration = Date.now() - optimizationStartTime;
      const minDisplayTime = 500; // milliseconds
      const remainingTime = Math.max(0, minDisplayTime - optimizationDuration);
      
      setTimeout(() => {
        // Hide optimization status indicator
        if(optimizationStatus){
          optimizationStatus.classList.add('hidden');
        }
        
        isOptimizingIterations = false;
      }, remainingTime);
      
      // Update the slider and maxIter if we found a better value
      let shouldUpdate = false;
      
      if(bestIter !== currentIter){
        // Primary rule: Accept any value with quality ≥ 92%
        if(bestQuality >= 0.92){
          shouldUpdate = true;
          console.log(`✓ Accepting ${bestIter} iterations with ${(bestQuality*100).toFixed(1)}% quality (was ${(lastOrbitQuality*100).toFixed(1)}%)`);
        }
        // Rule 2: If current quality is poor (<80%), accept ANY improvement of 5%+
        else if(lastOrbitQuality < 0.80 && bestQuality >= lastOrbitQuality + 0.05){
          shouldUpdate = true;
          console.log(`✓ Poor current quality - accepting improvement: ${(lastOrbitQuality*100).toFixed(1)}% → ${(bestQuality*100).toFixed(1)}%`);
        }
        // Rule 3: Accept significant improvements (10%+ quality gain)
        else if(bestQuality >= lastOrbitQuality + 0.10){
          shouldUpdate = true;
          console.log(`✓ Significant improvement: ${(lastOrbitQuality*100).toFixed(1)}% → ${(bestQuality*100).toFixed(1)}%`);
        }
        // Reject if quality doesn't meet any criteria
        else {
          console.log(`✗ Rejecting ${bestIter} iterations - quality ${(bestQuality*100).toFixed(1)}% not sufficient improvement (current: ${(lastOrbitQuality*100).toFixed(1)}%)`);
        }
      }
      
      if(shouldUpdate){
        console.log(`🔄 Updating iterations: ${currentIter} → ${bestIter}`);
        maxIter = bestIter;
        iterSlider.value = bestIter;
        iterVal.textContent = bestIter;
        
        // Save the optimized value to preserve during zooming
        optimizedIterValue = bestIter;
        
        // Clear cache so next render uses the optimized value
        cachedOrbit = null;
        
        // Trigger a re-render (which will update orbit quality display)
        requestRender();
      } else {
        console.log('✨ Optimization converged at optimal value');
      }
    }, 0); // Run asynchronously
  }

  // Helper to sync high-precision center with view center (for display only)
  function syncCenterToView(){
    // At deep zoom, parseFloat loses precision and can produce NaN
    // Keep the Decimal values, don't sync to view.cx/cy
    if(view.scale < 1e-7){
      // Just ensure view.cx/cy have some valid number (not used for rendering at deep zoom)
      view.cx = view.cx || 0;
      view.cy = view.cy || 0;
    } else {
      view.cx = parseFloat(centerRe.toString());
      view.cy = parseFloat(centerIm.toString());
    }
  }

  // Helper to sync view center to high-precision center (ONLY use for initial setup)
  function syncViewToCenter(){
    centerRe = new Decimal(view.cx);
    centerIm = new Decimal(view.cy);
  }

  // Pan by delta in Decimal precision
  function panDecimal(deltaReStr, deltaImStr){
    centerRe = centerRe.add(new Decimal(deltaReStr));
    centerIm = centerIm.add(new Decimal(deltaImStr));
    syncCenterToView();
  }

  // Calculate adaptive iteration count based on zoom level
  function calculateAdaptiveIter(){
    const zoomDepth = Math.log10(1 / view.scale);
    
    // Unified conservative scaling for both desktop and mobile
    // Fewer iterations at shallow zoom produces cleaner images with less noise
    // At scale 1e-2: ~120 iterations
    // At scale 1e-4: ~170 iterations
    // At scale 1e-7: ~295 iterations (deep zoom threshold - optimizer takes over)
    // Cap at 600 for shallow zoom - deep zoom optimizer will find true optimum
    const iter = Math.min(600, Math.max(50, Math.floor(50 + zoomDepth * 35)));
    return iter;
  }

  // Update max iterations (either from slider or auto-calculated)
  function updateMaxIter(){
    if(isAutoIter){
      // In deep zoom mode, preserve the optimizer's value if we have one
      // Only recalculate if we don't have an optimized value yet
      const inDeepZoom = (view.scale <= 1e-7);
      
      if(inDeepZoom && optimizedIterValue !== null){
        // Keep the optimized value - don't reset it
        maxIter = optimizedIterValue;
      } else {
        // Calculate adaptive iterations normally
        maxIter = calculateAdaptiveIter();
      }
      
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
    
    // Superscript helper
    const superscriptDigits = {'0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹','-':'⁻'};
    const toSuperscript = (num) => num.toString().split('').map(c => superscriptDigits[c]).join('');
    
    // Format zoom level with superscript notation for extreme zooms
    let zoomText;
    if(magnification < 1000){
      zoomText = magnification.toFixed(1);
    } else if(magnification < 1e6){
      zoomText = (magnification / 1000).toFixed(1) + 'K';
    } else if(magnification < 1e9){
      zoomText = (magnification / 1e6).toFixed(1) + 'M';
    } else if(magnification < 1e12){
      zoomText = (magnification / 1e9).toFixed(1) + 'G';
    } else {
      // Use superscript notation for extreme zooms (trillion+)
      const expNotation = magnification.toExponential(1);
      const [mantissa, exponent] = expNotation.split('e');
      const exp = parseInt(exponent);
      const superExp = toSuperscript(exp);
      zoomText = `${mantissa}×10${superExp}`;
    }
    
    zoomLevelSpan.innerHTML = zoomText;
    
    // Format scale with superscript notation (e.g., 1.3×10⁻³⁸)
    const expNotation = view.scale.toExponential(1);
    const [mantissa, exponent] = expNotation.split('e');
    const exp = parseInt(exponent);
    // Convert exponent to superscript using helper
    const superExp = toSuperscript(exp);
    scaleValueSpan.innerHTML = `${mantissa}×10${superExp}`;
    
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
    
    // Store Decimal starting point for deep zoom precision
    let animFromDecimal = null;
    let animToDecimal = null;
    if(useDeepZoom){
      animFromDecimal = {re: new Decimal(centerRe), im: new Decimal(centerIm)};
      animToDecimal = {re: new Decimal(targetCx.toString()), im: new Decimal(targetCy.toString())};
    }
    
    function step(now){
      const elapsed = now - animStart;
      const t = Math.min(elapsed / duration, 1);
      // ease in out
      const easeT = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      
      // Interpolate scale normally
      view.scale = animFrom.scale + (animTo.scale - animFrom.scale) * easeT;
      
      // Interpolate position with Decimal precision if in deep zoom
      if(useDeepZoom && animFromDecimal && animToDecimal){
        const deltaRe = animToDecimal.re.minus(animFromDecimal.re);
        const deltaIm = animToDecimal.im.minus(animFromDecimal.im);
        centerRe = animFromDecimal.re.add(deltaRe.times(easeT));
        centerIm = animFromDecimal.im.add(deltaIm.times(easeT));
        syncCenterToView();
      } else {
        view.cx = animFrom.cx + (animTo.cx - animFrom.cx) * easeT;
        view.cy = animFrom.cy + (animTo.cy - animFrom.cy) * easeT;
        // Sync high-precision center
        syncViewToCenter();
      }
      
      updateMaxIter(); // Update iterations during animation
      updateZoomDisplay(); // Update zoom level display
      requestRender();
      if(t < 1){
        requestAnimationFrame(step);
      } else {
        animating = false;
        // Set grace period flag to prevent immediate optimization
        justCompletedZoomAnimation = true;
        setTimeout(() => {
          justCompletedZoomAnimation = false;
        }, 2000); // 2 second grace period after zoom animation
      }
    }
    requestAnimationFrame(step);
  }

  function resetView(){
    if(isJuliaMode){
      // Julia sets are centered at origin with smaller initial view
      view.cx = 0;
      view.cy = 0;
      view.scale = Math.min(maxScale, Math.max(4.0 / canvasGL.width, 4.0 / canvasGL.height));
    } else {
      // Mandelbrot set centered at -0.75, 0
      view.cx = -0.75;
      view.cy = 0;
      view.scale = Math.min(maxScale, Math.max(3.5 / canvasGL.width, 2.5 / canvasGL.height));
    }
    // Sync high-precision center
    syncViewToCenter();
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

    // Detect mobile devices (touch-only)
    const isMobile = ('ontouchstart' in window) && !window.matchMedia('(pointer: fine)').matches;
    
    // Cap resolution for mobile devices to improve performance
    // Desktop: use full resolution with DPR
    // Mobile: cap at 1920×1080 for performance on large tablets
    let targetWidth = Math.floor(availW * devicePixelRatio);
    let targetHeight = Math.floor(availH * devicePixelRatio);
    
    if(isMobile){
      const maxMobilePixels = 1920 * 1080; // ~2 million pixels
      const currentPixels = targetWidth * targetHeight;
      if(currentPixels > maxMobilePixels){
        const scale = Math.sqrt(maxMobilePixels / currentPixels);
        targetWidth = Math.floor(targetWidth * scale);
        targetHeight = Math.floor(targetHeight * scale);
      }
    }

    // set canvas size to match window for full coverage and dynamic resolution
    canvasGL.width = targetWidth;
    canvasGL.height = targetHeight;
    canvasGL.style.width = availW + 'px';
    canvasGL.style.height = availH + 'px';
    canvasGL.style.left = '0px';
    canvasGL.style.top = '0px';

    // Update debug info
    const debugScreen = document.getElementById('debug-screen');
    const debugDpr = document.getElementById('debug-dpr');
    const debugCalc = document.getElementById('debug-calc');
    const debugCanvas = document.getElementById('debug-canvas');
    const debugDevice = document.getElementById('debug-device');
    const debugPixels = document.getElementById('debug-pixels');
    
    if(debugScreen) debugScreen.textContent = `${availW}×${availH}`;
    if(debugDpr) debugDpr.textContent = devicePixelRatio.toFixed(2);
    if(debugCalc) debugCalc.textContent = `${Math.floor(availW * devicePixelRatio)}×${Math.floor(availH * devicePixelRatio)}`;
    if(debugCanvas) debugCanvas.textContent = `${targetWidth}×${targetHeight}`;
    if(debugDevice) debugDevice.textContent = isMobile ? 'Mobile (throttled)' : 'Desktop (full)';
    if(debugPixels) debugPixels.textContent = `${(targetWidth * targetHeight / 1000000).toFixed(1)}M`;


    // adjust view.scale so the entire Mandelbrot set fits the canvas
    if(!resize._initialized){
      // store baseScale for human-friendly magnification display
      resize.baseScale = view.scale;
      resize._initialized = true;
      // Only reset view on first initialization, but don't render yet if app hasn't started
      if(appStarted){
        resetView();
      }
    } else if(appStarted){
      // On subsequent resizes, just re-render at current position (only if app has started)
      requestRender();
    }
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
  var glProgram = null; // Deep zoom (perturbation) shader
  var glProgramSimple = null; // Simple shader for normal zoom
  var glProgramJulia = null;
  
  // Simple Mandelbrot shader (original method, for normal zoom levels)
  function createGLProgramSimple(){
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
      return rgb + m;
    }

    void main(){
      // Simple standard Mandelbrot iteration
      vec2 uv = (v_pos * 0.5 + 0.5) * u_resolution;
      float x0 = u_center.x + (uv.x - u_resolution.x * 0.5) * u_scale;
      float y0 = u_center.y + (uv.y - u_resolution.y * 0.5) * u_scale;
      
      float x = 0.0; float y = 0.0;
      float xx = 0.0; float yy = 0.0;
      const int MAX_ITERS = 20000;
      int iter = u_iter;
      float mag2 = 0.0;
      
      for(int i = 0; i < MAX_ITERS; i++){
        if(i >= u_iter) break;
        y = 2.0*x*y + y0;
        x = xx - yy + x0;
        xx = x*x; yy = y*y;
        mag2 = xx + yy;
        if(mag2 > 4.0){ iter = i; break; }
      }
      
      if(iter == u_iter){ gl_FragColor = vec4(0.0,0.0,0.0,1.0); return; }
      
      float it = float(iter);
      // smooth iteration
      float nu = log(log(sqrt(mag2))) / log(2.0);
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
      gl_FragColor = vec4(col, 1.0);
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
    uniform sampler2D u_refOrbit;
    uniform int u_refLen;
    uniform vec2 u_deltaC;

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
      
      const int MAX_ITERS = 20000;
      int iter = u_iter;
      float mag2 = 0.0;
      
      // deltaC is the pixel offset from reference center (high precision via small offset)
      vec2 deltaC = vec2(
        (uv.x - u_resolution.x * 0.5) * u_scale,
        (uv.y - u_resolution.y * 0.5) * u_scale
      ) + u_deltaC;
      
      // If reference orbit is too short, fall back to standard iteration
      // This happens when the center point is outside or near the edge of the Mandelbrot set
      if(u_refLen < u_iter * 3 / 4){
        // Standard Mandelbrot iteration using low-precision center
        float x0 = u_center.x + (uv.x - u_resolution.x * 0.5) * u_scale;
        float y0 = u_center.y + (uv.y - u_resolution.y * 0.5) * u_scale;
        float x = 0.0; float y = 0.0; float xx = 0.0; float yy = 0.0;
        for(int i = 0; i < MAX_ITERS; i++){
          if(i >= u_iter) break;
          y = 2.0*x*y + y0;
          x = xx - yy + x0;
          xx = x*x; yy = y*y;
          if(xx + yy > 4.0){ iter = i; mag2 = xx + yy; break; }
        }
      } else {
        // Perturbation method for deep zoom
        // delta starts at 0 (z_0 = 0 for Mandelbrot)
        vec2 delta = vec2(0.0, 0.0);
        bool usedStandard = false;
        vec2 c_standard = vec2(0.0, 0.0);
        float x = 0.0; float y = 0.0;
        
        for(int i = 0; i < MAX_ITERS; i++){
          if(i >= u_iter) break;
          
          // If we've exhausted the reference orbit or already switched, use standard iteration
          if(i >= u_refLen || usedStandard){
            if(!usedStandard){
              // First time switching: compute c from reference c + deltaC
              vec2 c_ref = texture2D(u_refOrbit, vec2(0.5/float(u_refLen), 0.5)).xy;
              // For Mandelbrot, c_ref should be the center c value
              // Actually, the reference orbit is computed with c = centerRe/centerIm
              // So this pixel's c = c_ref + deltaC (but c_ref is NOT stored, it's implicit)
              // We need to get the last z value and continue
              vec2 zref = texture2D(u_refOrbit, vec2((float(u_refLen-1) + 0.5)/float(u_refLen), 0.5)).xy;
              vec2 z = zref + delta;
              x = z.x; y = z.y;
              // c value for this pixel (reconstructed as reference c + offset)
              // Since reference orbit uses c=(centerRe, centerIm), this is deltaC
              c_standard = deltaC;
              usedStandard = true;
            }
            // Standard iteration using deltaC as c (since it's offset from reference center)
            float yy = y*y; float xx = x*x;
            mag2 = xx + yy;
            if(mag2 > 4.0){ iter = i; break; }
            y = 2.0*x*y + c_standard.y;
            x = xx - yy + c_standard.x;
          } else {
            // Perturbation iteration
            // Sample reference orbit z_ref at iteration i
            vec2 zref = texture2D(u_refOrbit, vec2((float(i) + 0.5)/float(u_refLen), 0.5)).xy;
            
            // Glitch detection: Check if perturbation has broken down
            float deltaMag2 = dot(delta, delta);
            
            // Glitch conditions (conservative to avoid false positives):
            // 1. NaN check: NaN is the only value that doesn't equal itself
            // 2. Delta magnitude explodes beyond reasonable bounds
            bool isNaN = (deltaMag2 != deltaMag2);
            bool tooLarge = (deltaMag2 > 1e10);
            
            if(isNaN || tooLarge){
              // Perturbation has broken down - switch to standard iteration
              vec2 z = zref + delta;
              x = z.x; y = z.y;
              c_standard = deltaC;
              usedStandard = true;
              continue;
            }
            
            // Compute z = zref + delta
            vec2 zplus = zref + delta;
            mag2 = dot(zplus, zplus);
            
            // Escape test
            if(mag2 > 4.0){
              iter = i;
              break;
            }
            
            // Perturbation iteration: delta_{n+1} = 2*zref*delta + delta^2 + deltaC
            delta = vec2(
              2.0*(zref.x*delta.x - zref.y*delta.y) + (delta.x*delta.x - delta.y*delta.y) + deltaC.x,
              2.0*(zref.x*delta.y + zref.y*delta.x) + (2.0*delta.x*delta.y) + deltaC.y
            );
          }
        }
      }
      
      if(iter == u_iter){ gl_FragColor = vec4(0.0,0.0,0.0,1.0); return; }
      
      float it = float(iter);
      // smooth iteration
      float nu = log(log(sqrt(mag2))) / log(2.0);
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
      // Julia sets use standard iteration (no perturbation needed)
      // map gl coords (-1..1) to pixel coords
      vec2 uv = (v_pos * 0.5 + 0.5) * u_resolution;
      // Julia: z starts at pixel, c is constant
      float x = u_center.x + (uv.x - u_resolution.x * 0.5) * u_scale;
      float y = u_center.y + (uv.y - u_resolution.y * 0.5) * u_scale;
      float xx = x*x; float yy = y*y;
      const int MAX_ITERS = 20000;
      int iter = u_iter;
      float mag2 = xx + yy;
      
      for(int i = 0; i < MAX_ITERS; i++){
        if(i >= u_iter) break;
        y = 2.0*x*y + u_juliaC.y;
        x = xx - yy + u_juliaC.x;
        xx = x*x; yy = y*y;
        mag2 = xx + yy;
        if(mag2 > 4.0){ iter = i; break; }
      }
      if(iter == u_iter){ gl_FragColor = vec4(0.0,0.0,0.0,1.0); return; }
      float it = float(iter);
      // smooth iteration
      float nu = log(log(sqrt(mag2))) / log(2.0);
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
    
    // Determine if we should use deep zoom mode
    const shouldUseDeepZoom = !isJuliaMode && view.scale < deepZoomThreshold;
    
    // Show warning when entering deep zoom mode for the first time
    if(shouldUseDeepZoom && !useDeepZoom && !hasShownDeepZoomWarning){
      console.log('🔬 DEEP ZOOM MODE ACTIVATED');
      console.log('📍 Switching to perturbation method for zoom beyond 1e-7');
      console.log('💡 TIP: Center on BLACK areas (deep inside the set) for best results');
      console.log('⚠️  Colored areas will pixelate - recenter on black for smooth detail');
      hasShownDeepZoomWarning = true;
      // Show modal to user
      showDeepZoomModal();
    }
    useDeepZoom = shouldUseDeepZoom;
    
    // Choose program based on mode
    let program;
    if(isJuliaMode){
      program = glProgramJulia || (glProgramJulia = createGLProgramJulia());
    } else if(useDeepZoom){
      program = glProgram || (glProgram = createGLProgram());
    } else {
      program = glProgramSimple || (glProgramSimple = createGLProgramSimple());
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

    // Compute and upload reference orbit for deep zoom mode only
    let refLen = 0;
    let refOrbitLength = 0; // Store actual orbit length for iteration adjustment
    if(useDeepZoom){
      const orbit = getRefOrbit(maxIter);
      refLen = uploadRefOrbit(orbit);
      refOrbitLength = refLen; // Save for iteration adjustment
      
      // Update orbit quality display
      const quality = (refLen / maxIter * 100);
      lastOrbitQuality = quality / 100; // Store as 0-1 range for iteration adjustment
      console.log(`📊 Orbit quality: ${quality.toFixed(1)}% (${lastOrbitQuality.toFixed(3)}), refLen: ${refLen}, maxIter: ${maxIter}`);
      orbitQualityValue.textContent = quality.toFixed(0) + '%';
      
      // Color-code based on quality
      orbitQualityValue.className = '';
      if(quality >= 90){
        orbitQualityValue.classList.add('quality-good');
      } else if(quality >= 60){
        orbitQualityValue.classList.add('quality-medium');
      } else {
        orbitQualityValue.classList.add('quality-poor');
      }
      
      // Auto-optimize iterations if quality is poor and auto-iter is enabled
      // Also trigger if quality is 100% (black screen) - might need more iterations
      // Don't optimize during animations or right after loading a saved location or completing zoom animation
      const qualityTooLow = quality < 95;
      const blackScreenWithLowIter = (quality >= 99.9 && maxIter < 10000); // All black, might need more
      const shouldOptimize = isAutoIter && !isOptimizingIterations && !animating && !justLoadedSavedLocation && !justCompletedZoomAnimation && (qualityTooLow || blackScreenWithLowIter);
      
      if(shouldOptimize){
        // Clear optimized value so we can search for a better one
        optimizedIterValue = null;
        
        // Show indicator immediately
        if(optimizationStatus){
          optimizationStatus.classList.remove('hidden');
        }
        
        if(blackScreenWithLowIter){
          console.log('🎯 Black screen detected - triggering optimization to find detail');
        }
        
        // Delay optimization slightly to avoid doing it on every pan
        setTimeout(() => {
          const stillNeedsOpt = isAutoIter && !animating && (lastOrbitQuality < 0.95 || (lastOrbitQuality >= 0.999 && maxIter < 10000));
          if(stillNeedsOpt){
            optimizeIterations();
          } else {
            // If conditions changed, hide the indicator
            if(optimizationStatus){
              optimizationStatus.classList.add('hidden');
            }
          }
        }, 1000); // Longer delay to let things settle
      }
      
      // Show orbit quality display
      orbitQualityInfo.classList.remove('hidden');
      
      // Debug: log reference orbit details occasionally
      if(Math.random() < 0.05){
        console.log('Deep zoom - Scale:', view.scale.toExponential(2));
        console.log('Reference orbit length:', refLen, '/', maxIter);
        console.log('Orbit quality:', quality.toFixed(0) + '%');
        if(refLen < maxIter * 0.75){
          console.warn('⚠️ Reference orbit short - center may be near edge of set');
          console.warn('💡 Tip: For deep zoom, center on points deep INSIDE the set (black areas)');
        }
      }
    } else {
      // Hide orbit quality display when not in deep zoom
      orbitQualityInfo.classList.add('hidden');
      lastOrbitQuality = null; // Clear quality when not in deep zoom
      
      // Also hide optimization status indicator when leaving deep zoom
      if(optimizationStatus){
        optimizationStatus.classList.add('hidden');
      }
    }

    // Set shader uniforms
    const u_center = gl.getUniformLocation(program, 'u_center');
    const u_scale = gl.getUniformLocation(program, 'u_scale');
    const u_iter = gl.getUniformLocation(program, 'u_iter');
    const u_resolution = gl.getUniformLocation(program, 'u_resolution');

    // Pass float approximation of center for compatibility
    gl.uniform2f(u_center, parseFloat(centerRe.toString()), parseFloat(centerIm.toString()));
    gl.uniform1f(u_scale, view.scale);
    
    // Use maxIter directly - the optimizer will handle finding the best value
    gl.uniform1i(u_iter, maxIter);
    gl.uniform2f(u_resolution, canvasGL.width, canvasGL.height);

    // Deep zoom mode: pass reference orbit texture and delta
    if(useDeepZoom){
      const u_refOrbit = gl.getUniformLocation(program, 'u_refOrbit');
      const u_refLen = gl.getUniformLocation(program, 'u_refLen');
      const u_deltaC = gl.getUniformLocation(program, 'u_deltaC');
      
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, refOrbitTexture);
      gl.uniform1i(u_refOrbit, 0);
      gl.uniform1i(u_refLen, refLen);
      gl.uniform2f(u_deltaC, 0.0, 0.0); // Delta from reference center (currently zero)
    }
    
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
    if(!appStarted) return; // Don't render until app has started
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
    const oldScale = view.scale;
    view.scale *= zoomFactor;
    // Clamp scale to prevent zooming out too far or in too deep
    view.scale = Math.max(getMinScale(), Math.min(maxScale, view.scale));
    const actualZoomFactor = view.scale / oldScale;

    // Calculate how much the point under cursor moves in complex space
    const scaleChange = new Decimal(actualZoomFactor).sub(1);
    const offsetRe = new Decimal((mx - canvasGL.width / 2) * oldScale);
    const offsetIm = new Decimal((canvasGL.height / 2 - my) * oldScale);
    
    // Adjust center so point under cursor stays fixed (in Decimal precision)
    centerRe = centerRe.sub(offsetRe.mul(scaleChange));
    centerIm = centerIm.sub(offsetIm.mul(scaleChange));
    syncCenterToView();

    // Clear optimized iteration value if zooming significantly (>2x change) or leaving deep zoom
    const wasDeepZoom = oldScale <= 1e-7;
    const isDeepZoom = view.scale <= 1e-7;
    const significantZoom = Math.abs(actualZoomFactor - 1) > 1.0; // >2x zoom change
    
    if(significantZoom || (wasDeepZoom && !isDeepZoom)){
      optimizedIterValue = null; // Clear so optimizer can re-run for new depth
    }

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

  // Function to update coordinate display in settings panel
  function updateCoordinateDisplay(mx, my){
    // Only show coordinates in Mandelbrot mode
    if(isJuliaMode){
      coordDisplaySetting.style.display = 'none';
      return;
    } else {
      coordDisplaySetting.style.display = 'block';
    }
    
    // Calculate complex plane coordinates using high-precision center
    const dx = (mx - canvasGL.width / 2) * view.scale;
    const dy = (my - canvasGL.height / 2) * view.scale;
    const real = centerRe.add(new Decimal(dx));
    const imag = centerIm.sub(new Decimal(dy));
    
    // Format with appropriate precision based on zoom level
    let precision;
    if(view.scale < 1e-30) precision = 38;
    else if(view.scale < 1e-20) precision = 28;
    else if(view.scale < 1e-10) precision = 18;
    else if(view.scale < 1e-5) precision = 12;
    else precision = 8;
    
    const realStr = real.toFixed(precision);
    const imagStr = imag.toFixed(precision);
    const sign = imag.isNegative() ? '-' : '+';
    const imagAbs = imag.abs().toFixed(precision);
    
    // Display in settings panel (desktop and mobile)
    coordValuePanel.innerHTML = `${realStr} ${sign}<br>${imagAbs}i`;
  }

  // Update coordinate display on mouse move over canvas
  canvasGL.addEventListener('mousemove', function(e){
    const rect = canvasGL.getBoundingClientRect();
    const mx_css = (e.clientX - rect.left);
    const my_css = (e.clientY - rect.top);
    const mx = mx_css * devicePixelRatio;
    const my = my_css * devicePixelRatio;
    updateCoordinateDisplay(mx, my);
  });
  
  // Update coordinate display on touch move as well
  canvasGL.addEventListener('touchmove', function(e){
    if(e.touches.length === 1){
      const rect = canvasGL.getBoundingClientRect();
      const touch = e.touches[0];
      const mx_css = (touch.clientX - rect.left);
      const my_css = (touch.clientY - rect.top);
      const mx = mx_css * devicePixelRatio;
      const my = my_css * devicePixelRatio;
      updateCoordinateDisplay(mx, my);
    }
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
      // Pan using Decimal precision
      const deltaRe = new Decimal(-dx * view.scale);
      const deltaIm = new Decimal(dy * view.scale);
      centerRe = centerRe.add(deltaRe);
      centerIm = centerIm.add(deltaIm);
      syncCenterToView();
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
  newScale = Math.max(getMinScale(), Math.min(maxScale, newScale));
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
    // Calculate actual CSS to canvas pixel ratio (same as touch handling)
    const actualRatioX = canvasGL.width / canvasGL.clientWidth;
    const actualRatioY = canvasGL.height / canvasGL.clientHeight;
    const mx = (e.clientX - rect.left) * actualRatioX;
    const my = (e.clientY - rect.top) * actualRatioY;
    
    // Calculate target coordinates with high precision for deep zoom
    let targetCx, targetCy;
    if(useDeepZoom){
      // Use Decimal.js for precision at deep zoom
      const pixelOffsetX = new Decimal(mx - canvasGL.width / 2);
      const pixelOffsetY = new Decimal(my - canvasGL.height / 2);
      const scaleDecimal = new Decimal(view.scale);
      
      // Calculate delta in complex plane
      const deltaRe = pixelOffsetX.times(scaleDecimal);
      const deltaIm = pixelOffsetY.times(scaleDecimal).neg(); // Y is inverted
      
      // Calculate target center with Decimal precision
      const targetReDecimal = centerRe.add(deltaRe);
      const targetImDecimal = centerIm.add(deltaIm);
      
      // Convert to float for display (precision maintained in Decimal during animation)
      targetCx = targetReDecimal.toNumber();
      targetCy = targetImDecimal.toNumber();
    } else {
      // Standard precision for normal zoom levels
      const complex = pixelToComplex(mx, my);
      targetCx = complex.x;
      targetCy = complex.y;
    }
    
    let newScale = view.scale * 0.5;
    // Clamp to zoom limits
    newScale = Math.max(getMinScale(), Math.min(maxScale, newScale));
    // Only animate if scale actually changes (prevents pan-only when at zoom limit)
    // Use relative threshold for deep zooms
    if(Math.abs(newScale - view.scale) > view.scale * 0.001){
      animateView(targetCx, targetCy, newScale);
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
      // Calculate actual CSS to canvas pixel ratio (accounts for throttling on mobile)
      const actualRatioX = canvasGL.width / canvasGL.clientWidth;
      const actualRatioY = canvasGL.height / canvasGL.clientHeight;
      const mx = tx * actualRatioX;
      const my = ty * actualRatioY;
      const complex = pixelToComplex(mx, my);
      longPressPos = {x: touches[0].clientX, y: touches[0].clientY, cx: complex.x, cy: complex.y, mx_css: tx, my_css: ty};
      longPressTimer = setTimeout(function(){
        // Long press detected - show context menu
        if(longPressPos){
          showContextMenu(longPressPos.x, longPressPos.y, longPressPos.cx, longPressPos.cy, longPressPos.mx_css, longPressPos.my_css, true);
          touchStart = null; // Cancel pan
        }
      }, 500); // 500ms long press
      
      // Check for double tap
      const now = Date.now();
      if(now - lastTap < 300 && Math.abs(tx - lastTapPos.x) < 30 && Math.abs(ty - lastTapPos.y) < 30){
        // Double tap
        clearTimeout(longPressTimer); // Cancel long press
        longPressTimer = null;
        
        // Calculate target coordinates with high precision for deep zoom
        let targetCx, targetCy;
        if(useDeepZoom){
          // Use Decimal.js for precision at deep zoom
          const pixelOffsetX = new Decimal(mx - canvasGL.width / 2);
          const pixelOffsetY = new Decimal(my - canvasGL.height / 2);
          const scaleDecimal = new Decimal(view.scale);
          
          // Calculate delta in complex plane
          const deltaRe = pixelOffsetX.times(scaleDecimal);
          const deltaIm = pixelOffsetY.times(scaleDecimal).neg(); // Y is inverted
          
          // Calculate target center with Decimal precision
          const targetReDecimal = centerRe.add(deltaRe);
          const targetImDecimal = centerIm.add(deltaIm);
          
          // Convert to float for display (precision maintained in Decimal during animation)
          targetCx = targetReDecimal.toNumber();
          targetCy = targetImDecimal.toNumber();
        } else {
          // Standard precision for normal zoom levels
          const complex = pixelToComplex(mx, my);
          targetCx = complex.x;
          targetCy = complex.y;
        }
        
        let newScale = view.scale * 0.5;
        // Clamp to zoom limits
        newScale = Math.max(getMinScale(), Math.min(maxScale, newScale));
        // Only animate if scale actually changes (prevents pan-only when at zoom limit)
        // Use relative threshold for deep zooms
        if(Math.abs(newScale - view.scale) > view.scale * 0.001){
          animateView(targetCx, targetCy, newScale);
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
      // Center of pinch - convert CSS pixels to canvas pixels
      const cx = (t1.clientX + t2.clientX) / 2 - rect.left;
      const cy = (t1.clientY + t2.clientY) / 2 - rect.top;
      // Use actual canvas to CSS pixel ratio (same as pan code)
      const actualRatioX = canvasGL.width / canvasGL.clientWidth;
      const actualRatioY = canvasGL.height / canvasGL.clientHeight;
      touchStart = {x: cx * actualRatioX, y: cy * actualRatioY};
    }
  }, {passive: false});

  // Throttle touch move events to prevent iPad from being overwhelmed
  let lastTouchMoveTime = 0;
  let pendingTouchMove = null;

  canvasGL.addEventListener('touchmove', function(e){
    e.preventDefault();
    // Cancel long press if finger moves
    if(longPressTimer){
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    
    // Throttle: only process touch moves every 16ms (60fps max)
    const now = Date.now();
    if(now - lastTouchMoveTime < 16){
      // Store the event to process later
      pendingTouchMove = e;
      return;
    }
    lastTouchMoveTime = now;
    
    const touches = e.touches;
    if(touches.length === 1 && touchStart){
      // Pan - but only if we're not right after a pinch gesture
      if(now - lastPinchEnd > 100){
        const rect = canvasGL.getBoundingClientRect();
        const tx = touches[0].clientX - rect.left;
        const ty = touches[0].clientY - rect.top;
        // Use actual canvas to CSS pixel ratio (accounts for throttling)
        const actualRatioX = canvasGL.width / canvasGL.clientWidth;
        const actualRatioY = canvasGL.height / canvasGL.clientHeight;
        const dx = (tx - touchStart.x) * actualRatioX;
        const dy = (ty - touchStart.y) * actualRatioY;
        // Pan using Decimal precision
        const deltaRe = new Decimal(-dx * view.scale);
        const deltaIm = new Decimal(dy * view.scale);
        centerRe = centerRe.add(deltaRe);
        centerIm = centerIm.add(deltaIm);
        syncCenterToView();
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
      const oldScale = view.scale;
      let newScale = initialScale / scaleFactor;
      // Clamp scale to prevent zooming out too far or in too deep
      newScale = Math.max(getMinScale(), Math.min(maxScale, newScale));
      view.scale = newScale;
      const actualZoomFactor = newScale / oldScale;
      
      // Calculate offset of pinch point from center in old scale
      const scaleChange = new Decimal(actualZoomFactor).sub(1);
      const offsetRe = new Decimal((touchStart.x - canvasGL.width / 2) * oldScale);
      const offsetIm = new Decimal((canvasGL.height / 2 - touchStart.y) * oldScale);
      
      // Adjust center in Decimal precision
      centerRe = centerRe.sub(offsetRe.mul(scaleChange));
      centerIm = centerIm.sub(offsetIm.mul(scaleChange));
      syncCenterToView();
      
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
      // All touches ended
      coordInfo.classList.add('hidden');
      touchStart = null;
      initialDistance = null;
      initialScale = null;
    }
  }, {passive: false});

  // Set slider max based on device type and GPU capabilities
  const maxTexSize = getMaxTextureSize();
  if(isMobileDevice){
    iterSlider.max = 4000;
    console.log('Mobile device: slider max set to 4000');
  } else {
    // Desktop: use texture limit (typically 16384) with 25% headroom for manual adjustment
    // Going much higher causes exponential slowdown at extreme zoom depths
    iterSlider.max = Math.max(20000, Math.floor(maxTexSize * 1.25));
    console.log(`Desktop device: slider max set to ${iterSlider.max} (texture limit: ${maxTexSize})`);
  }

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

  // Return to Title Screen button
  returnToTitleBtn.addEventListener('click', function(){
    // Show title screen (reverse the dismissTitleScreen logic)
    titleScreen.style.display = 'flex';
    setTimeout(() => {
      titleScreen.classList.remove('hidden');
    }, 10);
    // Close settings panel
    settingsPanel.classList.add('hidden');
    menuToggle.classList.remove('active');
  });

  // Preset locations
  const presetLocations = {
    'seahorse': { cx: -0.7435669, cy: 0.1314023, scale: 0.00005, name: 'Seahorse Valley' },
    'elephant': { cx: 0.28692999, cy: 0.0148590, scale: 0.00004, name: 'Elephant Valley' },
    'triple-spiral': { cx: -0.7710, cy: 0.1060, scale: 0.00008, name: 'Triple Spiral Valley' },
    'dendrite': { cx: -0.1592, cy: 1.0317, scale: 0.0015, name: 'Dendrite' },
    'mini-mandelbrot': { cx: -0.7453, cy: 0.1127, scale: 0.000008, name: 'Mini Mandelbrot' },
    'misiurewicz': { cx: -0.1011, cy: 0.9563, scale: 0.0003, name: 'Misiurewicz Point' },
    'scepter': { cx: -1.2569, cy: 0.3803, scale: 0.0003, name: 'Scepter Valley' },
    'satellite': { cx: -0.1565, cy: 1.0325, scale: 0.0001, name: 'Satellite' },
    'deep-river': { 
      cx: -1.0242634588322839, 
      cy: 0.28090100808524593, 
      scale: 5.480436e-23, 
      name: 'Deep River (e-23)',
      centerRe: "-1.0242634588322839",
      centerIm: "0.28090100808524593",
      iterations: 7801
    }
  };

  // Load custom locations from localStorage
  function loadCustomLocations(){
    const stored = localStorage.getItem('mandelscope-custom-locations');
    return stored ? JSON.parse(stored) : {};
  }

  function saveCustomLocations(customLocs){
    localStorage.setItem('mandelscope-custom-locations', JSON.stringify(customLocs));
  }

  let customLocations = loadCustomLocations();

  // Populate dropdown with preset and custom locations
  function populateLocationDropdown(){
    const presetSelect = document.getElementById('preset-locations');
    // Clear all children except the first option (default)
    const firstOption = presetSelect.firstElementChild;
    presetSelect.innerHTML = '';
    presetSelect.appendChild(firstOption);

    // Add preset locations
    const presetGroup = document.createElement('optgroup');
    presetGroup.label = 'Famous Places';
    for(const [key, loc] of Object.entries(presetLocations)){
      const option = document.createElement('option');
      option.value = 'preset:' + key;
      option.textContent = loc.name;
      presetGroup.appendChild(option);
    }
    presetSelect.appendChild(presetGroup);

    // Add custom locations if any exist
    if(Object.keys(customLocations).length > 0){
      const customGroup = document.createElement('optgroup');
      customGroup.label = 'My Locations';
      for(const [key, loc] of Object.entries(customLocations)){
        const option = document.createElement('option');
        option.value = 'custom:' + key;
        option.textContent = loc.name;
        customGroup.appendChild(option);
      }
      presetSelect.appendChild(customGroup);
    }
  }

  populateLocationDropdown();

  const presetSelect = document.getElementById('preset-locations');
  presetSelect.addEventListener('change', function(){
    const selected = this.value;
    if(selected){
      let loc = null;
      if(selected.startsWith('preset:')){
        const key = selected.substring(7);
        loc = presetLocations[key];
      } else if(selected.startsWith('custom:')){
        const key = selected.substring(7);
        loc = customLocations[key];
      }
      
      if(loc){
        // Close hamburger menu
        settingsPanel.classList.add('hidden');
        menuToggle.classList.remove('active');
        
        // Switch to Mandelbrot mode if in Julia mode
        if(isJuliaMode){
          switchToMandelbrot();
        }
        
        // Use high-precision coordinates if available (for deep zoom locations)
        if(loc.centerRe && loc.centerIm){
          centerRe = new Decimal(loc.centerRe);
          centerIm = new Decimal(loc.centerIm);
          view.scale = loc.scale;
          
          // If location has saved iterations, use them as starting point
          const hasSavedIterations = loc.iterations && isAutoIter;
          if(hasSavedIterations){
            maxIter = loc.iterations;
            iterSlider.value = maxIter;
            iterVal.textContent = maxIter;
            optimizedIterValue = maxIter; // Treat saved iterations as optimized value
            justLoadedSavedLocation = true; // Prevent auto-optimization for a while
            console.log(`📂 Loaded saved location with ${maxIter} iterations`);
            
            // Clear flag after 5 seconds (enough time for user to see the result)
            setTimeout(() => {
              justLoadedSavedLocation = false;
            }, 5000);
          }
          
          // Show helpful note if location has one
          if(loc.note){
            console.log(`💡 ${loc.note}`);
          }
          
          // Clear cached orbit so it recalculates with new coordinates
          cachedOrbit = null;
          
          syncCenterToView(); // Sync the Decimal values to view (or keep as fallback)
          
          // Only call updateMaxIter if NO saved iterations (otherwise it overwrites our value)
          if(!hasSavedIterations){
            updateMaxIter();
          }
          
          updateZoomDisplay();
          requestRender();
          
          // For deep zoom locations WITHOUT saved iterations, force optimization after initial render
          // If iterations are saved, trust them and skip optimization
          if(view.scale <= 1e-7 && isAutoIter && !loc.iterations){
            setTimeout(() => {
              if(useDeepZoom && !isOptimizingIterations){
                console.log('🎯 Deep zoom location loaded - forcing iteration optimization');
                optimizeIterations();
              }
            }, 1500); // Wait for initial render to complete
          }
        } else {
          // Legacy location without high-precision coords
          animateView(loc.cx, loc.cy, loc.scale);
        }
        
        // Reset dropdown after a short delay
        setTimeout(() => {
          this.value = '';
        }, 300);
      }
    }
  });

  // Settings menu toggle
  menuToggle.addEventListener('click', function(){
    settingsPanel.classList.toggle('hidden');
    menuToggle.classList.toggle('active');
  });

  // Close settings panel when clicking/touching outside
  function closeSettingsIfOutside(e){
    if(!settingsPanel.contains(e.target) && !menuToggle.contains(e.target)){
      settingsPanel.classList.add('hidden');
      menuToggle.classList.remove('active');
    }
  }
  document.addEventListener('click', closeSettingsIfOutside);
  document.addEventListener('touchstart', closeSettingsIfOutside);

  // Keyboard controls - continuous movement
  const keysPressed = new Set();
  let keyboardAnimFrame = null;

  function updateKeyboardMovement(){
    if(keysPressed.size === 0){
      keyboardAnimFrame = null;
      return;
    }

    const panSpeed = view.scale * 2; // Pan speed relative to current zoom
    const zoomSpeed = 0.98; // Zoom multiplier per frame (slower than discrete)
    let changed = false;

    // Pan with arrow keys or WASD (using Decimal precision)
    if(keysPressed.has('arrowup') || keysPressed.has('w')){
      centerIm = centerIm.sub(new Decimal(panSpeed));
      changed = true;
    }
    if(keysPressed.has('arrowdown') || keysPressed.has('s')){
      centerIm = centerIm.add(new Decimal(panSpeed));
      changed = true;
    }
    if(keysPressed.has('arrowleft') || keysPressed.has('a')){
      centerRe = centerRe.add(new Decimal(panSpeed));
      changed = true;
    }
    if(keysPressed.has('arrowright') || keysPressed.has('d')){
      centerRe = centerRe.sub(new Decimal(panSpeed));
      changed = true;
    }

    // Zoom with +/- (center point stays fixed in Decimal precision)
    if(keysPressed.has('+') || keysPressed.has('=')){
      view.scale *= zoomSpeed;
      view.scale = Math.max(getMinScale(), view.scale);
      changed = true;
    }
    if(keysPressed.has('-') || keysPressed.has('_')){
      view.scale /= zoomSpeed;
      view.scale = Math.min(maxScale, view.scale);
      changed = true;
    }

    if(changed){
      syncCenterToView();
      updateMaxIter();
      updateZoomDisplay();
      requestRender();
    }

    keyboardAnimFrame = requestAnimationFrame(updateKeyboardMovement);
  }

  document.addEventListener('keydown', function(e){
    // Don't intercept keys when typing in input fields
    if(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA'){
      return;
    }

    // Don't handle keys if title screen is visible
    if(!titleScreen.classList.contains('hidden')){
      return;
    }

    const key = e.key.toLowerCase();
    let handled = false;

    // Handle movement keys
    if(['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', '+', '=', '-', '_'].includes(key)){
      if(!keysPressed.has(key)){
        keysPressed.add(key);
        if(!keyboardAnimFrame){
          updateKeyboardMovement();
        }
      }
      handled = true;
    }

    // Handle 'R' key - Reset view
    if(key === 'r'){
      resetView();
      handled = true;
    }

    // Handle Escape
    if(key === 'escape'){
      titleScreen.style.display = 'flex';
      setTimeout(() => {
        titleScreen.classList.remove('hidden');
      }, 10);
      // Close any open panels
      settingsPanel.classList.add('hidden');
      menuToggle.classList.remove('active');
      handled = true;
    }

    if(handled){
      e.preventDefault();
    }
  });

  document.addEventListener('keyup', function(e){
    const key = e.key.toLowerCase();
    keysPressed.delete(key);
  });

  // Mode toggle
  function switchToJulia(cx, cy){
    // Save current Mandelbrot view before switching (including high-precision center for deep zoom)
    savedMandelbrotView = {
      cx: view.cx,
      cy: view.cy,
      scale: view.scale,
      centerRe: new Decimal(centerRe),
      centerIm: new Decimal(centerIm)
    };
    
    juliaC.x = cx;
    juliaC.y = cy;
    isJuliaMode = true;
    juliaInfo.classList.remove('hidden');
    juliaSetButtonWrap.classList.add('hidden'); // Hide Julia button in Julia mode
    backToMandelbrotBtn.classList.remove('hidden');
    updateJuliaDisplay();
    
    // Start from extremely zoomed out view
    view.cx = 0;
    view.cy = 0;
    view.scale = Math.min(maxScale, Math.max(20.0 / canvasGL.width, 20.0 / canvasGL.height));
    syncViewToCenter();
    updateMaxIter();
    updateZoomDisplay();
    requestRender();
    
    // Animate to normal Julia set starting position
    setTimeout(() => {
      const targetScale = Math.min(maxScale, Math.max(4.0 / canvasGL.width, 4.0 / canvasGL.height));
      animateView(0, 0, targetScale, 1200); // 1.2 second smooth zoom
    }, 100);
  }

  function switchToMandelbrot(){
    isJuliaMode = false;
    juliaInfo.classList.add('hidden');
    juliaSetButtonWrap.classList.remove('hidden'); // Show Julia button in Mandelbrot mode
    backToMandelbrotBtn.classList.add('hidden');
    
    // Restore saved Mandelbrot view if available
    if(savedMandelbrotView){
      view.cx = savedMandelbrotView.cx;
      view.cy = savedMandelbrotView.cy;
      view.scale = savedMandelbrotView.scale;
      // Restore high-precision center for deep zoom
      if(savedMandelbrotView.centerRe && savedMandelbrotView.centerIm){
        centerRe = new Decimal(savedMandelbrotView.centerRe);
        centerIm = new Decimal(savedMandelbrotView.centerIm);
        syncCenterToView(); // Sync from high-precision to view
      } else {
        syncViewToCenter(); // Sync from view to high-precision
      }
      updateZoomDisplay();
    } else {
      resetView();
    }
    
    requestRender();
  }

  function updateJuliaDisplay(){
    // No longer displaying Julia c value in UI
  }

  // Back to Mandelbrot button
  backToMandelbrotBtn.addEventListener('click', switchToMandelbrot);

  // Context menu state
  let contextMenuPos = {x: 0, y: 0, cx: 0, cy: 0, mx_css: 0, my_css: 0};

  function showContextMenu(x, y, cx, cy, mx_css, my_css, isTouch = false){
    contextMenuPos = {x, y, cx, cy, mx_css, my_css};
    
    // Show/hide menu items based on mode
    if(isJuliaMode){
      // Julia mode: hide Show Julia option
      menuShowJulia.style.display = 'none';
    } else {
      // Mandelbrot mode: show Julia option
      menuShowJulia.style.display = 'block';
    }
    
    // Show/hide save options based on mode
    if(isJuliaMode){
      menuSaveLocation.style.display = 'none';
      menuSaveJulia.style.display = 'block';
    } else {
      menuSaveLocation.style.display = 'block';
      menuSaveJulia.style.display = 'none';
    }
    
    contextMenu.classList.remove('hidden');
    
    // Position menu based on input type
    if(isTouch){
      // For touch: position above and to the left so it's not hidden under finger
      // Offset upward by menu height (~80-120px depending on items) plus some padding
      const menuHeight = contextMenu.offsetHeight || 100;
      contextMenu.style.left = (x - 100) + 'px'; // Left of finger
      contextMenu.style.top = (y - menuHeight - 20) + 'px'; // Above finger
    } else {
      // For mouse: position below and to the right of cursor
      // Small offset so cursor doesn't immediately hover over first item
      contextMenu.style.left = (x + 5) + 'px';
      contextMenu.style.top = (y + 5) + 'px';
    }
  }

  function hideContextMenu(){
    contextMenu.classList.add('hidden');
  }

  // Hide context menu when clicking/touching elsewhere
  function hideContextMenuIfOutside(e){
    if(!contextMenu.contains(e.target)){
      hideContextMenu();
    }
  }
  document.addEventListener('click', hideContextMenuIfOutside);
  document.addEventListener('touchstart', hideContextMenuIfOutside);

  // Context menu actions
  menuShowJulia.addEventListener('click', function(){
    hideContextMenu();
    if(!isJuliaMode){
      switchToJulia(contextMenuPos.cx, contextMenuPos.cy);
    }
  });

  // Julia Set button (bottom left) - shows Julia set of current center
  showJuliaBtn.addEventListener('click', function(){
    if(!isJuliaMode){
      // Use current center coordinates
      const cx = parseFloat(centerRe.toString());
      const cy = parseFloat(centerIm.toString());
      switchToJulia(cx, cy);
    }
  });

  // Share Location functionality
  menuShareLocation.addEventListener('click', async function(){
    hideContextMenu();
    
    // Calculate zoom level from scale
    const zoomDepth = Math.max(0, -Math.log10(view.scale / resize.baseScale));
    const zoomLevel = Math.pow(10, zoomDepth);
    
    // Build share text with full precision coordinates
    let shareText = '';
    if(isJuliaMode){
      shareText = `Julia Set Location\n\n`;
      shareText += `c = ${juliaC.x.toFixed(15)} ${juliaC.y >= 0 ? '+' : ''}${juliaC.y.toFixed(15)}i\n`;
      shareText += `Center: ${view.cx.toFixed(15)} ${view.cy >= 0 ? '+' : ''}${view.cy.toFixed(15)}i\n`;
      shareText += `Scale: ${view.scale.toExponential(6)}\n`;
      shareText += `Zoom: ${zoomLevel.toExponential(2)}×`;
    } else {
      // Use Decimal.js for high-precision Mandelbrot coordinates
      const reStr = centerRe.toString();
      const imStr = centerIm.toString();
      shareText = `Mandelbrot Set Location\n\n`;
      shareText += `Center: ${reStr} ${imStr.startsWith('-') ? '' : '+'}${imStr}i\n`;
      shareText += `Scale: ${view.scale.toExponential(6)}\n`;
      shareText += `Zoom: ${zoomLevel.toExponential(2)}×\n`;
      shareText += `Iterations: ${maxIter}`;
    }
    
    // Copy to clipboard
    try {
      await navigator.clipboard.writeText(shareText);
      // Show success feedback
      const feedback = document.createElement('div');
      feedback.textContent = '✓ Location copied to clipboard!';
      feedback.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(102,126,234,0.95);color:white;padding:16px 24px;border-radius:8px;font-size:1rem;font-weight:600;z-index:10001;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
      document.body.appendChild(feedback);
      setTimeout(() => feedback.remove(), 2000);
    } catch(err) {
      console.error('Failed to copy to clipboard:', err);
      alert('Failed to copy to clipboard. Please try again.');
    }
  });

  // Save Location functionality
  const menuSaveLocation = document.getElementById('menu-save-location');
  const saveLocationModal = document.getElementById('save-location-modal');
  const locationNameInput = document.getElementById('location-name-input');
  const saveLocationBtn = document.getElementById('save-location-btn');
  const cancelLocationBtn = document.getElementById('cancel-location-btn');

  menuSaveLocation.addEventListener('click', function(){
    hideContextMenu();
    // Only allow saving in Mandelbrot mode
    if(isJuliaMode){
      alert('Location saving is only available in Mandelbrot mode');
      return;
    }
    // Show modal and focus input
    saveLocationModal.classList.remove('hidden');
    locationNameInput.value = '';
    locationNameInput.focus();
  });

  function saveCurrentLocation(){
    const name = locationNameInput.value.trim();
    if(!name){
      alert('Please enter a name for this location');
      return;
    }

    // Generate a unique key
    const key = 'loc_' + Date.now();
    
    // Save location with high-precision coordinates AND current iteration count
    customLocations[key] = {
      name: name,
      cx: view.cx,
      cy: view.cy,
      scale: view.scale,
      // Store high-precision Decimal coordinates as strings for deep zoom
      centerRe: centerRe.toString(),
      centerIm: centerIm.toString(),
      // Save the current iteration count as a starting point for future loads
      iterations: maxIter
    };

    saveCustomLocations(customLocations);
    populateLocationDropdown();

    // Close modal
    saveLocationModal.classList.add('hidden');
    
    console.log(`💾 Saved location "${name}" with ${maxIter} iterations`);
  }

  saveLocationBtn.addEventListener('click', saveCurrentLocation);
  
  cancelLocationBtn.addEventListener('click', function(){
    saveLocationModal.classList.add('hidden');
  });

  // Allow Enter key to save
  locationNameInput.addEventListener('keydown', function(e){
    // Stop event from bubbling to document keydown handler
    e.stopPropagation();
    if(e.key === 'Enter'){
      saveCurrentLocation();
    } else if(e.key === 'Escape'){
      saveLocationModal.classList.add('hidden');
    }
  });

  // Close modal when clicking outside
  saveLocationModal.addEventListener('click', function(e){
    if(e.target === saveLocationModal){
      saveLocationModal.classList.add('hidden');
    }
  });

  // Manage Locations functionality
  const manageLocationsBtn = document.getElementById('manage-locations-btn');
  const manageLocationsModal = document.getElementById('manage-locations-modal');
  const manageLocationsList = document.getElementById('manage-locations-list');
  const closeManageBtn = document.getElementById('close-manage-btn');

  function populateManageList(){
    manageLocationsList.innerHTML = '';
    
    if(Object.keys(customLocations).length === 0){
      return; // Empty state handled by CSS
    }

    for(const [key, loc] of Object.entries(customLocations)){
      const item = document.createElement('div');
      item.className = 'location-item';
      
      const nameSpan = document.createElement('span');
      nameSpan.className = 'location-name';
      nameSpan.textContent = loc.name;
      
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-location-btn';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', function(){
        if(confirm(`Delete "${loc.name}"?`)){
          delete customLocations[key];
          saveCustomLocations(customLocations);
          populateLocationDropdown();
          populateManageList();
        }
      });
      
      item.appendChild(nameSpan);
      item.appendChild(deleteBtn);
      manageLocationsList.appendChild(item);
    }
  }

  manageLocationsBtn.addEventListener('click', function(){
    populateManageList();
    manageLocationsModal.classList.remove('hidden');
  });

  closeManageBtn.addEventListener('click', function(){
    manageLocationsModal.classList.add('hidden');
  });

  manageLocationsModal.addEventListener('click', function(e){
    if(e.target === manageLocationsModal){
      manageLocationsModal.classList.add('hidden');
    }
  });

  // ============ JULIA SET LOCATIONS ============

  // Preset Julia sets (famous ones)
  const presetJuliaSets = {
    'dendrite': { cx: 0, cy: 0, c_real: -0.4, c_imag: 0.6, scale: 0.003, name: 'Dendrite Julia' },
    'douady-rabbit': { cx: 0, cy: 0, c_real: -0.123, c_imag: 0.745, scale: 0.003, name: 'Douady Rabbit' },
    'siegel-disk': { cx: 0, cy: 0, c_real: -0.391, c_imag: -0.587, scale: 0.003, name: 'Siegel Disk' },
    'san-marco': { cx: 0, cy: 0, c_real: -0.75, c_imag: 0, scale: 0.003, name: 'San Marco' },
    'spiral': { cx: 0, cy: 0, c_real: -0.70176, c_imag: -0.3842, scale: 0.003, name: 'Spiral' },
    'dragon': { cx: 0, cy: 0, c_real: -0.8, c_imag: 0.156, scale: 0.003, name: 'Dragon' },
    'galaxies': { cx: 0, cy: 0, c_real: -0.7269, c_imag: 0.1889, scale: 0.003, name: 'Galaxies' },
    'frost': { cx: 0, cy: 0, c_real: 0.285, c_imag: 0.01, scale: 0.003, name: 'Frost' }
  };

  // Load custom Julia sets from localStorage
  function loadCustomJuliaSets(){
    const stored = localStorage.getItem('mandelscope-custom-julia');
    return stored ? JSON.parse(stored) : {};
  }

  function saveCustomJuliaSets(customJulia){
    localStorage.setItem('mandelscope-custom-julia', JSON.stringify(customJulia));
  }

  let customJuliaSets = loadCustomJuliaSets();

  // Populate Julia dropdown
  function populateJuliaDropdown(){
    const juliaSelect = document.getElementById('julia-locations');
    const firstOption = juliaSelect.firstElementChild;
    juliaSelect.innerHTML = '';
    juliaSelect.appendChild(firstOption);

    // Add preset Julia sets
    const presetGroup = document.createElement('optgroup');
    presetGroup.label = 'Famous Julia Sets';
    for(const [key, julia] of Object.entries(presetJuliaSets)){
      const option = document.createElement('option');
      option.value = 'preset:' + key;
      option.textContent = julia.name;
      presetGroup.appendChild(option);
    }
    juliaSelect.appendChild(presetGroup);

    // Add custom Julia sets if any exist
    if(Object.keys(customJuliaSets).length > 0){
      const customGroup = document.createElement('optgroup');
      customGroup.label = 'My Julia Sets';
      for(const [key, julia] of Object.entries(customJuliaSets)){
        const option = document.createElement('option');
        option.value = 'custom:' + key;
        option.textContent = julia.name;
        customGroup.appendChild(option);
      }
      juliaSelect.appendChild(customGroup);
    }
  }

  populateJuliaDropdown();

  // Julia dropdown change handler
  const juliaSelect = document.getElementById('julia-locations');
  juliaSelect.addEventListener('change', function(){
    const selected = this.value;
    if(selected){
      let julia = null;
      if(selected.startsWith('preset:')){
        const key = selected.substring(7);
        julia = presetJuliaSets[key];
      } else if(selected.startsWith('custom:')){
        const key = selected.substring(7);
        julia = customJuliaSets[key];
      }
      
      if(julia){
        // Close hamburger menu
        settingsPanel.classList.add('hidden');
        menuToggle.classList.remove('active');
        
        // Switch to Julia mode with the specified c value
        juliaC.x = julia.c_real;
        juliaC.y = julia.c_imag;
        
        if(!isJuliaMode){
          // Switch from Mandelbrot to Julia mode
          isJuliaMode = true;
          juliaInfo.classList.remove('hidden');
          backToMandelbrotBtn.classList.remove('hidden');
          updateJuliaDisplay();
        } else {
          // Already in Julia mode, just update the c value
          updateJuliaDisplay();
        }
        
        // Animate to the view
        animateView(julia.cx, julia.cy, julia.scale);
        
        // Reset dropdown after a short delay
        setTimeout(() => {
          this.value = '';
        }, 300);
      }
    }
  });

  // Save Julia Set functionality
  const menuSaveJulia = document.getElementById('menu-save-julia');
  const saveJuliaModal = document.getElementById('save-julia-modal');
  const juliaNameInput = document.getElementById('julia-name-input');
  const saveJuliaBtn = document.getElementById('save-julia-btn');
  const cancelJuliaBtn = document.getElementById('cancel-julia-btn');

  menuSaveJulia.addEventListener('click', function(){
    hideContextMenu();
    // Only allow saving in Julia mode
    if(!isJuliaMode){
      alert('Julia set saving is only available in Julia mode');
      return;
    }
    // Show modal and focus input
    saveJuliaModal.classList.remove('hidden');
    juliaNameInput.value = '';
    juliaNameInput.focus();
  });

  function saveCurrentJuliaSet(){
    const name = juliaNameInput.value.trim();
    if(!name){
      alert('Please enter a name for this Julia set');
      return;
    }

    // Generate a unique key
    const key = 'julia_' + Date.now();
    
    // Save Julia set
    customJuliaSets[key] = {
      name: name,
      cx: view.cx,
      cy: view.cy,
      scale: view.scale,
      c_real: juliaC.x,
      c_imag: juliaC.y
    };

    saveCustomJuliaSets(customJuliaSets);
    populateJuliaDropdown();

    // Close modal
    saveJuliaModal.classList.add('hidden');
  }

  saveJuliaBtn.addEventListener('click', saveCurrentJuliaSet);
  
  cancelJuliaBtn.addEventListener('click', function(){
    saveJuliaModal.classList.add('hidden');
  });

  // Allow Enter key to save
  juliaNameInput.addEventListener('keydown', function(e){
    // Stop event from bubbling to document keydown handler
    e.stopPropagation();
    if(e.key === 'Enter'){
      saveCurrentJuliaSet();
    } else if(e.key === 'Escape'){
      saveJuliaModal.classList.add('hidden');
    }
  });

  // Close modal when clicking outside
  saveJuliaModal.addEventListener('click', function(e){
    if(e.target === saveJuliaModal){
      saveJuliaModal.classList.add('hidden');
    }
  });

  // Manage Julia Sets functionality
  const manageJuliaBtn = document.getElementById('manage-julia-btn');
  const manageJuliaModal = document.getElementById('manage-julia-modal');
  const manageJuliaList = document.getElementById('manage-julia-list');
  const closeManageJuliaBtn = document.getElementById('close-manage-julia-btn');

  function populateManageJuliaList(){
    manageJuliaList.innerHTML = '';
    
    if(Object.keys(customJuliaSets).length === 0){
      return; // Empty state handled by CSS
    }

    for(const [key, julia] of Object.entries(customJuliaSets)){
      const item = document.createElement('div');
      item.className = 'location-item';
      
      const nameSpan = document.createElement('span');
      nameSpan.className = 'location-name';
      nameSpan.textContent = julia.name;
      
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-location-btn';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', function(){
        if(confirm(`Delete "${julia.name}"?`)){
          delete customJuliaSets[key];
          saveCustomJuliaSets(customJuliaSets);
          populateJuliaDropdown();
          populateManageJuliaList();
        }
      });
      
      item.appendChild(nameSpan);
      item.appendChild(deleteBtn);
      manageJuliaList.appendChild(item);
    }
  }

  manageJuliaBtn.addEventListener('click', function(){
    populateManageJuliaList();
    manageJuliaModal.classList.remove('hidden');
  });

  closeManageJuliaBtn.addEventListener('click', function(){
    manageJuliaModal.classList.add('hidden');
  });

  manageJuliaModal.addEventListener('click', function(e){
    if(e.target === manageJuliaModal){
      manageJuliaModal.classList.add('hidden');
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

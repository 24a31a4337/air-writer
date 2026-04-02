/**
 * Air Writer — Draw in the air using hand gestures
 * Uses MediaPipe Hands for real-time hand tracking
 */

(function () {
  'use strict';

  // ───── DOM References ─────
  const video = document.getElementById('webcam');
  const drawCanvas = document.getElementById('drawCanvas');
  const landmarkCanvas = document.getElementById('landmarkCanvas');
  const drawCtx = drawCanvas.getContext('2d');
  const landmarkCtx = landmarkCanvas.getContext('2d');

  const startBtn = document.getElementById('startBtn');
  const onboarding = document.getElementById('onboarding');
  const statusBadge = document.getElementById('statusBadge');
  const statusText = document.getElementById('statusText');
  const gestureIndicator = document.getElementById('gestureIndicator');
  const gestureIcon = document.getElementById('gestureIcon');
  const gestureLabel = document.getElementById('gestureLabel');
  const fpsCounter = document.getElementById('fpsCounter');

  const colorPicker = document.getElementById('colorPicker');
  const swatches = document.querySelectorAll('.swatch');
  const thicknessSlider = document.getElementById('thickness');
  const thicknessVal = document.getElementById('thicknessVal');
  const smoothingSlider = document.getElementById('smoothing');
  const glowToggle = document.getElementById('glowToggle');
  const undoBtn = document.getElementById('undoBtn');
  const clearBtn = document.getElementById('clearBtn');
  const saveBtn = document.getElementById('saveBtn');

  // ───── State ─────
  let currentColor = '#00e5ff';
  let currentThickness = 4;
  let smoothingFactor = 5;
  let glowEnabled = true;
  let isDrawing = false;
  let currentStroke = [];
  let allStrokes = []; // history for undo
  let lastPoint = null;
  let smoothedPoint = null;
  let currentGesture = 'none';
  let clearGestureTimer = null;
  let clearGestureHeld = false;
  let cameraRunning = false;

  // FPS tracking
  let frameCount = 0;
  let lastFpsTime = performance.now();

  // ───── Sizing ─────
  function resizeCanvases() {
    const area = document.getElementById('canvasArea');
    const w = area.clientWidth;
    const h = area.clientHeight;

    // Save current drawing
    const savedImage = drawCanvas.width > 0 ? drawCtx.getImageData(0, 0, drawCanvas.width, drawCanvas.height) : null;

    drawCanvas.width = w;
    drawCanvas.height = h;
    landmarkCanvas.width = w;
    landmarkCanvas.height = h;

    // Restore drawing if possible (won't work perfectly on resize but prevents full loss)
    if (savedImage && savedImage.width > 0) {
      // Redraw all strokes from history instead
      redrawAllStrokes();
    }
  }

  function redrawAllStrokes() {
    drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
    for (const stroke of allStrokes) {
      drawStroke(stroke);
    }
  }

  function drawStroke(stroke) {
    if (stroke.points.length < 2) return;
    drawCtx.save();
    drawCtx.strokeStyle = stroke.color;
    drawCtx.lineWidth = stroke.thickness;
    drawCtx.lineCap = 'round';
    drawCtx.lineJoin = 'round';

    if (stroke.glow) {
      drawCtx.shadowColor = stroke.color;
      drawCtx.shadowBlur = stroke.thickness * 3;
    }

    if (stroke.eraser) {
      drawCtx.globalCompositeOperation = 'destination-out';
      drawCtx.shadowColor = 'transparent';
      drawCtx.shadowBlur = 0;
    }

    drawCtx.beginPath();
    drawCtx.moveTo(stroke.points[0].x, stroke.points[0].y);

    // Use quadratic curves for smooth lines
    for (let i = 1; i < stroke.points.length - 1; i++) {
      const cp = stroke.points[i];
      const next = stroke.points[i + 1];
      const midX = (cp.x + next.x) / 2;
      const midY = (cp.y + next.y) / 2;
      drawCtx.quadraticCurveTo(cp.x, cp.y, midX, midY);
    }

    // Draw to the last point
    const last = stroke.points[stroke.points.length - 1];
    drawCtx.lineTo(last.x, last.y);
    drawCtx.stroke();
    drawCtx.restore();
  }

  // ───── Gesture Detection ─────
  function isFingerExtended(landmarks, fingerTip, fingerPIP) {
    // A finger is "up" if the tip is above (lower y) the PIP joint
    return landmarks[fingerTip].y < landmarks[fingerPIP].y;
  }

  function detectGesture(landmarks) {
    const indexUp = isFingerExtended(landmarks, 8, 6);
    const middleUp = isFingerExtended(landmarks, 12, 10);
    const ringUp = isFingerExtended(landmarks, 16, 14);
    const pinkyUp = isFingerExtended(landmarks, 20, 18);

    // Thumb check (different axis — use x relative to index MCP)
    const thumbUp = landmarks[4].x < landmarks[3].x; // for right hand (mirrored)

    const fingersUp = [thumbUp, indexUp, middleUp, ringUp, pinkyUp];
    const upCount = fingersUp.filter(Boolean).length;

    // Open palm — all 5 fingers up
    if (upCount >= 4 && indexUp && middleUp && ringUp) {
      return 'clear';
    }

    // Two fingers — index and middle up, others down
    if (indexUp && middleUp && !ringUp && !pinkyUp) {
      return 'erase';
    }

    // Index only — draw
    if (indexUp && !middleUp && !ringUp && !pinkyUp) {
      return 'draw';
    }

    // Fist or anything else — idle
    return 'idle';
  }

  // ───── Update Gesture UI ─────
  function updateGestureUI(gesture) {
    gestureIndicator.classList.add('visible');
    gestureIndicator.classList.remove('drawing', 'erasing', 'clearing');

    switch (gesture) {
      case 'draw':
        gestureIcon.textContent = '✏️';
        gestureLabel.textContent = 'Drawing';
        gestureIndicator.classList.add('drawing');
        break;
      case 'erase':
        gestureIcon.textContent = '🧹';
        gestureLabel.textContent = 'Erasing';
        gestureIndicator.classList.add('erasing');
        break;
      case 'clear':
        gestureIcon.textContent = '🖐️';
        gestureLabel.textContent = 'Hold to clear...';
        gestureIndicator.classList.add('clearing');
        break;
      case 'idle':
        gestureIcon.textContent = '✊';
        gestureLabel.textContent = 'Pen up';
        break;
      default:
        gestureIcon.textContent = '👀';
        gestureLabel.textContent = 'Waiting...';
    }
  }

  // ───── Smoothing ─────
  function smooth(current, previous, factor) {
    if (!previous || factor === 0) return current;
    const alpha = factor / 10;
    return {
      x: previous.x * alpha + current.x * (1 - alpha),
      y: previous.y * alpha + current.y * (1 - alpha),
    };
  }

  // ───── MediaPipe Hands ─────
  function onResults(results) {
    // FPS
    frameCount++;
    const now = performance.now();
    if (now - lastFpsTime >= 1000) {
      fpsCounter.textContent = `${frameCount} FPS`;
      frameCount = 0;
      lastFpsTime = now;
    }

    // Clear landmark canvas
    landmarkCtx.clearRect(0, 0, landmarkCanvas.width, landmarkCanvas.height);

    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      // No hand detected
      if (isDrawing) {
        finishStroke();
      }
      currentGesture = 'none';
      updateGestureUI('none');
      lastPoint = null;
      smoothedPoint = null;
      return;
    }

    const landmarks = results.multiHandLandmarks[0];
    const w = landmarkCanvas.width;
    const h = landmarkCanvas.height;

    // Draw hand skeleton with glow
    landmarkCtx.save();
    landmarkCtx.globalAlpha = 0.4;
    drawConnectors(landmarkCtx, landmarks, HAND_CONNECTIONS, {
      color: 'rgba(0, 229, 255, 0.3)',
      lineWidth: 2,
    });
    drawLandmarks(landmarkCtx, landmarks, {
      color: 'rgba(0, 229, 255, 0.5)',
      lineWidth: 1,
      radius: 3,
    });
    landmarkCtx.restore();

    // Highlight index fingertip
    const tipX = (1 - landmarks[8].x) * w; // mirror
    const tipY = landmarks[8].y * h;

    landmarkCtx.save();
    landmarkCtx.beginPath();
    landmarkCtx.arc(tipX, tipY, 8, 0, Math.PI * 2);
    landmarkCtx.fillStyle = currentColor;
    landmarkCtx.shadowColor = currentColor;
    landmarkCtx.shadowBlur = 16;
    landmarkCtx.fill();
    landmarkCtx.restore();

    // Detect gesture
    const gesture = detectGesture(landmarks);

    // Handle gestures
    if (gesture === 'draw') {
      const rawPoint = { x: tipX, y: tipY };
      const point = smooth(rawPoint, smoothedPoint, smoothingFactor);
      smoothedPoint = point;

      if (!isDrawing || currentGesture !== 'draw') {
        // Start new draw stroke
        if (isDrawing) finishStroke();
        isDrawing = true;
        currentStroke = [];
        lastPoint = point;
      }

      currentStroke.push(point);

      // Real-time drawing
      if (lastPoint && currentStroke.length > 1) {
        drawCtx.save();
        drawCtx.strokeStyle = currentColor;
        drawCtx.lineWidth = currentThickness;
        drawCtx.lineCap = 'round';
        drawCtx.lineJoin = 'round';
        if (glowEnabled) {
          drawCtx.shadowColor = currentColor;
          drawCtx.shadowBlur = currentThickness * 3;
        }
        drawCtx.beginPath();
        drawCtx.moveTo(lastPoint.x, lastPoint.y);
        drawCtx.lineTo(point.x, point.y);
        drawCtx.stroke();
        drawCtx.restore();
      }

      lastPoint = point;
    } else if (gesture === 'erase') {
      const rawPoint = { x: tipX, y: tipY };
      const point = smooth(rawPoint, smoothedPoint, smoothingFactor);
      smoothedPoint = point;

      if (!isDrawing || currentGesture !== 'erase') {
        if (isDrawing) finishStroke();
        isDrawing = true;
        currentStroke = [];
        lastPoint = point;
      }

      currentStroke.push(point);

      // Erase in real-time
      if (lastPoint && currentStroke.length > 1) {
        drawCtx.save();
        drawCtx.globalCompositeOperation = 'destination-out';
        drawCtx.strokeStyle = 'rgba(0,0,0,1)';
        drawCtx.lineWidth = currentThickness * 5;
        drawCtx.lineCap = 'round';
        drawCtx.lineJoin = 'round';
        drawCtx.beginPath();
        drawCtx.moveTo(lastPoint.x, lastPoint.y);
        drawCtx.lineTo(point.x, point.y);
        drawCtx.stroke();
        drawCtx.restore();
      }

      lastPoint = point;
    } else if (gesture === 'clear') {
      if (isDrawing) finishStroke();
      // Require holding for 1 second to clear
      if (!clearGestureTimer) {
        clearGestureTimer = setTimeout(() => {
          clearGestureHeld = true;
          clearCanvas();
          clearGestureTimer = null;
        }, 1000);
      }
      lastPoint = null;
      smoothedPoint = null;
    } else {
      // idle
      if (isDrawing) finishStroke();
      lastPoint = null;
      smoothedPoint = null;
    }

    // Cancel clear timer if gesture changes
    if (gesture !== 'clear' && clearGestureTimer) {
      clearTimeout(clearGestureTimer);
      clearGestureTimer = null;
      clearGestureHeld = false;
    }

    currentGesture = gesture;
    updateGestureUI(gesture);
  }

  function finishStroke() {
    if (currentStroke.length > 1) {
      allStrokes.push({
        points: [...currentStroke],
        color: currentGesture === 'erase' ? 'rgba(0,0,0,1)' : currentColor,
        thickness: currentGesture === 'erase' ? currentThickness * 5 : currentThickness,
        glow: glowEnabled && currentGesture !== 'erase',
        eraser: currentGesture === 'erase',
      });
    }
    isDrawing = false;
    currentStroke = [];
    lastPoint = null;
    smoothedPoint = null;
  }

  function clearCanvas() {
    drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
    allStrokes = [];
    currentStroke = [];

    // Flash effect
    drawCtx.save();
    drawCtx.fillStyle = 'rgba(255, 64, 96, 0.15)';
    drawCtx.fillRect(0, 0, drawCanvas.width, drawCanvas.height);
    drawCtx.restore();
    setTimeout(() => {
      drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
    }, 150);
  }

  function undo() {
    if (allStrokes.length === 0) return;
    allStrokes.pop();
    redrawAllStrokes();
  }

  function saveCanvas() {
    // Create a combined image
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = drawCanvas.width;
    tempCanvas.height = drawCanvas.height;
    const tempCtx = tempCanvas.getContext('2d');

    // Dark background
    tempCtx.fillStyle = '#0a0e17';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    // Draw the strokes
    tempCtx.drawImage(drawCanvas, 0, 0);

    // Download
    const link = document.createElement('a');
    link.download = `air-writing-${Date.now()}.png`;
    link.href = tempCanvas.toDataURL('image/png');
    link.click();
  }

  // ───── Initialize MediaPipe ─────
  async function initCamera() {
    statusText.textContent = 'Loading ML model...';

    const hands = new Hands({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`,
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.6,
    });

    hands.onResults(onResults);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: 'user' },
      });
      video.srcObject = stream;
      await video.play();
      video.classList.add('active');

      // Start camera loop
      const camera = new Camera(video, {
        onFrame: async () => {
          await hands.send({ image: video });
        },
        width: 1280,
        height: 720,
      });

      await camera.start();
      cameraRunning = true;

      statusBadge.classList.add('active');
      statusText.textContent = 'Tracking active';
      onboarding.classList.add('hidden');
    } catch (err) {
      console.error('Camera error:', err);
      statusText.textContent = 'Camera access denied';
      alert(
        'Camera access is required for Air Writer to work.\nPlease allow camera permission and reload.'
      );
    }
  }

  // ───── Event Listeners ─────
  startBtn.addEventListener('click', initCamera);

  // Color swatches
  swatches.forEach((swatch) => {
    swatch.addEventListener('click', () => {
      const color = swatch.dataset.color;
      currentColor = color;
      colorPicker.value = color;
      swatches.forEach((s) => s.classList.remove('active'));
      swatch.classList.add('active');
    });
  });

  colorPicker.addEventListener('input', (e) => {
    currentColor = e.target.value;
    swatches.forEach((s) => s.classList.remove('active'));
  });

  thicknessSlider.addEventListener('input', (e) => {
    currentThickness = parseInt(e.target.value);
    thicknessVal.textContent = currentThickness;
  });

  smoothingSlider.addEventListener('input', (e) => {
    smoothingFactor = parseInt(e.target.value);
  });

  glowToggle.addEventListener('change', (e) => {
    glowEnabled = e.target.checked;
  });

  undoBtn.addEventListener('click', undo);
  clearBtn.addEventListener('click', clearCanvas);
  saveBtn.addEventListener('click', saveCanvas);

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'z') {
      e.preventDefault();
      undo();
    }
    if (e.key === 'Delete' || (e.ctrlKey && e.key === 'x')) {
      e.preventDefault();
      clearCanvas();
    }
  });

  // Resize
  window.addEventListener('resize', resizeCanvases);
  resizeCanvases();
})();

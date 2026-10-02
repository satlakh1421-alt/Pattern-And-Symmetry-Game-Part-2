/**
 * ============================================================================
 * Pattern Pulse: Symmetry Circuit
 * Cambridge Maths: Pattern & Symmetry (Floor 2)
 *
 * An arcade sequence puzzle action game where players analyze repeating
 * geometric patterns, apply 90°/180° rotational and reflective transformations,
 * and lock the matching pulses into high-voltage symmetry power circuits.
 *
 * Strictly compliant with StuCent runtime rules:
 * - root DOM access with fallback for local testing
 * - game.end({ score, stars, maxScore, success })
 * - Zero external URLs / zero external assets (pure inline Canvas & WebAudio)
 * - Zero periodic polling (only requestAnimationFrame & setTimeout)
 * - Zero global leakage (scoped inside IIFE)
 * - Tablet/touch first with pointer events
 * ============================================================================
 */

(function () {
  'use strict';

  // ==========================================================================
  // DOM ACCESS HELPERS (The "Golden Rule")
  // ==========================================================================
  const $ = (id) => (typeof root !== 'undefined' ? root.getElementById(id) : document.getElementById(id));
  const $$ = (sel) => (typeof root !== 'undefined' ? root.querySelectorAll(sel) : document.querySelectorAll(sel));

  // ==========================================================================
  // AUDIO SYNTHESIZER (WebAudio API — 100% Self-Contained, Zero External Files)
  // ==========================================================================
  let audioCtx = null;
  let soundEnabled = true;
  let isAudioUnlocked = false;
  let bgmStep = 0;
  let bgmTimeout = null;

  function initAudio() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function unlockAudio() {
    initAudio();
    if (audioCtx && audioCtx.state === 'running' && soundEnabled && !bgmTimeout) {
      startBgm();
    }
  }

  function playTone(freq, durationMs, type = 'sine', gainVal = 0.1) {
    if (!soundEnabled || !audioCtx || audioCtx.state !== 'running') return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

      gain.gain.setValueAtTime(gainVal, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + durationMs / 1000);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + durationMs / 1000);
    } catch (e) {}
  }

  function playSound(name) {
    if (!soundEnabled || !audioCtx || audioCtx.state !== 'running') return;
    try {
      if (name === 'rotate') {
        // Crisp mechanical click
        playTone(587.33, 70, 'triangle', 0.1);
        setTimeout(() => playTone(880, 80, 'sine', 0.08), 30);
      } else if (name === 'flip') {
        // Fast whoosh
        playTone(440, 90, 'sine', 0.12);
        setTimeout(() => playTone(659.25, 90, 'triangle', 0.1), 40);
      } else if (name === 'circuit-lock') {
        // Energetic power lock
        playTone(523.25, 120, 'sine', 0.14);
        setTimeout(() => playTone(659.25, 140, 'triangle', 0.16), 50);
        setTimeout(() => playTone(783.99, 180, 'sine', 0.18), 100);
        setTimeout(() => playTone(1046.5, 260, 'triangle', 0.22), 150);
      } else if (name === 'wrong') {
        // Hollow buzzer thud
        playTone(160, 200, 'sawtooth', 0.12);
        playTone(110, 240, 'square', 0.08);
      } else if (name === 'countdown') {
        playTone(440, 100, 'sine', 0.12);
      } else if (name === 'launch') {
        playTone(880, 250, 'triangle', 0.2);
      } else if (name === 'tick') {
        playTone(740, 40, 'sine', 0.05);
      } else if (name === 'level-clear') {
        [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
          setTimeout(() => playTone(f, 320, 'sine', 0.14), i * 60);
        });
      } else if (name === 'star') {
        playTone(784, 160, 'sine', 0.14);
        setTimeout(() => playTone(1046.5, 280, 'triangle', 0.18), 80);
      }
    } catch (e) {}
  }

  // --- BGM: Cyber Pulse Ambient Synth Loop ---
  const bgmNotes = [
    261.63, 329.63, 392.00, 523.25, 392.00, 329.63,
    293.66, 349.23, 440.00, 587.33, 440.00, 349.23,
    220.00, 261.63, 329.63, 440.00, 329.63, 261.63,
    196.00, 261.63, 329.63, 392.00, 329.63, 261.63
  ];

  function scheduleBgmNote() {
    if (!soundEnabled) { stopBgm(); return; }
    if (!audioCtx || audioCtx.state !== 'running') {
      bgmTimeout = setTimeout(scheduleBgmNote, 340);
      return;
    }
    const note = bgmNotes[bgmStep % bgmNotes.length];
    playTone(note, 300, 'sine', 0.035);
    playTone(note / 2, 380, 'triangle', 0.02);
    bgmStep++;
    bgmTimeout = setTimeout(scheduleBgmNote, 340);
  }

  function startBgm() {
    if (bgmTimeout || !soundEnabled) return;
    bgmStep = 0;
    scheduleBgmNote();
  }

  function stopBgm() {
    if (bgmTimeout) {
      clearTimeout(bgmTimeout);
      bgmTimeout = null;
    }
  }

  function toggleSound() {
    soundEnabled = !soundEnabled;
    const icon = $('sound-icon');
    if (icon) icon.textContent = soundEnabled ? '🔊' : '🔇';
    if (soundEnabled) {
      initAudio();
      startBgm();
    } else {
      stopBgm();
    }
  }

  // ==========================================================================
  // LEVEL DEFINITIONS: REPEATING SEQUENCES & SYMMETRY TRANSFORMATIONS
  // ==========================================================================
  // Shape motifs:
  // - 'arrow': Triangle chevron pointing at angle
  // - 'wing': Asymmetrical butterfly wing (tests reflection flip!)
  // - 'crystal': Hexagon/kite with distinct color split
  // - 'cross': T-shape or asymmetric cross
  // Transformation parameters:
  // - rotation: 0, 90, 180, 270 (degrees)
  // - isFlipped: true/false (horizontal mirror reflection)
  // - color: hex string

  const LEVELS = [
    {
      levelNum: 1,
      title: 'Reflection Sequences',
      ruleTag: 'HORIZONTAL REFLECTION',
      timerSec: 35,
      circuits: [
        {
          name: 'Wing Pair Echo',
          shape: 'wing',
          ruleDesc: 'Alternating left and right mirror reflection!',
          hint: 'The wing flips across the vertical mirror axis each step!',
          terms: [
            { rotation: 0, isFlipped: false, color: '#a78bfa' },
            { rotation: 0, isFlipped: true,  color: '#a78bfa' },
            { rotation: 0, isFlipped: false, color: '#a78bfa' },
            { isMissing: true, rotation: 0, isFlipped: true, color: '#a78bfa' }
          ]
        },
        {
          name: 'Prism Shield Echo',
          shape: 'crystal',
          ruleDesc: 'Flipped dual-tone crystal reflection',
          hint: 'Look at the highlighted face: it mirrors side to side!',
          terms: [
            { rotation: 0, isFlipped: true,  color: '#06b6d4' },
            { rotation: 0, isFlipped: false, color: '#06b6d4' },
            { rotation: 0, isFlipped: true,  color: '#06b6d4' },
            { isMissing: true, rotation: 0, isFlipped: false, color: '#06b6d4' }
          ]
        },
        {
          name: 'Chevron Mirror Cadence',
          shape: 'arrow',
          ruleDesc: 'Opposite arrow reflections',
          hint: 'Left, Right, Left, Right... mirror the token!',
          terms: [
            { rotation: 270, isFlipped: false, color: '#f59e0b' },
            { rotation: 90,  isFlipped: false, color: '#f59e0b' },
            { rotation: 270, isFlipped: false, color: '#f59e0b' },
            { isMissing: true, rotation: 90, isFlipped: false, color: '#f59e0b' }
          ]
        }
      ]
    },
    {
      levelNum: 2,
      title: 'Quarter-Turn Rotations (90° CW)',
      ruleTag: 'ROTATION 90° CW',
      timerSec: 35,
      circuits: [
        {
          name: 'Clockwise Compass',
          shape: 'arrow',
          ruleDesc: 'Rotating 90° clockwise every step: Up → Right → Down → Left',
          hint: 'Each step turns 90° clockwise (quarter turn)!',
          terms: [
            { rotation: 0,   isFlipped: false, color: '#06b6d4' },
            { rotation: 90,  isFlipped: false, color: '#06b6d4' },
            { rotation: 180, isFlipped: false, color: '#06b6d4' },
            { isMissing: true, rotation: 270, isFlipped: false, color: '#06b6d4' }
          ]
        },
        {
          name: 'Orbital Crystal Surge',
          shape: 'crystal',
          ruleDesc: 'Continuous 90° quarter turns',
          hint: 'Track the glowing tip: it turns one quarter turn clockwise!',
          terms: [
            { rotation: 90,  isFlipped: false, color: '#a78bfa' },
            { rotation: 180, isFlipped: false, color: '#a78bfa' },
            { rotation: 270, isFlipped: false, color: '#a78bfa' },
            { isMissing: true, rotation: 0, isFlipped: false, color: '#a78bfa' }
          ]
        },
        {
          name: 'Radial Cross Pulse',
          shape: 'cross',
          ruleDesc: 'Quarter-turn radial rotation',
          hint: 'Rotate the token by 90° to continue the cycle!',
          terms: [
            { rotation: 180, isFlipped: false, color: '#10b981' },
            { rotation: 270, isFlipped: false, color: '#10b981' },
            { rotation: 0,   isFlipped: false, color: '#10b981' },
            { isMissing: true, rotation: 90, isFlipped: false, color: '#10b981' }
          ]
        }
      ]
    },
    {
      levelNum: 3,
      title: 'Half-Turns (180° Inversion)',
      ruleTag: 'HALF-TURN 180°',
      timerSec: 40,
      circuits: [
        {
          name: 'Solar Polarity Relay',
          shape: 'arrow',
          ruleDesc: '180° half-turn rotation (Up / Down / Up / Down)',
          hint: 'Half turn: 180 degrees flips it upside down!',
          terms: [
            { rotation: 0,   isFlipped: false, color: '#f59e0b' },
            { rotation: 180, isFlipped: false, color: '#06b6d4' },
            { rotation: 0,   isFlipped: false, color: '#f59e0b' },
            { isMissing: true, rotation: 180, isFlipped: false, color: '#06b6d4' }
          ]
        },
        {
          name: 'Bipolar Wing Matrix',
          shape: 'wing',
          ruleDesc: '180° rotation inversion',
          hint: 'Rotate twice by 90° (or 180°) to match the polarity!',
          terms: [
            { rotation: 90,  isFlipped: false, color: '#a78bfa' },
            { rotation: 270, isFlipped: false, color: '#a78bfa' },
            { rotation: 90,  isFlipped: false, color: '#a78bfa' },
            { isMissing: true, rotation: 270, isFlipped: false, color: '#a78bfa' }
          ]
        },
        {
          name: 'Prism Alternator',
          shape: 'crystal',
          ruleDesc: 'Alternating 180° half-turn + color shift',
          hint: 'Invert the pulse by 180 degrees!',
          terms: [
            { rotation: 270, isFlipped: false, color: '#10b981' },
            { rotation: 90,  isFlipped: false, color: '#f59e0b' },
            { rotation: 270, isFlipped: false, color: '#10b981' },
            { isMissing: true, rotation: 90, isFlipped: false, color: '#f59e0b' }
          ]
        }
      ]
    },
    {
      levelNum: 4,
      title: 'Glide & Rotation Combinations',
      ruleTag: 'ROTATE + REFLECT',
      timerSec: 45,
      circuits: [
        {
          name: 'Glide Reflection Spiral',
          shape: 'wing',
          ruleDesc: 'Rotates 90° AND flips mirror across each step',
          hint: 'Combined rule: both turns 90° clockwise and flips mirror!',
          terms: [
            { rotation: 0,   isFlipped: false, color: '#a78bfa' },
            { rotation: 90,  isFlipped: true,  color: '#a78bfa' },
            { rotation: 180, isFlipped: false, color: '#a78bfa' },
            { isMissing: true, rotation: 270, isFlipped: true, color: '#a78bfa' }
          ]
        },
        {
          name: 'Cyber Cross Glide',
          shape: 'cross',
          ruleDesc: 'Reflects then rotates quarter turn',
          hint: 'Analyze the wing tips: flip then rotate!',
          terms: [
            { rotation: 90,  isFlipped: false, color: '#06b6d4' },
            { rotation: 180, isFlipped: true,  color: '#06b6d4' },
            { rotation: 270, isFlipped: false, color: '#06b6d4' },
            { isMissing: true, rotation: 0, isFlipped: true, color: '#06b6d4' }
          ]
        }
      ]
    },
    {
      levelNum: 5,
      title: 'Grand Overdrive Symmetry Matrix',
      ruleTag: 'OVERDRIVE HARMONY',
      timerSec: 45,
      circuits: [
        {
          name: 'Hyper-Crystal Sequence',
          shape: 'crystal',
          ruleDesc: 'Rapid 90° rotational cycle with polarity surge',
          hint: 'Final Challenge: Rapid rotational precision!',
          terms: [
            { rotation: 0,   isFlipped: false, color: '#f59e0b' },
            { rotation: 90,  isFlipped: false, color: '#a78bfa' },
            { rotation: 180, isFlipped: false, color: '#06b6d4' },
            { isMissing: true, rotation: 270, isFlipped: false, color: '#10b981' }
          ]
        },
        {
          name: 'Cosmic Wing Vortex',
          shape: 'wing',
          ruleDesc: 'Full 4-fold glide reflection matrix',
          hint: 'Master symmetry: deduce the final transformation!',
          terms: [
            { rotation: 270, isFlipped: true,  color: '#a78bfa' },
            { rotation: 0,   isFlipped: false, color: '#f59e0b' },
            { rotation: 90,  isFlipped: true,  color: '#a78bfa' },
            { isMissing: true, rotation: 180, isFlipped: false, color: '#f59e0b' }
          ]
        }
      ]
    }
  ];

  // ==========================================================================
  // GAME STATE
  // ==========================================================================
  let currentLevel = 0;
  let currentCircuitIdx = 0;
  let score = 0;
  let lives = 3;
  let timerLeft = 0;
  let timerTimeout = null;
  let combo = 1;
  let maxCombo = 1;
  let totalCircuitsSolved = 0;
  let totalAttempts = 0;
  let correctAttempts = 0;
  let gameRunning = false;

  // Active circuit
  let activeCircuit = null;
  let expectedTerm = null;

  // Player token state (rotation 0, 90, 180, 270; isFlipped boolean)
  let playerToken = {
    rotation: 0,
    isFlipped: false
  };

  // Canvas & Visual Juice
  let canvas = null;
  let ctx = null;
  let canvasWidth = 800;
  let canvasHeight = 420;
  let animationFrameId = null;
  let screenShake = 0;
  let circuitSurgeProgress = 0; // 0 to 1 when pulsing
  let isSurging = false;
  let particles = [];
  let floatingTexts = [];

  // ==========================================================================
  // CANVAS SIZING & METRICS
  // ==========================================================================
  function updateCanvasDimensions() {
    if (!canvas) return;
    const container = $('canvas-container');
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.floor(rect.width) || 800;
    const h = Math.floor(rect.height) || 420;

    canvasWidth = w;
    canvasHeight = h;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';

    ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
  }

  // ==========================================================================
  // DRAWING: MAIN CIRCUIT RENDER LOOP
  // ==========================================================================
  function renderCircuit() {
    if (!ctx) return;

    ctx.save();

    // Screen Shake
    if (screenShake > 0) {
      const sx = (Math.random() - 0.5) * screenShake;
      const sy = (Math.random() - 0.5) * screenShake;
      ctx.translate(sx, sy);
      screenShake *= 0.85;
      if (screenShake < 0.5) screenShake = 0;
    }

    // Clear
    ctx.fillStyle = '#050811';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // 1. Draw glowing background circuitry bus
    drawCircuitBackground();

    // 2. Draw Sequence Lane (The glowing nodes & missing slot)
    drawSequenceLane();

    // 3. Draw Player Active Token Forge Dock
    drawPlayerTokenForge();

    // 4. Draw Particles & Surge Lightning
    drawSurgeEffects();
    drawParticles();
    drawFloatingTexts();

    ctx.restore();

    if (gameRunning) {
      animationFrameId = requestAnimationFrame(renderCircuit);
    }
  }

  function drawCircuitBackground() {
    ctx.save();
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.08)';
    ctx.lineWidth = 1.5;

    // Glowing bus tracks
    const midY = canvasHeight * 0.42;
    ctx.beginPath();
    ctx.moveTo(40, midY);
    ctx.lineTo(canvasWidth - 40, midY);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(6, 182, 212, 0.08)';
    ctx.beginPath();
    ctx.moveTo(40, midY - 30);
    ctx.lineTo(canvasWidth - 40, midY - 30);
    ctx.moveTo(40, midY + 30);
    ctx.lineTo(canvasWidth - 40, midY + 30);
    ctx.stroke();

    ctx.restore();
  }

  function drawSequenceLane() {
    if (!activeCircuit || !activeCircuit.terms) return;

    const terms = activeCircuit.terms;
    const nodeCount = terms.length;
    const startX = canvasWidth * 0.12;
    const endX = canvasWidth * 0.88;
    const laneY = canvasHeight * 0.42;
    const spacing = (endX - startX) / (nodeCount - 1);

    ctx.save();

    // Draw connecting laser circuit line
    ctx.strokeStyle = isSurging ? '#10b981' : 'rgba(139, 92, 246, 0.45)';
    ctx.shadowColor = isSurging ? '#10b981' : '#8b5cf6';
    ctx.shadowBlur = isSurging ? 20 : 8;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(startX, laneY);
    ctx.lineTo(endX, laneY);
    ctx.stroke();

    // Surge pulse traveling along the wire
    if (isSurging) {
      const surgeX = startX + (endX - startX) * circuitSurgeProgress;
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#10b981';
      ctx.shadowBlur = 25;
      ctx.beginPath();
      ctx.arc(surgeX, laneY, 14, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw nodes
    for (let i = 0; i < nodeCount; i++) {
      const nx = startX + i * spacing;
      const term = terms[i];

      if (term.isMissing) {
        // Missing Slot Node
        drawMissingSlotNode(nx, laneY);
      } else {
        // Standard Sequence Term Node
        drawTermNode(nx, laneY, term, activeCircuit.shape, i + 1);
      }
    }

    ctx.restore();
  }

  function drawTermNode(x, y, term, shapeType, index) {
    ctx.save();

    // Outer Node Ring
    ctx.fillStyle = 'rgba(11, 17, 34, 0.9)';
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.6)';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = 'rgba(139, 92, 246, 0.4)';
    ctx.shadowBlur = 10;

    const r = Math.min(42, canvasWidth * 0.055);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Index Tag
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`TERM #${index}`, x, y + r + 18);

    // Draw Transformed Shape Glyph inside node
    drawGlyph(x, y, shapeType, term.rotation, term.isFlipped, term.color, r * 0.6);

    ctx.restore();
  }

  function drawMissingSlotNode(x, y) {
    ctx.save();
    const time = performance.now() * 0.003;
    const pulse = Math.sin(time * 3) * 3;
    const r = Math.min(46, canvasWidth * 0.06) + pulse;

    // Glowing Target Ring
    ctx.fillStyle = 'rgba(245, 158, 11, 0.08)';
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 5]);
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 18;

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Question Mark / Hologram
    ctx.setLineDash([]);
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', x, y);

    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('MISSING TERM', x, y + r + 20);

    ctx.restore();
  }

  // Draw Player Active Token Forge Dock at bottom of canvas
  function drawPlayerTokenForge() {
    ctx.save();
    const dockX = canvasWidth * 0.5;
    const dockY = canvasHeight * 0.82;
    const dockR = Math.min(48, canvasHeight * 0.13);

    // Forge platform ring
    ctx.fillStyle = 'rgba(19, 28, 54, 0.9)';
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#06b6d4';
    ctx.shadowBlur = 16;

    ctx.beginPath();
    ctx.arc(dockX, dockY, dockR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Active transformation readout label
    ctx.fillStyle = '#c4b5fd';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    const flipText = playerToken.isFlipped ? ' | Mirrored' : '';
    ctx.fillText(`ANGLE: ${playerToken.rotation}°${flipText}`, dockX, dockY - dockR - 10);

    // Draw the Player's Configured Token Glyph
    if (activeCircuit) {
      drawGlyph(dockX, dockY, activeCircuit.shape, playerToken.rotation, playerToken.isFlipped, '#ffffff', dockR * 0.65);
    }

    ctx.restore();
  }

  // Draw Mathematical Geometric Shapes with Rotational & Reflection transforms
  function drawGlyph(cx, cy, shapeType, rotationDeg, isFlipped, color, size) {
    ctx.save();
    ctx.translate(cx, cy);

    // Apply Rotation
    ctx.rotate((rotationDeg * Math.PI) / 180);

    // Apply Horizontal Reflection
    if (isFlipped) {
      ctx.scale(-1, 1);
    }

    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.lineWidth = 2.5;

    if (shapeType === 'arrow') {
      // Directional Chevron Arrow pointing UP (0 deg)
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(size * 0.75, size * 0.6);
      ctx.lineTo(0, size * 0.2);
      ctx.lineTo(-size * 0.75, size * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (shapeType === 'wing') {
      // Asymmetric Butterfly / Wing Glyph (strictly changes under reflection!)
      ctx.beginPath();
      ctx.moveTo(0, size * 0.7);
      ctx.bezierCurveTo(size * 0.2, 0, size * 0.9, -size * 0.8, size * 0.75, -size * 0.6);
      ctx.bezierCurveTo(size * 0.6, -size * 0.2, size * 0.7, size * 0.2, 0, size * 0.7);
      ctx.fill();
      ctx.stroke();

      // Wing spine line
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, size * 0.7);
      ctx.lineTo(0, -size * 0.6);
      ctx.stroke();
    } else if (shapeType === 'crystal') {
      // Two-tone split diamond kite
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(size * 0.7, 0);
      ctx.lineTo(0, size * 0.85);
      ctx.lineTo(0, -size);
      ctx.fillStyle = color;
      ctx.fill();

      // Contrasting half
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(-size * 0.7, 0);
      ctx.lineTo(0, size * 0.85);
      ctx.lineTo(0, -size);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.fill();

      ctx.stroke();
    } else if (shapeType === 'cross') {
      // Asymmetrical T-Shape
      ctx.beginPath();
      ctx.rect(-size * 0.25, -size * 0.8, size * 0.5, size * 1.6);
      ctx.rect(-size * 0.8, -size * 0.3, size * 1.6, size * 0.45);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawSurgeEffects() {
    if (!isSurging) return;
    circuitSurgeProgress += 0.04;
    if (circuitSurgeProgress >= 1) {
      isSurging = false;
      circuitSurgeProgress = 0;
    }
  }

  function drawParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.025;
      p.size = Math.max(0, p.size * 0.96);

      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function spawnParticles(x, y, count = 14, color = '#10b981') {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 5;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3 + Math.random() * 4,
        life: 1.0,
        color
      });
    }
  }

  function drawFloatingTexts() {
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      const ft = floatingTexts[i];
      ft.y -= 1.2;
      ft.life -= 0.025;

      if (ft.life <= 0) {
        floatingTexts.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = ft.life;
      ctx.fillStyle = ft.color;
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = ft.color;
      ctx.shadowBlur = 12;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }
  }

  function spawnFloatingText(x, y, text, color = '#f59e0b') {
    floatingTexts.push({ x, y, text, color, life: 1.0 });
  }

  // ==========================================================================
  // PLAYER ACTIONS: TRANSFORM & LOCK
  // ==========================================================================
  function rotateTokenCW() {
    unlockAudio();
    playerToken.rotation = (playerToken.rotation + 90) % 360;
    playSound('rotate');
    spawnParticles(canvasWidth * 0.5, canvasHeight * 0.82, 6, '#8b5cf6');
  }

  function flipTokenH() {
    unlockAudio();
    playerToken.isFlipped = !playerToken.isFlipped;
    playSound('flip');
    spawnParticles(canvasWidth * 0.5, canvasHeight * 0.82, 6, '#06b6d4');
  }

  function lockTokenInSlot() {
    unlockAudio();
    if (!gameRunning || !expectedTerm) return;

    totalAttempts++;

    // Check if player's token transformation matches the expected sequence term
    const matchesRotation = playerToken.rotation === expectedTerm.rotation;
    const matchesFlip = playerToken.isFlipped === expectedTerm.isFlipped;

    const dockX = canvasWidth * 0.5;
    const dockY = canvasHeight * 0.82;

    if (matchesRotation && matchesFlip) {
      // SUCCESSFUL SEQUENCE LOCK!
      correctAttempts++;
      combo++;
      if (combo > maxCombo) maxCombo = combo;

      const pts = 100 * combo;
      score += pts;
      playSound('circuit-lock');

      isSurging = true;
      circuitSurgeProgress = 0;

      spawnParticles(dockX, dockY, 20, '#10b981');
      spawnFloatingText(dockX, dockY - 30, `+${pts} HARMONIC! ✨`, '#10b981');
      showPopup('⚡ CIRCUIT COMPLETE! ⚡');

      totalCircuitsSolved++;
      updateHUD();

      // Replace missing slot with completed glyph
      const missingIdx = activeCircuit.terms.findIndex(t => t.isMissing);
      if (missingIdx !== -1) {
        activeCircuit.terms[missingIdx].isMissing = false;
      }

      setTimeout(() => {
        currentCircuitIdx++;
        const lvl = LEVELS[currentLevel];
        if (currentCircuitIdx >= lvl.circuits.length) {
          onLevelComplete();
        } else {
          loadCircuit(lvl.circuits[currentCircuitIdx]);
        }
      }, 850);
    } else {
      // MISMATCH
      combo = 1;
      screenShake = 12;
      lives--;
      playSound('wrong');
      spawnFloatingText(dockX, dockY - 30, 'Polarity Mismatch! ❌', '#ef4444');
      updateHUD();

      if (lives <= 0) {
        onGameOver();
      }
    }
  }

  // ==========================================================================
  // LEVEL FLOW & HUD
  // ==========================================================================
  function startLevel() {
    const lvl = LEVELS[currentLevel];
    currentCircuitIdx = 0;
    loadCircuit(lvl.circuits[currentCircuitIdx]);
    startTimer(lvl.timerSec);
    updateHUD();
  }

  function loadCircuit(circuit) {
    activeCircuit = JSON.parse(JSON.stringify(circuit)); // deep clone
    expectedTerm = circuit.terms.find(t => t.isMissing);

    // Reset player token to neutral
    playerToken = {
      rotation: 0,
      isFlipped: false
    };

    // Update HUD
    const tagEl = $('mission-rule-tag');
    const nameEl = $('mission-pattern-name');
    const hintEl = $('hint-text');

    if (tagEl) tagEl.textContent = LEVELS[currentLevel].ruleTag;
    if (nameEl) nameEl.textContent = circuit.name;
    if (hintEl) hintEl.textContent = circuit.hint;

    const progressFill = $('mission-progress-fill');
    const progressText = $('mission-progress-text');
    const total = LEVELS[currentLevel].circuits.length;
    if (progressFill) progressFill.style.width = `${(currentCircuitIdx / total) * 100}%`;
    if (progressText) progressText.textContent = `${currentCircuitIdx}/${total}`;
  }

  function updateHUD() {
    const lvlEl = $('hud-level-val');
    const scoreEl = $('hud-score-val');
    const timerEl = $('hud-timer-val');
    const comboEl = $('multiplier-pill');
    const hearts = $$('#hud-lives-val .heart');

    if (lvlEl) lvlEl.textContent = `${currentLevel + 1}/${LEVELS.length}`;
    if (scoreEl) scoreEl.textContent = score;
    if (timerEl) timerEl.textContent = `${timerLeft}s`;
    if (comboEl) comboEl.textContent = `x${combo} COMBO`;

    hearts.forEach((h, i) => {
      if (i < lives) {
        h.classList.remove('lost');
      } else {
        h.classList.add('lost');
      }
    });
  }

  function startTimer(seconds) {
    stopTimer();
    timerLeft = seconds;
    updateHUD();

    function tick() {
      timerLeft--;
      if (timerLeft <= 5 && timerLeft > 0) playSound('tick');
      updateHUD();
      if (timerLeft <= 0) {
        stopTimer();
        onTimeUp();
      } else {
        timerTimeout = setTimeout(tick, 1000);
      }
    }

    timerTimeout = setTimeout(tick, 1000);
  }

  function stopTimer() {
    if (timerTimeout) {
      clearTimeout(timerTimeout);
      timerTimeout = null;
    }
  }

  function onTimeUp() {
    playSound('wrong');
    showPopup('⏳ TIME SURGE!');
    lives--;
    updateHUD();
    if (lives <= 0) {
      onGameOver();
    } else {
      setTimeout(() => {
        loadCircuit(LEVELS[currentLevel].circuits[currentCircuitIdx]);
        startTimer(LEVELS[currentLevel].timerSec);
      }, 700);
    }
  }

  function onLevelComplete() {
    stopTimer();
    playSound('level-clear');

    const bonus = 250 * (currentLevel + 1);
    score += bonus;
    updateHUD();

    const modal = $('modal-level-up');
    const titleEl = $('levelup-title');
    const bonusEl = $('levelup-bonus');
    const accEl = $('levelup-acc');

    const acc = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 100;
    if (titleEl) titleEl.textContent = `Level ${currentLevel + 1} Cleared!`;
    if (bonusEl) bonusEl.textContent = `+${bonus} pts`;
    if (accEl) accEl.textContent = `${acc}%`;

    if (modal) modal.classList.add('active');
  }

  function onGameOver() {
    stopTimer();
    gameRunning = false;
    finishGame(false);
  }

  function finishGame(isVictory = true) {
    stopTimer();
    stopBgm();
    gameRunning = false;

    showScreen('screen-result');

    const badgeEl = $('result-badge');
    const titleEl = $('result-title');
    const subEl = $('result-subtitle');
    const scoreEl = $('result-score-val');
    const circEl = $('result-circuits-val');
    const accEl = $('result-accuracy-val');
    const comboEl = $('result-combo-val');

    const accuracy = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 100;

    if (badgeEl) badgeEl.textContent = isVictory ? 'CIRCUIT ARCHITECT' : 'PRACTICE COMPLETE';
    if (titleEl) titleEl.textContent = isVictory ? 'Pattern Mastered!' : 'Circuit Discharged';
    if (subEl) {
      subEl.textContent = isVictory
        ? 'You solved all rotational and reflective symmetry sequences with flawlessness!'
        : 'Good effort! Review the sequence transformation rule and power up again.';
    }

    if (scoreEl) scoreEl.textContent = score;
    if (circEl) circEl.textContent = totalCircuitsSolved;
    if (accEl) accEl.textContent = `${accuracy}%`;
    if (comboEl) comboEl.textContent = `x${maxCombo}`;

    // Stars Rating (0 - 3)
    let starsEarned = 0;
    if (score >= 1200) starsEarned = 3;
    else if (score >= 600) starsEarned = 2;
    else if (score >= 200) starsEarned = 1;

    const starSlots = [$('star-1'), $('star-2'), $('star-3')];
    starSlots.forEach((slot, idx) => {
      if (!slot) return;
      slot.classList.remove('earned');
      if (idx < starsEarned) {
        setTimeout(() => {
          slot.classList.add('earned');
          playSound('star');
        }, (idx + 1) * 350);
      }
    });

    // Store final metrics scaled to game.config.maxPoints
    const maxConfigPoints = (typeof game !== 'undefined' && game.config && game.config.maxPoints) ? game.config.maxPoints : 100;
    const scaledScore = Math.min(maxConfigPoints, Math.max(0, Math.round((score / 2000) * maxConfigPoints)));
    window._lastResult = {
      score: scaledScore,
      rawScore: score,
      stars: starsEarned,
      success: isVictory || starsEarned >= 1,
      maxScore: maxConfigPoints
    };
  }

  function showPopup(text) {
    const pop = $('floating-feedback');
    if (!pop) return;
    pop.textContent = text;
    pop.className = 'floating-feedback show-pop';
    setTimeout(() => {
      pop.className = 'floating-feedback';
    }, 750);
  }

  // ==========================================================================
  // ANIMATED VISUAL INSTRUCTION DEMO CANVAS
  // ==========================================================================
  let demoAnimId = null;
  let demoActive = false;

  function runInstructionDemo() {
    const dCanvas = $('canvas-instruction-demo');
    if (!dCanvas) return;
    const dCtx = dCanvas.getContext('2d');
    demoActive = true;
    let step = 0;

    function renderDemo() {
      if (!demoActive) return;
      step += 0.03;

      dCtx.fillStyle = '#050811';
      dCtx.fillRect(0, 0, 360, 150);

      // Circuit wire
      dCtx.strokeStyle = 'rgba(139, 92, 246, 0.4)';
      dCtx.lineWidth = 3;
      dCtx.beginPath();
      dCtx.moveTo(30, 60);
      dCtx.lineTo(330, 60);
      dCtx.stroke();

      // Sequence terms: Term 1 (0 deg), Term 2 (90 deg), Term 3 (180 deg), Term 4 (?)
      const xPositions = [60, 140, 220, 300];
      const rotations = [0, 90, 180, 270];

      for (let i = 0; i < 3; i++) {
        dCtx.save();
        dCtx.fillStyle = '#0b1122';
        dCtx.strokeStyle = '#8b5cf6';
        dCtx.lineWidth = 2;
        dCtx.beginPath();
        dCtx.arc(xPositions[i], 60, 22, 0, Math.PI * 2);
        dCtx.fill();
        dCtx.stroke();

        // Arrow glyph
        dCtx.translate(xPositions[i], 60);
        dCtx.rotate((rotations[i] * Math.PI) / 180);
        dCtx.fillStyle = '#06b6d4';
        dCtx.beginPath();
        dCtx.moveTo(0, -12);
        dCtx.lineTo(10, 8);
        dCtx.lineTo(0, 2);
        dCtx.lineTo(-10, 8);
        dCtx.closePath();
        dCtx.fill();
        dCtx.restore();
      }

      // Slot 4: Missing target
      dCtx.save();
      dCtx.strokeStyle = '#f59e0b';
      dCtx.setLineDash([4, 4]);
      dCtx.lineWidth = 2;
      dCtx.beginPath();
      dCtx.arc(xPositions[3], 60, 24, 0, Math.PI * 2);
      dCtx.stroke();
      dCtx.setLineDash([]);
      dCtx.fillStyle = '#f59e0b';
      dCtx.font = 'bold 16px sans-serif';
      dCtx.textAlign = 'center';
      dCtx.textBaseline = 'middle';
      dCtx.fillText('?', xPositions[3], 60);
      dCtx.restore();

      // Animated Finger & rotation at bottom
      const prog = (Math.sin(step) + 1) / 2; // 0 to 1
      const animatedAngle = prog > 0.5 ? 270 : 180;

      dCtx.save();
      dCtx.translate(180, 115);
      dCtx.fillStyle = '#0b1122';
      dCtx.strokeStyle = '#10b981';
      dCtx.lineWidth = 2;
      dCtx.beginPath();
      dCtx.arc(0, 0, 18, 0, Math.PI * 2);
      dCtx.fill();
      dCtx.stroke();

      dCtx.rotate((animatedAngle * Math.PI) / 180);
      dCtx.fillStyle = '#ffffff';
      dCtx.beginPath();
      dCtx.moveTo(0, -10);
      dCtx.lineTo(8, 6);
      dCtx.lineTo(0, 2);
      dCtx.lineTo(-8, 6);
      dCtx.closePath();
      dCtx.fill();
      dCtx.restore();

      dCtx.fillStyle = '#a78bfa';
      dCtx.font = 'bold 10px sans-serif';
      dCtx.textAlign = 'center';
      dCtx.fillText(prog > 0.5 ? 'Rotated to 270° → Match!' : 'Rotate 90°...', 180, 142);

      demoAnimId = requestAnimationFrame(renderDemo);
    }

    renderDemo();
  }

  function stopInstructionDemo() {
    demoActive = false;
    if (demoAnimId) {
      cancelAnimationFrame(demoAnimId);
      demoAnimId = null;
    }
  }

  // ==========================================================================
  // START SCREEN MASCOT PREVIEW CANVAS (Rotating Cyber-Circuit Mandala)
  // ==========================================================================
  let startPreviewAnimId = null;
  let startPreviewActive = false;

  function runStartPreview() {
    const sCanvas = $('canvas-start-preview');
    if (!sCanvas) return;
    const sCtx = sCanvas.getContext('2d');
    startPreviewActive = true;
    let angle = 0;

    function renderStart() {
      if (!startPreviewActive) return;
      angle += 0.02;

      sCtx.fillStyle = 'rgba(5, 8, 17, 0.25)';
      sCtx.fillRect(0, 0, 320, 140);

      const cx = 160;
      const cy = 70;

      sCtx.save();
      sCtx.translate(cx, cy);

      // Rotating Mandala Arms with 90° Symmetry
      for (let i = 0; i < 4; i++) {
        sCtx.rotate(Math.PI / 2);
        sCtx.strokeStyle = i % 2 === 0 ? '#8b5cf6' : '#06b6d4';
        sCtx.lineWidth = 2.5;
        sCtx.shadowColor = i % 2 === 0 ? '#8b5cf6' : '#06b6d4';
        sCtx.shadowBlur = 12;

        sCtx.beginPath();
        sCtx.moveTo(0, 0);
        sCtx.lineTo(Math.cos(angle) * 30, Math.sin(angle) * 30);
        sCtx.lineTo(Math.cos(angle * 1.4) * 45, 0);
        sCtx.stroke();

        // Node tip
        sCtx.fillStyle = '#ffffff';
        sCtx.beginPath();
        sCtx.arc(Math.cos(angle * 1.4) * 45, 0, 4, 0, Math.PI * 2);
        sCtx.fill();
      }

      // Center reactor
      sCtx.fillStyle = '#f59e0b';
      sCtx.shadowColor = '#f59e0b';
      sCtx.shadowBlur = 16;
      sCtx.beginPath();
      sCtx.arc(0, 0, 7, 0, Math.PI * 2);
      sCtx.fill();

      sCtx.restore();

      startPreviewAnimId = requestAnimationFrame(renderStart);
    }

    renderStart();
  }

  function stopStartPreview() {
    startPreviewActive = false;
    if (startPreviewAnimId) {
      cancelAnimationFrame(startPreviewAnimId);
      startPreviewAnimId = null;
    }
  }

  // ==========================================================================
  // NAVIGATION & SCREEN MANAGEMENT
  // ==========================================================================
  function showScreen(screenId) {
    const screens = $$('.screen');
    screens.forEach(s => s.classList.remove('active'));

    const target = $(screenId);
    if (target) {
      target.classList.add('active');
    }

    const modal = $('modal-level-up');
    if (modal) modal.classList.remove('active');

    if (screenId === 'screen-start') {
      runStartPreview();
      stopInstructionDemo();
    } else if (screenId === 'screen-instructions') {
      stopStartPreview();
      runInstructionDemo();
    } else {
      stopStartPreview();
      stopInstructionDemo();
    }
  }

  function runCountdown(callback) {
    showScreen('screen-countdown');
    let count = 3;
    const numEl = $('countdown-number');
    if (numEl) numEl.textContent = count;
    playSound('countdown');

    function nextCount() {
      count--;
      if (count > 0) {
        if (numEl) numEl.textContent = count;
        playSound('countdown');
        setTimeout(nextCount, 800);
      } else {
        if (numEl) numEl.textContent = '⚡';
        playSound('launch');
        setTimeout(() => {
          callback();
        }, 350);
      }
    }

    setTimeout(nextCount, 800);
  }

  function resetGame() {
    currentLevel = 0;
    currentCircuitIdx = 0;
    score = 0;
    lives = 3;
    combo = 1;
    maxCombo = 1;
    totalCircuitsSolved = 0;
    totalAttempts = 0;
    correctAttempts = 0;
    particles = [];
    floatingTexts = [];
    isSurging = false;
    stopTimer();
  }

  function startGame() {
    resetGame();
    unlockAudio();
    runCountdown(() => {
      showScreen('screen-game');
      canvas = $('canvas-circuit');
      updateCanvasDimensions();
      gameRunning = true;
      startLevel();
      renderCircuit();
    });
  }

  // ==========================================================================
  // INITIALIZATION & EVENT LISTENERS
  // ==========================================================================
  function init() {
    // 1. Button Bindings
    const btnPlay = $('btn-play');
    if (btnPlay) btnPlay.addEventListener('click', startGame);

    const btnInstructions = $('btn-instructions');
    if (btnInstructions) {
      btnInstructions.addEventListener('click', () => {
        unlockAudio();
        showScreen('screen-instructions');
      });
    }

    const btnStartFromHow = $('btn-start-from-how');
    if (btnStartFromHow) btnStartFromHow.addEventListener('click', startGame);

    const btnSound = $('btn-sound-toggle');
    if (btnSound) btnSound.addEventListener('click', toggleSound);

    const btnFullscreen = $('btn-fullscreen-toggle');
    if (btnFullscreen) {
      btnFullscreen.addEventListener('click', () => {
        const wrap = $('game-wrapper');
        if (!document.fullscreenElement) {
          wrap.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      });
    }

    // Toolbox controls
    const btnRotate = $('btn-rotate-cw');
    if (btnRotate) btnRotate.addEventListener('click', rotateTokenCW);

    const btnFlip = $('btn-flip-h');
    if (btnFlip) btnFlip.addEventListener('click', flipTokenH);

    const btnLock = $('btn-lock-token');
    if (btnLock) btnLock.addEventListener('click', lockTokenInSlot);

    // Canvas tap shortcut: tap the active token dock or the missing slot to lock!
    canvas = $('canvas-circuit');
    if (canvas) {
      canvas.addEventListener('pointerdown', (e) => {
        unlockAudio();
        if (!gameRunning) return;
        const rect = canvas.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;

        // If tapped near token dock at bottom
        const dockX = canvasWidth * 0.5;
        const dockY = canvasHeight * 0.82;
        const distDock = Math.hypot(px - dockX, py - dockY);

        if (distDock < 60) {
          rotateTokenCW();
          return;
        }

        // If tapped missing slot
        if (activeCircuit) {
          const terms = activeCircuit.terms;
          const startX = canvasWidth * 0.12;
          const endX = canvasWidth * 0.88;
          const laneY = canvasHeight * 0.42;
          const spacing = (endX - startX) / (terms.length - 1);
          const missIdx = terms.findIndex(t => t.isMissing);
          if (missIdx !== -1) {
            const mx = startX + missIdx * spacing;
            const distMiss = Math.hypot(px - mx, py - laneY);
            if (distMiss < 50) {
              lockTokenInSlot();
            }
          }
        }
      });
    }

    // Level up next button
    const btnNextLevel = $('btn-next-level');
    if (btnNextLevel) {
      btnNextLevel.addEventListener('click', () => {
        const modal = $('modal-level-up');
        if (modal) modal.classList.remove('active');
        currentLevel++;
        if (currentLevel >= LEVELS.length) {
          finishGame(true);
        } else {
          startLevel();
        }
      });
    }

    // Try Again
    const btnTryAgain = $('btn-try-again');
    if (btnTryAgain) {
      btnTryAgain.addEventListener('click', () => {
        showScreen('screen-start');
      });
    }

    // Submit Score -> calls game.end()
    const btnSubmit = $('btn-submit-score');
    if (btnSubmit) {
      btnSubmit.addEventListener('click', () => {
        const maxConfigPoints = (typeof game !== 'undefined' && game.config && game.config.maxPoints) ? game.config.maxPoints : 100;
        const res = window._lastResult || { score: maxConfigPoints, stars: 3, success: true, maxScore: maxConfigPoints };
        if (typeof game !== 'undefined' && typeof game.end === 'function') {
          game.end({
            score: res.score,
            stars: res.stars,
            success: res.success,
            maxScore: maxConfigPoints,
            meta: {
              rawScore: res.rawScore,
              circuitsSolved: totalCircuitsSolved,
              combo: maxCombo
            }
          });
        }
        btnSubmit.disabled = true;
        btnSubmit.textContent = 'Submitted! ✅';
      });
    }

    // 2. Responsive Canvas Resize
    window.addEventListener('resize', () => {
      if (gameRunning) {
        updateCanvasDimensions();
      }
    });
    window.addEventListener('orientationchange', () => {
      if (gameRunning) {
        setTimeout(updateCanvasDimensions, 200);
      }
    });

    // 3. Show Start Screen
    showScreen('screen-start');
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

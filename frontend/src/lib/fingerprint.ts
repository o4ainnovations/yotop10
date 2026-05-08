/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

const webkitAudioContext = typeof window !== 'undefined'
  ? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  : undefined;

const performanceMemory = typeof window !== 'undefined'
  ? (window.performance as Performance & { memory?: { jsHeapSizeLimit: number } }).memory
  : undefined;

// Tier 0 Signals: Machine-stable, cross-browser — never changes
interface Tier0Signals {
  screenResolution: string;
  colorDepth: number;
  hardwareConcurrency: number;
  timezoneOffset: number;
  platform: string;
  devicePixelRatio: number;
  maxTouchPoints: number;
}

// Tier 1 Signals: 99.9% stability | Weight: 10x
interface Tier1Signals {
  webglRenderer: string;
  webglVendor: string;
  audioFingerprint: number;
  cpuCoreCount: number;
  maxHeapSize: number;
  devicePixelRatio: number;
  canvasHash: string;
  webglExtensions: string;
}

// Tier 2 Signals: 95% stability | Weight: 1x
interface Tier2Signals {
  timezoneOffset: number;
  canvasPixelRatio: number;
  touchSupport: number;
  webglShaderPrecision: string;
  audioSampleRate: number;
  colorDepth: number;
  hardwareConcurrency: number;
  localStorageAvailable: boolean;
  indexedDBAvailable: boolean;
}

interface FingerprintData {
  tier0: Tier0Signals;
  tier1: Tier1Signals;
  tier2: Tier2Signals;
  hash: string;
  generatedAt: number;
}

export const getTier0Signals = (): Tier0Signals => ({
  screenResolution: `${window.screen.width}x${window.screen.height}`,
  colorDepth: window.screen.colorDepth,
  hardwareConcurrency: navigator.hardwareConcurrency || 0,
  timezoneOffset: new Date().getTimezoneOffset(),
  platform: navigator.platform || 'unknown',
  devicePixelRatio: window.devicePixelRatio,
  maxTouchPoints: navigator.maxTouchPoints || 0,
});

// Generate audio context fingerprint
const getAudioFingerprint = async (): Promise<number> => {
  try {
    const audioContext = new (window.AudioContext || webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const analyser = audioContext.createAnalyser();
    const gain = audioContext.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(1000, audioContext.currentTime);
    gain.gain.setValueAtTime(0, audioContext.currentTime);
    
    oscillator.connect(analyser);
    analyser.connect(gain);
    gain.connect(audioContext.destination);
    
    const buffer = new Float32Array(analyser.frequencyBinCount);
    analyser.getFloatFrequencyData(buffer);
    
    let hash = 0;
    for (let i = 0; i < buffer.length; i++) {
      hash += buffer[i];
    }
    
    audioContext.close();
    return Math.round(hash * 1000) / 1000;
  } catch {
    return 0;
  }
};

// Generate canvas 2D fingerprint
const getCanvasHash = (): string => {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    
    canvas.width = 200;
    canvas.height = 50;
    
    ctx.textBaseline = 'alphabetic';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#666';
    ctx.fillText('yotop10 fingerprint canvas hash', 2, 20);
    
    return canvas.toDataURL().slice(-50);
  } catch {
    return 'canvas_unsupported';
  }
};

// Get WebGL information
const getWebGLInfo = (): { renderer: string; vendor: string; extensions: string; shaderPrecision: string } => {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl') as WebGLRenderingContext;
    
    if (!gl) {
      return { renderer: 'none', vendor: 'none', extensions: 'none', shaderPrecision: 'none' };
    }
    
    const renderer = gl.getParameter(gl.RENDERER);
    const vendor = gl.getParameter(gl.VENDOR);
    const extensions = gl.getSupportedExtensions()?.sort().join(',') || '';
    
    const precision = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
    const shaderPrecision = `${precision?.precision}-${precision?.rangeMin}-${precision?.rangeMax}`;
    
    return { renderer, vendor, extensions, shaderPrecision };
  } catch {
    return { renderer: 'none', vendor: 'none', extensions: 'none', shaderPrecision: 'none' };
  }
};

// Collect all 25 signals
const collectAllSignals = async (): Promise<FingerprintData> => {
  const webglInfo = getWebGLInfo();
  const audioFingerprint = await getAudioFingerprint();
  const canvasHash = getCanvasHash();

  return {
    tier0: getTier0Signals(),
    tier1: {
      webglRenderer: webglInfo.renderer,
      webglVendor: webglInfo.vendor,
      audioFingerprint,
      cpuCoreCount: navigator.hardwareConcurrency || 0,
      maxHeapSize: performanceMemory?.jsHeapSizeLimit || 0,
      devicePixelRatio: window.devicePixelRatio,
      canvasHash,
      webglExtensions: webglInfo.extensions,
    },
    tier2: {
      timezoneOffset: new Date().getTimezoneOffset(),
      canvasPixelRatio: window.devicePixelRatio,
      touchSupport: navigator.maxTouchPoints || 0,
      webglShaderPrecision: webglInfo.shaderPrecision,
      audioSampleRate: new AudioContext().sampleRate,
      colorDepth: window.screen.colorDepth,
      hardwareConcurrency: navigator.hardwareConcurrency || 0,
      localStorageAvailable: typeof localStorage !== 'undefined',
      indexedDBAvailable: typeof indexedDB !== 'undefined',
    },
    hash: '',
    generatedAt: Date.now(),
  };
};

// Generate stable hash from signals
const generateHash = (data: FingerprintData): string => {
  const allSignals = [
    ...Object.values(data.tier1),
    ...Object.values(data.tier2),
  ].join('|');
  
  let hash = 0;
  for (let i = 0; i < allSignals.length; i++) {
    hash = ((hash << 5) - hash) + allSignals.charCodeAt(i);
    hash = hash & hash;
  }
  
  return Math.abs(hash).toString(16).padStart(16, '0');
};

// Exported function to get fingerprint
const safeGetItem = (key: string): string | null => {
  try { return localStorage.getItem(key); } catch { return null; }
};

const safeSetItem = (key: string, value: string): void => {
  try { localStorage.setItem(key, value); } catch { /* private browsing */ }
};

export const getFingerprint = async (): Promise<string> => {
  const cached = safeGetItem('yotop10_fp');
  if (cached) return cached;

  const data = await collectAllSignals();
  data.hash = generateHash(data);
  
  safeSetItem('yotop10_fp', data.hash);
  safeSetItem('yotop10_fp_full', JSON.stringify(data));
  
  return data.hash;
};

// Run fingerprinting exactly 3000ms after page load
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    setTimeout(() => {
      getFingerprint().then(hash => {
        // Submit full fingerprint data for cross-browser matching
        const tier0 = getTier0Signals();
        const full = JSON.parse(safeGetItem('yotop10_fp_full') || '{}');
        fetch('/api/fingerprint/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tier0, tier1: full.tier1 || {}, tier2: full.tier2 || {}, hash }),
          credentials: 'include',
        }).catch(() => {});
      }).catch(() => {
        const fallback = 'fp_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
        localStorage.setItem('yotop10_fp', fallback);
      });
    }, 3000);
  });
}

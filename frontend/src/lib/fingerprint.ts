/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

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
  tier1: Tier1Signals;
  tier2: Tier2Signals;
  hash: string;
  generatedAt: number;
}

// Generate audio context fingerprint
const getAudioFingerprint = async (): Promise<number> => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
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

// Collect all 18 signals
const collectAllSignals = async (): Promise<FingerprintData> => {
  const webglInfo = getWebGLInfo();
  const audioFingerprint = await getAudioFingerprint();
  const canvasHash = getCanvasHash();
  
  return {
    tier1: {
      webglRenderer: webglInfo.renderer,
      webglVendor: webglInfo.vendor,
      audioFingerprint,
      cpuCoreCount: navigator.hardwareConcurrency || 0,
      maxHeapSize: (window.performance as any).memory?.jsHeapSizeLimit || 0,
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
export const getFingerprint = async (): Promise<string> => {
  // Return cached if available
  const cached = localStorage.getItem('yotop10_fp');
  if (cached) return cached;

  const data = await collectAllSignals();
  data.hash = generateHash(data);
  
  // Store permanently
  localStorage.setItem('yotop10_fp', data.hash);
  localStorage.setItem('yotop10_fp_full', JSON.stringify(data));
  
  return data.hash;
};

// Run fingerprinting exactly 3000ms after page load per specification
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    setTimeout(() => {
      getFingerprint().catch(() => {
        // Fallback to simple random fingerprint if collection fails
        const fallback = 'fp_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
        localStorage.setItem('yotop10_fp', fallback);
      });
    }, 3000);
  });
}

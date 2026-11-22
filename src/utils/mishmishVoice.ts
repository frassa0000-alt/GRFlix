// Synthesized cute child-like voice & giggle engine for "Mishmish" using Web Audio vocal formants

let sharedAudioCtx: AudioContext | null = null;
let noiseBuffer: AudioBuffer | null = null;
let lastTickleVoiceAt = 0;

export type MishmishVoiceKind =
  | 'smile'
  | 'laugh'
  | 'tickle'
  | 'wink'
  | 'surprised'
  | 'starry'
  | 'shy'
  | 'cool'
  | 'cry'
  | 'celebrate'
  | 'angry';

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;

  if (!sharedAudioCtx) {
    sharedAudioCtx = new AudioCtx();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {
      // Ignore autoplay lock until next user gesture
    });
  }
  return sharedAudioCtx;
}

function getBreathNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) {
    return noiseBuffer;
  }
  const length = Math.floor(ctx.sampleRate * 0.25);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  noiseBuffer = buffer;
  return buffer;
}

/**
 * Unlocks Web Audio on first tap/touch gesture so tickling can immediately play sound.
 */
export function unlockMishmishAudio(): void {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
}

interface ChildSyllableOptions {
  startTime: number;
  duration: number;
  baseFreq: number;
  peakFreq: number;
  endFreq: number;
  volume: number;
  f1: number;
  f2: number;
}

function scheduleChildSyllable(ctx: AudioContext, opts: ChildSyllableOptions): void {
  const { startTime, duration, baseFreq, peakFreq, endFreq, volume, f1, f2 } = opts;
  const stopTime = startTime + duration + 0.04;

  // Warm glottal-like child pitch source (triangle + soft octave harmonic)
  const oscMain = ctx.createOscillator();
  oscMain.type = 'triangle';
  oscMain.frequency.setValueAtTime(baseFreq, startTime);
  oscMain.frequency.exponentialRampToValueAtTime(peakFreq, startTime + duration * 0.42);
  oscMain.frequency.exponentialRampToValueAtTime(endFreq, startTime + duration);

  const oscHarmonic = ctx.createOscillator();
  oscHarmonic.type = 'sine';
  oscHarmonic.frequency.setValueAtTime(baseFreq * 2, startTime);
  oscHarmonic.frequency.exponentialRampToValueAtTime(peakFreq * 2, startTime + duration * 0.42);
  oscHarmonic.frequency.exponentialRampToValueAtTime(endFreq * 2, startTime + duration);

  const harmonicGain = ctx.createGain();
  harmonicGain.gain.value = 0.28;

  // Parallel vocal tract formant filters (bright child-like vowel resonance)
  const formant1 = ctx.createBiquadFilter();
  formant1.type = 'bandpass';
  formant1.frequency.setValueAtTime(f1, startTime);
  formant1.frequency.exponentialRampToValueAtTime(f1 * 1.18, startTime + duration * 0.5);
  formant1.Q.value = 2.6;

  const formant2 = ctx.createBiquadFilter();
  formant2.type = 'bandpass';
  formant2.frequency.setValueAtTime(f2, startTime);
  formant2.frequency.exponentialRampToValueAtTime(f2 * 1.12, startTime + duration * 0.5);
  formant2.Q.value = 3.2;

  const formant2Gain = ctx.createGain();
  formant2Gain.gain.value = 0.65;

  // Master smooth syllable envelope
  const envGain = ctx.createGain();
  envGain.gain.setValueAtTime(0.0001, startTime);
  envGain.gain.linearRampToValueAtTime(volume, startTime + 0.022);
  envGain.gain.exponentialRampToValueAtTime(volume * 0.68, startTime + duration * 0.55);
  envGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  // Subtle airy 'h' breath burst on onset for authentic "hi-hi" child giggle
  const breathSrc = ctx.createBufferSource();
  breathSrc.buffer = getBreathNoiseBuffer(ctx);
  const breathFilter = ctx.createBiquadFilter();
  breathFilter.type = 'bandpass';
  breathFilter.frequency.value = f2 * 0.9;
  breathFilter.Q.value = 1.6;
  const breathGain = ctx.createGain();
  breathGain.gain.setValueAtTime(0.0001, startTime);
  breathGain.gain.linearRampToValueAtTime(volume * 0.14, startTime + 0.012);
  breathGain.gain.exponentialRampToValueAtTime(0.0001, startTime + Math.min(0.055, duration * 0.45));

  oscMain.connect(formant1);
  oscMain.connect(formant2);

  oscHarmonic.connect(harmonicGain);
  harmonicGain.connect(formant1);
  harmonicGain.connect(formant2);

  formant1.connect(envGain);
  formant2.connect(formant2Gain);
  formant2Gain.connect(envGain);

  breathSrc.connect(breathFilter);
  breathFilter.connect(breathGain);
  breathGain.connect(ctx.destination);

  envGain.connect(ctx.destination);

  oscMain.start(startTime);
  oscHarmonic.start(startTime);
  breathSrc.start(startTime);

  oscMain.stop(stopTime);
  oscHarmonic.stop(stopTime);
  breathSrc.stop(stopTime);
}

/**
 * Plays Mishmish's playful child-like laugh / reaction voice matching each expression.
 */
export function playMishmishVoice(kind: MishmishVoiceKind): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = performance.now();
  if (kind === 'tickle') {
    if (now - lastTickleVoiceAt < 340) return;
    lastTickleVoiceAt = now;
  }

  const t0 = ctx.currentTime + 0.01;

  if (kind === 'smile') {
    scheduleChildSyllable(ctx, {
      startTime: t0,
      duration: 0.11,
      baseFreq: 520,
      peakFreq: 660,
      endFreq: 610,
      volume: 0.24,
      f1: 780,
      f2: 1950,
    });
    scheduleChildSyllable(ctx, {
      startTime: t0 + 0.125,
      duration: 0.16,
      baseFreq: 600,
      peakFreq: 790,
      endFreq: 720,
      volume: 0.27,
      f1: 860,
      f2: 2150,
    });
    return;
  }

  if (kind === 'wink') {
    // Quick cheeky upward child chirp ("بيب!")
    scheduleChildSyllable(ctx, {
      startTime: t0,
      duration: 0.14,
      baseFreq: 580,
      peakFreq: 860,
      endFreq: 790,
      volume: 0.25,
      f1: 840,
      f2: 2100,
    });
    return;
  }

  if (kind === 'surprised') {
    // Cute child surprised "أووه!"
    scheduleChildSyllable(ctx, {
      startTime: t0,
      duration: 0.22,
      baseFreq: 490,
      peakFreq: 760,
      endFreq: 670,
      volume: 0.25,
      f1: 680,
      f2: 1480,
    });
    return;
  }

  if (kind === 'starry') {
    // Delighted sparkling child "واااو!"
    scheduleChildSyllable(ctx, {
      startTime: t0,
      duration: 0.11,
      baseFreq: 540,
      peakFreq: 720,
      endFreq: 680,
      volume: 0.24,
      f1: 780,
      f2: 1900,
    });
    scheduleChildSyllable(ctx, {
      startTime: t0 + 0.115,
      duration: 0.19,
      baseFreq: 660,
      peakFreq: 900,
      endFreq: 840,
      volume: 0.26,
      f1: 880,
      f2: 2200,
    });
    return;
  }

  if (kind === 'shy') {
    // Bashful little child "أهـهـ"
    scheduleChildSyllable(ctx, {
      startTime: t0,
      duration: 0.1,
      baseFreq: 510,
      peakFreq: 610,
      endFreq: 560,
      volume: 0.2,
      f1: 760,
      f2: 1850,
    });
    scheduleChildSyllable(ctx, {
      startTime: t0 + 0.115,
      duration: 0.13,
      baseFreq: 560,
      peakFreq: 690,
      endFreq: 630,
      volume: 0.22,
      f1: 800,
      f2: 1960,
    });
    return;
  }

  if (kind === 'cool') {
    // Playful two-beat confident child "همـم هـا!"
    scheduleChildSyllable(ctx, {
      startTime: t0,
      duration: 0.09,
      baseFreq: 530,
      peakFreq: 640,
      endFreq: 590,
      volume: 0.22,
      f1: 740,
      f2: 1780,
    });
    scheduleChildSyllable(ctx, {
      startTime: t0 + 0.11,
      duration: 0.15,
      baseFreq: 620,
      peakFreq: 810,
      endFreq: 720,
      volume: 0.25,
      f1: 860,
      f2: 2080,
    });
    return;
  }

  if (kind === 'laugh') {
    const notes = [
      { delay: 0.0, dur: 0.1, b: 560, p: 720, e: 600, v: 0.24 },
      { delay: 0.12, dur: 0.1, b: 620, p: 790, e: 650, v: 0.27 },
      { delay: 0.24, dur: 0.11, b: 670, p: 860, e: 700, v: 0.28 },
      { delay: 0.37, dur: 0.16, b: 640, p: 880, e: 740, v: 0.25 },
    ];
    notes.forEach((n, idx) => {
      scheduleChildSyllable(ctx, {
        startTime: t0 + n.delay,
        duration: n.dur,
        baseFreq: n.b,
        peakFreq: n.p,
        endFreq: n.e,
        volume: n.v,
        f1: 820 + idx * 35,
        f2: 2020 + idx * 70,
      });
    });
    return;
  }

  if (kind === 'cry') {
    // Soft sad little child whimper ("أووه... إهه...") when absent for a day
    scheduleChildSyllable(ctx, {
      startTime: t0,
      duration: 0.22,
      baseFreq: 520,
      peakFreq: 495,
      endFreq: 390,
      volume: 0.17,
      f1: 580,
      f2: 1220,
    });
    scheduleChildSyllable(ctx, {
      startTime: t0 + 0.26,
      duration: 0.24,
      baseFreq: 470,
      peakFreq: 445,
      endFreq: 355,
      volume: 0.15,
      f1: 540,
      f2: 1150,
    });
    return;
  }

  if (kind === 'celebrate') {
    // Bright cheerful child celebration ("ياااه! هيهي!") right after login
    const celebrationNotes = [
      { delay: 0.0, dur: 0.11, b: 560, p: 760, e: 700, v: 0.24 },
      { delay: 0.12, dur: 0.14, b: 640, p: 880, e: 820, v: 0.28 },
      { delay: 0.28, dur: 0.1, b: 700, p: 930, e: 780, v: 0.25 },
      { delay: 0.4, dur: 0.18, b: 690, p: 960, e: 860, v: 0.27 },
    ];
    celebrationNotes.forEach((n, idx) => {
      scheduleChildSyllable(ctx, {
        startTime: t0 + n.delay,
        duration: n.dur,
        baseFreq: n.b,
        peakFreq: n.p,
        endFreq: n.e,
        volume: n.v,
        f1: 840 + idx * 40,
        f2: 2050 + idx * 80,
      });
    });
    return;
  }

  if (kind === 'angry') {
    // Cheeky grumpy child protest ("همم! لأ بقى!")
    const grumpyNotes = [
      { delay: 0.0, dur: 0.11, b: 440, p: 510, e: 360, v: 0.28 },
      { delay: 0.13, dur: 0.16, b: 560, p: 640, e: 390, v: 0.3 },
    ];
    grumpyNotes.forEach((n, idx) => {
      scheduleChildSyllable(ctx, {
        startTime: t0 + n.delay,
        duration: n.dur,
        baseFreq: n.b,
        peakFreq: n.p,
        endFreq: n.e,
        volume: n.v,
        f1: 690 + idx * 60,
        f2: 1480 + idx * 140,
      });
    });
    return;
  }

  // Tickle: playful cascading high-pitched bubbly child giggles
  const jitter = (Math.random() - 0.5) * 45;
  const giggleBurst = [
    { delay: 0.0, dur: 0.085, b: 630 + jitter, p: 830 + jitter, e: 690 + jitter, v: 0.24 },
    { delay: 0.1, dur: 0.09, b: 690 + jitter, p: 900 + jitter, e: 740 + jitter, v: 0.27 },
    { delay: 0.205, dur: 0.11, b: 730 + jitter, p: 940 + jitter, e: 780 + jitter, v: 0.25 },
  ];
  giggleBurst.forEach((n, idx) => {
    scheduleChildSyllable(ctx, {
      startTime: t0 + n.delay,
      duration: n.dur,
      baseFreq: n.b,
      peakFreq: n.p,
      endFreq: n.e,
      volume: n.v,
      f1: 870 + idx * 40,
      f2: 2150 + idx * 90,
    });
  });
}

/**
 * Speaks Mishmish's short grumpy reply aloud with a cute child-like pitch via Web Speech API.
 */
export function speakMishmishAngryReply(text: string, lang: 'ar' | 'en' = 'ar'): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === 'en' ? 'en-US' : 'ar-EG';
    utterance.pitch = 1.55;
    utterance.rate = 1.12;
    utterance.volume = 0.92;

    const voices = synth.getVoices?.() || [];
    if (voices.length > 0) {
      const preferred =
        voices.find((v) =>
          lang === 'en' ? v.lang.startsWith('en') : v.lang.startsWith('ar')
        ) || null;
      if (preferred) {
        utterance.voice = preferred;
      }
    }
    synth.speak(utterance);
  } catch {
    // Ignore environments restricting speech synthesis
  }
}

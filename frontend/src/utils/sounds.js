// frontend/src/utils/sounds.js
// Small synthesized join tone using Web Audio API — no external file required.

export function playJoinTone() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();

    // short melody: three beeps
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = 0.15; // volume
    master.connect(ctx.destination);

    const scheduleBeep = (start, freq, dur = 0.12) => {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      env.gain.value = 0.0;

      osc.connect(env);
      env.connect(master);

      env.gain.setValueAtTime(0.0, start);
      env.gain.linearRampToValueAtTime(1.0, start + 0.005);
      env.gain.exponentialRampToValueAtTime(0.001, start + dur);

      osc.start(start);
      osc.stop(start + dur + 0.02);
    };

    // pattern: quick harmonic beep (like meeting join)
    scheduleBeep(now, 880, 0.10);      // high beep
    scheduleBeep(now + 0.12, 660, 0.10); // lower beep
    scheduleBeep(now + 0.24, 990, 0.12); // final beep

    // resume context if suspended on user gesture restriction
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
  } catch (e) {
    // silently fail if browser doesn't support WebAudio
    console.warn("playJoinTone error", e);
  }
}

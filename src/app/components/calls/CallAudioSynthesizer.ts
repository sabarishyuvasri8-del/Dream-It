/**
 * CallAudioSynthesizer
 * Synthesizes ringtones and call tone alerts using the browser Web Audio API.
 * Ensures zero external MP3 downloads and zero persistent storage footprint.
 */

class CallAudioSynthesizer {
  private ctx: AudioContext | null = null;
  private ringtoneInterval: any = null;
  private outgoingInterval: any = null;

  private getAudioContext(): AudioContext {
    if (!this.ctx || this.ctx.state === "closed") {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtxClass();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Plays a pleasant dual-tone chime (incoming call ring)
   */
  public startIncomingRingtone() {
    this.stopAll();
    const playTonePair = () => {
      try {
        const ctx = this.getAudioContext();
        const now = ctx.currentTime;

        // First tone: 440Hz (A4)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = "sine";
        osc1.frequency.setValueAtTime(440, now);
        gain1.gain.setValueAtTime(0, now);
        gain1.gain.linearRampToValueAtTime(0.18, now + 0.05);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.5);

        // Second tone: 554.37Hz (C#5)
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(554.37, now + 0.15);
        gain2.gain.setValueAtTime(0, now + 0.15);
        gain2.gain.linearRampToValueAtTime(0.22, now + 0.2);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.15);
        osc2.stop(now + 0.9);
      } catch (err) {
        console.warn("[CallAudio] Could not play incoming ringtone:", err);
      }
    };

    playTonePair();
    this.ringtoneInterval = setInterval(playTonePair, 2200);
  }

  /**
   * Plays standard gentle outgoing ring tone (calling friend...)
   */
  public startOutgoingRingtone() {
    this.stopAll();
    const playOutgoingBeep = () => {
      try {
        const ctx = this.getAudioContext();
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(425, now);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.12, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.95);
      } catch (err) {
        console.warn("[CallAudio] Could not play outgoing tone:", err);
      }
    };

    playOutgoingBeep();
    this.outgoingInterval = setInterval(playOutgoingBeep, 3000);
  }

  /**
   * Plays a quick chime when call connects
   */
  public playConnectedChime() {
    this.stopAll();
    try {
      const ctx = this.getAudioContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.12); // E5
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.4);
    } catch {}
  }

  /**
   * Plays a short subtle descending tone when call ends
   */
  public playEndCallChime() {
    this.stopAll();
    try {
      const ctx = this.getAudioContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(261.63, now + 0.25);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } catch {}
  }

  /**
   * Stops all active synthesized ringtones
   */
  public stopAll() {
    if (this.ringtoneInterval) {
      clearInterval(this.ringtoneInterval);
      this.ringtoneInterval = null;
    }
    if (this.outgoingInterval) {
      clearInterval(this.outgoingInterval);
      this.outgoingInterval = null;
    }
  }
}

export const callAudio = new CallAudioSynthesizer();

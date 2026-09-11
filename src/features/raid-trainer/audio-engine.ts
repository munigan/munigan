import type { AudioCue } from "./audio-cues";

export type AudioSettings = {
  enabled: boolean;
  volume: number;
  voice: boolean;
  ambience: boolean;
};
const voiceCues: AudioCue[] = [
  "count-1",
  "count-2",
  "count-3",
  "count-4",
  "count-5",
  "spread",
  "target",
  "other",
  "damage",
  "regroup",
  "complete",
  "failed",
];

/** Owns all Web Audio resources. No sound starts before unlock() from a gesture. */
export class TrainerAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private windGain: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private voices = new Set<AudioBufferSourceNode>();
  private effects = new Set<AudioScheduledSourceNode>();
  private wind: AudioBufferSourceNode | null = null;
  private settings: AudioSettings = {
    enabled: true,
    volume: 0.55,
    voice: true,
    ambience: true,
  };
  private active = false;
  private destroyed = false;
  private loading: Promise<void> | null = null;
  private lastDamage = -10;

  async unlock() {
    if (this.destroyed) return;
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.connect(this.context.destination);
      this.master.gain.value = this.settings.enabled ? this.settings.volume : 0;
      const context = this.context;
      this.loading = Promise.all(
        [...voiceCues, "air-horn"].map(async (name) => {
          try {
            const response = await fetch(
              `/raid-trainer/audio/${name}.${name === "air-horn" ? "ogg" : "mp3"}`,
            );
            if (!response.ok) return;
            const buffer = await context.decodeAudioData(
              await response.arrayBuffer(),
            );
            if (!this.destroyed) this.buffers.set(name, buffer);
          } catch {
            /* The oscillator cue remains available if an asset cannot decode. */
          }
        }),
      ).then(() => undefined);
      this.createWind();
    }
    if (this.context.state === "suspended") await this.context.resume();
    await this.loading;
  }

  configure(settings: AudioSettings) {
    this.settings = settings;
    if (this.context && this.master)
      this.master.gain.setTargetAtTime(
        settings.enabled ? settings.volume : 0,
        this.context.currentTime,
        0.04,
      );
    if (!settings.enabled || !settings.voice) this.stopVoices();
    this.setActive(this.active);
  }

  setActive(active: boolean) {
    const changed = this.active !== active;
    this.active = active;
    if (this.context && this.windGain)
      this.windGain.gain.setTargetAtTime(
        active && this.settings.enabled && this.settings.ambience ? 0.1 : 0,
        this.context.currentTime,
        0.15,
      );
    if (!active && changed) this.stopVoices();
  }

  play(cue: AudioCue) {
    if (
      !this.context ||
      !this.master ||
      this.destroyed ||
      !this.settings.enabled ||
      this.context.state !== "running"
    )
      return;
    const now = this.context.currentTime;
    if (cue === "damage") {
      if (now - this.lastDamage < 1.5) return;
      this.lastDamage = now;
    }
    if (cue === "target") this.sample("air-horn", 0.16, false);
    else if (cue === "pool") this.tone(72, 0.45, 0.11, "sawtooth", 32);
    else if (cue === "damage") {
      this.tone(125, 0.2, 0.14, "triangle", 70);
    } else if (cue === "complete") {
      [440, 554, 659, 880].forEach((hz, i) =>
        this.tone(hz, 0.6, 0.09, "sine", hz, i * 0.12),
      );
    } else if (cue === "failed") {
      this.tone(174, 0.8, 0.1, "triangle", 87);
    } else if (cue.startsWith("count-")) this.tone(700, 0.08, 0.045, "sine");
    else this.tone(420, 0.13, 0.04, "sine");
    if (this.settings.voice && cue !== "pool") this.sample(cue, 0.85, true);
  }

  private sample(name: string, volume: number, voice: boolean) {
    const buffer = this.buffers.get(name);
    if (!buffer || !this.context || !this.master) return;
    if (voice) this.stopVoices();
    const source = this.context.createBufferSource(),
      gain = this.context.createGain();
    source.buffer = buffer;
    gain.gain.value = volume;
    source.connect(gain);
    gain.connect(this.master);
    if (voice) this.voices.add(source);
    else this.effects.add(source);
    source.onended = () => {
      this.voices.delete(source);
      this.effects.delete(source);
      source.disconnect();
      gain.disconnect();
    };
    source.start();
  }

  private tone(
    hz: number,
    duration: number,
    volume: number,
    type: OscillatorType,
    endHz = hz,
    delay = 0,
  ) {
    if (!this.context || !this.master) return;
    const source = this.context.createOscillator(),
      gain = this.context.createGain(),
      now = this.context.currentTime + delay;
    source.type = type;
    source.frequency.setValueAtTime(hz, now);
    source.frequency.exponentialRampToValueAtTime(endHz, now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(gain);
    gain.connect(this.master);
    this.effects.add(source);
    source.start(now);
    source.stop(now + duration + 0.01);
    source.onended = () => {
      this.effects.delete(source);
      source.disconnect();
      gain.disconnect();
    };
  }

  private createWind() {
    if (!this.context || !this.master) return;
    const length = this.context.sampleRate * 4,
      buffer = this.context.createBuffer(1, length, this.context.sampleRate),
      data = buffer.getChannelData(0);
    let previous = 0;
    for (let i = 0; i < length; i++) {
      previous = (previous + (Math.random() * 2 - 1) * 0.02) / 1.02;
      data[i] = previous * 4;
    }
    this.wind = this.context.createBufferSource();
    this.wind.buffer = buffer;
    this.wind.loop = true;
    const filter = this.context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 650;
    this.windGain = this.context.createGain();
    this.windGain.gain.value = 0;
    this.wind.connect(filter);
    filter.connect(this.windGain);
    this.windGain.connect(this.master);
    this.wind.start();
  }

  private stopVoices() {
    for (const source of this.voices) {
      try {
        source.stop();
      } catch {}
    }
    this.voices.clear();
  }
  stop() {
    this.setActive(false);
    for (const source of this.effects) {
      try {
        source.stop();
      } catch {}
    }
    this.effects.clear();
    this.lastDamage = -10;
  }
  destroy() {
    this.destroyed = true;
    this.stop();
    try {
      this.wind?.stop();
    } catch {}
    void this.context?.close();
    this.buffers.clear();
  }
}

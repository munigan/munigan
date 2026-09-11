import { afterEach, expect, it, vi } from "vitest";
import { TrainerAudio } from "./audio-engine";

afterEach(() => vi.unstubAllGlobals());
it("stops a replay voice even when live ambience was never active", async () => {
  const started: { stop: ReturnType<typeof vi.fn>; loop?: boolean }[] = [];
  const param = () => ({
    value: 0,
    setTargetAtTime: vi.fn(),
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  });
  const node = () => ({ connect: vi.fn(), disconnect: vi.fn() });
  class Context {
    sampleRate = 10;
    currentTime = 1;
    state = "running";
    destination = {};
    createGain() {
      return { ...node(), gain: param() };
    }
    createBuffer(_channels: number, length: number) {
      return { getChannelData: () => new Float32Array(length) };
    }
    createBufferSource() {
      const source = {
        ...node(),
        loop: false,
        buffer: undefined,
        start: () => started.push(source),
        stop: vi.fn(),
      };
      return source;
    }
    createBiquadFilter() {
      return { ...node(), type: "lowpass", frequency: param() };
    }
    createOscillator() {
      return { ...node(), frequency: param(), start: vi.fn(), stop: vi.fn() };
    }
    decodeAudioData() {
      return Promise.resolve({});
    }
    close() {
      return Promise.resolve();
    }
  }
  vi.stubGlobal("AudioContext", Context);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(1),
    })),
  );
  const audio = new TrainerAudio();
  await audio.unlock();
  audio.play("other");
  const voice = started.find((source) => !source.loop)!;
  expect(voice).toBeDefined();
  expect(voice.stop).not.toHaveBeenCalled();
  audio.stop();
  expect(voice.stop).toHaveBeenCalledTimes(1);
  audio.destroy();
});

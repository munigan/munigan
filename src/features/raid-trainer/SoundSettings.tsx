import type { AudioSettings } from "./audio-engine";

export function SoundSettings({
  settings,
  configure,
  preview,
}: {
  settings: AudioSettings;
  configure: (update: Partial<AudioSettings>) => void;
  preview: () => void;
}) {
  return (
    <details className="rt-sound-settings">
      <summary>
        <span>Sound studio</span>
        <span>
          {settings.enabled ? `${Math.round(settings.volume * 100)}%` : "Muted"}{" "}
          <i>⌄</i>
        </span>
      </summary>
      <div className="rt-sound-body">
        <label className="rt-volume">
          Master volume <span>{Math.round(settings.volume * 100)}%</span>
          <input
            aria-label="Master volume"
            type="range"
            min="0"
            max="100"
            value={Math.round(settings.volume * 100)}
            onChange={(event) =>
              configure({ volume: Number(event.target.value) / 100 })
            }
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(event) => configure({ enabled: event.target.checked })}
          />{" "}
          Sound enabled
        </label>
        <label>
          <input
            type="checkbox"
            checked={settings.voice}
            onChange={(event) => configure({ voice: event.target.checked })}
          />{" "}
          Spoken countdowns & callouts
        </label>
        <label>
          <input
            type="checkbox"
            checked={settings.ambience}
            onChange={(event) => configure({ ambience: event.target.checked })}
          />{" "}
          Frozen Throne ambience
        </label>
        <button onClick={preview} disabled={!settings.enabled}>
          ▶ Preview countdown
        </button>
        <p>
          Original callouts + DBM’s AirHorn alert.
          <br />
          <a href="/raid-trainer/credits.txt" target="_blank" rel="noreferrer">
            Audio & artwork credits ↗
          </a>
        </p>
      </div>
    </details>
  );
}

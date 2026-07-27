import type { FC } from 'react'

import type { AudioMixerControls } from '../../hooks/useAudioPlayer'

type MixerPanelProps = {
  mixerControls: AudioMixerControls
}

export const MixerPanel: FC<MixerPanelProps> = ({ mixerControls }) => {
  return (
    <div className="flex min-w-180 gap-4 pb-1">
      <div className="flex w-20 shrink-0 flex-col items-center gap-2">
        <span className="w-full truncate text-center text-xs text-gray-700">
          Master
        </span>
        <input
          type="range"
          min={0}
          max={2}
          step={0.01}
          value={mixerControls.masterVolume}
          aria-label="マスター音量"
          className="h-20 w-6 [direction:rtl] [writing-mode:vertical-lr]"
          onChange={(event) =>
            mixerControls.setMasterVolume(Number(event.target.value))
          }
        />
        <div className="flex w-full gap-1">
          <button
            type="button"
            className="h-7 w-full rounded-md border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-50"
            onClick={mixerControls.muteAll}
          >
            M
          </button>
          <button
            type="button"
            className="h-7 w-full rounded-md border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-50"
            onClick={mixerControls.unmuteAll}
          >
            S
          </button>
        </div>
      </div>

      <div className="flex w-20 shrink-0 flex-col items-center gap-2">
        <span className="w-full truncate text-center text-xs text-gray-700">
          Metronome
        </span>
        <input
          type="range"
          min={0}
          max={2}
          step={0.01}
          value={mixerControls.metronomeVolume}
          aria-label="メトロノーム音量"
          className="h-20 w-6 [direction:rtl] [writing-mode:vertical-lr]"
          onChange={(event) =>
            mixerControls.setMetronomeVolume(Number(event.target.value))
          }
        />
        <div className="flex w-full gap-1">
          <button
            type="button"
            className={`h-7 flex-1 rounded-md border text-xs font-medium ${
              mixerControls.isMetronomeMuted
                ? 'border-red-500 bg-red-500 text-white'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
            onClick={
              mixerControls.isMetronomeMuted
                ? mixerControls.unmuteMetronome
                : mixerControls.muteMetronome
            }
          >
            M
          </button>
          <button
            type="button"
            className={`h-7 flex-1 rounded-md border text-xs font-medium ${
              mixerControls.isMetronomeSoloed
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
            onClick={
              mixerControls.isMetronomeSoloed
                ? mixerControls.clearMetronomeSolo
                : mixerControls.soloMetronome
            }
          >
            S
          </button>
        </div>
      </div>

      {mixerControls.parts.map((part) => (
        <div
          key={part.id}
          className="flex w-20 shrink-0 flex-col items-center gap-2"
        >
          <span className="texto w-full truncate text-center text-xs text-gray-700">
            {part.name}
          </span>
          <input
            type="range"
            min={0}
            max={2}
            step={0.01}
            value={part.volume}
            aria-label={`${part.name} 音量`}
            className="h-20 w-6 [direction:rtl] [writing-mode:vertical-lr]"
            onChange={(event) =>
              mixerControls.setPartVolume(part.id, Number(event.target.value))
            }
          />
          <div className="flex w-full gap-1">
            <button
              type="button"
              className={`h-7 flex-1 rounded-md border text-xs font-medium ${
                part.isMuted
                  ? 'border-red-500 bg-red-500 text-white'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
              onClick={() =>
                part.isMuted
                  ? mixerControls.unmutePart(part.id)
                  : mixerControls.mutePart(part.id)
              }
            >
              M
            </button>
            <button
              type="button"
              className={`h-7 flex-1 rounded-md border text-xs font-medium ${
                part.isSoloed
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
              onClick={() =>
                part.isSoloed
                  ? mixerControls.clearSoloPart()
                  : mixerControls.soloPart(part.id)
              }
            >
              S
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

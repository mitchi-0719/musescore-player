import type { FC } from 'react'

import type { AudioMixerControls } from '../../hooks/useAudioPlayer'
import { useScoreStore } from '../../stores/useScoreStore'
import { Icon } from '../ui/Icon'

export type ScorePartVisibilityControl = {
  id: string
  name: string
  isVisible: boolean
}

export type ScoreVisibilityControls = {
  parts: ScorePartVisibilityControl[]
  isRendering: boolean
  togglePart: (partId: string) => void
  showAllParts: () => void
}

type MixerPanelProps = {
  mixerControls: AudioMixerControls
  visibilityControls: ScoreVisibilityControls
}

export const MixerPanel: FC<MixerPanelProps> = ({
  mixerControls,
  visibilityControls,
}) => {
  const isPlaying = useScoreStore((state) => state.isPlaying)
  const visiblePartCount = visibilityControls.parts.filter(
    (part) => part.isVisible
  ).length
  const allPartsVisible = visiblePartCount === visibilityControls.parts.length
  const audioPartsById = new Map(
    mixerControls.parts.map((part) => [part.id, part])
  )

  return (
    <div className="flex min-w-180 gap-4 pb-1">
      <div className="flex w-20 shrink-0 flex-col items-center gap-2">
        <span className="w-full truncate text-center text-xs text-gray-700">
          Master
        </span>
        <button
          type="button"
          className="grid h-5 place-items-center rounded-md border border-blue-200 bg-blue-50 px-3 text-blue-600 disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-300"
          disabled={
            isPlaying || visibilityControls.isRendering || allPartsVisible
          }
          aria-label="全パートを表示"
          title="全パートを表示"
          onClick={visibilityControls.showAllParts}
        >
          <Icon name="visibility" size="xSmall" />
        </button>
        <input
          type="range"
          min={0}
          max={2}
          step={0.01}
          value={mixerControls.masterVolume}
          aria-label="マスター音量"
          className="h-16 w-6 [direction:rtl] [writing-mode:vertical-lr]"
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
        <span className="h-5" aria-hidden="true" />
        <input
          type="range"
          min={0}
          max={2}
          step={0.01}
          value={mixerControls.metronomeVolume}
          aria-label="メトロノーム音量"
          className="h-16 w-6 [direction:rtl] [writing-mode:vertical-lr]"
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

      {visibilityControls.parts.map((scorePart) => {
        const audioPart = audioPartsById.get(scorePart.id)
        const visibilityDisabled =
          isPlaying ||
          visibilityControls.isRendering ||
          (scorePart.isVisible && visiblePartCount === 1)

        return (
          <div
            key={scorePart.id}
            className="flex w-20 shrink-0 flex-col items-center gap-2"
          >
            <span className="w-full truncate text-center text-xs text-gray-700">
              {scorePart.name}
            </span>
            <button
              type="button"
              className={`grid h-5 place-items-center rounded-md border px-3 ${
                scorePart.isVisible
                  ? 'border-blue-200 bg-blue-50 text-blue-600'
                  : 'border-slate-200 bg-slate-50 text-slate-400'
              } disabled:cursor-not-allowed disabled:opacity-40`}
              disabled={visibilityDisabled}
              aria-pressed={scorePart.isVisible}
              aria-label={`${scorePart.name}パートを${
                scorePart.isVisible ? '非表示' : '表示'
              }`}
              title={
                scorePart.isVisible && visiblePartCount === 1
                  ? '最低1パートは表示する必要があります'
                  : `${scorePart.name}パートを${
                      scorePart.isVisible ? '非表示' : '表示'
                    }`
              }
              onClick={() => visibilityControls.togglePart(scorePart.id)}
            >
              <Icon
                name={scorePart.isVisible ? 'visibility' : 'visibility-off'}
                size="xSmall"
              />
            </button>
            <input
              type="range"
              min={0}
              max={2}
              step={0.01}
              value={audioPart?.volume ?? 1}
              disabled={!audioPart}
              aria-label={`${scorePart.name} 音量`}
              className="h-16 w-6 [direction:rtl] [writing-mode:vertical-lr] disabled:opacity-30"
              onChange={(event) =>
                mixerControls.setPartVolume(
                  scorePart.id,
                  Number(event.target.value)
                )
              }
            />
            <div className="flex w-full gap-1">
              <button
                type="button"
                disabled={!audioPart}
                className={`h-7 flex-1 rounded-md border text-xs font-medium disabled:cursor-not-allowed disabled:opacity-30 ${
                  audioPart?.isMuted
                    ? 'border-red-500 bg-red-500 text-white'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
                onClick={() =>
                  audioPart?.isMuted
                    ? mixerControls.unmutePart(scorePart.id)
                    : mixerControls.mutePart(scorePart.id)
                }
              >
                M
              </button>
              <button
                type="button"
                disabled={!audioPart}
                className={`h-7 flex-1 rounded-md border text-xs font-medium disabled:cursor-not-allowed disabled:opacity-30 ${
                  audioPart?.isSoloed
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
                onClick={() =>
                  audioPart?.isSoloed
                    ? mixerControls.clearSoloPart()
                    : mixerControls.soloPart(scorePart.id)
                }
              >
                S
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

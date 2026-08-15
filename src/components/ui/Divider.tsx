import type { FC } from 'react'

type DividerProps = {
  size: 'thin' | 'medium' | 'thick'
  orientation?: 'horizontal' | 'vertical'
}

export const Divider: FC<DividerProps> = ({
  size,
  orientation = 'horizontal',
}) => {
  const orientationClass = {
    horizontal: {
      thin: 'h-px w-full',
      medium: 'h-1 w-full',
      thick: 'h-2 w-full',
    },
    vertical: {
      thin: 'w-px self-stretch',
      medium: 'w-1 self-stretch',
      thick: 'w-2 self-stretch',
    },
  }[orientation][size]

  return (
    <div
      className={`shrink-0 bg-gray-200 ${orientationClass}`}
      aria-hidden="true"
    />
  )
}

import type { ComponentProps } from 'react'

const iconMap = {
  play: 'M8 17.175V6.825q0-.425.3-.713t.7-.287q.125 0 .263.037t.262.113l8.15 5.175q.225.15.338.375t.112.475t-.112.475t-.338.375l-8.15 5.175q-.125.075-.262.113T9 18.175q-.4 0-.7-.288t-.3-.712',
  pause:
    'M16 19q-.825 0-1.412-.587T14 17V7q0-.825.588-1.412T16 5t1.413.588T18 7v10q0 .825-.587 1.413T16 19m-8 0q-.825 0-1.412-.587T6 17V7q0-.825.588-1.412T8 5t1.413.588T10 7v10q0 .825-.587 1.413T8 19',
  add: 'M11 13H6q-.425 0-.712-.288T5 12t.288-.712T6 11h5V6q0-.425.288-.712T12 5t.713.288T13 6v5h5q.425 0 .713.288T19 12t-.288.713T18 13h-5v5q0 .425-.288.713T12 19t-.712-.288T11 18z',
  remove:
    'M6 13q-.425 0-.712-.288T5 12t.288-.712T6 11h12q.425 0 .713.288T19 12t-.288.713T18 13z',
  'arrow-up':
    'M12 13.825L8.1 17.7q-.275.275-.687.288T6.7 17.7q-.275-.275-.275-.7t.275-.7l4.6-4.6q.15-.15.325-.213t.375-.062t.375.062t.325.213l4.6 4.6q.275.275.288.688t-.288.712q-.275.275-.7.275t-.7-.275zm0-6L8.1 11.7q-.275.275-.687.288T6.7 11.7q-.275-.275-.275-.7t.275-.7l4.6-4.6q.15-.15.325-.212T12 5.425t.375.063t.325.212l4.6 4.6q.275.275.288.688t-.288.712q-.275.275-.7.275t-.7-.275z',
  'arrow-down':
    'm12 16.175 3.9-3.875q.275-.275.688-.288t.712.288q.275.275.275.7t-.275.7l-4.6 4.6q-.15.15-.325.213t-.375.062t-.375-.062t-.325-.213l-4.6-4.6q-.275-.275-.288-.687T6.7 12.3q.275-.275.7-.275t.7.275zm0-6L15.9 6.3q.275-.275.688-.287t.712.287q.275.275.275.7t-.275.7l-4.6 4.6q-.15.15-.325.213t-.375.062t-.375-.062t-.325-.213L6.7 7.7q-.275-.275-.288-.687T6.7 6.3q.275-.275.7-.275t.7.275z',
} as const

export type IconName = keyof typeof iconMap
export type IconSize = 'small' | 'medium' | 'large'

const iconSizeClass: Record<IconSize, string> = {
  small: 'h-5 w-5',
  medium: 'h-6 w-6',
  large: 'h-7 w-7',
}

interface IconProps extends Omit<ComponentProps<'svg'>, 'name'> {
  name: IconName
  size?: IconSize
}

export const Icon = ({
  name,
  size = 'medium',
  className = '',
  ...props
}: IconProps) => {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`${iconSizeClass[size]} ${className}`}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path fill="currentColor" d={iconMap[name]} />
    </svg>
  )
}

import type { ComponentProps } from 'react'

import { Icon as IconifyIcon } from '@iconify/react'

const iconMap = {
  play: 'material-symbols:play-arrow-rounded',
  pause: 'material-symbols:pause-rounded',
  add: 'material-symbols:add-rounded',
  remove: 'material-symbols:remove-rounded',
  'arrow-up': 'material-symbols:keyboard-double-arrow-up-rounded',
  'arrow-down': 'material-symbols:keyboard-double-arrow-down-rounded',
} as const

export type IconName = keyof typeof iconMap
export type IconSize = 'small' | 'medium' | 'large'

const iconSizeClass: Record<IconSize, string> = {
  small: 'h-5 w-5',
  medium: 'h-6 w-6',
  large: 'h-7 w-7',
}

interface IconProps extends Omit<
  ComponentProps<typeof IconifyIcon>,
  'icon' | 'size'
> {
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
    <IconifyIcon
      icon={iconMap[name]}
      className={`${iconSizeClass[size]} ${className}`}
      {...props}
    />
  )
}

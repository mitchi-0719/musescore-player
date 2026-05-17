import { ComponentProps } from 'react'

import { Icon as IconifyIcon } from '@iconify/react'

const iconMap = {
  play: 'material-symbols:play-arrow-rounded',
  pause: 'material-symbols:pause-rounded',
  edit: 'material-symbols:edit-outline-rounded',
  'arrow-up': 'material-symbols:keyboard-double-arrow-up-rounded',
  'arrow-down': 'material-symbols:keyboard-double-arrow-down-rounded',
} as const

export type IconName = keyof typeof iconMap

interface IconProps extends Omit<ComponentProps<typeof IconifyIcon>, 'icon'> {
  name: IconName
}

export const Icon = ({ name, className = '', ...props }: IconProps) => {
  return <IconifyIcon icon={iconMap[name]} className={className} {...props} />
}

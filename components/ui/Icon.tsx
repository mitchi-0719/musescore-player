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

// IconifyIconの型から、衝突の元になる 'icon' だけを除外（Omit）した型を作ります
interface IconProps extends Omit<ComponentProps<typeof IconifyIcon>, 'icon'> {
  name: IconName
}

export const Icon = ({ name, className = '', ...props }: IconProps) => {
  return (
    <IconifyIcon
      icon={iconMap[name]} // 辞書から安全にアイコン名を指定
      className={className}
      {...props} // props の中にはもう icon が入っていないので衝突しません！
    />
  )
}

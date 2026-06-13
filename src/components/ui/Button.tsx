import type { FC, ReactNode } from 'react'

type Props = {
  onClick?: () => void
  disabled?: boolean
  children: ReactNode
}

export const Button: FC<Props> = ({ children, onClick, disabled }) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-block rounded-lg bg-blue-500 px-6 py-2 font-medium text-white transition-colors hover:bg-blue-600 disabled:bg-gray-400"
    >
      {children}
    </button>
  )
}

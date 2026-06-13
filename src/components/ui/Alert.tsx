import type { FC, ReactNode } from 'react'

type AlertProps = {
  variant: 'success' | 'error' | 'info'
  children: ReactNode
}

export const Alert: FC<AlertProps> = ({ variant, children }) => {
  const baseClasses = 'rounded-lg px-4 py-3'
  const variantClasses = {
    success: 'border border-green-300 bg-green-50 text-green-700',
    error: 'border border-red-300 bg-red-50 text-red-700',
    info: 'border border-blue-300 bg-blue-50 text-blue-700',
  }

  return (
    <div className={`${baseClasses} ${variantClasses[variant]}`}>
      {children}
    </div>
  )
}

type Props = {
  children: ReactNode
}

export const AlertTitle: FC<Props> = ({ children }) => {
  return <div className="font-semibold">{children}</div>
}

export const AlertDescription: FC<Props> = ({ children }) => {
  return <div className="mt-1 text-sm">{children}</div>
}

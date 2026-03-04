import React from 'react'

interface CardProps {
  children: React.ReactNode
  className?: string
  elevated?: boolean
}

export function Card({ children, className = '', elevated = false }: CardProps) {
  return (
    <div
      className={`bg-surface rounded-xl p-4 ${elevated ? 'shadow-elevation-2' : 'border border-surface-variant'} ${className}`}
    >
      {children}
    </div>
  )
}

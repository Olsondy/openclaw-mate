import React from 'react'

interface CardProps {
  children: React.ReactNode
  className?: string
  elevated?: boolean
}

export function Card({ children, className = '', elevated = false }: CardProps) {
  return (
    <div
      className={`bg-card-bg border border-card-border rounded-xl p-4 ${elevated ? 'shadow-elevation-2' : ''} ${className}`}
    >
      {children}
    </div>
  )
}

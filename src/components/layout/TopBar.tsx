interface TopBarProps {
  title: string
  subtitle?: string
}

export function TopBar({ title, subtitle }: TopBarProps) {
  return (
    <div className="h-14 border-b border-surface-variant bg-surface flex items-center px-6 flex-shrink-0">
      <div className="flex-1">
        <h1 className="text-base font-semibold text-surface-on">{title}</h1>
        {subtitle && <p className="text-xs text-surface-on-variant mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

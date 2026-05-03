interface Props {
  icon: string
  title: string
  description: string
  hint?: string
  color?: string
}

const colorMap: Record<string, { bg: string; border: string; icon: string; hint: string }> = {
  violet: { bg: 'bg-violet-50', border: 'border-violet-100', icon: 'text-violet-300', hint: 'text-violet-400' },
  amber: { bg: 'bg-amber-50', border: 'border-amber-100', icon: 'text-amber-300', hint: 'text-amber-400' },
  rose: { bg: 'bg-rose-50', border: 'border-rose-100', icon: 'text-rose-300', hint: 'text-rose-400' },
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-100', icon: 'text-emerald-300', hint: 'text-emerald-400' },
  blue: { bg: 'bg-blue-50', border: 'border-blue-100', icon: 'text-blue-300', hint: 'text-blue-400' },
}

export function EmptyState({ icon, title, description, hint, color = 'emerald' }: Props) {
  const c = colorMap[color] || colorMap.emerald

  return (
    <div className={`rounded-2xl border-2 border-dashed ${c.border} ${c.bg} p-12 text-center`}>
      <div className={`text-5xl mb-4 ${c.icon}`}>{icon}</div>
      <h3 className="text-lg font-semibold text-gray-700 mb-1">{title}</h3>
      <p className="text-sm text-gray-500 max-w-xs mx-auto">{description}</p>
      {hint && (
        <p className={`text-xs mt-4 ${c.hint} font-medium`}>{hint}</p>
      )}
    </div>
  )
}

import './clay.css'
import type { PaletteKey } from './palette'

interface ProgressBarProps {
  value: number
  color: PaletteKey
  ariaLabel?: string
}

export function ProgressBar({ value, color, ariaLabel }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, Math.round(value)))
  return (
    <div
      className="clay-bar"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={ariaLabel}
    >
      <div
        className="clay-bar-fill"
        style={{
          width: `${pct}%`,
          background: `linear-gradient(145deg, var(--color-persona-${color}), var(--color-persona-${color}-hondo))`,
        }}
      />
    </div>
  )
}

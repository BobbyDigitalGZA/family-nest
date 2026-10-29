import './clay.css'
import { usePress } from './usePress'

interface CheckboxProps {
  checked: boolean
  onToggle: () => void
  disabled?: boolean
  ariaLabel: string
}

export function Checkbox({ checked, onToggle, disabled = false, ariaLabel }: CheckboxProps) {
  const { pressed, handlers } = usePress()
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      className="clay-checkbox"
      data-checked={checked}
      data-pressed={pressed}
      onClick={onToggle}
      {...handlers}
    >
      {checked && (
        <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">
          <path d="M2.5 6.2 5 8.6l4.5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  )
}

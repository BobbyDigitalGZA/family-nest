import type { Weekday } from '../../domain/types'
import { t, type TKey } from '../../i18n/es'
import type { RecurrenceDraft } from './recurrenceDraft'

const DAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 7]

interface Props {
  value: RecurrenceDraft
  onChange: (next: RecurrenceDraft) => void
  disabled?: boolean
  /** Para ids únicos cuando hay más de un grupo en pantalla. */
  idPrefix: string
}

/** Semanal (días elegidos) o mensual (día del mes), con inicio y fin opcional. */
export function RecurrenceFields({ value, onChange, disabled = false, idPrefix }: Props) {
  const set = (patch: Partial<RecurrenceDraft>) => onChange({ ...value, ...patch })
  const toggle = (d: Weekday) =>
    set({
      weekdays: value.weekdays.includes(d)
        ? value.weekdays.filter((x) => x !== d)
        : [...value.weekdays, d],
    })
  return (
    <div className="tk-recurrence">
      <label className="fn-field" htmlFor={`${idPrefix}-kind`}>
        {t('repeatEvery')}
        <select
          id={`${idPrefix}-kind`}
          value={value.kind}
          disabled={disabled}
          onChange={(e) => set({ kind: e.target.value as RecurrenceDraft['kind'] })}
        >
          <option value="weekly">{t('everyWeek')}</option>
          <option value="monthly">{t('everyMonth')}</option>
        </select>
      </label>
      {value.kind === 'weekly' ? (
        <div role="group" aria-label={t('weekdaysLabel')} className="tk-weekdays">
          {DAYS.map((d) => (
            <button
              key={d}
              type="button"
              className="tk-day"
              aria-pressed={value.weekdays.includes(d)}
              aria-label={t(`wd${d}` as TKey)}
              disabled={disabled}
              onClick={() => toggle(d)}
            >
              {t(`wdShort${d}` as TKey)}
            </button>
          ))}
        </div>
      ) : (
        <label className="fn-field" htmlFor={`${idPrefix}-dom`}>
          {t('dayOfMonthLabel')}
          <input
            id={`${idPrefix}-dom`}
            type="number"
            min={1}
            max={31}
            value={Number.isNaN(value.dayOfMonth) ? '' : value.dayOfMonth}
            disabled={disabled}
            onChange={(e) => set({ dayOfMonth: e.target.valueAsNumber })}
          />
        </label>
      )}
      <label className="fn-field" htmlFor={`${idPrefix}-start`}>
        {t('startLabel')}
        <input
          id={`${idPrefix}-start`}
          type="date"
          value={value.start}
          disabled={disabled}
          onChange={(e) => set({ start: e.target.value })}
        />
      </label>
      <label className="tk-check-line">
        <input
          type="checkbox"
          checked={value.end === null}
          disabled={disabled}
          onChange={(e) => set({ end: e.target.checked ? null : value.start })}
        />
        {t('noEndDate')}
      </label>
      {value.end !== null && (
        <label className="fn-field" htmlFor={`${idPrefix}-end`}>
          {t('endLabel')}
          <input
            id={`${idPrefix}-end`}
            type="date"
            value={value.end}
            disabled={disabled}
            onChange={(e) => set({ end: e.target.value })}
          />
        </label>
      )}
    </div>
  )
}

'use client'

import React from 'react'

type Option<T extends string | number = string> = { label: string; value: T; disabled?: boolean }

interface Props<T extends string | number = string> {
  options: Option<T>[]
  value?: T
  onChange?: (v: T) => void
  placeholder?: string
  name?: string
  disabled?: boolean
  className?: string
}

// 原生下拉触发器美化：保持系统外观，但触发器统一样式（圆角、焦点态）
export function NativeSelect<T extends string | number = string>({
  options,
  value,
  onChange,
  placeholder,
  name,
  disabled,
  className,
}: Props<T>) {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const raw = e.target.value
    const parsed = (typeof value === 'number' ? Number(raw) : raw) as T
    onChange?.(parsed)
  }

  const selectValue = value === undefined ? '' : value

  return (
    <div className={`relative ${className ?? ''}`}>
      <select
        name={name}
        disabled={disabled}
        value={selectValue}
        onChange={handleChange}
        className="block w-full appearance-none rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 pr-10 text-sm text-gray-900 dark:text-gray-100 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500 data-[placeholder]:text-gray-400"
      >
        {placeholder && (
          <option value="" disabled hidden>
            {placeholder}
          </option>
        )}
        {options.map((o) => (
          <option key={String(o.value)} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      <svg
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 dark:text-gray-400"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" />
      </svg>
    </div>
  )
}

export default NativeSelect

'use client'

import type { ReactNode } from 'react'
import { useMemo, useRef } from 'react'

import { RadioGroup } from '@/app/components/ui/RadioGroup'

export type LoginMethodOption<T extends string = string> = {
  id: T
  name: string
  description: string
  icon: ReactNode
}

interface LoginMethodSelectorProps<T extends string = string> {
  titleId: string
  methods: LoginMethodOption<T>[]
  value: T
  onValueChange: (next: T) => void
}

/**
 * 登录方式选择：使用 RadioGroup 提供语义与键盘交互（方向键切换），避免仅靠样式表达选中态。
 */
export function LoginMethodSelector<T extends string = string>({
  titleId,
  methods,
  value,
  onValueChange,
}: LoginMethodSelectorProps<T>) {
  const ids = useMemo(() => methods.map((m) => m.id), [methods])
  const itemRefs = useRef<Map<T, HTMLButtonElement | null>>(new Map())

  return (
    <RadioGroup.Root
      aria-labelledby={titleId}
      orientation="vertical"
      value={value}
      onValueChange={(v) => onValueChange(v as T)}
      onKeyDown={(event) => {
        const key = event.key
        const delta =
          key === 'ArrowDown' || key === 'ArrowRight'
            ? 1
            : key === 'ArrowUp' || key === 'ArrowLeft'
              ? -1
              : 0
        if (!delta) return
        if (ids.length <= 1) return

        const index = ids.indexOf(value)
        if (index < 0) return

        event.preventDefault()
        const next = ids[(index + delta + ids.length) % ids.length]
        if (!next || next === value) return

        onValueChange(next)
        // 说明：切换选项后同步移动焦点，保持键盘导航连续性。
        setTimeout(() => itemRefs.current.get(next)?.focus(), 0)
      }}
      className="space-y-2 sm:space-y-3"
    >
      {methods.map((method) => {
        const isActive = value === method.id
        return (
          <RadioGroup.Item
            key={method.id}
            value={method.id}
            ref={(node) => {
              itemRefs.current.set(method.id, node)
            }}
            className={`w-full text-left p-3 sm:p-4 rounded-xl transition-all duration-300 transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              isActive
                ? 'bg-blue-500 text-white shadow-lg'
                : 'bg-gray-100 dark:bg-gray-700/50 border-2 border-transparent hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div
                className={`p-1.5 sm:p-2 rounded-lg ${isActive ? 'bg-white/20' : 'bg-gray-200 dark:bg-gray-600'}`}
                aria-hidden
              >
                {method.icon}
              </div>
              <div className="flex-1">
                <div className={`text-sm sm:text-base font-semibold ${isActive ? 'text-white' : 'text-gray-900 dark:text-gray-100'}`}>
                  {method.name}
                </div>
                <div className={`text-xs sm:text-sm mt-0.5 sm:mt-1 ${isActive ? 'text-white/80' : 'text-gray-600 dark:text-gray-400'}`}>
                  {method.description}
                </div>
              </div>
            </div>
          </RadioGroup.Item>
        )
      })}
    </RadioGroup.Root>
  )
}

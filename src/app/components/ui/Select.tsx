 'use client'

 import * as Select from '@radix-ui/react-select'
 import React from 'react'

 // 通用选项类型
 export type Option<T extends string = string> = { label: string; value: T; disabled?: boolean }

 interface Props<T extends string = string> {
   options: Option<T>[]
   value?: T
   onValueChange?: (v: T) => void
   placeholder?: string
   disabled?: boolean
   className?: string
   error?: boolean
   size?: 'sm' | 'md' | 'lg'
 }

 // 统一风格下拉：完全自定义下拉面板样式，支持圆角/暗色/键盘可达
 export function StyledSelect<T extends string = string>({
   options,
   value,
   onValueChange,
   placeholder,
   disabled,
   className,
   error,
   size = 'md',
 }: Props<T>) {
   const sizeCls =
     size === 'sm' ? 'h-9 text-sm' : size === 'lg' ? 'h-11 text-base' : 'h-10 text-sm'

   return (
     <Select.Root value={value} onValueChange={(v) => onValueChange?.(v as T)} disabled={disabled}>
       {/* 触发器：与站点输入框一致，圆角+边框+焦点环；错误态高亮 */}
       <Select.Trigger
         className={
           `inline-flex w-full items-center justify-between rounded-xl border px-3 ${sizeCls} shadow-sm outline-none transition
            bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100
            border-gray-300 dark:border-gray-700
            focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            data-[placeholder]:text-gray-400 ${error ? 'border-red-500 ring-2 ring-red-500/30' : ''} ${className ?? ''}`
         }
       >
         <Select.Value placeholder={placeholder} />
         <Select.Icon aria-hidden>
           <svg className="ml-2 h-4 w-4 text-gray-500 dark:text-gray-400" viewBox="0 0 20 20" fill="currentColor">
             <path d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" />
           </svg>
         </Select.Icon>
       </Select.Trigger>

       {/* 下拉面板：完全可控的配色/圆角/阴影，暗色适配 */}
       <Select.Portal>
         <Select.Content
           position="popper"
           sideOffset={8}
           className="z-50 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-1 shadow-xl ring-1 ring-black/5"
         >
           <Select.ScrollUpButton className="flex items-center justify-center py-1 text-gray-500 dark:text-gray-400">▲</Select.ScrollUpButton>
           <Select.Viewport className="p-1">
             {options.map((o) => (
               <Select.Item
                 key={o.value}
                 value={o.value}
                 disabled={o.disabled}
                 className="group relative flex w-full cursor-pointer select-none items-center rounded-md pl-3 pr-8 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none transition
                            data-[disabled]:opacity-40 data-[state=checked]:text-blue-600 dark:data-[state=checked]:text-blue-400 data-[highlighted]:bg-blue-500/10"
               >
                 <Select.ItemText>{o.label}</Select.ItemText>
                 <Select.ItemIndicator className="absolute right-2 text-blue-600 dark:text-blue-400">✓</Select.ItemIndicator>
               </Select.Item>
             ))}
           </Select.Viewport>
           <Select.ScrollDownButton className="flex items-center justify-center py-1 text-gray-500 dark:text-gray-400">▼</Select.ScrollDownButton>
         </Select.Content>
       </Select.Portal>
     </Select.Root>
   )
 }

 export default StyledSelect

'use client'

import {
  Root,
  Item,
  Indicator,
} from '@radix-ui/react-radio-group'

// 使用具名导入并组装为与 Radix API 一致的命名空间对象，便于复用与 tree-shaking
export const RadioGroup = {
  Root,
  Item,
  Indicator,
} as const

export default RadioGroup


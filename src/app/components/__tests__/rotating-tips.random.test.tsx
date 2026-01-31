// @vitest-environment jsdom

import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

vi.mock('../TipsProvider', () => ({
  useTips: () => ({
    state: 'loaded',
    tips: ['A', 'B', 'C', 'D'],
    reload: async () => {},
  }),
}))

import { RotatingTips } from '../RotatingTips'

function buildOrder(length: number, seed: number): number[] {
  const base = Array.from({ length }, (_, i) => i)
  if (length <= 1) return base

  let state = (seed || 1) >>> 0
  const nextRand = () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }

  for (let i = base.length - 1; i > 0; i--) {
    const j = Math.floor(nextRand() * (i + 1))
    ;[base[i], base[j]] = [base[j], base[i]]
  }
  return base
}

describe('RotatingTips random seed init', () => {
  it('initializes a session seed on mount when randomize=true', async () => {
    const seed = 123456789
    const spy = vi
      .spyOn(globalThis.crypto, 'getRandomValues')
      .mockImplementation((arr: ArrayBufferView) => {
        ;(arr as Uint32Array)[0] = seed
        return arr
      })

    const tips = ['A', 'B', 'C', 'D']
    const expectedFirst = tips[buildOrder(tips.length, seed)[0]]

    const { unmount } = render(<RotatingTips intervalMs={999_999} />)

    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1))
    expect(screen.getByText(expectedFirst)).toBeTruthy()

    unmount()
    spy.mockRestore()
  })

  it('does not initialize a session seed when randomize=false', async () => {
    const spy = vi.spyOn(globalThis.crypto, 'getRandomValues')

    const { unmount } = render(<RotatingTips intervalMs={999_999} randomize={false} />)

    await waitFor(() => expect(screen.getByText('A')).toBeTruthy())
    expect(spy).not.toHaveBeenCalled()

    unmount()
    spy.mockRestore()
  })
})


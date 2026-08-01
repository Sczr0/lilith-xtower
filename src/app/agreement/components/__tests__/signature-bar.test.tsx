// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { SignatureBar } from '../SignatureBar';
import type { PrecompiledSignatureInfo } from '@/app/lib/precompiled-types';

afterEach(() => cleanup());

const SIGNED_INFO: PrecompiledSignatureInfo = {
  format: 'openpgp-clearsign',
  status: 'signed',
  verified: null,
  hash: 'SHA256',
  signature: '-----BEGIN PGP SIGNATURE-----\n\nmock-signature\n-----END PGP SIGNATURE-----',
};

describe('SignatureBar', () => {
  it('展示签名状态与公钥指纹', () => {
    render(<SignatureBar signatureInfo={SIGNED_INFO} />);

    expect(screen.getByText('已签名（未校验）')).toBeTruthy();
    expect(screen.getByText('Hash: SHA256')).toBeTruthy();
    // gpg 标准分组格式的完整指纹
    expect(screen.getByText('2CBA 8D3E 4C17 C116 B1BD 1DCE 00CF 8232 4397 032F')).toBeTruthy();
  });

  it('公钥下载链接指向 .asc 文件且带指纹 aria-label', () => {
    render(<SignatureBar signatureInfo={SIGNED_INFO} />);

    // 页面内唯一的链接即公钥下载链接（aria-label 覆盖了按钮文字）
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('/Sczr0_0x2CBA8D3E4C17C116B1BD1DCE00CF82324397032F.asc');
    expect(link.getAttribute('download')).not.toBeNull();
    expect(link.getAttribute('aria-label')).toContain('2CBA8D3E4C17C116B1BD1DCE00CF82324397032F');
  });

  it('展示密钥 UID 与核验提示', () => {
    render(<SignatureBar signatureInfo={SIGNED_INFO} />);

    // 嵌套元素可能共享文本，取第一个精确匹配的元素
    expect(screen.getAllByText('Sczr0 <sczr0710@163.com>')[0]).toBeTruthy();
    expect(screen.getByText(/请与外部渠道/)).toBeTruthy();
  });

  it('unsigned 状态显示「未签名」', () => {
    render(
      <SignatureBar signatureInfo={{ format: 'openpgp-clearsign', status: 'unsigned', verified: null }} />,
    );
    expect(screen.getByText('未签名')).toBeTruthy();
  });
});

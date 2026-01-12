import { describe, expect, it } from 'vitest';
import { normalizePgpClearsignedMarkdown, parsePgpClearsignedMessage } from './pgp-clearsigned-markdown.mjs';

describe('normalizePgpClearsignedMarkdown', () => {
  it('returns original input when not clearsigned', () => {
    const input = '# Title\n\n- item\n';
    expect(normalizePgpClearsignedMarkdown(input)).toBe(input);
  });

  it('extracts body and removes dash-escaping for clearsigned markdown', () => {
    const input = [
      '-----BEGIN PGP SIGNED MESSAGE-----',
      'Hash: SHA256',
      '',
      '# Title',
      '',
      '- - item 1',
      '- -From: literal',
      'normal line',
      '',
      '-----BEGIN PGP SIGNATURE-----',
      '',
      'iQGzBAEBC...fake...',
      '=abcd',
      '-----END PGP SIGNATURE-----',
      '',
    ].join('\n');

    const parsed = parsePgpClearsignedMessage(input);
    expect(parsed.isClearsigned).toBe(true);
    expect(parsed.hash).toBe('SHA256');
    expect(parsed.signature).toContain('-----BEGIN PGP SIGNATURE-----');
    expect(parsed.signature).toContain('-----END PGP SIGNATURE-----');
    expect(parsed.body).toBe(['# Title', '', '- item 1', '-From: literal', 'normal line', ''].join('\n'));

    expect(normalizePgpClearsignedMarkdown(input)).toBe(
      ['# Title', '', '- item 1', '-From: literal', 'normal line', ''].join('\n'),
    );
  });

  it('does not modify malformed clearsigned blocks (missing signature)', () => {
    const input = [
      '-----BEGIN PGP SIGNED MESSAGE-----',
      'Hash: SHA256',
      '',
      '# Title',
      '',
      '- - item',
      '',
    ].join('\n');

    expect(parsePgpClearsignedMessage(input).isClearsigned).toBe(false);
    expect(normalizePgpClearsignedMarkdown(input)).toBe(input);
  });
});

import crypto from 'crypto';

export function computeWeakEtag(payload: string | Buffer): string {
  const hash = crypto.createHash('sha1').update(payload).digest('base64url');
  return `W/"${hash}"`;
}

export function isEtagFresh(ifNoneMatch: string | null, etag: string): boolean {
  return ifNoneMatch === etag;
}

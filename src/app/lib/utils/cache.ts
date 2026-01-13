import type { AuthCredentialSummary } from '../auth/credentialSummary'

// 简单字符串哈希用于本地存储key隔离（避免泄露原始凭证）
export function hash(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return `h${(h >>> 0).toString(16)}`;
}

// 按用户隔离的本地缓存 ownerKey 计算
export function getOwnerKey(cred: AuthCredentialSummary | null): string | null {
  if (!cred) return null;
  switch (cred.type) {
    case 'session':
      return `session:${hash(cred.tokenMasked)}`;
    case 'api':
      return `api:${hash(`${cred.api_user_id}:${cred.api_token_masked || ''}`)}`;
    case 'platform':
      return `platform:${hash(`${cred.platform}:${cred.platform_id}`)}`;
    default:
      return null;
  }
}

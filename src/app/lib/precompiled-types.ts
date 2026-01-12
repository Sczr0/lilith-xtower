/**
 * 预编译内容的通用类型定义。
 * 注意：该文件不应引入 Node.js 专属模块（fs/path），以便可被 Client Component 安全引用。
 */

export interface PrecompiledSignatureInfo {
  format: 'openpgp-clearsign';
  status: 'signed' | 'unsigned';
  verified: boolean | null;
  hash?: string;
  signature?: string;
}


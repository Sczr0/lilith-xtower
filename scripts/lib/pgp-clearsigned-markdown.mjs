/**
 * 将 OpenPGP cleartext signature（例如 `gpg --clearsign`）包裹的 Markdown 还原为可渲染的原始 Markdown：
 * - 去除 armor 头/尾与 Hash 等头部字段
 * - 反向处理 dash-escaping（将以 `- -` 开头的行还原为 `-` 开头）
 *
 * 注意：仅用于“展示/预编译”，不做签名校验。
 */

const PGP_BEGIN_SIGNED = '-----BEGIN PGP SIGNED MESSAGE-----';
const PGP_BEGIN_SIGNATURE = '-----BEGIN PGP SIGNATURE-----';
const PGP_END_SIGNATURE = '-----END PGP SIGNATURE-----';

function stripBom(text) {
  return text.replace(/^\uFEFF/, '');
}

function normalizeDashEscapedLine(line) {
  // OpenPGP dash-escaping: "- " prefix + original line. For Markdown lists this becomes "- - ...".
  return line.startsWith('- -') ? line.slice(2) : line;
}

/**
 * 解析 clearsigned 文本，抽取“正文（已还原 dash-escaping）”与“签名块”。
 *
 * @param {string} input
 * @returns {{
 *   isClearsigned: boolean;
 *   headers?: Record<string, string>;
 *   hash?: string;
 *   body?: string;
 *   signature?: string;
 * }}
 */
export function parsePgpClearsignedMessage(input) {
  const raw = stripBom(input);
  const lines = raw.split(/\r?\n/);
  if (lines[0]?.trim() !== PGP_BEGIN_SIGNED) return { isClearsigned: false };

  // 头部字段（例如：Hash: SHA256）直到空行
  const headers = {};
  let i = 1;
  for (; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === '') break;
    const m = line.match(/^([^:]+):\s*(.+)$/);
    if (!m) continue;
    headers[m[1].trim()] = m[2].trim();
  }
  // 要求存在空行作为分隔
  if (i >= lines.length) return { isClearsigned: false };
  i += 1;

  const bodyLines = [];
  for (; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === PGP_BEGIN_SIGNATURE) break;
    bodyLines.push(normalizeDashEscapedLine(line));
  }

  if (i >= lines.length) return { isClearsigned: false };

  const signatureLines = [];
  let sawEnd = false;
  for (; i < lines.length; i += 1) {
    const line = lines[i];
    signatureLines.push(line);
    if (line.trim() === PGP_END_SIGNATURE) {
      sawEnd = true;
      break;
    }
  }
  if (!sawEnd) return { isClearsigned: false };

  return {
    isClearsigned: true,
    headers,
    hash: headers.Hash,
    body: bodyLines.join('\n'),
    signature: signatureLines.join('\n'),
  };
}

/**
 * @param {string} input
 * @returns {string}
 */
export function normalizePgpClearsignedMarkdown(input) {
  const parsed = parsePgpClearsignedMessage(input);
  if (!parsed.isClearsigned || typeof parsed.body !== 'string') return input;
  return parsed.body;
}

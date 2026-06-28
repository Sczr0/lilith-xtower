/**
 * 协议"当前应同意版本"常量。
 *
 * 说明：
 * - 当协议有实质性变更（需要用户重新显式同意）时，手动 bump 这里。
 * - agreement 与 privacy 是分别更新的两份协议，故各维护一个版本号。
 * - 版本号建议直接用协议正文里的"最后更新日期"（YYYY-MM-DD），便于和公示文案对齐。
 * - 仅修改排版/错别字等不改变权利义务的编辑，不应 bump 版本。
 */
export const REQUIRED_AGREEMENT_VERSION = '2026-04-29';
export const REQUIRED_PRIVACY_VERSION = '2026-05-13';

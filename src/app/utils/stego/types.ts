/**
 * 隐写水印类型定义
 * 
 * 设计目标：挡住 90% 的作弊小子，而非军事级防伪
 * - LSB 扩频隐写：人眼不可见，截图/crop 后仍可部分恢复
 * - PNG 元数据块：作为双重保险的明文签名载体
 * - 所有常量通过 build-time 混淆变换
 */

export interface WatermarkPayload {
  /** 4 字节魔数，用于快速判断是否存在水印 */
  magic: number
  /** 版本号 */
  version: number
  /** HMAC-SHA256 的前 32 字节（原始 hex 转 binary） */
  sigHash: Uint8Array
  /** Unix 时间戳，签发时间 */
  timestamp: number
  /** 用户 ID 前缀，不足 8 字节右补零 */
  userId: Uint8Array
  /** SVG 内容哈希前 8 字节 */
  contentHash: Uint8Array
}

export interface WatermarkEncodeOptions {
  /** 扩频重复次数（默认 3），越高越抗裁剪但容量需求越大 */
  spreadFactor?: number
  /** LSB 修改的通道偏移（0=R, 1=G, 2=B），默认 B 通道对视觉影响最小 */
  channelOffset?: number
  /** 起始像素偏移（跳过边缘像素，避免被裁掉） */
  marginPixels?: number
}

export interface WatermarkExtractResult {
  found: boolean
  payload: WatermarkPayload | null
  /** 纠错恢复的 bit 数 */
  correctedBits: number
  /** 总 bit 数 */
  totalBits: number
}

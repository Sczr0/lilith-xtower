/**
 * server-only 模块的 vitest 桩。
 *
 * Next.js 的 `server-only` 包由 next 内部（compiled/server-only）提供，
 * 在 vitest（非 react-server 条件导出）环境下会抛错。这里提供一个空桩，
 * 使测试可以导入标记为服务端专用的模块。
 */
export {};

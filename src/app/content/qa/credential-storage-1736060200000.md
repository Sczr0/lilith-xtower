---
id: qa-1736060200000
question: 登录凭证会保存多久？
category: security
priority: 3
enabled: true
createdAt: '2025-01-05T12:02:00.000Z'
---

登录态通过服务端加密的 HttpOnly 会话 Cookie 维护（浏览器脚本无法直接读取原始凭证）。除非您主动退出登录或清除站点 Cookie/数据，否则登录状态会保持。

我们不会在浏览器 localStorage 中持久化保存 SessionToken/API Token 等原始凭证；页面可能会使用本地缓存保存非敏感设置与查询偏好。

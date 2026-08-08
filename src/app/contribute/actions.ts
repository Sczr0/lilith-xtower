'use server';

import { headers } from 'next/headers'

import { getAuthSession } from '@/app/lib/auth/session'

/**
 * 处理通用反馈表单提交，并转发到飞书 Webhook。
 */
export async function submitFeedback(formData: FormData) {
  // 反机器人：蜜罐字段（正常用户看不到；命中时静默丢弃，避免给刷子反馈信号）
  const honeypot = formData.get('website')?.toString() ?? ''
  if (honeypot.trim()) {
    return { success: true, message: '投喂成功！鸽子已收到啾~' }
  }

  // 鉴权：必须已登录（P0-3：避免匿名刷爆 webhook）
  const session = await getAuthSession()
  if (!session.credential) {
    return { success: false, message: '请先登录后再提交' }
  }

  // 频控：基于 IP 的滑动窗口限流（单实例有效；多实例部署需替换为 Redis/KV）
  const ip = await resolveClientIp()
  if (!allowSubmit(ip)) {
    return { success: false, message: '请求过于频繁，请稍后再试' }
  }

  // 获取字段
  const category = formData.get('category')?.toString() || 'tip';
  // 兼容旧的 'tip' 字段，如果 'content' 不存在则尝试取 'tip'
  const content = (formData.get('content')?.toString() || formData.get('tip')?.toString() || '').trim();
  const authorRaw = formData.get('author')?.toString() ?? '';
  const author = authorRaw.trim() ? authorRaw.trim().slice(0, 30) : '匿名用户';
  const contactRaw = formData.get('contact')?.toString() ?? '';
  const contact = contactRaw.trim() ? contactRaw.trim().slice(0, 50) : '无';
  // 问题报告自动携带的诊断信息（由前端采集，纯文本，无敏感信息）
  const diagnostics = (formData.get('diagnostics')?.toString() ?? '').trim().slice(0, 2000);

  // 基础校验：不能为空且长度限制
  if (content.length === 0) {
    return { success: false, message: '内容不能为空' };
  }
  
  // 长度限制：Tips 限制 100，其他反馈放宽到 500
  const limit = category === 'tip' ? 100 : 500;
  if (content.length > limit) {
    return { success: false, message: `内容过长（限${limit}字）` };
  }

  // 规则：除 Tip 投稿外，其余分类必须提供联系方式
  const requiresContact = category === 'bug' || category === 'feature' || category === 'other';
  if (requiresContact && contactRaw.trim().length === 0) {
    return {
      success: false,
      message: '该分类需填写联系方式；也可加入QQ群：https://qm.qq.com/q/YQMW1eiz8m',
    };
  }

  const webhookUrl = process.env.FEISHU_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error('未配置飞书 Webhook');
    return { success: false, message: '服务器配置错误，请联系站长' };
  }

  // 标题映射
  const titles: Record<string, string> = {
    tip: '新 Tip 投稿',
    bug: 'Bug 反馈',
    feature: '功能建议',
    other: '其他反馈'
  };
  const title = titles[category] || '新反馈';

  // 组装飞书消息体（诊断信息非空时附在末尾，便于直接定位）
  const feishuBody = {
    msg_type: 'text',
    content: {
      text: `🕘【${title}】\n\n内容：${content}\n提交人：${author}\n联系方式：${contact}${diagnostics ? `\n\n诊断信息：\n${diagnostics}` : ''}\n来源：你的 Phigros 站点`,
    },
  };

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(feishuBody),
      cache: 'no-store',
    });

    const data = await res.json();

    // 飞书接口成功会返回 code: 0
    if (data.code !== 0) {
      // 最小化日志：避免记录用户输入内容/敏感信息
      console.error('飞书报错:', { code: data.code, msg: data.msg });
      return { success: false, message: `发送失败：${data.msg}` };
    }

    return { success: true, message: '提交成功！感谢你的反馈~' };
  } catch (e) {
    console.error('Submission error:', e);
    return { success: false, message: '网络炸了，稍后再试？' };
  }
}

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 3

type RateBucket = { timestamps: number[] }
const rateLimiter = new Map<string, RateBucket>()

function allowSubmit(key: string): boolean {
  const now = Date.now()
  const bucket = rateLimiter.get(key) ?? { timestamps: [] }
  const next = bucket.timestamps.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS)
  if (next.length >= RATE_LIMIT_MAX) {
    rateLimiter.set(key, { timestamps: next })
    return false
  }
  next.push(now)
  rateLimiter.set(key, { timestamps: next })
  return true
}

async function resolveClientIp(): Promise<string> {
  // Next.js 16 headers() 可能为异步；统一 await，避免类型不兼容
  const h = await headers()
  const cf = h.get('cf-connecting-ip')?.trim()
  if (cf) return cf
  const real = h.get('x-real-ip')?.trim()
  if (real) return real
  const forwarded = h.get('x-forwarded-for')?.split(',')[0]?.trim()
  if (forwarded) return forwarded
  return 'unknown'
}

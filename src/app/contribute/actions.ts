'use server';

/**
 * 处理 Tips 投稿表单提交，并转发到飞书 Webhook。
 */
export async function submitTip(formData: FormData) {
  const tip = formData.get('tip')?.toString();
  const authorRaw = formData.get('author')?.toString() ?? '';
  const author = authorRaw.trim() ? authorRaw.trim().slice(0, 30) : '匿名投稿';

  // 基础校验：不能为空且长度限制
  if (!tip || tip.trim().length === 0) {
    return { success: false, message: '不能发空鸽子呀！' };
  }
  if (tip.length > 100) {
    return { success: false, message: '太长啦，鸽子啃不动（限100字）' };
  }

  const webhookUrl = process.env.FEISHU_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error('未配置飞书 Webhook');
    return { success: false, message: '服务器配置错误，请联系站长' };
  }

  // 组装飞书消息体（保持含“投稿”关键词）
  const feishuBody = {
    msg_type: 'text',
    content: {
      text: `🕘【新 Tip 投稿】\n\n内容：${tip}\n投稿人：${author}\n来源：你的 Phigros 站点`,
    },
  };

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(feishuBody),
    });

    const data = await res.json();

    // 飞书接口成功会返回 code: 0
    if (data.code !== 0) {
      console.error('飞书报错:', data);
      return { success: false, message: `发送失败：${data.msg}` };
    }

    return { success: true, message: '投喂成功！鸽子已收到啾~' };
  } catch (e) {
    console.error('Submission error:', e);
    return { success: false, message: '网络炸了，稍后再试？' };
  }
}

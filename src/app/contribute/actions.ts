'use server'

export async function submitTip(formData: FormData) {
  const tip = formData.get('tip')?.toString();

  // 1. 简单的校验
  if (!tip || tip.trim().length === 0) {
    return { success: false, message: '不能发空鸽子哦！' };
  }
  if (tip.length > 100) {
    return { success: false, message: '太长啦，鸽子叼不动 (限100字)' };
  }

  const webhookUrl = process.env.FEISHU_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error('未配置飞书 Webhook');
    return { success: false, message: '服务器配置错误，请联系站长' };
  }

  // 2. 组装飞书消息体
  // 注意：文本中必须包含你在飞书后台设置的“自定义关键词”，比如这里我假设你设置了“投稿”
  const feishuBody = {
    msg_type: "text",
    content: {
      text: `🕊️ [新Tip投稿] \n\n内容：${tip}\n\n来自：你的Phigros网站`
    }
  };

  try {
    // 3. 发送请求
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(feishuBody),
    });

    const data = await res.json();

    // 飞书接口成功会返回 code: 0
    if (data.code !== 0) {
      console.error('飞书报错:', data);
      return { success: false, message: `发送失败: ${data.msg}` };
    }

    return { success: true, message: '投喂成功！鸽子已收到咕~' };
    
  } catch (e) {
    console.error('Submission error:', e);
    return { success: false, message: '网络炸了，稍后再试' };
  }
}
import { NextRequest, NextResponse } from 'next/server';

type TapTapAuthData = { taptap: Record<string, unknown> };
type LoginRequestBody = {
  authData: TapTapAuthData;
  version?: 'cn' | 'global' | string;
};

/**
 * TapTap 扫码登录 API 端点
 * 接收 TapTap 认证数据，与 LeanCloud 服务集成，返回 sessionToken
 */
export async function POST(request: NextRequest) {
  try {
    const { authData, version } = (await request.json()) as LoginRequestBody;

    // 验证请求数据
    if (!authData || !authData.taptap) {
      return NextResponse.json(
        { success: false, message: '无效的认证数据' },
        { status: 400 },
      );
    }

    // 这里应该实现与 LeanCloud 的集成逻辑（当前为模拟）
    const sessionToken = await integrateWithLeanCloud(authData, version ?? 'cn');

    if (!sessionToken) {
      return NextResponse.json(
        { success: false, message: '登录失败，无法获取 session token' },
        { status: 401 },
      );
    }

    return NextResponse.json({
      success: true,
      sessionToken,
      message: '登录成功',
    });
  } catch (error) {
    console.error('TapTap 登录错误:', error);
    return NextResponse.json(
      { success: false, message: '登录过程中发生错误' },
      { status: 500 },
    );
  }
}

/**
 * 与 LeanCloud 集成的模拟函数
 * 实际项目中需要实现真正的 LeanCloud API 调用
 */
async function integrateWithLeanCloud(authData: TapTapAuthData, version: string): Promise<string | null> {
  try {
    if (!authData?.taptap || typeof authData.taptap !== 'object') {
      return null;
    }

    // 这里应该：
    // 1. 构建 LeanCloud 格式的认证数据
    // 2. 调用 LeanCloud 用户登录 API
    // 3. 获取并返回 sessionToken

    // 模拟实现 - 实际项目中需要调用真正的 LeanCloud API
    return `mock_session_token_${version}_${Date.now()}`;
  } catch (error) {
    console.error('LeanCloud 集成错误:', error);
    return null;
  }
}

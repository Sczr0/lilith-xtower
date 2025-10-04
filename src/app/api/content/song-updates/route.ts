import { NextResponse } from 'next/server';
import { getSongUpdates } from '@/app/lib/content/parser';

/**
 * GET /api/content/song-updates
 * 获取所有启用的新曲速递
 */
export async function GET() {
  try {
    const updates = getSongUpdates();
    return NextResponse.json(updates);
  } catch (error) {
    console.error('获取新曲速递失败:', error);
    return NextResponse.json(
      { error: '获取新曲速递失败' },
      { status: 500 }
    );
  }
}

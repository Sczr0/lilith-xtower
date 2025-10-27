import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'src', 'app', 'agreement', 'agreement.md');
    const content = fs.readFileSync(filePath, 'utf8');

    return new NextResponse(content, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=3600', // 缓存1小时
      },
    });
  } catch (error) {
    console.error('Failed to read agreement file:', error);
    return new NextResponse('协议文件加载失败', { status: 500 });
  }
}
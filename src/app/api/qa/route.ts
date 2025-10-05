import { NextResponse } from 'next/server';
import { getAllQA } from '@/app/lib/qa';

export async function GET() {
  try {
    const qaData = getAllQA();
    return NextResponse.json(qaData);
  } catch (error) {
    console.error('Error fetching QA data:', error);
    return NextResponse.json([], { status: 500 });
  }
}

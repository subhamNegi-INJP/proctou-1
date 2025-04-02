import { NextResponse } from 'next/server';
import { cleanupUnusedFiles } from '@/lib/file-cleanup';

// This endpoint should be called by a cron job service (e.g., Vercel Cron)
export async function GET(request: Request) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const filesDeleted = await cleanupUnusedFiles();

    return NextResponse.json({
      message: `Successfully cleaned up ${filesDeleted} unused files`,
      filesDeleted
    });
  } catch (error) {
    console.error('Error in cleanup cron job:', error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Error running cleanup' },
      { status: 500 }
    );
  }
} 
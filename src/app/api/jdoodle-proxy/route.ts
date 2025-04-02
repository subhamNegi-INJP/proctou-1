import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const submission = await request.json();
    // Forward the submission to JDoodle API
    const jdoodleResponse = await fetch('https://api.jdoodle.com/v1/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(submission)
    });
    const data = await jdoodleResponse.json();
    return NextResponse.json(data, {
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  } catch (error) {
    console.error('JDoodle proxy error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
}

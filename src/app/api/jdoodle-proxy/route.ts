import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const submission = await request.json();
    
    // Improved language detection and handling
    const code = submission.script || '';
    const firstLine = code.trim().split('\n')[0] || '';
    
    // Save the original language for logging
    const originalLanguage = submission.language;
    
    // Detect Python from comments
    if (firstLine.startsWith('#')) {
      // Python - ensure we use python3
      if (submission.language === 'python' || submission.language.includes('python')) {
        submission.language = 'python3';
        console.log(`Language adjusted from ${originalLanguage} to python3 based on # comment`);
      }
    } else if (firstLine.startsWith('//')) {
      // C-style language comments
      if (firstLine.toLowerCase().includes('java') && 
          !firstLine.toLowerCase().includes('javascript') && 
          submission.language !== 'java') {
        submission.language = 'java';
        console.log(`Language adjusted to java based on comment: ${firstLine}`);
      } else if ((firstLine.toLowerCase().includes('c++') || 
                 firstLine.toLowerCase().includes('cpp')) && 
                 submission.language !== 'cpp') {
        submission.language = 'cpp';
        console.log(`Language adjusted to cpp based on comment: ${firstLine}`);
      }
    }
    
    // Handle multiple inputs by ensuring they're properly formatted with newlines
    if (submission.stdin && submission.stdin.includes(',')) {
      const originalInput = submission.stdin;
      submission.stdin = submission.stdin.split(',').map(i => i.trim()).join('\n');
      console.log(`Reformatted input from "${originalInput}" to "${submission.stdin}"`);
    }
    
    console.log(`Executing code with JDoodle:`, {
      language: submission.language,
      originalLanguage,
      hasInput: !!submission.stdin,
      inputLength: submission.stdin?.length || 0,
      firstLineOfCode: firstLine
    });

    // Forward the submission to JDoodle API
    const jdoodleResponse = await fetch('https://api.jdoodle.com/v1/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(submission)
    });
    
    if (!jdoodleResponse.ok) {
      console.error(`JDoodle API error: ${jdoodleResponse.status} ${jdoodleResponse.statusText}`);
      const errorText = await jdoodleResponse.text();
      return NextResponse.json(
        { error: `API Error: ${jdoodleResponse.status} ${jdoodleResponse.statusText}`, details: errorText },
        { status: jdoodleResponse.status, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }
    
    const data = await jdoodleResponse.json();
    
    console.log('JDoodle response:', {
      statusCode: data.statusCode,
      memory: data.memory,
      cpuTime: data.cpuTime,
      output: data.output,
      outputLength: data.output?.length || 0
    });
    
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

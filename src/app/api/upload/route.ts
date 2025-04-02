import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { rateLimit } from '@/lib/rate-limit';

const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500
});

const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain'
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: Request) {
  try {
    // Rate limiting
    try {
      await limiter.check(request, 10, 'UPLOAD'); // 10 requests per minute
    } catch {
      return NextResponse.json(
        { message: 'Too many uploads. Please try again later.' },
        { status: 429 }
      );
    }

    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const examId = formData.get('examId') as string;

    if (!file) {
      return NextResponse.json(
        { message: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return NextResponse.json(
        { message: 'Invalid file type. Only PDF, Word documents, and text files are allowed.' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { message: 'File size exceeds 10MB limit' },
        { status: 400 }
      );
    }

    // If examId is provided, verify exam ownership
    if (examId) {
      const exam = await prisma.exam.findUnique({
        where: { id: examId }
      });

      if (!exam) {
        return NextResponse.json(
          { message: 'Exam not found' },
          { status: 404 }
        );
      }

      if (exam.userId !== session.user.id) {
        return NextResponse.json(
          { message: 'Forbidden' },
          { status: 403 }
        );
      }
    }

    // Generate unique filename
    const ext = file.name.split('.').pop();
    const filename = `${uuidv4()}.${ext}`;
    const path = `uploads/${filename}`;
    const fullPath = join(process.cwd(), 'public', path);

    // Convert File to Buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Save file to disk
    await writeFile(fullPath, buffer);

    // Save file record to database
    const fileRecord = await prisma.file.create({
      data: {
        filename: file.name,
        path,
        type: file.type,
        size: file.size,
        examId
      }
    });

    return NextResponse.json(fileRecord);
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Error uploading file' },
      { status: 500 }
    );
  }
} 
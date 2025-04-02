import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ExamType, QuestionType, ExamStatus, Prisma, Role } from '@prisma/client';
import { z } from 'zod';

const questionSchema = z.object({
  type: z.nativeEnum(QuestionType),
  question: z.string().min(1, 'Question is required'),
  options: z.array(z.string()).optional(),
  correctAnswer: z.string().optional(),
  marks: z.number().min(1, 'Marks must be at least 1'),
  content: z.string().optional(),
  answer: z.string().optional(),
});

const examSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  type: z.nativeEnum(ExamType),
  duration: z.number().min(1, 'Duration must be at least 1 minute'),
  totalMarks: z.number().min(1, 'Total marks must be at least 1'),
  startDate: z.string().refine((date) => {
    const parsed = new Date(date);
    return !isNaN(parsed.getTime());
  }, 'Invalid date format'),
  endDate: z.string().refine((date) => {
    const parsed = new Date(date);
    return !isNaN(parsed.getTime());
  }, 'Invalid date format'),
  questions: z.array(questionSchema).min(1, 'At least one question is required'),
}).refine((data) => {
  const startDate = new Date(data.startDate);
  const endDate = new Date(data.endDate);
  return endDate > startDate;
}, {
  message: "End date must be after start date",
  path: ["endDate"],
});

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  search: z.string().optional(),
  type: z.nativeEnum(ExamType).optional(),
  status: z.nativeEnum(ExamStatus).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  orderBy: z.enum(['createdAt', 'updatedAt', 'title']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

// Function to generate a unique exam code
function generateExamCode(): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return code;
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const data = await request.json();
    
    // Validate input
    const validatedData = examSchema.parse(data);
    
    // Calculate total marks from questions
    const totalQuestionMarks = validatedData.questions.reduce((sum, q) => sum + q.marks, 0);
    
    // Check if total marks match
    if (totalQuestionMarks !== validatedData.totalMarks) {
      return NextResponse.json(
        { message: `Total marks (${validatedData.totalMarks}) does not match the sum of question marks (${totalQuestionMarks})` },
        { status: 400 }
      );
    }
    
    // Generate a unique exam code
    let examCode = generateExamCode();
    let isUnique = false;
    
    // Ensure the exam code is unique
    while (!isUnique) {
      const existingExam = await prisma.exam.findUnique({
        where: { examCode }
      });
      
      if (!existingExam) {
        isUnique = true;
      } else {
        examCode = generateExamCode();
      }
    }

    // Create exam with questions in a transaction
    const exam = await prisma.$transaction(async (tx) => {
      return tx.exam.create({
        data: {
          examCode,
          title: validatedData.title,
          description: validatedData.description,
          type: validatedData.type,
          duration: validatedData.duration,
          totalMarks: validatedData.totalMarks,
          startDate: new Date(validatedData.startDate),
          endDate: new Date(validatedData.endDate),
          status: ExamStatus.DRAFT,
          createdBy: {
            connect: {
              id: session.user.id
            }
          },
          questions: {
            create: validatedData.questions.map(q => ({
              type: q.type,
              question: q.question,
              options: q.options || [],
              correctAnswer: q.correctAnswer || '',
              marks: q.marks,
              content: q.content || '',
              answer: q.answer || '',
            })),
          },
        },
        include: {
          questions: true,
        },
      });
    });

    return NextResponse.json(exam);
  } catch (error) {
    console.error('Error creating exam:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: 'Validation error', errors: error.errors },
        { status: 400 }
      );
    }
    
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json(
        { message: 'Database error', error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Error creating exam' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = querySchema.parse(Object.fromEntries(searchParams));
    const { page, limit, search, type, status, startDate, endDate, orderBy, order } = query;

    const where: Prisma.ExamWhereInput = {
      ...(search ? {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ]
      } : {}),
      ...(type && { type }),
      ...(status && { status }),
      ...(startDate && { startDate: { gte: startDate } }),
      ...(endDate && { endDate: { lte: endDate } }),
      ...(session.user.role === Role.STUDENT && {
        OR: [
          { status: ExamStatus.PUBLISHED },
          { status: ExamStatus.COMPLETED },
        ]
      }),
    };

    const [total, exams] = await Promise.all([
      prisma.exam.count({ where }),
      prisma.exam.findMany({
        where,
        include: {
          questions: {
            select: {
              id: true,
              question: true,
              type: true,
              marks: true,
              options: true,
            } as Prisma.QuestionSelect
          },
          attempts: {
            where: {
              userId: session.user.id
            },
            select: {
              id: true,
              status: true,
              score: true,
              endedAt: true,
            }
          },
          _count: {
            select: {
              attempts: true,
              questions: true,
            }
          }
        },
        orderBy: { [orderBy]: order },
        skip: (page - 1) * limit,
        take: limit,
      })
    ]);

    const hasMore = total > page * limit;
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      exams,
      pagination: {
        total,
        totalPages,
        currentPage: page,
        limit,
        hasMore,
      }
    });
  } catch (error) {
    console.error('Error fetching exams:', error);
    return NextResponse.json({ error: "Failed to fetch exams" }, { status: 500 });
  }
}
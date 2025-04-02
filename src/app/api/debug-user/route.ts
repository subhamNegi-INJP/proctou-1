import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

/**
 * GET - Debug endpoint to check current user session and database access
 */
export async function GET() {
  try {
    console.log('[API] GET /api/debug-user - Checking user session');
    
    // Get the current session
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      console.log('[API] GET /api/debug-user - No authenticated user');
      return NextResponse.json({
        authenticated: false,
        session: null,
        message: 'No user is logged in'
      });
    }
    
    console.log(`[API] GET /api/debug-user - Session found for: ${session.user.email}`);
    
    // Try to get the user from the database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        name: true,
        email: true,
        role: true
      }
    });
    
    if (!user) {
      console.log('[API] GET /api/debug-user - User not found in database');
      return NextResponse.json({
        authenticated: true,
        session: {
          email: session.user.email,
          name: session.user.name
        },
        databaseUser: null,
        message: 'User is authenticated but not found in database'
      });
    }
    
    console.log(`[API] GET /api/debug-user - User found in database: ID ${user.id}, Role: ${user.role}`);
    
    return NextResponse.json({
      authenticated: true,
      session: {
        email: session.user.email,
        name: session.user.name
      },
      databaseUser: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      message: 'User is authenticated and found in database'
    });
  } catch (error) {
    console.error('[API] GET /api/debug-user - Error:', error);
    return NextResponse.json(
      { 
        authenticated: false,
        message: 'Error checking user',
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 
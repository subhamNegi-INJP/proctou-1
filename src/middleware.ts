import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { rateLimit } from './lib/rate-limit';

// Create a new ratelimiter, that allows 10 requests per minute
const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500,
});

// Configure CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.NEXTAUTH_URL || 'http://localhost:3000',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400', // 24 hours
};

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Handle CORS preflight requests
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // Apply rate limiting to API routes
  if (pathname.startsWith('/api/')) {
    try {
      await limiter.check(request, 10000, 'GLOBAL_API'); // 100 requests per minute per token
    } catch {
      return new NextResponse(
        JSON.stringify({ message: 'Too Many Requests' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }
  }

  // Apply stricter rate limiting to file upload endpoint
  if (pathname.startsWith('/api/upload')) {
    try {
      await limiter.check(request, 10, 'UPLOAD'); // 10 uploads per minute per token
    } catch {
      return new NextResponse(
        JSON.stringify({ message: 'Too Many Uploads' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }
  }

  const response = NextResponse.next();

  // Add CORS headers to all API responses
  if (pathname.startsWith('/api/')) {
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
  }

  return response;
}

export const config = {
  matcher: [
    '/api/:path*',
  ],
}; 
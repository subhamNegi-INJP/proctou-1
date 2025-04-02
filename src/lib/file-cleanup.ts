import { prisma } from './prisma';
import { unlink } from 'fs/promises';
import { join } from 'path';

export async function cleanupUnusedFiles() {
  try {
    // Get all files that are not associated with any exam
    const unusedFiles = await prisma.file.findMany({
      where: {
        examId: null,
        createdAt: {
          // Files older than 24 hours
          lt: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      }
    });

    // Delete each file from disk and database
    for (const file of unusedFiles) {
      try {
        // Delete file from disk
        await unlink(join(process.cwd(), 'public', file.path));
        
        // Delete file record from database
        await prisma.file.delete({
          where: { id: file.id }
        });

        console.log(`Cleaned up unused file: ${file.filename}`);
      } catch (error) {
        console.error(`Failed to cleanup file ${file.filename}:`, error);
      }
    }

    return unusedFiles.length;
  } catch (error) {
    console.error('Error cleaning up unused files:', error);
    throw error;
  }
}

export async function cleanupExamFiles(examId: string) {
  try {
    // Get all files associated with the exam
    const files = await prisma.file.findMany({
      where: { examId }
    });

    // Delete each file from disk and database
    for (const file of files) {
      try {
        // Delete file from disk
        await unlink(join(process.cwd(), 'public', file.path));
        
        // Delete file record from database
        await prisma.file.delete({
          where: { id: file.id }
        });

        console.log(`Cleaned up exam file: ${file.filename}`);
      } catch (error) {
        console.error(`Failed to cleanup exam file ${file.filename}:`, error);
      }
    }

    return files.length;
  } catch (error) {
    console.error(`Error cleaning up exam files for exam ${examId}:`, error);
    throw error;
  }
} 
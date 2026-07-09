import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join, extname } from 'path';
import { randomBytes } from 'crypto';

const UPLOAD_DIR = join(process.cwd(), 'public', 'uploads', 'onboarding');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.doc', '.docx', '.txt', '.svg',
]);

const MIME_TYPE_MAP: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'text/plain': '.txt',
  'image/svg+xml': '.svg',
};

function validateFileType(filename: string, contentType: string): string | null {
  const ext = extname(filename).toLowerCase();
  const mappedExt = MIME_TYPE_MAP[contentType];

  // Check extension against allowed list
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return `File type "${ext}" is not allowed. Allowed types: ${Array.from(ALLOWED_EXTENSIONS).join(', ')}`;
  }

  // If we can map the MIME type, verify it matches the extension
  if (mappedExt && ext !== mappedExt) {
    return `File extension "${ext}" does not match the declared content type.`;
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided. Use the "file" field.' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds the 10MB limit (${(file.size / 1024 / 1024).toFixed(2)}MB).` },
        { status: 400 }
      );
    }

    // Validate file type
    const typeError = validateFileType(file.name, file.type);
    if (typeError) {
      return NextResponse.json({ error: typeError }, { status: 400 });
    }

    // Ensure upload directory exists
    await mkdir(UPLOAD_DIR, { recursive: true });

    // Generate unique filename: timestamp + random hex + original extension
    const ext = extname(file.name).toLowerCase();
    const timestamp = Date.now();
    const hex = randomBytes(8).toString('hex');
    const uniqueFilename = `${timestamp}-${hex}${ext}`;

    // Read file buffer and write to disk
    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = join(UPLOAD_DIR, uniqueFilename);
    await writeFile(filePath, buffer);

    // Build the public URL path
    const url = `/uploads/onboarding/${uniqueFilename}`;

    return NextResponse.json({
      url,
      filename: uniqueFilename,
      originalName: file.name,
      size: file.size,
      type: file.type,
    });
  } catch (error) {
    console.error('File upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error during file upload.' },
      { status: 500 }
    );
  }
}
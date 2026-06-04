import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { AppError } from '../types/api.js';

export interface IStorageProvider {
  uploadFile(file: Express.Multer.File): Promise<string>; // Returns relative filepath
  deleteFile(filepath: string): Promise<void>;
}

export const ALLOWED_EXTENSIONS = [
  'png', 'jpg', 'jpeg', 'gif', 'webp',
  'pdf',
  'doc', 'docx',
  'xls', 'xlsx',
  'ppt', 'pptx',
  'txt', 'md',
  'zip', 'rar', '7z',
  'mp4', 'mov'
];

export class LocalStorageProvider implements IStorageProvider {
  private uploadDir: string;

  constructor() {
    this.uploadDir = process.env.UPLOAD_DIR || 'uploads';
    this.initializeDirectory();
  }

  private initializeDirectory() {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  public async uploadFile(file: Express.Multer.File): Promise<string> {
    // 1. Double extension and malicious script verification
    const originalName = file.originalname;
    
    // Split on dot to check all segments
    const parts = originalName.split('.');
    if (parts.length > 2) {
      // Check if any intermediate extensions are executable scripts
      const forbiddenScripts = ['exe', 'sh', 'bat', 'cmd', 'js', 'vbs', 'scr', 'pif', 'com'];
      const hasForbiddenIntermediate = parts.slice(1, -1).some(p => forbiddenScripts.includes(p.toLowerCase()));
      if (hasForbiddenIntermediate) {
        throw new AppError('SECURITY_VIOLATION', 'Double extension exploit detected. Upload blocked.', 400);
      }
    }

    const extension = parts.pop()?.toLowerCase();
    if (!extension || !ALLOWED_EXTENSIONS.includes(extension)) {
      throw new AppError('VALIDATION_ERROR', `File extension .${extension} is not allowed.`, 400);
    }

    // 2. Generate randomized UUID file name
    const randomName = `${crypto.randomUUID()}.${extension}`;
    const destinationPath = path.join(this.uploadDir, randomName);

    // 3. Save buffer to disk
    await fs.promises.writeFile(destinationPath, file.buffer);

    // Return the relative filepath
    return path.join(this.uploadDir, randomName);
  }

  public async deleteFile(filepath: string): Promise<void> {
    if (fs.existsSync(filepath)) {
      await fs.promises.unlink(filepath);
    }
  }
}

export const storageProvider = new LocalStorageProvider();
export const uploadLimitBytes = 25 * 1024 * 1024; // 25MB

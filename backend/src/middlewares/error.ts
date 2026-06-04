import { Request, Response, NextFunction } from 'express';
import { AppError } from '../types/api.js';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Structured logging can print details here
  console.error('[Error Handler Log]:', err);

  let statusCode = 500;
  let code = 'INTERNAL_SERVER_ERROR';
  let message = 'An unexpected error occurred on the server.';
  let details: any = undefined;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err.name === 'ValidationError') {
    // Handling generic validation library errors if needed
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = err.message;
    details = err.errors || err.details;
  } else if (err.code === 'P2002') {
    // Prisma unique constraint violation
    statusCode = 409;
    code = 'DUPLICATE_RESOURCE';
    message = 'A resource with this identifier already exists.';
    details = { fields: err.meta?.target };
  } else if (err.code === 'P2025') {
    // Prisma record not found
    statusCode = 404;
    code = 'RESOURCE_NOT_FOUND';
    message = 'The requested resource was not found.';
  }

  res.status(statusCode).json({
    error: {
      code,
      message,
      details,
      statusCode,
    },
  });
}

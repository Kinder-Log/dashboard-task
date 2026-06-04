export interface ApiError {
  code: string;
  message: string;
  details?: any;
  statusCode: number;
}

export interface ApiResponseMetadata {
  page?: number;
  limit?: number;
  total?: number;
  [key: string]: any;
}

export interface ApiResponse<T> {
  data?: T;
  meta?: ApiResponseMetadata;
  error?: ApiError;
}

export class AppError extends Error {
  public code: string;
  public statusCode: number;
  public details?: any;

  constructor(code: string, message: string, statusCode: number = 400, details?: any) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

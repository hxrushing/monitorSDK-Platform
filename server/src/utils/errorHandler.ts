/**
 * 错误处理工具函数
 */

/**
 * 从未知错误中安全地提取错误消息
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as any).message);
  }
  
  return 'Unknown error occurred';
}

/**
 * 从未知错误中安全地提取错误堆栈
 */
export function getErrorStack(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.stack;
  }
  
  if (error && typeof error === 'object' && 'stack' in error) {
    return String((error as any).stack);
  }
  
  return undefined;
}

/**
 * 创建标准化的错误响应
 */
export function createErrorResponse(error: unknown, defaultMessage = 'Internal Server Error') {
  const message = getErrorMessage(error);
  const stack = getErrorStack(error);
  
  return {
    success: false,
    error: message || defaultMessage,
    ...(process.env.NODE_ENV === 'development' && stack && { stack })
  };
}

/**
 * 安全地记录错误日志
 */
export function logError(prefix: string, error: unknown): void {
  const message = getErrorMessage(error);
  const stack = getErrorStack(error);
  
  console.error(`${prefix}:`, message);
  if (stack) {
    console.error(`${prefix} Stack:`, stack);
  }
}
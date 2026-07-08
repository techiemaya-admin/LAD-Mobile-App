export const getFriendlyError = (err: string | null | undefined): string | null => {
  if (!err) return null;
  
  const lowerErr = err.toLowerCase();
  
  if (lowerErr.includes('http 503') || lowerErr.includes('503 service unavailable')) {
    return 'Service is temporarily unavailable. Please try again later.';
  }
  if (lowerErr.includes('http 500') || lowerErr.includes('500 internal server error')) {
    return 'Internal server error. Please try again later.';
  }
  if (lowerErr.includes('http 401') || lowerErr.includes('http 403')) {
    return 'Authentication failed. Please check your connection and try again.';
  }
  if (lowerErr.includes('http 404')) {
    return 'Resource not found. Please try again.';
  }
  if (lowerErr.includes('network request failed') || lowerErr.includes('network error')) {
    return 'Network connection error. Please check your internet connection.';
  }
  if (err.length > 80) {
    return 'An unexpected error occurred. Please try again.';
  }
  
  return err;
};

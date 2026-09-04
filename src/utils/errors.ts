export const isConnectionUnavailableError = (err: string | null | undefined): boolean => {
  if (!err) return false;

  const lowerErr = err.toLowerCase();

  return (
    lowerErr.includes('http 502') ||
    lowerErr.includes('502 bad gateway') ||
    lowerErr.includes('status 502') ||
    lowerErr.includes('http 504') ||
    lowerErr.includes('504 gateway timeout') ||
    lowerErr.includes('network request failed') ||
    lowerErr.includes('network connection error') ||
    lowerErr.includes('network error') ||
    lowerErr.includes('failed to fetch') ||
    lowerErr.includes('fetch failed') ||
    lowerErr.includes('unable to reach the configured backend') ||
    lowerErr.includes('unable to reach login endpoint') ||
    lowerErr.includes('backend request timed out') ||
    lowerErr.includes('proxy request failed') ||
    lowerErr.includes('realtime connection is unavailable') ||
    lowerErr.includes('unable to load real call logs from the backend') ||
    lowerErr.includes('backend returned 0 live conversations') ||
    lowerErr.includes('no internet') ||
    lowerErr.includes('offline')
  );
};

export const getFriendlyError = (err: string | null | undefined): string | null => {
  if (!err) return null;
  
  const lowerErr = err.toLowerCase();

  if (isConnectionUnavailableError(err)) {
    return 'Network connection error. Please check your internet connection.';
  }
  
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
  if (err.length > 80) {
    return 'An unexpected error occurred. Please try again.';
  }
  
  return err;
};

export const CLIENT_HEADERS = { 'X-Nuclear-Client': 'remote' };

export const JSON_HEADERS = {
  ...CLIENT_HEADERS,
  'Content-Type': 'application/json',
};

export const HTTP_STATUS = {
  badRequest: 400,
  unauthorized: 401,
  tooManyRequests: 429,
} as const;

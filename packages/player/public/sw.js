const CACHE_NAME = 'nuclear-jam-shell-v1';
const APP_SHELL_URL = '/';
const API_PREFIX = '/api/';

const shouldHandle = (request, url) =>
  request.method === 'GET' &&
  url.origin === self.location.origin &&
  !url.pathname.startsWith(API_PREFIX);

const networkFirst = async (request, cacheKey) => {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(cacheKey, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(cacheKey);
    if (cached) {
      return cached;
    }
    throw error;
  }
};

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (!shouldHandle(request, url)) {
    return;
  }
  const cacheKey = request.mode === 'navigate' ? APP_SHELL_URL : request;
  event.respondWith(networkFirst(request, cacheKey));
});

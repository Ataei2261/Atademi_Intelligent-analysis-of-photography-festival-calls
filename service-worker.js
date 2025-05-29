
const CACHE_NAME = 'photo-contest-analyzer-cache-v1';
const urlsToCache = [
  '/index.html',
  // '/index.tsx', // REMOVED: TSX files should not be cached raw by the service worker.
  '/manifest.json',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;700&display=swap',
  'https://i.postimg.cc/rmYvtr2H/Create-a-modern-minimalist-logo-without-any-text-representing-a-multifaceted-photo-analysis-concep.png',
  '/logo192.png',
  '/logo512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        // Filter out CDN URLs that should be fetched directly or are problematic for SW caching.
        return cache.addAll(urlsToCache.filter(url => 
            !url.startsWith('https://esm.sh') && 
            !url.startsWith('https://cdnjs.cloudflare.com') &&
            !url.startsWith('https://unpkg.com/') &&
            !url.startsWith('https://cdn.jsdelivr.net/')
        ));
      })
      .catch(error => {
        console.error('Failed to cache initial assets:', error);
      })
  );
});

self.addEventListener('fetch', event => {
  const requestUrl = event.request.url;
  
  // Bypass service worker entirely for specified CDN requests.
  if (
    requestUrl.startsWith('https://cdnjs.cloudflare.com/') || 
    requestUrl.startsWith('https://unpkg.com/') ||
    requestUrl.startsWith('https://cdn.jsdelivr.net/')
  ) {
    // Let the browser handle the request directly.
    return; 
  }

  // We only want to cache GET requests.
  if (event.request.method !== 'GET') {
    return;
  }

  // Prevent caching of .ts and .tsx files
  if (requestUrl.endsWith('.ts') || requestUrl.endsWith('.tsx')) {
    // Always fetch from network, do not attempt to cache or serve from cache.
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse; // Serve from cache
        }

        // Not in cache, fetch from network
        return fetch(event.request)
          .then(networkResponse => {
            // Check if we received a valid response
            if (!networkResponse || networkResponse.status !== 200 || (networkResponse.type !== 'basic' && networkResponse.type !== 'cors')) {
              return networkResponse;
            }

            // Clone the response to cache it
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                // Only cache if it's not a .ts or .tsx file (double check, though handled above)
                if (!requestUrl.endsWith('.ts') && !requestUrl.endsWith('.tsx')) {
                  cache.put(event.request, responseToCache);
                }
              });
            return networkResponse;
          })
          .catch(error => {
            console.error('Service Worker: Fetch failed.', error);
            // Optionally, return a fallback offline page for navigation requests:
            // if (event.request.mode === 'navigate') {
            //   return caches.match('/offline.html');
            // }
          });
      })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

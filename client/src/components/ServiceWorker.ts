// Service worker for offline functionality

const CACHE_NAME = 'laundromatlocator-cache-v1';
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/src/main.tsx',
  '/src/index.css',
  '/src/App.tsx',
];

// Install service worker
self.addEventListener('install', (event: any) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache opened');
        return cache.addAll(URLS_TO_CACHE);
      })
  );
});

// Activate service worker
self.addEventListener('activate', (event: any) => {
  const cacheWhitelist = [CACHE_NAME];
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            // Delete old caches
            return caches.delete(cacheName);
          }
          return null;
        })
      );
    })
  );
});

// Fetch event
self.addEventListener('fetch', (event: any) => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return the response
        if (response) {
          return response;
        }
        
        // Clone the request because it's a one-time use
        const fetchRequest = event.request.clone();
        
        return fetch(fetchRequest)
          .then(response => {
            // Check if we received a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Clone the response because it's a one-time use
            const responseToCache = response.clone();
            
            caches.open(CACHE_NAME)
              .then(cache => {
                // Don't cache API requests
                if (!event.request.url.includes('/api/')) {
                  cache.put(event.request, responseToCache);
                }
              });
            
            return response;
          })
          .catch(() => {
            // If fetch fails, try to return the offline page
            if (event.request.url.includes('page')) {
              return caches.match('/');
            }
            return null;
          });
      })
  );
});

export {};

const CACHE_VERSION = 2;
const CACHE_NAME = `manantial-v${CACHE_VERSION}`;
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/logo.svg',
    '/manifest.json'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS).catch(err => console.warn('SW static cache warn:', err));
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    // Limpieza de caches antiguos
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const requestUrl = new URL(event.request.url);

    // API requests (/api/precios) -> Network First, fallback to cache
    if (requestUrl.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    const resClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, resClone);
                    });
                    return response;
                })
                .catch(() => {
                    return caches.match(event.request);
                })
        );
        return;
    }

    // Navegación HTML -> Network First
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then((networkResponse) => {
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, networkResponse.clone());
                    });
                    return networkResponse;
                })
                .catch(() => {
                    return caches.match(event.request);
                })
        );
        return;
    }

    // Assets estáticos -> Stale-While-Revalidate
    if (event.request.method === 'GET' && !requestUrl.pathname.includes('hot-update')) {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                const fetchPromise = fetch(event.request).then((networkResponse) => {
                    caches.open(CACHE_NAME).then((cache) => {
                        if (networkResponse.status === 200 && !event.request.url.startsWith('chrome-extension')) {
                            cache.put(event.request, networkResponse.clone());
                        }
                    });
                    return networkResponse;
                }).catch(() => {
                    // Ignoramos errores de red en el background
                });
                return cachedResponse || fetchPromise;
            })
        );
    }
});

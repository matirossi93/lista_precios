const CACHE_NAME = 'manantial-v1';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/logo.svg',
    '/manifest.json'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            // Intenta guardar activos estáticos raíz. Vite en `dev` maneja esto diferente que en `build`,
            // pero el array se asegura de al menos precachear el envoltorio HTML para el Offline.
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

    // Caso especial 1: Respuestas de Google Sheets (Siempre Network First, fallback to cache)
    if (requestUrl.hostname === 'docs.google.com' || requestUrl.hostname === 'sheets.googleapis.com') {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    // Si el fetch sale bien, clonamos la respuesta a la cache para uso offline
                    const resClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, resClone);
                    });
                    return response;
                })
                .catch(() => {
                    // Si throwea error (Ej: offline de red), buscamos en la cache la versión previa!
                    return caches.match(event.request);
                })
        );
        return;
    }

    // Caso general 2: Archivos de la App web estáticos (Stale-While-Revalidate modificado)
    // Vite hace HMR (Hot Module Replacement), así que no cachearemos todo a lo loco en dev
    if (event.request.method === 'GET' && !requestUrl.pathname.includes('hot-update')) {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                const fetchPromise = fetch(event.request).then((networkResponse) => {
                    caches.open(CACHE_NAME).then((cache) => {
                        // Guardamos todo GET normal local si es OK
                        if (networkResponse.status === 200 && !event.request.url.startsWith('chrome-extension')) {
                            cache.put(event.request, networkResponse.clone());
                        }
                    });
                    return networkResponse;
                }).catch(() => {
                    // Fallback final en caso offline
                    return cachedResponse;
                });
                return cachedResponse || fetchPromise;
            })
        );
    }
});

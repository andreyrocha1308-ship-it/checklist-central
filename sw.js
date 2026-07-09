const CACHE_NAME = 'checklist-central-v2';
const ASSETS = [
    './',
    './index.html',
    './admin.html',
    './style.css',
    './app.js',
    './admin.js',
    './manifest.json',
    './icon.png'
];

// Instalação do Service Worker e caching de recursos essenciais
self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
    self.skipWaiting();
});

// Ativação e limpeza de caches antigos
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Intercepção de requisições de rede (Estratégia Network-First com fallback para Cache)
self.addEventListener('fetch', (e) => {
    // Evita interceptar requisições do Firebase Firestore ou chamadas de API externas
    if (e.request.url.startsWith('http') && !e.request.url.includes('firestore.googleapis.com')) {
        e.respondWith(
            fetch(e.request)
                .then((response) => {
                    // Clona a resposta e atualiza o cache
                    if (response.status === 200) {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(e.request, responseClone);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    // Fallback para o cache se offline
                    return caches.match(e.request);
                })
        );
    }
});

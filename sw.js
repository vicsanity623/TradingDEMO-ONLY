const CACHE_NAME = 'goku-rpg-v1.8'; // UPDATED: Version bump forces cache clear
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './strategy.js',
  './manifest.json', // Added manifest to cache
  './IMG_0054.png',
  './IMG_0061.png',
  './IMG_0062.png'
];

// Install Event: Cache files
self.addEventListener('install', (event) => {
  // FORCE UPDATE: Activate new service worker immediately
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Activate Event: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('Clearing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  // FORCE UPDATE: Take control of all open clients immediately
  return self.clients.claim();
});

// Fetch Event: Serve from cache if available, otherwise fetch from network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
const CACHE_NAME = 'goku-rpg-v4.77';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './game.js',
  './hub.js',
  './soul.js',
  './strategy.js',
  './skills.js',
  './gear.js',
  './advance.js',
  './battle.js',
  './battleworld.js',
  './manifest.json',
  './charged_b.png',
  './hb_b.png',
  './charged_s.png',
  './IMG_0061.png',
  './IMG_0081.png',
  './IMG_0206.png',
  './IMG_0287.png',
  './IMG_0299.png',
  './IMG_0300.png',
  './IMG_0292.png',
  './IMG_0222.png'
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

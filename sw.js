const CACHE = 'xposter-v2';

const ASSETS = [
  '/',
  '/index.html',
  '/app.js',
  '/style.css',
  '/manifest.json'
];

// Install
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE)
          .map(key => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

// Cache First Strategy
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return (
        response ||
        fetch(event.request).catch(() => {
          return caches.match('/index.html');
        })
      );
    })
  );
});

// Notification Click
self.addEventListener('notificationclick', event => {
  event.notification.close();

  const post = event.notification.data?.post || '';

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(clientList => {

      const tweetUrl =
        'https://twitter.com/intent/tweet?text=' +
        encodeURIComponent(post);

      if (clientList.length > 0) {
        clientList[0].focus();
        return clientList[0].navigate(tweetUrl);
      }

      return clients.openWindow(tweetUrl);
    })
  );
});

// Alarm Check
self.addEventListener('message', event => {

  if (
    !event.data ||
    event.data.type !== 'CHECK_ALARMS'
  ) {
    return;
  }

  const alarms = event.data.alarms || [];

  const now = new Date();

  const hhmm =
    String(now.getHours()).padStart(2, '0') +
    ':' +
    String(now.getMinutes()).padStart(2, '0');

  alarms.forEach(alarm => {

    if (
      alarm.time === hhmm &&
      alarm.post
    ) {

      self.registration.showNotification(
        '⏰ Time to post on X!',
        {
          body:
            alarm.post.substring(0, 120) +
            (alarm.post.length > 120 ? '...' : ''),

          icon: '/icon-192.png',
          badge: '/icon-192.png',

          tag: `post-${alarm.time}`,

          renotify: true,
          requireInteraction: true,

          data: {
            post: alarm.post
          }
        }
      );
    }

  });

});
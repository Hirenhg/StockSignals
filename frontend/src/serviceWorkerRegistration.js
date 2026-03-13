export function register() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/service-worker.js')
        .then((registration) => {
          console.log('SW registered:', registration);
          
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'activated' && 'sync' in registration) {
                  registration.sync.register('sync-data').catch(err => {
                    console.log('Background sync not supported:', err);
                  });
                }
              });
            }
          });
          
          if (registration.active && 'sync' in registration) {
            registration.sync.register('sync-data').catch(err => {
              console.log('Background sync not supported:', err);
            });
          }
          
          navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'SYNC_DATA') {
              window.dispatchEvent(new CustomEvent('sync-data'));
            }
          });
        })
        .catch((error) => {
          console.log('SW registration failed:', error);
        });
    });
    
    window.addEventListener('online', () => {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then((registration) => {
          if ('sync' in registration) {
            registration.sync.register('sync-data').catch(err => {
              console.log('Background sync not supported:', err);
            });
          }
        });
      }
    });
  }
}

export function unregister() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister();
      })
      .catch((error) => {
        console.error(error.message);
      });
  }
}

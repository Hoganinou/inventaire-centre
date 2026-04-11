// Utilitaires pour la gestion du cache et des mises à jour

// Enregistrer le service worker
export const registerServiceWorker = async (): Promise<void> => {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      
      // Écouter les mises à jour
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                // Nouvelle version disponible - notification désactivée
                // window.dispatchEvent(new CustomEvent('sw-update-available'));
              }
            }
          });
        }
      });
    } catch (error) {
      console.error('❌ Erreur enregistrement Service Worker:', error);
    }
  }
};

// Forcer la mise à jour du service worker
export const updateServiceWorker = async (): Promise<void> => {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        // Forcer la mise à jour
        await registration.update();
        
        // Skip waiting si nouveau worker disponible
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      }
    } catch (error) {
      console.error('❌ Erreur mise à jour Service Worker:', error);
    }
  }
};

// Vider tout le cache
export const clearAllCache = async (): Promise<void> => {
  if ('caches' in window) {
    try {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
      );
      console.log('🗑️ Tous les caches supprimés');
    } catch (error) {
      console.error('❌ Erreur suppression cache:', error);
    }
  }
};

// Vider le localStorage des données de cache
export const clearLocalStorageCache = (): void => {
  try {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('cache_') || 
          key.startsWith('vehicule_') || 
          key.startsWith('firebase_') ||
          key.startsWith('app_version')) {
        localStorage.removeItem(key);
      }
    });
    console.log('🗑️ Cache localStorage supprimé');
  } catch (error) {
    console.error('❌ Erreur suppression localStorage:', error);
  }
};

// Recharge complète avec nettoyage du cache
export const hardReload = async (): Promise<void> => {
  console.log('🔄 Rechargement complet avec nettoyage du cache...');
  
  // Vider tous les caches
  await clearAllCache();
  clearLocalStorageCache();
  
  // Désenregistrer les service workers
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(reg => reg.unregister()));
  }
  
  // Recharger la page avec cache forcé
  window.location.reload();
};

// Vérifier la connectivité réseau
export const checkNetworkStatus = (): boolean => {
  return navigator.onLine;
};

// Écouter les changements de connectivité
export const listenNetworkStatus = (callback: (isOnline: boolean) => void): void => {
  window.addEventListener('online', () => callback(true));
  window.addEventListener('offline', () => callback(false));
};
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Configuration de la langue pour les messages de validation HTML5
document.documentElement.lang = 'fr';

// Les erreurs MIME sont gérées par le nettoyage du service worker

// Dé-enregistrer tout service worker existant pour éviter les problèmes de cache
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(r => r.unregister());
  });
  // Vider tous les caches
  if ('caches' in window) {
    caches.keys().then(names => names.forEach(n => caches.delete(n)));
  }
}

/*  ANCIEN CODE SW DÉSACTIVÉ
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('[SW] Enregistré:', registration);
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[SW] Nouvelle version disponible');
                newWorker.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          }
        });
      })
      .catch(error => {
        console.log('[SW] Échec enregistrement:', error);
      });
    
    // Recharger quand un nouveau service worker prend le contrôle
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[SW] Nouveau contrôleur, rechargement...');
      window.location.reload();
    });
  });
}
*/

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

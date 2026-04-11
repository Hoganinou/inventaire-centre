import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Configuration de la langue pour les messages de validation HTML5
document.documentElement.lang = 'fr';

// Gestion des erreurs de chargement de modules (MIME type)
window.addEventListener('error', (event) => {
  if (event.message?.includes('MIME type') || 
      event.message?.includes('module script') ||
      event.filename?.includes('/assets/')) {
    console.warn('[CACHE ERROR] Erreur de MIME type détectée, rechargement forcé...');
    
    // Vider le cache et recharger
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(registration => {
        if (registration.active) {
          const channel = new MessageChannel();
          channel.port1.onmessage = () => {
            window.location.reload();
          };
          registration.active.postMessage({ type: 'FORCE_UPDATE' }, [channel.port2]);
        }
      });
    } else {
      // Fallback si pas de service worker
      window.location.reload();
    }
  }
});

// Enregistrement du service worker amélioré
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('[SW] Enregistré:', registration);
        
        // Vérifier les mises à jour
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

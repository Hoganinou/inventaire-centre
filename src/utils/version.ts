// Version et cache busting - Généré automatiquement
export const APP_VERSION = "1.0.0";
export const BUILD_DATE = new Date("2026-04-11T10:43:53.963Z");
export const BUILD_NUMBER = "44";
export const GIT_COMMIT = "046aba8";

// Cache busting automatique
export const CACHE_VERSION = `v${APP_VERSION}-${BUILD_NUMBER}`;

// URL avec version pour forcer le rechargement
export const getVersionedUrl = (url: string): string => {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${CACHE_VERSION}&t=${Date.now()}`;
};

// Vérifier si une nouvelle version est disponible
export const checkForUpdates = (): boolean => {
  const storedVersion = localStorage.getItem('app_version');
  const currentVersion = CACHE_VERSION;
  
  if (storedVersion && storedVersion !== currentVersion) {
    return true; // Nouvelle version disponible
  }
  
  localStorage.setItem('app_version', currentVersion);
  return false;
};

// Forcer le rechargement de la page si nouvelle version
export const handleVersionCheck = (): void => {
  if (checkForUpdates()) {
    if (confirm('Une nouvelle version est disponible. Voulez-vous recharger la page ?')) {
      // Vider le cache et recharger
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
          registrations.forEach(registration => registration.unregister());
        });
      }
      
      // Vider le localStorage cache
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('cache_') || key.startsWith('vehicule_') || key.startsWith('firebase_')) {
          localStorage.removeItem(key);
        }
      });
      
      // Recharger avec cache forcé
      window.location.reload();
    }
  }
};

// Information de debug pour les développeurs
export const getVersionInfo = () => ({
  version: APP_VERSION,
  buildDate: BUILD_DATE,
  buildNumber: BUILD_NUMBER,
  gitCommit: GIT_COMMIT,
  cacheVersion: CACHE_VERSION,
  userAgent: navigator.userAgent,
  timestamp: new Date().toISOString()
});

// Log de la version au démarrage
console.log(`🚀 Application version: ${APP_VERSION} (build ${BUILD_NUMBER})`);
console.log(`📅 Build date: ${BUILD_DATE.toLocaleDateString('fr-FR')}`);
console.log(`🔄 Cache version: ${CACHE_VERSION}`);
console.log(`📝 Git commit: ${GIT_COMMIT}`);

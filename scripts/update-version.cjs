#!/usr/bin/env node

const fs = require('fs');
const { execSync } = require('child_process');

// Lire le package.json pour la version
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

// Obtenir les informations git
let gitCommit = 'unknown';
try {
  gitCommit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
} catch (error) {
  console.warn('⚠️ Impossible de récupérer le commit git');
}

// Incrémenter le numéro de build
let buildNumber = 1;
try {
  const versionFile = fs.readFileSync('version.json', 'utf8');
  const versionData = JSON.parse(versionFile);
  buildNumber = parseInt(versionData.buildNumber) + 1;
} catch (error) {
  console.log('📝 Création du premier fichier de version');
}

// Créer les nouvelles données de version
const versionData = {
  version: packageJson.version,
  buildDate: new Date().toISOString(),
  buildNumber: buildNumber.toString(),
  gitCommit: gitCommit
};

// Sauvegarder le fichier version.json
fs.writeFileSync('version.json', JSON.stringify(versionData, null, 2));

// Générer le fichier TypeScript
const tsContent = `// Version et cache busting - Généré automatiquement
export const APP_VERSION = "${versionData.version}";
export const BUILD_DATE = new Date("${versionData.buildDate}");
export const BUILD_NUMBER = "${versionData.buildNumber}";
export const GIT_COMMIT = "${versionData.gitCommit}";

// Cache busting automatique
export const CACHE_VERSION = \`v\${APP_VERSION}-\${BUILD_NUMBER}\`;

// URL avec version pour forcer le rechargement
export const getVersionedUrl = (url: string): string => {
  const separator = url.includes('?') ? '&' : '?';
  return \`\${url}\${separator}v=\${CACHE_VERSION}&t=\${Date.now()}\`;
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
console.log(\`🚀 Application version: \${APP_VERSION} (build \${BUILD_NUMBER})\`);
console.log(\`📅 Build date: \${BUILD_DATE.toLocaleDateString('fr-FR')}\`);
console.log(\`🔄 Cache version: \${CACHE_VERSION}\`);
console.log(\`📝 Git commit: \${GIT_COMMIT}\`);
`;

// Sauvegarder le fichier TypeScript
fs.writeFileSync('src/utils/version.ts', tsContent);

// Mettre à jour index.html avec la version et le timestamp
try {
  let indexHtml = fs.readFileSync('index.html', 'utf8');
  const timestamp = Date.now();
  
  indexHtml = indexHtml.replace(
    /<meta name="version" content="[^"]*" \/>/,
    `<meta name="version" content="${versionData.version}-${versionData.buildNumber}" />`
  );
  
  indexHtml = indexHtml.replace(
    /<meta name="cache-bust" content="[^"]*" \/>/,
    `<meta name="cache-bust" content="${timestamp}" />`
  );
  
  fs.writeFileSync('index.html', indexHtml);
  console.log('✅ index.html mis à jour avec la version');
} catch (error) {
  console.warn('⚠️ Impossible de mettre à jour index.html:', error.message);
}

console.log(`✅ Version mise à jour: ${versionData.version} (build ${versionData.buildNumber})`);
console.log(`📝 Git commit: ${versionData.gitCommit}`);
console.log(`📅 Build date: ${new Date(versionData.buildDate).toLocaleString('fr-FR')}`);
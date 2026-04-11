#!/usr/bin/env node

console.log('🚀 Démarrage du processus de déploiement avec versioning...\n');

const { execSync } = require('child_process');
const fs = require('fs');

try {
  // 1. Mettre à jour la version
  console.log('📝 Mise à jour de la version...');
  execSync('npm run version:update', { stdio: 'inherit' });

  // 2. Lire la nouvelle version
  const versionData = JSON.parse(fs.readFileSync('version.json', 'utf8'));
  console.log(`\n✅ Version mise à jour: ${versionData.version} (build ${versionData.buildNumber})`);

  // 3. Build de l'application
  console.log('\n🔨 Construction de l\'application...');
  execSync('npm run build', { stdio: 'inherit' });

  // 4. Déploiement Firebase
  console.log('\n🚀 Déploiement sur Firebase...');
  execSync('firebase deploy', { stdio: 'inherit' });

  // 5. Commit des changements de version
  console.log('\n📝 Commit des changements de version...');
  execSync('git add version.json src/utils/version.ts', { stdio: 'inherit' });
  execSync(`git commit -m "chore: mise à jour version ${versionData.version} (build ${versionData.buildNumber})"`, { stdio: 'inherit' });
  
  // 6. Push vers GitHub
  console.log('\n📤 Push vers GitHub...');
  execSync('git push origin main', { stdio: 'inherit' });

  console.log('\n🎉 Déploiement terminé avec succès !');
  console.log(`📱 Version déployée: ${versionData.version} (build ${versionData.buildNumber})`);
  console.log(`🌐 URL: https://inventaire-centre.web.app`);

} catch (error) {
  console.error('\n❌ Erreur lors du déploiement:', error.message);
  process.exit(1);
}
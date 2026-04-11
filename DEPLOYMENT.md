# 🔄 Guide de Déploiement et Gestion du Cache

## 🚀 Déployer une nouvelle version

### Option 1 : Déploiement complet avec commit GitHub (RECOMMANDÉ)
```bash
npm run deploy:version
```
✅ Incrémente automatiquement le build number  
✅ Build l'application  
✅ Déploie sur Firebase  
✅ Commit et push sur GitHub

### Option 2 : Déploiement simple
```bash
npm run deploy
```
✅ Incrémente le build number  
✅ Build et déploie  
❌ Ne commit pas sur GitHub

### Option 3 : Déploiement manuel
```bash
npm run build
firebase deploy
```
⚠️ N'incrémente PAS la version automatiquement

---

## 📱 Problème : Les modifications ne s'affichent pas après déploiement ?

### Cause
Le navigateur garde l'ancienne version en cache. Même si vous déployez une nouvelle version avec `npm run deploy`, les utilisateurs verront l'ancienne jusqu'à ce qu'ils vident leur cache.

### Solutions pour les utilisateurs

#### Sur ordinateur :
- **Chrome/Edge** : `Ctrl + Shift + R` (Windows) ou `Cmd + Shift + R` (Mac)
- **Firefox** : `Ctrl + F5` (Windows) ou `Cmd + Shift + R` (Mac)
- **Safari** : `Cmd + Option + R`

#### Sur mobile :
- **Android Chrome** : 
  1. Menu (⋮) → Historique
  2. Effacer les données de navigation
  3. Sélectionner "Images et fichiers en cache"
  
- **iOS Safari** :
  1. Réglages → Safari
  2. Effacer historique et données de sites

#### Solution automatique (dans l'app) :
1. L'application détecte automatiquement une nouvelle version
2. Une notification s'affiche en haut à droite
3. Cliquer sur "Mettre à jour" pour recharger

---

## 🔍 Vérifier la version actuellement déployée

### Dans l'application :
- Regarder en bas de page : `Version 1.0.0 (build XX)`
- Cliquer sur le numéro de version pour voir les détails

### Dans le navigateur (console) :
```javascript
console.log(window.APP_VERSION)
```

### Localement :
```bash
cat version.json
```

---

## 🛠️ Workflow recommandé

1. **Développer localement**
   ```bash
   npm run dev
   ```

2. **Tester les modifications**
   - Vérifier que tout fonctionne
   - Tester sur plusieurs navigateurs si possible

3. **Déployer**
   ```bash
   npm run deploy:version
   ```

4. **Vérifier le déploiement**
   - Aller sur https://inventairecaserne.web.app
   - Faire `Ctrl + Shift + R` pour forcer le rechargement
   - Vérifier le numéro de build en bas de page

5. **Informer les utilisateurs**
   - Demander aux utilisateurs de faire `Ctrl + Shift + R`
   - Ou attendre que la notification automatique s'affiche

---

## 🔧 Configuration du cache

### Headers HTTP (firebase.json)
```json
{
  "hosting": {
    "headers": [{
      "source": "**",
      "headers": [{
        "key": "Cache-Control",
        "value": "no-cache, no-store, must-revalidate"
      }]
    }]
  }
}
```

### Service Worker
Le fichier `public/sw.js` gère le cache côté client :
- Cache automatique des ressources
- Nettoyage de l'ancien cache lors des mises à jour
- Force le rechargement quand une nouvelle version est disponible

---

## 📝 Historique des versions

Voir le fichier `version.json` pour :
- Version actuelle
- Numéro de build
- Date du dernier build
- Commit Git associé

---

## ⚠️ Troubleshooting

### "Je ne vois pas mes modifications après npm run deploy"
1. Vérifier que le build s'est bien terminé sans erreur
2. Vérifier le numéro de build dans `version.json`
3. Faire `Ctrl + Shift + R` dans le navigateur
4. Vider complètement le cache du navigateur
5. Essayer en navigation privée

### "Le build échoue"
1. Vérifier les erreurs TypeScript
2. Corriger les erreurs
3. Relancer `npm run build`

### "Firebase deploy échoue"
1. Vérifier la connexion internet
2. Se reconnecter : `firebase login`
3. Vérifier les permissions du projet

---

## 📞 Support

Pour toute question ou problème, consulter :
- Les logs de build : `npm run build`
- Les logs Firebase : Console Firebase
- Le repository GitHub : https://github.com/Hoganinou/inventaire-centre
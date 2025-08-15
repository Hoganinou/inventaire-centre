# Fonctionnalité Photos - Section Extérieur

## Vue d'ensemble
Une nouvelle section "Extérieur" a été ajoutée en première position de l'inventaire du VSAV 1, permettant la documentation photographique des impacts sur carrosserie et de l'usure des pneus.

## Nouvelles Fonctionnalités

### 1. Section Extérieur
- **Position** : Première section de l'inventaire (avant "Cabine")
- **Sous-sections** :
  - Inspection carrosserie
  - Inspection pneumatiques  
  - Autres défauts extérieurs

### 2. Type de Matériel "Photo"
Un nouveau type `photo` a été ajouté au modèle TypeScript `Materiel` :

```typescript
interface Materiel {
  // ... propriétés existantes
  type?: 'checkbox' | 'quantite' | 'select' | 'photo';
  photos?: string[]; // URLs/base64 des photos prises
  photoRequise?: boolean; // Indique si une photo est requise
}
```

### 3. Composant PhotoCapture
- **Prise de photos** : Accès direct à la caméra (privilégie caméra arrière sur mobile)
- **Galerie** : Import depuis la galerie photo
- **Gestion** : Affichage miniatures et suppression individuelle
- **Format** : Compression JPEG (qualité 0.8)

### 4. Matériels avec Support Photo

#### Inspection Carrosserie
- Impacts face avant
- Impacts face arrière  
- Impacts côté gauche
- Impacts côté droit
- Rayures importantes

#### Inspection Pneumatiques
- Usure pneu avant gauche
- Usure pneu avant droit
- Usure pneu arrière gauche
- Usure pneu arrière droit
- Hernie ou fissure pneu

#### Autres Défauts Extérieurs
- Feux endommagés
- Rétroviseurs endommagés
- Autres défauts visibles

## Interface Utilisateur

### Indicateurs Visuels
- **○** : Aucune photo
- **📷** : Photo(s) présente(s)
- **Statut vert** : Photos capturées

### Contrôles Photo
- Bouton "📷 Prendre une photo" : Lance la caméra
- Bouton "📁 Choisir depuis galerie" : Import fichiers
- Galerie avec miniatures et boutons de suppression

### CSS Responsive
- **Desktop** : Grille photos 150px minimum
- **Mobile** : Grille adaptée 100px, boutons pleine largeur
- **Caméra** : Prévisualisation responsive avec contrôles centrés

## Intégration Système

### Calculs de Progression
Le type `photo` est intégré dans :
- `getCompletedMaterials()` : Compte les matériels avec photos
- `isSectionComplete()` : Validation section avec photos
- `getSectionStatus()` : Statut visuel des sections

### Persistance Firebase
Les photos sont stockées en base64 dans Firestore avec le reste des données d'inventaire.

### Sécurité
- Permissions caméra gérées avec messages d'erreur appropriés
- Validation des types de fichiers (images uniquement)
- Compression pour optimiser le stockage

## Utilisation

1. **Sélectionner VSAV 1** depuis la page d'accueil
2. **Section Extérieur** apparaît en premier
3. **Cliquer sur un matériel** de type photo
4. **Prendre des photos** via caméra ou galerie
5. **Valider et continuer** l'inventaire normalement

## Notes Techniques

### Compatibilité Navigateur
- **Caméra** : Nécessite HTTPS en production
- **MediaDevices API** : Support moderne requis
- **File API** : Lecture fichiers locaux

### Performance
- **Compression automatique** des images
- **Stockage optimisé** en base64
- **Interface réactive** avec indicateurs temps réel

Cette fonctionnalité enrichit considérablement la documentation des inventaires en permettant une traçabilité visuelle des défauts et dommages extérieurs.

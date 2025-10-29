# 🎨 Icônes disponibles pour les véhicules

Ce document présente toutes les icônes disponibles pour identifier vos véhicules dans le système d'inventaire.

## 📋 Liste complète des icônes

### 🚑 Secours à la personne
- **🚑** Ambulance - `ambulance` - VSAV, ambulance de réanimation

### 🚒 Lutte contre l'incendie
- **🚒** Camion de pompiers - `fire_truck` - FPT, CCF, fourgon-pompe tonne
- **🚨** Autopompe - `fire_engine` - Véhicule d'intervention incendie
- **🚰** Camion-citerne - `water_truck` - Citerne eau, approvisionnement

### 🚐 Véhicules techniques
- **🚐** Fourgon de secours - `rescue_van` - VTU, véhicule tout usage
- **🚛** Camion lourd - `truck` - CCF, camion citerne feux de forêts
- **🚧** Véhicule de chantier - `construction_vehicle` - Véhicule de travaux et secours
- **🏗️** Véhicule grue - `crane` - Grue mobile, levage

### 🚗 Véhicules légers
- **🏍️** Moto - `motorcycle` - Moto de liaison, VL
- **🚗** Véhicule léger - `car` - Véhicule de liaison, transport du personnel
- **🚙** Fourgonnette - `van` - Transport, petit matériel
- **🚘** SUV tout-terrain - `suv` - Véhicule tout-terrain, accès difficile

### 📡 Commandement
- **📡** Véhicule de commandement - `command_vehicle` - PC mobile, véhicule de commandement
- **📻** Véhicule de communication - `communication` - Véhicule radio, télécommunications

### 📦 Logistique
- **📦** Véhicule logistique - `logistics` - Transport de matériel, ravitaillement

### 🚔 Intervention
- **🚔** Véhicule d'intervention rapide - `quick_response` - VIR, première intervention

### 👮 Forces de l'ordre
- **🚓** Véhicule de police - `police_car` - Véhicule de police municipale/nationale

### 🚁 Aéronefs
- **🚁** Hélicoptère - `helicopter` - Dragon, hélicoptère de secours

### 🚤 Véhicules nautiques
- **🚤** Embarcation - `boat` - Vedette, zodiac, bateau de secours

### ☢️ Risques spéciaux
- **☢️** Véhicule NRBC - `hazmat` - Nucléaire, radiologique, biologique, chimique

### 🚚 Remorques
- **🚚** Remorque - `trailer` - Remorque de transport, matériel spécialisé

### 🆔 Divers
- **🆔** Véhicule générique - `generic` - Véhicule non catégorisé

## 🛠️ Utilisation

### Sélection automatique
Le système attribue automatiquement une icône selon le nom du véhicule :
- Véhicules contenant "VSAV" → 🚑
- Véhicules contenant "FPT" → 🚒
- Véhicules contenant "CCF" → 🚛
- Véhicules contenant "VTU" → 🚐
- Véhicules contenant "DRAGON" ou "HELI" → 🚁
- Véhicules contenant "ZODIAC" ou "VEDETTE" → 🚤
- Véhicules contenant "MOTO" ou "VL" → 🏍️
- Par défaut → 🚗

### Accès dans l'interface
1. **Panel d'administration** : Bouton "🎨 Icônes disponibles" pour voir toutes les options
2. **Sélection manuelle** : Utilisation du composant `IconSelector` pour choisir une icône spécifique

### Personnalisation
Les icônes peuvent être étendues en modifiant le fichier `src/utils/vehicule-icons.ts` :
- Ajouter de nouvelles icônes dans `VEHICULE_ICONS`
- Créer de nouvelles catégories
- Modifier la logique de sélection automatique

## 📊 Statistiques
- **Total** : 23 icônes disponibles
- **13 catégories** différentes
- **Couverture complète** des types de véhicules de secours
- **Extensible** et facilement modifiable

## 💡 Conseils d'utilisation
- Choisissez des icônes qui correspondent visuellement au type de véhicule
- Utilisez les catégories pour organiser vos véhicules
- Les noms personnalisés des véhicules peuvent influencer l'icône automatique
- Préférez la cohérence visuelle pour faciliter l'identification rapide

---

*Ce système d'icônes améliore l'expérience utilisateur en permettant une identification visuelle rapide des différents types de véhicules dans l'interface d'inventaire.*

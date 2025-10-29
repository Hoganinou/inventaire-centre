import type { Vehicule, Section, Materiel } from '../models/inventaire';

/**
 * Migre un véhicule de l'ancien format vers le nouveau format
 */
export function migrateVehiculeToNewFormat(vehicule: Vehicule): Vehicule {
  const migratedVehicule: Vehicule = {
    ...vehicule,
    sections: vehicule.sections.map(section => migrateSection(section))
  };
  
  // Nettoyer toutes les valeurs undefined pour Firebase
  const cleanedVehicule = cleanUndefinedValues(migratedVehicule);
  
  // Migration véhicule vers nouveau format
  return cleanedVehicule;
}

/**
 * Migre une section et ses sous-sections
 */
function migrateSection(section: Section): Section {
  return {
    ...section,
    materiels: section.materiels?.map(materiel => migrateMateriel(materiel)),
    sousSections: section.sousSections?.map(sousSection => migrateSection(sousSection))
  };
}

/**
 * Migre un matériel de l'ancien type 'checkbox' vers les nouveaux types
 */
function migrateMateriel(materiel: Materiel): Materiel {
  const migrated = { ...materiel };

  // Si c'est un ancien type 'checkbox', déterminer le nouveau type
  if (materiel.type === 'checkbox') {
    migrated.type = determineNewCheckboxType(materiel);
  }

  // Nettoyer les propriétés undefined pour éviter les erreurs Firebase
  const cleaned: any = {};
  for (const [key, value] of Object.entries(migrated)) {
    if (value !== undefined) {
      cleaned[key] = value;
    }
  }

  return cleaned as Materiel;
}

/**
 * Détermine le nouveau type de checkbox en fonction du contexte
 */
function determineNewCheckboxType(materiel: Materiel): 'checkbox-presence' | 'checkbox-fonction' {
  // Règles de migration basées sur le nom et les propriétés
  const nom = materiel.nom.toLowerCase();
  
  // Si le matériel a une propriété 'fonctionne' définie (pas undefined), c'est probablement un équipement à tester
  if (materiel.fonctionne !== undefined) {
    return 'checkbox-fonction';
  }

  // Si seul estPresent est défini, c'est probablement présence uniquement
  if (materiel.estPresent !== undefined && materiel.fonctionne === undefined) {
    return 'checkbox-presence';
  }
  
  // Équipements qui nécessitent un test de fonctionnement
  const equipementsFonction = [
    'allumage', 'moteur', 'radio', 'klaxon', 'phare', 'gyrophare', 'fonctionne',
    'thermomètre', 'dextro', 'testeur', 'détecteur', 'alarme', 'sirène'
  ];
  
  // Équipements de présence uniquement
  const equipementsPresence = [
    'voyant', 'tableau', 'extincteur', 'ofd', 'cric', 'pochette', 'gants',
    'sha', 'parcellaire', 'ciseau', 'clé', 'bouteille', 'aspirateur',
    'garrot', 'brin', 'tensiomètre', 'mid', 'pompe', 'brancard', 'chaise', 'portoir'
  ];

  // Vérifier si le nom contient des mots-clés pour les équipements de fonction
  if (equipementsFonction.some(mot => nom.includes(mot))) {
    return 'checkbox-fonction';
  }

  // Vérifier si le nom contient des mots-clés pour les équipements de présence
  if (equipementsPresence.some(mot => nom.includes(mot))) {
    return 'checkbox-presence';
  }

  // Par défaut, utiliser checkbox-presence (plus sûr)
  return 'checkbox-presence';
}

/**
 * Valide qu'un véhicule importé depuis JSON est valide
 */
export function validateImportedVehicule(data: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Vérifications de base
  if (!data.id || typeof data.id !== 'string') {
    errors.push('ID du véhicule manquant ou invalide');
  }

  if (!data.nom || typeof data.nom !== 'string') {
    errors.push('Nom du véhicule manquant ou invalide');
  }

  if (!Array.isArray(data.sections)) {
    errors.push('Sections manquantes ou invalides');
  } else {
    // Valider les sections
    data.sections.forEach((section: any, index: number) => {
      if (!section.id || !section.nom) {
        errors.push(`Section ${index + 1}: ID ou nom manquant`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Nettoie et standardise un véhicule importé
 */
export function cleanImportedVehicule(data: any): Vehicule {
  // Migrer automatiquement si nécessaire
  const cleanedVehicule: Vehicule = {
    id: data.id.toUpperCase(),
    nom: data.nom,
    sections: data.sections || [],
    isCustom: true,
    editable: true,
    visible: true
  };

  // Appliquer la migration si il y a d'anciens types
  return migrateVehiculeToNewFormat(cleanedVehicule);
}

/**
 * Nettoie récursivement toutes les valeurs undefined d'un objet
 * Firebase ne supporte pas les valeurs undefined
 */
function cleanUndefinedValues(obj: any): any {
  if (obj === null || obj === undefined) {
    return null;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => cleanUndefinedValues(item));
  }
  
  if (typeof obj === 'object') {
    const cleaned: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = cleanUndefinedValues(value);
      }
    }
    
    return cleaned;
  }
  
  return obj;
}

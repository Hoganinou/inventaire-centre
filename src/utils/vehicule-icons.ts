// Configuration des icônes pour les différents types d'engins de secours

export interface VehiculeIcon {
  id: string;
  name: string;
  emoji: string;
  category: string;
  description: string;
}

export const VEHICULE_ICONS: VehiculeIcon[] = [
  // Véhicules de Secours et d'Assistance aux Victimes (VSAV)
  {
    id: 'ambulance',
    name: 'Ambulance',
    emoji: '🚑',
    category: 'Secours à la personne',
    description: 'VSAV, ambulance de réanimation'
  },
  
  // Véhicules d'Incendie et de Secours
  {
    id: 'fire_truck',
    name: 'Camion de pompiers',
    emoji: '🚒',
    category: 'Lutte contre l\'incendie',
    description: 'FPT, CCF, fourgon-pompe tonne'
  },
  {
    id: 'fire_engine',
    name: 'Autopompe',
    emoji: '🚨',
    category: 'Lutte contre l\'incendie',
    description: 'Véhicule d\'intervention incendie'
  },
  
  // Véhicules Techniques
  {
    id: 'rescue_van',
    name: 'Fourgon de secours',
    emoji: '🚐',
    category: 'Véhicules techniques',
    description: 'VTU, véhicule tout usage'
  },
  {
    id: 'truck',
    name: 'Camion lourd',
    emoji: '🚛',
    category: 'Véhicules techniques',
    description: 'CCF, camion citerne feux de forêts'
  },
  {
    id: 'construction_vehicle',
    name: 'Véhicule de chantier',
    emoji: '🚧',
    category: 'Véhicules techniques',
    description: 'Véhicule de travaux et secours'
  },
  
  // Véhicules Spécialisés
  {
    id: 'helicopter',
    name: 'Hélicoptère',
    emoji: '🚁',
    category: 'Aéronefs',
    description: 'Dragon, hélicoptère de secours'
  },
  {
    id: 'boat',
    name: 'Embarcation',
    emoji: '🚤',
    category: 'Véhicules nautiques',
    description: 'Vedette, zodiac, bateau de secours'
  },
  {
    id: 'motorcycle',
    name: 'Moto',
    emoji: '🏍️',
    category: 'Véhicules légers',
    description: 'Moto de liaison, VL'
  },
  
  // Véhicules de Commandement et Logistique
  {
    id: 'command_vehicle',
    name: 'Véhicule de commandement',
    emoji: '📡',
    category: 'Commandement',
    description: 'PC mobile, véhicule de commandement'
  },
  {
    id: 'communication',
    name: 'Véhicule de communication',
    emoji: '📻',
    category: 'Commandement',
    description: 'Véhicule radio, télécommunications'
  },
  {
    id: 'logistics',
    name: 'Véhicule logistique',
    emoji: '📦',
    category: 'Logistique',
    description: 'Transport de matériel, ravitaillement'
  },
  
  // Véhicules Spéciaux
  {
    id: 'hazmat',
    name: 'Véhicule NRBC',
    emoji: '☢️',
    category: 'Risques spéciaux',
    description: 'Nucléaire, radiologique, biologique, chimique'
  },
  {
    id: 'crane',
    name: 'Véhicule grue',
    emoji: '🏗️',
    category: 'Véhicules techniques',
    description: 'Grue mobile, levage'
  },
  {
    id: 'water_truck',
    name: 'Camion-citerne',
    emoji: '🚰',
    category: 'Lutte contre l\'incendie',
    description: 'Citerne eau, approvisionnement'
  },
  
  // Véhicules d'Intervention Rapide
  {
    id: 'quick_response',
    name: 'Véhicule d\'intervention rapide',
    emoji: '🚔',
    category: 'Intervention',
    description: 'VIR, première intervention'
  },
  {
    id: 'police_car',
    name: 'Véhicule de police',
    emoji: '🚓',
    category: 'Forces de l\'ordre',
    description: 'Véhicule de police municipale/nationale'
  },
  
  // Véhicules Utilitaires
  {
    id: 'car',
    name: 'Véhicule léger',
    emoji: '🚗',
    category: 'Véhicules légers',
    description: 'Véhicule de liaison, transport du personnel'
  },
  {
    id: 'van',
    name: 'Fourgonnette',
    emoji: '🚙',
    category: 'Véhicules légers',
    description: 'Transport, petit matériel'
  },
  {
    id: 'suv',
    name: 'SUV tout-terrain',
    emoji: '🚘',
    category: 'Véhicules légers',
    description: 'Véhicule tout-terrain, accès difficile'
  },
  
  // Autres Véhicules
  {
    id: 'trailer',
    name: 'Remorque',
    emoji: '🚚',
    category: 'Remorques',
    description: 'Remorque de transport, matériel spécialisé'
  },
  {
    id: 'generic',
    name: 'Véhicule générique',
    emoji: '🆔',
    category: 'Divers',
    description: 'Véhicule non catégorisé'
  }
];

// Regroupement par catégorie pour faciliter la sélection
export const ICON_CATEGORIES = {
  'Secours à la personne': VEHICULE_ICONS.filter(icon => icon.category === 'Secours à la personne'),
  'Lutte contre l\'incendie': VEHICULE_ICONS.filter(icon => icon.category === 'Lutte contre l\'incendie'),
  'Véhicules techniques': VEHICULE_ICONS.filter(icon => icon.category === 'Véhicules techniques'),
  'Véhicules légers': VEHICULE_ICONS.filter(icon => icon.category === 'Véhicules légers'),
  'Commandement': VEHICULE_ICONS.filter(icon => icon.category === 'Commandement'),
  'Logistique': VEHICULE_ICONS.filter(icon => icon.category === 'Logistique'),
  'Intervention': VEHICULE_ICONS.filter(icon => icon.category === 'Intervention'),
  'Forces de l\'ordre': VEHICULE_ICONS.filter(icon => icon.category === 'Forces de l\'ordre'),
  'Aéronefs': VEHICULE_ICONS.filter(icon => icon.category === 'Aéronefs'),
  'Véhicules nautiques': VEHICULE_ICONS.filter(icon => icon.category === 'Véhicules nautiques'),
  'Risques spéciaux': VEHICULE_ICONS.filter(icon => icon.category === 'Risques spéciaux'),
  'Remorques': VEHICULE_ICONS.filter(icon => icon.category === 'Remorques'),
  'Divers': VEHICULE_ICONS.filter(icon => icon.category === 'Divers')
};

// Fonction pour obtenir une icône par son ID
export const getIconById = (id: string): VehiculeIcon | undefined => {
  return VEHICULE_ICONS.find(icon => icon.id === id);
};

// Fonction pour obtenir une icône par emoji
export const getIconByEmoji = (emoji: string): VehiculeIcon | undefined => {
  return VEHICULE_ICONS.find(icon => icon.emoji === emoji);
};

// Fonction de fallback pour maintenir la compatibilité avec l'ancien système
export const getVehiculeIconLegacy = (nom: string): string => {
  if (nom.includes('VSAV')) return '🚑';
  if (nom.includes('FPT')) return '🚒';
  if (nom.includes('CCF')) return '🚛';
  if (nom.includes('VTU')) return '🚐';
  if (nom.includes('DRAGON') || nom.includes('HELI')) return '🚁';
  if (nom.includes('ZODIAC') || nom.includes('VEDETTE')) return '🚤';
  if (nom.includes('MOTO') || nom.includes('VL')) return '🏍️';
  if (nom.includes('PC') || nom.includes('COMMAND')) return '📡';
  if (nom.includes('NRBC') || nom.includes('CHIMIQUE')) return '☢️';
  if (nom.includes('GRUE')) return '🏗️';
  if (nom.includes('CITERNE')) return '🚰';
  if (nom.includes('VIR')) return '🚔';
  if (nom.includes('POLICE')) return '🚓';
  return '🚗';
};

// Types pour l'interface
export type IconCategory = keyof typeof ICON_CATEGORIES;

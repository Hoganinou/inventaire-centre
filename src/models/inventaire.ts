// Modèles TypeScript pour la gestion d'inventaire des véhicules

export interface Materiel {
  id: string;
  nom: string;
  // Type de contrôle : 
  // 'checkbox' (présent/fonctionne), 
  // 'checkbox-presence' (présence seulement), 
  // 'checkbox-fonction' (présence ET fonction),
  // 'checkbox-ok' (simple case à cocher "OK"),
  // 'radio' (boutons radio RAS/Défaut),
  // 'quantite' (nombre), 'select' (liste d'options), 'photo' (prise de photo)
  // 'niveau' (Plein/Moyen/Bas/Vide), 'etat' (Bon/Moyen/Mauvais)
  // 'conformite' (Conforme/Non conforme), 'statut-ternaire' (Bon/Moyen/Mauvais)
  // 'date' (sélecteur de date), 'texte-libre' (zone de texte)
  type?: 'checkbox' | 'checkbox-presence' | 'checkbox-fonction' | 'checkbox-ok' | 'radio' | 'quantite' | 'select' | 'photo' | 'niveau' | 'etat' | 'conformite' | 'statut-ternaire' | 'date' | 'texte-libre';
  options?: string[]; // Pour les listes déroulantes (ex: plein/moitié/vide) et labels des boutons radio
  valeur?: any; // Valeur saisie (boolean, number, string...) ou quantité attendue pour type 'quantite'
  quantiteReelle?: number; // Quantité réellement trouvée lors du contrôle (pour type 'quantite')
  estPresent?: boolean; // Pour compatibilité avec anciens matériels
  fonctionne?: boolean; // Pour compatibilité avec anciens matériels
  remarque?: string;
  observation?: string; // Champ texte libre pour observations spécifiques
  observationPrecedente?: string; // Observation du défaut précédent (non modifiable)
  photos?: string[]; // URLs/base64 des photos prises
  photoRequise?: boolean; // Indique si une photo est requise pour cet élément
  bonEtat?: boolean; // Indique que l'élément est en bon état (pas besoin de photo)
  repare?: boolean; // Indique que l'élément a été réparé (photos précédentes obsolètes)
  pasDeChangement?: boolean; // Indique qu'il n'y a pas de changement par rapport aux photos précédentes
  photosAnciennes?: string[]; // Photos des inventaires précédents
  photosReparees?: number[]; // Indices des photos anciennes qui correspondent aux problèmes réparés
  defautPrecedent?: boolean; // Indique qu'un défaut était présent lors de l'inventaire précédent
  nouveauDefaut?: boolean; // Indique qu'il s'agit d'un nouveau défaut (différent du précédent)
  statutReparation?: 'repare' | 'aucun_changement' | 'nouveau_defaut'; // Statut de réparation du défaut
}

export interface Section {
  id: string;
  nom: string;
  materiels?: Materiel[];
  sousSections?: Section[];
}

export interface Vehicule {
  id: string;
  nom: string;
  sections: Section[];
  visible?: boolean; // Permet de masquer/afficher le véhicule
  editable?: boolean; // Indique si le véhicule peut être modifié
  isCustom?: boolean; // Indique si c'est un véhicule personnalisé (créé par l'utilisateur)
  originalId?: string; // ID du véhicule original (pour les duplications)
}

export interface Inventaire {
  id: string;
  vehiculeId: string;
  agent: string;
  date: string;
  sections: Section[];
  defauts: string[];
}

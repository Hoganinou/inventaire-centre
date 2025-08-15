// Modèles TypeScript pour la gestion d'inventaire des véhicules

export interface Materiel {
  id: string;
  nom: string;
  // Type de contrôle : 'checkbox' (présent/fonctionne), 'quantite' (nombre), 'select' (liste d'options), 'photo' (prise de photo)
  type?: 'checkbox' | 'quantite' | 'select' | 'photo';
  options?: string[]; // Pour les listes déroulantes (ex: plein/moitié/vide)
  valeur?: any; // Valeur saisie (boolean, number, string...) ou quantité attendue pour type 'quantite'
  quantiteReelle?: number; // Quantité réellement trouvée lors du contrôle (pour type 'quantite')
  estPresent?: boolean; // Pour compatibilité avec anciens matériels
  fonctionne?: boolean; // Pour compatibilité avec anciens matériels
  remarque?: string;
  photos?: string[]; // URLs/base64 des photos prises
  photoRequise?: boolean; // Indique si une photo est requise pour cet élément
  bonEtat?: boolean; // Indique que l'élément est en bon état (pas besoin de photo)
  repare?: boolean; // Indique que l'élément a été réparé (photos précédentes obsolètes)
  photosAnciennnes?: string[]; // Photos des inventaires précédents
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
}

export interface Inventaire {
  id: string;
  vehiculeId: string;
  agent: string;
  date: string;
  sections: Section[];
  defauts: string[];
}

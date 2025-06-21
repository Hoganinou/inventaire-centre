// Modèles TypeScript pour la gestion d'inventaire des véhicules

export interface Materiel {
  id: string;
  nom: string;
  // Type de contrôle : 'checkbox' (présent/fonctionne), 'quantite' (nombre), 'select' (liste d'options), etc.
  type?: 'checkbox' | 'quantite' | 'select';
  options?: string[]; // Pour les listes déroulantes (ex: plein/moitié/vide)
  valeur?: any; // Valeur saisie (boolean, number, string...)
  estPresent?: boolean; // Pour compatibilité avec anciens matériels
  fonctionne?: boolean; // Pour compatibilité avec anciens matériels
  remarque?: string;
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

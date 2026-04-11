export interface SOGDefaut {
  chemin: string;
  nom: string;
  details?: string;
  quantite?: number; // Quantité manquante/en défaut
  quantiteAttendue?: number; // Quantité attendue (pour référence)
  dateDetection: Date;
  manuel?: boolean; // true si ajouté manuellement par le SOG
}

export interface SOGObservation {
  text: string;
  agent: string;
  date: Date;
}

// Défaut d'inventaire marqué comme résolu
export interface ResolvedDefaut {
  chemin: string;
  nom: string;
  resolvedBy: string; // agent qui a résolu
  resolvedDate: Date;
  reason?: string; // raison: réappro, erreur, etc.
}

export interface SOGVehiculeStatus {
  vehiculeId: string;
  vehiculeName: string;
  familleId?: string; // ID de la famille du véhicule
  mensuelActif: boolean; // Indique si le contrôle mensuel est activé pour ce véhicule
  dernierInventaire?: {
    date: Date;
    agent: string;
    agentRole?: string;
    observation?: string;
  };
  dernierMensuel?: {
    date: Date;
    agent: string;
    statut: 'OK' | 'ATTENTION' | 'DEFAUT';
    kilometres: number;
    defautsCount: number;
  };
  defauts: SOGDefaut[];
  observationsSOG: SOGObservation[]; // Observations manuelles ajoutées par le SOG
  statut: 'OK' | 'DEFAUT' | 'NON_VERIFIE';
}

export interface SOGData {
  dateGeneration: Date;
  vehicules: SOGVehiculeStatus[];
}

// Données manuelles du SOG stockées en Firestore
export interface SOGManualData {
  vehiculeId: string;
  defautsManuels: SOGDefaut[];
  observationsSOG: SOGObservation[];
  resolvedDefauts: ResolvedDefaut[]; // défauts d'inventaire marqués comme résolus
  observationOverride?: string | null; // null/undefined = pas de modification, "" = supprimée, string = modifiée
  lastModified: Date;
}

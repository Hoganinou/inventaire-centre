export interface SOGVehiculeStatus {
  vehiculeId: string;
  vehiculeName: string;
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
  defauts: Array<{
    chemin: string;
    nom: string;
    details?: string;
    dateDetection: Date;
  }>;
  statut: 'OK' | 'DEFAUT' | 'NON_VERIFIE';
}

export interface SOGData {
  dateGeneration: Date;
  vehicules: SOGVehiculeStatus[];
}

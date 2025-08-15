export interface InventaireRecord {
  id?: string;
  vehiculeId: string;
  vehiculeName: string;
  agent: string;
  dateInventaire: Date;
  defauts: Array<{
    chemin: string;
    nom: string;
    present: boolean;
    fonctionne?: boolean;
    details?: string;
  }>;
  observation: string;
  totalMateriels: number;
  materielValides: number;
  progressPercent: number;
}

export interface InventaireSummary {
  dernierInventaire: InventaireRecord | null;
  historique: InventaireRecord[];
  nombreDefauts: number;
  dernierAgent?: string;
  derniereDateCheck?: Date;
}

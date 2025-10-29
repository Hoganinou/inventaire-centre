// Interface pour les contrôles mensuels des véhicules
export interface ControleMensuel {
  id?: string;
  vehiculeId: string;
  dateMensuel: Date;
  agent: string;
  agentRole?: string;
  
  // Kilométrage
  kilometres: number;
  
  // Contrôles des liquides
  liquides: {
    huile: 'OK' | 'A_COMPLETER' | 'A_CHANGER' | 'DEFAUT';
    liquideRefroidissement: 'OK' | 'A_COMPLETER' | 'A_CHANGER' | 'DEFAUT';
    liquideFrein: 'OK' | 'A_COMPLETER' | 'A_CHANGER' | 'DEFAUT';
    liquideDirectionAssistee?: 'OK' | 'A_COMPLETER' | 'A_CHANGER' | 'DEFAUT';
  };
  
  // Contrôle des balais d'essuie-glace
  balaisEssuieGlace: {
    avant: 'OK' | 'A_CHANGER' | 'DEFAUT';
    arriere?: 'OK' | 'A_CHANGER' | 'DEFAUT';
  };
  
  // Pression des pneus
  pressionPneus: {
    avantGauche: number; // en bars
    avantDroit: number;
    arriereGauche: number;
    arriereDroit: number;
    pressionRecommandee: number;
  };
  
  // Lavage
  lavage: {
    effectue: boolean;
    typelavage: 'EXTERIEUR' | 'INTERIEUR' | 'COMPLET';
  };
  
  // Observations générales
  observations?: string;
  
  // Défauts détectés
  defauts: DefautMensuel[];
  
  // Statut global
  statut: 'OK' | 'ATTENTION' | 'DEFAUT';
  
  // Sections personnalisées - permettre l'ajout de propriétés dynamiques
  [key: string]: any;
}

export interface DefautMensuel {
  categorie: 'LIQUIDES' | 'BALAIS' | 'PNEUS' | 'LAVAGE' | 'AUTRE';
  description: string;
  gravite: 'MINEUR' | 'MOYEN' | 'GRAVE';
  dateDetection: Date;
}

// Interface pour l'affichage dans le SOG
export interface ResumeMensuel {
  vehiculeId: string;
  derniereMensuel?: {
    date: Date;
    agent: string;
    statut: 'OK' | 'ATTENTION' | 'DEFAUT';
    kilometres: number;
    defautsCount: number;
  };
}

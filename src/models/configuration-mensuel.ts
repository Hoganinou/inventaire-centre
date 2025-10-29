export interface ConfigurationMensuel {
  id: string;
  nom: string;
  sections: SectionMensuel[];
  pressionRecommandee?: number;
  dateCreation: Date;
  dateModification: Date;
  actif: boolean;
}

export interface SectionMensuel {
  id: string;
  nom: string;
  ordre: number;
  type: TypeSectionMensuel;
  obligatoire: boolean;
  elements: ElementMensuel[];
}

export type TypeSectionMensuel = 
  | 'LIQUIDES'
  | 'BALAIS'
  | 'PNEUS'
  | 'LAVAGE'
  | 'DEFAUTS'
  | 'OBSERVATIONS'
  | 'KILOMETRAGE'
  | 'PERSONNALISE';

export interface ElementMensuel {
  id: string;
  nom: string;
  type: TypeElementMensuel;
  obligatoire: boolean;
  options?: string[];
  valeurParDefaut?: string | number | boolean;
  unite?: string;
  min?: number;
  max?: number;
  ordre: number;
}

export type TypeElementMensuel =
  | 'SELECT'
  | 'INPUT_NUMBER'
  | 'INPUT_TEXT'
  | 'CHECKBOX'
  | 'TEXTAREA'
  | 'DATE';

// Configuration par défaut pour les véhicules
export const CONFIGURATION_MENSUEL_DEFAUT: ConfigurationMensuel = {
  id: 'default',
  nom: 'Configuration standard',
  actif: true,
  dateCreation: new Date(),
  dateModification: new Date(),
  pressionRecommandee: 2.2,
  sections: [
    {
      id: 'info-generales',
      nom: 'Informations générales',
      ordre: 1,
      type: 'KILOMETRAGE',
      obligatoire: true,
      elements: [
        {
          id: 'date',
          nom: 'Date du contrôle',
          type: 'DATE',
          obligatoire: true,
          ordre: 1
        },
        {
          id: 'agent',
          nom: 'Agent',
          type: 'INPUT_TEXT',
          obligatoire: true,
          ordre: 2
        },
        {
          id: 'kilometres',
          nom: 'Kilométrage actuel',
          type: 'INPUT_NUMBER',
          obligatoire: true,
          min: 0,
          ordre: 3
        }
      ]
    },
    {
      id: 'liquides',
      nom: 'Contrôle des liquides',
      ordre: 2,
      type: 'LIQUIDES',
      obligatoire: true,
      elements: [
        {
          id: 'huile',
          nom: 'Huile',
          type: 'SELECT',
          obligatoire: true,
          options: ['OK', 'A_COMPLETER', 'A_CHANGER', 'DEFAUT'],
          valeurParDefaut: 'OK',
          ordre: 1
        },
        {
          id: 'liquideRefroidissement',
          nom: 'Liquide de refroidissement',
          type: 'SELECT',
          obligatoire: true,
          options: ['OK', 'A_COMPLETER', 'A_CHANGER', 'DEFAUT'],
          valeurParDefaut: 'OK',
          ordre: 2
        },
        {
          id: 'liquideFrein',
          nom: 'Liquide de frein',
          type: 'SELECT',
          obligatoire: true,
          options: ['OK', 'A_COMPLETER', 'A_CHANGER', 'DEFAUT'],
          valeurParDefaut: 'OK',
          ordre: 3
        },
        {
          id: 'liquideDirectionAssistee',
          nom: 'Liquide direction assistée',
          type: 'SELECT',
          obligatoire: true,
          options: ['OK', 'A_COMPLETER', 'A_CHANGER', 'DEFAUT'],
          valeurParDefaut: 'OK',
          ordre: 4
        }
      ]
    },
    {
      id: 'balais',
      nom: 'Balais d\'essuie-glace',
      ordre: 3,
      type: 'BALAIS',
      obligatoire: true,
      elements: [
        {
          id: 'avant',
          nom: 'Avant',
          type: 'SELECT',
          obligatoire: true,
          options: ['OK', 'A_CHANGER', 'DEFAUT'],
          valeurParDefaut: 'OK',
          ordre: 1
        },
        {
          id: 'arriere',
          nom: 'Arrière',
          type: 'SELECT',
          obligatoire: true,
          options: ['OK', 'A_CHANGER', 'DEFAUT'],
          valeurParDefaut: 'OK',
          ordre: 2
        }
      ]
    },
    {
      id: 'pneus',
      nom: 'Pression des pneus',
      ordre: 4,
      type: 'PNEUS',
      obligatoire: true,
      elements: [
        {
          id: 'pressionRecommandee',
          nom: 'Pression recommandée',
          type: 'INPUT_NUMBER',
          obligatoire: true,
          unite: 'bars',
          min: 1.0,
          max: 5.0,
          valeurParDefaut: 2.2,
          ordre: 1
        },
        {
          id: 'avantGauche',
          nom: 'Avant gauche',
          type: 'INPUT_NUMBER',
          obligatoire: true,
          unite: 'bars',
          min: 0.5,
          max: 5.0,
          valeurParDefaut: 2.2,
          ordre: 2
        },
        {
          id: 'avantDroit',
          nom: 'Avant droit',
          type: 'INPUT_NUMBER',
          obligatoire: true,
          unite: 'bars',
          min: 0.5,
          max: 5.0,
          valeurParDefaut: 2.2,
          ordre: 3
        },
        {
          id: 'arriereGauche',
          nom: 'Arrière gauche',
          type: 'INPUT_NUMBER',
          obligatoire: true,
          unite: 'bars',
          min: 0.5,
          max: 5.0,
          valeurParDefaut: 2.2,
          ordre: 4
        },
        {
          id: 'arriereDroit',
          nom: 'Arrière droit',
          type: 'INPUT_NUMBER',
          obligatoire: true,
          unite: 'bars',
          min: 0.5,
          max: 5.0,
          valeurParDefaut: 2.2,
          ordre: 5
        }
      ]
    },
    {
      id: 'lavage',
      nom: 'Lavage',
      ordre: 5,
      type: 'LAVAGE',
      obligatoire: false,
      elements: [
        {
          id: 'effectue',
          nom: 'Lavage effectué',
          type: 'CHECKBOX',
          obligatoire: false,
          valeurParDefaut: false,
          ordre: 1
        },
        {
          id: 'type',
          nom: 'Type de lavage',
          type: 'SELECT',
          obligatoire: false,
          options: ['EXTERIEUR', 'INTERIEUR', 'COMPLET'],
          valeurParDefaut: 'EXTERIEUR',
          ordre: 2
        }
      ]
    },
    {
      id: 'observations',
      nom: 'Observations générales',
      ordre: 6,
      type: 'OBSERVATIONS',
      obligatoire: false,
      elements: [
        {
          id: 'observations',
          nom: 'Observations complémentaires',
          type: 'TEXTAREA',
          obligatoire: false,
          ordre: 1
        }
      ]
    }
  ]
};

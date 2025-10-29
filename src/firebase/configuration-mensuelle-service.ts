import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  getDocs,
  deleteDoc,
  updateDoc,
  query,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { db } from './config';

export interface ConfigurationMensuelle {
  id: string;
  nom: string;
  description: string;
  sections: SectionMensuelle[];
  actif: boolean;
  dateCreation: Date;
  dateModification: Date;
  creePar: string;
}

export interface SectionMensuelle {
  id: string;
  nom: string;
  type: 'liquides' | 'balais' | 'pneus' | 'lavage' | 'defauts' | 'observations' | 'personnalise' | string;
  obligatoire: boolean;
  ordre: number;
  config?: any; // Configuration spécifique selon le type
}

// Configuration par défaut
const CONFIG_MENSUELLE_DEFAULT: Omit<ConfigurationMensuelle, 'id' | 'dateCreation' | 'dateModification' | 'creePar'> = {
  nom: "Configuration Standard",
  description: "Configuration par défaut pour les contrôles mensuels",
  actif: true,
  sections: [
    {
      id: "info-generales",
      nom: "Informations générales",
      type: "personnalise",
      obligatoire: true,
      ordre: 1,
      config: {
        champs: [
          { nom: "dateMensuel", label: "Date du contrôle", type: "date", obligatoire: true },
          { nom: "agent", label: "Agent", type: "text", obligatoire: true, readonly: true },
          { nom: "kilometres", label: "Kilométrage actuel", type: "number", obligatoire: true }
        ]
      }
    },
    {
      id: "liquides",
      nom: "Contrôle des liquides",
      type: "liquides",
      obligatoire: true,
      ordre: 2,
      config: {
        liquides: [
          { nom: "huile", label: "Huile moteur" },
          { nom: "liquideRefroidissement", label: "Liquide de refroidissement" },
          { nom: "liquideFrein", label: "Liquide de frein" },
          { nom: "liquideDirectionAssistee", label: "Liquide direction assistée" }
        ],
        options: ["OK", "A_COMPLETER", "A_CHANGER", "DEFAUT"]
      }
    },
    {
      id: "balais",
      nom: "Balais d'essuie-glace",
      type: "balais",
      obligatoire: true,
      ordre: 3,
      config: {
        positions: [
          { nom: "avant", label: "Avant" },
          { nom: "arriere", label: "Arrière" }
        ],
        options: ["OK", "A_CHANGER", "DEFAUT"]
      }
    },
    {
      id: "pneus",
      nom: "Pression des pneus",
      type: "pneus",
      obligatoire: true,
      ordre: 4,
      config: {
        pressionRecommandee: 2.2,
        positions: [
          { nom: "avantGauche", label: "Avant gauche" },
          { nom: "avantDroit", label: "Avant droit" },
          { nom: "arriereGauche", label: "Arrière gauche" },
          { nom: "arriereDroit", label: "Arrière droit" }
        ]
      }
    },
    {
      id: "lavage",
      nom: "Lavage",
      type: "lavage",
      obligatoire: false,
      ordre: 5,
      config: {
        typesLavage: ["EXTERIEUR", "INTERIEUR", "COMPLET"]
      }
    },
    {
      id: "defauts",
      nom: "Défauts détectés",
      type: "defauts",
      obligatoire: false,
      ordre: 6,
      config: {
        categories: ["LIQUIDES", "BALAIS", "PNEUS", "LAVAGE", "AUTRE"],
        gravites: ["MINEUR", "MOYEN", "GRAVE"]
      }
    },
    {
      id: "observations",
      nom: "Observations générales",
      type: "observations",
      obligatoire: false,
      ordre: 7,
      config: {
        placeholder: "Observations complémentaires...",
        maxLength: 1000
      }
    }
  ]
};

class ConfigurationMensuelleService {
  private readonly COLLECTION_NAME = 'configurations-mensuelles';

  // Convertir les dates Firestore en objets Date
  private convertFirestoreToConfig(data: any): ConfigurationMensuelle {
    const convertDate = (dateValue: any): Date => {
      if (!dateValue) return new Date();
      
      // Si c'est un Timestamp Firestore
      if (dateValue && typeof dateValue.toDate === 'function') {
        return dateValue.toDate();
      }
      
      // Si c'est déjà un objet Date
      if (dateValue instanceof Date) {
        return dateValue;
      }
      
      // Si c'est un string ou un number, essayer de le convertir
      if (typeof dateValue === 'string' || typeof dateValue === 'number') {
        const parsed = new Date(dateValue);
        return isNaN(parsed.getTime()) ? new Date() : parsed;
      }
      
      // Fallback
      return new Date();
    };

    return {
      ...data,
      dateCreation: convertDate(data.dateCreation),
      dateModification: convertDate(data.dateModification)
    };
  }

  // Convertir les dates en Timestamp pour Firestore
  private convertConfigToFirestore(config: ConfigurationMensuelle): any {
    return {
      ...config,
      dateCreation: Timestamp.fromDate(config.dateCreation),
      dateModification: Timestamp.fromDate(config.dateModification)
    };
  }

  // Obtenir la configuration active
  async getConfigurationActive(): Promise<ConfigurationMensuelle> {
    try {
      const q = query(
        collection(db, this.COLLECTION_NAME),
        orderBy('dateModification', 'desc')
      );
      
      const snapshot = await getDocs(q);
      
      // Chercher la première configuration active
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        if (data.actif) {
          return this.convertFirestoreToConfig({
            id: docSnap.id,
            ...data
          });
        }
      }
      
      // Si aucune configuration active, créer la configuration par défaut
      console.log('Aucune configuration active trouvée, création de la configuration par défaut');
      return await this.creerConfigurationParDefaut();
      
    } catch (error) {
      console.error('Erreur lors de la récupération de la configuration active:', error);
      // En cas d'erreur, retourner la configuration par défaut
      return {
        id: 'default',
        ...CONFIG_MENSUELLE_DEFAULT,
        dateCreation: new Date(),
        dateModification: new Date(),
        creePar: 'system'
      };
    }
  }

  // Créer la configuration par défaut
  async creerConfigurationParDefaut(): Promise<ConfigurationMensuelle> {
    const config: ConfigurationMensuelle = {
      id: 'default',
      ...CONFIG_MENSUELLE_DEFAULT,
      dateCreation: new Date(),
      dateModification: new Date(),
      creePar: 'system'
    };

    try {
      await setDoc(doc(db, this.COLLECTION_NAME, 'default'), this.convertConfigToFirestore(config));
      console.log('Configuration par défaut créée avec succès');
      return config;
    } catch (error) {
      console.error('Erreur lors de la création de la configuration par défaut:', error);
      return config;
    }
  }

  // Créer une nouvelle configuration personnalisée
  async creerNouvelleConfiguration(nom: string, description: string, agent: string = 'admin'): Promise<ConfigurationMensuelle> {
    const id = `config_${Date.now()}`;
    const config: ConfigurationMensuelle = {
      id,
      nom,
      description,
      sections: [...CONFIG_MENSUELLE_DEFAULT.sections], // Copie de la structure par défaut
      actif: false, // Nouvelle configuration pas active par défaut
      dateCreation: new Date(),
      dateModification: new Date(),
      creePar: agent
    };

    try {
      await setDoc(doc(db, this.COLLECTION_NAME, id), this.convertConfigToFirestore(config));
      console.log('Nouvelle configuration créée avec succès:', id);
      return config;
    } catch (error) {
      console.error('Erreur lors de la création de la nouvelle configuration:', error);
      throw error;
    }
  }

  // Obtenir toutes les configurations
  async getToutesLesConfigurations(): Promise<ConfigurationMensuelle[]> {
    try {
      const q = query(
        collection(db, this.COLLECTION_NAME),
        orderBy('dateModification', 'desc')
      );
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => this.convertFirestoreToConfig({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Erreur lors de la récupération des configurations:', error);
      return [];
    }
  }

  // Sauvegarder une configuration
  async sauvegarderConfiguration(config: Omit<ConfigurationMensuelle, 'id' | 'dateCreation' | 'dateModification'>, agent: string): Promise<string> {
    try {
      const maintenant = new Date();
      const nouvelleConfig: ConfigurationMensuelle = {
        ...config,
        id: '', // Sera remplacé par l'ID du document
        dateCreation: maintenant,
        dateModification: maintenant,
        creePar: agent
      };

      // Si c'est une configuration active, désactiver les autres
      if (config.actif) {
        await this.desactiverToutesLesConfigurations();
      }

      const docRef = doc(collection(db, this.COLLECTION_NAME));
      nouvelleConfig.id = docRef.id;
      
      await setDoc(docRef, this.convertConfigToFirestore(nouvelleConfig));
      
      console.log('Configuration sauvegardée avec succès:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('Erreur lors de la sauvegarde de la configuration:', error);
      throw new Error('Impossible de sauvegarder la configuration');
    }
  }

  // Fonction utilitaire pour nettoyer les valeurs undefined
  private cleanUndefinedValues(obj: any): any {
    if (obj === null || obj === undefined) {
      return null;
    }
    
    // Préserver les Timestamp Firebase
    if (obj && typeof obj.toDate === 'function') {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.cleanUndefinedValues(item));
    }
    
    if (typeof obj === 'object') {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
          cleaned[key] = this.cleanUndefinedValues(value);
        }
      }
      return cleaned;
    }
    
    return obj;
  }

  // Mettre à jour une configuration
  async mettreAJourConfiguration(id: string, config: Partial<ConfigurationMensuelle>, agent: string): Promise<void> {
    try {
      const docRef = doc(db, this.COLLECTION_NAME, id);
      
      // Si on active cette configuration, désactiver les autres
      if (config.actif) {
        await this.desactiverToutesLesConfigurations();
      }

      const updateData = {
        ...config,
        dateModification: Timestamp.fromDate(new Date()),
        creePar: agent
      };

      // Nettoyer les valeurs undefined avant d'envoyer à Firebase
      const cleanedData = this.cleanUndefinedValues(updateData);

      await updateDoc(docRef, cleanedData);
      console.log('Configuration mise à jour avec succès:', id);
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la configuration:', error);
      throw new Error('Impossible de mettre à jour la configuration');
    }
  }

  // Supprimer une configuration
  async supprimerConfiguration(id: string): Promise<void> {
    try {
      if (id === 'default') {
        throw new Error('Impossible de supprimer la configuration par défaut');
      }

      await deleteDoc(doc(db, this.COLLECTION_NAME, id));
      console.log('Configuration supprimée avec succès:', id);
    } catch (error) {
      console.error('Erreur lors de la suppression de la configuration:', error);
      throw new Error('Impossible de supprimer la configuration');
    }
  }

  // Activer une configuration (et désactiver les autres)
  async activerConfiguration(id: string): Promise<void> {
    try {
      // Désactiver toutes les configurations
      await this.desactiverToutesLesConfigurations();
      
      // Activer la configuration spécifiée
      const docRef = doc(db, this.COLLECTION_NAME, id);
      await updateDoc(docRef, {
        actif: true,
        dateModification: Timestamp.fromDate(new Date())
      });
      
      console.log('Configuration activée avec succès:', id);
    } catch (error) {
      console.error('Erreur lors de l\'activation de la configuration:', error);
      throw new Error('Impossible d\'activer la configuration');
    }
  }

  // Désactiver toutes les configurations
  private async desactiverToutesLesConfigurations(): Promise<void> {
    try {
      const snapshot = await getDocs(collection(db, this.COLLECTION_NAME));
      const promises = snapshot.docs.map(doc => 
        updateDoc(doc.ref, { 
          actif: false,
          dateModification: Timestamp.fromDate(new Date())
        })
      );
      
      await Promise.all(promises);
      console.log('Toutes les configurations ont été désactivées');
    } catch (error) {
      console.error('Erreur lors de la désactivation des configurations:', error);
    }
  }

  // Dupliquer une configuration
  async dupliquerConfiguration(id: string, nouveauNom: string, agent: string): Promise<string> {
    try {
      const docRef = doc(db, this.COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        throw new Error('Configuration introuvable');
      }
      
      const configOriginale = this.convertFirestoreToConfig({
        id: docSnap.id,
        ...docSnap.data()
      });
      
      const configDupliquee = {
        ...configOriginale,
        nom: nouveauNom,
        actif: false // La copie n'est pas active par défaut
      };
      
      delete (configDupliquee as any).id;
      delete (configDupliquee as any).dateCreation;
      delete (configDupliquee as any).dateModification;
      
      return await this.sauvegarderConfiguration(configDupliquee, agent);
    } catch (error) {
      console.error('Erreur lors de la duplication de la configuration:', error);
      throw new Error('Impossible de dupliquer la configuration');
    }
  }
}

const configurationMensuelleService = new ConfigurationMensuelleService();
export default configurationMensuelleService;

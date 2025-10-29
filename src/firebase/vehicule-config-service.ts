import { doc, setDoc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from './config';
import type { Vehicule } from '../models/inventaire';

const VEHICULES_COLLECTION = 'vehicules_config';

export class VehiculeConfigService {
  
  /**
   * Sauvegarder la configuration d'un véhicule
   */
  static async saveVehiculeConfig(vehicule: Vehicule): Promise<boolean> {
    try {
      const docRef = doc(db, VEHICULES_COLLECTION, vehicule.id);
      await setDoc(docRef, {
        ...vehicule,
        lastModified: new Date(),
        version: '2.1'
      });
      
      // Configuration sauvegardée
      return true;
    } catch (error) {
      console.error('❌ Erreur sauvegarde configuration:', error);
      return false;
    }
  }

  /**
   * Récupérer la configuration d'un véhicule
   */
  static async getVehiculeConfig(vehiculeId: string): Promise<Vehicule | null> {
    try {
      const docRef = doc(db, VEHICULES_COLLECTION, vehiculeId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        // Configuration récupérée
        return {
          id: data.id,
          nom: data.nom,
          sections: data.sections
        } as Vehicule;
      }
      
      return null;
    } catch (error) {
      console.error('❌ Erreur récupération configuration:', error);
      return null;
    }
  }

  /**
   * Récupérer toutes les configurations de véhicules
   */
  static async getAllVehiculeConfigs(): Promise<Vehicule[]> {
    try {
      const querySnapshot = await getDocs(collection(db, VEHICULES_COLLECTION));
      const vehicules: Vehicule[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        vehicules.push({
          id: data.id,
          nom: data.nom,
          sections: data.sections
        } as Vehicule);
      });
      
      return vehicules;
    } catch (error) {
      console.error('❌ Erreur récupération configurations:', error);
      return [];
    }
  }

  /**
   * Supprimer la configuration d'un véhicule
   */
  static async deleteVehiculeConfig(_vehiculeId: string): Promise<void> {
    try {
      // Note: Firestore deleteDoc n'est pas importé pour éviter les suppressions accidentelles
      // On peut l'ajouter plus tard si nécessaire
      // Suppression configuration
      // await deleteDoc(doc(db, VEHICULES_COLLECTION, vehiculeId));
    } catch (error) {
      console.error('❌ Erreur suppression configuration:', error);
      throw error;
    }
  }

  /**
   * Vérifier si une configuration personnalisée existe
   */
  static async hasCustomConfig(vehiculeId: string): Promise<boolean> {
    try {
      const docRef = doc(db, VEHICULES_COLLECTION, vehiculeId);
      const docSnap = await getDoc(docRef);
      return docSnap.exists();
    } catch (error) {
      console.error('❌ Erreur vérification configuration:', error);
      return false;
    }
  }

  /**
   * Créer une nouvelle configuration de véhicule
   */
  static async createNewVehicule(nom: string, basedOn?: string): Promise<Vehicule> {
    const newId = `vehicule_${Date.now()}`;
    
    let baseConfig: Vehicule;
    
    if (basedOn) {
      // Copier depuis un véhicule existant
      const existingConfig = await this.getVehiculeConfig(basedOn);
      if (existingConfig) {
        baseConfig = {
          id: newId,
          nom: nom,
          sections: JSON.parse(JSON.stringify(existingConfig.sections)) // Deep copy
        };
      } else {
        // Fallback si le véhicule de base n'existe pas
        baseConfig = {
          id: newId,
          nom: nom,
          sections: []
        };
      }
    } else {
      // Nouveau véhicule vide
      baseConfig = {
        id: newId,
        nom: nom,
        sections: []
      };
    }
    
    await this.saveVehiculeConfig(baseConfig);
    return baseConfig;
  }

  /**
   * Exporter toutes les configurations au format JSON
   */
  static async exportAllConfigs(): Promise<string> {
    const configs = await this.getAllVehiculeConfigs();
    return JSON.stringify(configs, null, 2);
  }

  /**
   * Importer des configurations depuis JSON
   */
  static async importConfigs(jsonData: string): Promise<number> {
    try {
      const configs: Vehicule[] = JSON.parse(jsonData);
      let importedCount = 0;
      
      for (const config of configs) {
        if (config.id && config.nom && config.sections) {
          await this.saveVehiculeConfig(config);
          importedCount++;
        }
      }
      
      // Configurations importées
      return importedCount;
    } catch (error) {
      console.error('❌ Erreur import configurations:', error);
      throw error;
    }
  }
}

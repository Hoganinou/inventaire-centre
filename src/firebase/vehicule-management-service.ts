import { db } from './config';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  deleteDoc
} from 'firebase/firestore';
import type { Vehicule } from '../models/inventaire';

export interface VehiculeMetadata {
  id: string;
  visible: boolean;
  customName?: string; // Nom personnalisé (si différent du nom par défaut)
  isHidden: boolean;
  displayOrder?: number; // Ordre d'affichage
  familleId?: string; // ID de la famille du véhicule (référence vers familles-config)
}

class VehiculeManagementServiceClass {
  private collectionName = 'vehicule-metadata';

  // Obtenir les métadonnées d'un véhicule
  async getVehiculeMetadata(vehiculeId: string): Promise<VehiculeMetadata | null> {
    try {
      const docRef = doc(db, this.collectionName, vehiculeId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return docSnap.data() as VehiculeMetadata;
      }
      
      // Retourner des métadonnées par défaut si elles n'existent pas
      return {
        id: vehiculeId,
        visible: true,
        isHidden: false,
        displayOrder: 999 // Ordre par défaut élevé pour les nouveaux véhicules
      };
    } catch (error) {
      console.error('❌ Erreur récupération métadonnées véhicule:', error);
      return null;
    }
  }

  // Sauvegarder les métadonnées d'un véhicule
  async saveVehiculeMetadata(metadata: VehiculeMetadata): Promise<boolean> {
    try {
      const docRef = doc(db, this.collectionName, metadata.id);
      
      // Nettoyer les valeurs undefined pour éviter les erreurs Firebase
      const cleanMetadata: any = {
        id: metadata.id,
        visible: metadata.visible,
        isHidden: metadata.isHidden,
        displayOrder: metadata.displayOrder
      };
      
      if (metadata.customName) {
        cleanMetadata.customName = metadata.customName;
      }
      
      if (metadata.familleId) {
        cleanMetadata.familleId = metadata.familleId;
      }
      
      await setDoc(docRef, cleanMetadata, { merge: true });
      // Métadonnées véhicule sauvegardées
      return true;
    } catch (error) {
      console.error('❌ Erreur sauvegarde métadonnées:', error);
      return false;
    }
  }

  // Masquer/afficher un véhicule
  async toggleVehiculeVisibility(vehiculeId: string): Promise<boolean> {
    try {
      const metadata = await this.getVehiculeMetadata(vehiculeId);
      if (metadata) {
        metadata.visible = !metadata.visible;
        metadata.isHidden = !metadata.visible;
        return await this.saveVehiculeMetadata(metadata);
      }
      return false;
    } catch (error) {
      console.error('❌ Erreur toggle visibilité:', error);
      return false;
    }
  }

  // Renommer un véhicule
  async renameVehicule(vehiculeId: string, newName: string): Promise<boolean> {
    try {
      const metadata = await this.getVehiculeMetadata(vehiculeId);
      if (metadata) {
        metadata.customName = newName;
        return await this.saveVehiculeMetadata(metadata);
      }
      return false;
    } catch (error) {
      console.error('❌ Erreur renommage véhicule:', error);
      return false;
    }
  }

  // Dupliquer un véhicule
  async duplicateVehicule(originalVehicule: Vehicule, newId: string, newName: string): Promise<boolean> {
    try {
      // Créer une copie du véhicule
      const duplicatedVehicule: Vehicule = {
        ...JSON.parse(JSON.stringify(originalVehicule)), // Deep copy
        id: newId,
        nom: newName,
        isCustom: true,
        originalId: originalVehicule.id,
        editable: true,
        visible: true
      };

      // Sauvegarder la configuration du véhicule dupliqué
      const { VehiculeConfigService } = await import('./vehicule-config-service');
      const success = await VehiculeConfigService.saveVehiculeConfig(duplicatedVehicule);
      
      if (success) {
        // Créer les métadonnées pour le véhicule dupliqué
        const metadata: VehiculeMetadata = {
          id: newId,
          visible: true,
          isHidden: false,
          customName: newName,
          displayOrder: 999 // Les nouveaux véhicules vont à la fin
        };
        
        await this.saveVehiculeMetadata(metadata);
        // Véhicule dupliqué avec succès
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('❌ Erreur duplication véhicule:', error);
      return false;
    }
  }

  // Obtenir toutes les métadonnées
  async getAllVehiculeMetadata(): Promise<VehiculeMetadata[]> {
    try {
      const querySnapshot = await getDocs(collection(db, this.collectionName));
      return querySnapshot.docs.map(doc => doc.data() as VehiculeMetadata);
    } catch (error) {
      console.error('❌ Erreur récupération toutes métadonnées:', error);
      return [];
    }
  }

  // Mettre à jour l'ordre d'affichage des véhicules
  async updateVehiculeDisplayOrder(vehiculeOrders: { id: string; order: number }[]): Promise<boolean> {
    try {
      const updatePromises = vehiculeOrders.map(async ({ id, order }) => {
        const docRef = doc(db, this.collectionName, id);
        // S'assurer que l'id est bien dans le document
        return setDoc(docRef, { 
          id: id,  // Ajouter explicitement l'id
          displayOrder: order 
        }, { merge: true });
      });
      
      await Promise.all(updatePromises);
      return true;
    } catch (error) {
      console.error('❌ Erreur mise à jour ordre véhicules:', error);
      return false;
    }
  }

  // Obtenir tous les véhicules triés par ordre d'affichage
  async getVehiculesWithOrder(): Promise<VehiculeMetadata[]> {
    try {
      const metadatas = await this.getAllVehiculeMetadata();
      
      // Filtrer les métadonnées valides (avec un id)
      const validMetadatas = metadatas.filter(meta => meta.id && !meta.isHidden);
      
      return validMetadatas.sort((a, b) => (a.displayOrder || 999) - (b.displayOrder || 999));
    } catch (error) {
      console.error('❌ Erreur récupération véhicules triés:', error);
      return [];
    }
  }

  // Supprimer les métadonnées d'un véhicule
  async deleteVehiculeMetadata(vehiculeId: string): Promise<boolean> {
    try {
      const docRef = doc(db, this.collectionName, vehiculeId);
      await deleteDoc(docRef);
      // Métadonnées véhicule supprimées
      return true;
    } catch (error) {
      console.error('❌ Erreur suppression métadonnées:', error);
      return false;
    }
  }

  // Mettre à jour la famille d'un véhicule
  async updateVehiculeFamilleId(vehiculeId: string, familleId: string): Promise<boolean> {
    try {
      const docRef = doc(db, this.collectionName, vehiculeId);
      const existingMetadata = await this.getVehiculeMetadata(vehiculeId);
      
      const metadata: VehiculeMetadata = {
        id: vehiculeId,
        visible: existingMetadata?.visible ?? true,
        isHidden: existingMetadata?.isHidden ?? false,
        displayOrder: existingMetadata?.displayOrder ?? 999,
        familleId: familleId
      };

      // Ajouter customName seulement s'il existe et n'est pas undefined
      if (existingMetadata?.customName) {
        metadata.customName = existingMetadata.customName;
      }

      await setDoc(docRef, metadata, { merge: true });
      
      // Vérifier que la sauvegarde a bien fonctionné
      const savedMetadata = await this.getVehiculeMetadata(vehiculeId);
      if (savedMetadata?.familleId === familleId) {
        console.log(`✅ Famille ${familleId} sauvegardée pour ${vehiculeId}`);
        return true;
      } else {
        console.error(`❌ Échec vérification: famille ${savedMetadata?.familleId} != ${familleId}`);
        return false;
      }
    } catch (error) {
      console.error('❌ Erreur mise à jour famille véhicule:', error);
      return false;
    }
  }

  // Obtenir les véhicules regroupés par famille ID
  async getVehiculesGroupedByFamilleId(): Promise<{ [familleId: string]: VehiculeMetadata[] }> {
    try {
      const allMetadatas = await this.getVehiculesWithOrder();
      const groupedByFamille: { [familleId: string]: VehiculeMetadata[] } = {};

      for (const metadata of allMetadatas) {
        const familleId = metadata.familleId || 'divers';
        
        if (!groupedByFamille[familleId]) {
          groupedByFamille[familleId] = [];
        }
        groupedByFamille[familleId].push(metadata);
      }

      // Trier chaque famille par ordre d'affichage
      Object.keys(groupedByFamille).forEach(familleId => {
        groupedByFamille[familleId].sort((a, b) => (a.displayOrder || 999) - (b.displayOrder || 999));
      });

      return groupedByFamille;
    } catch (error) {
      console.error('❌ Erreur regroupement véhicules par famille:', error);
      return {};
    }
  }
}

export const VehiculeManagementService = new VehiculeManagementServiceClass();

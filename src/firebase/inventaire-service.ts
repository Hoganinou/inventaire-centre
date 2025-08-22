import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs, 
  Timestamp 
} from 'firebase/firestore';
import { db } from './config';
import type { InventaireRecord, InventaireSummary } from '../models/inventaire-record';

const INVENTAIRES_COLLECTION = 'inventaires';

export class InventaireService {
  
  // Sauvegarder un inventaire
  static async saveInventaire(inventaire: Omit<InventaireRecord, 'id'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, INVENTAIRES_COLLECTION), {
        ...inventaire,
        dateInventaire: Timestamp.fromDate(inventaire.dateInventaire)
      });
      

      return docRef.id;
    } catch (error) {
      console.error('❌ Erreur sauvegarde inventaire:', error);
      throw error;
    }
  }

  // Récupérer le résumé des inventaires pour un véhicule
  static async getInventaireSummary(vehiculeId: string): Promise<InventaireSummary> {
    try {
      // Requête pour obtenir les 5 derniers inventaires du véhicule
      const q = query(
        collection(db, INVENTAIRES_COLLECTION),
        where('vehiculeId', '==', vehiculeId),
        orderBy('dateInventaire', 'desc'),
        limit(5)
      );

      const querySnapshot = await getDocs(q);
      const historique: InventaireRecord[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        historique.push({
          id: doc.id,
          ...data,
          dateInventaire: data.dateInventaire.toDate()
        } as InventaireRecord);
      });

      const dernierInventaire = historique[0] || null;
      const nombreDefauts = dernierInventaire?.defauts.length || 0;

      return {
        dernierInventaire,
        historique,
        nombreDefauts,
        dernierAgent: dernierInventaire?.agent,
        derniereDateCheck: dernierInventaire?.dateInventaire
      };

    } catch (error) {
      console.error('❌ Erreur récupération résumé:', error);
      return {
        dernierInventaire: null,
        historique: [],
        nombreDefauts: 0
      };
    }
  }

  // Récupérer uniquement le dernier inventaire d'un véhicule
  static async getDernierInventaire(vehiculeId: string): Promise<InventaireRecord | null> {
    try {
      const q = query(
        collection(db, INVENTAIRES_COLLECTION),
        where('vehiculeId', '==', vehiculeId),
        orderBy('dateInventaire', 'desc'),
        limit(1)
      );

      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return null;
      }

      const doc = querySnapshot.docs[0];
      const data = doc.data();
      
      return {
        id: doc.id,
        ...data,
        dateInventaire: data.dateInventaire.toDate()
      } as InventaireRecord;

    } catch (error) {
      console.error('❌ Erreur récupération dernier inventaire:', error);
      return null;
    }
  }

  // Récupérer l'historique complet d'un véhicule
  static async getHistorique(vehiculeId: string): Promise<InventaireRecord[]> {
    try {
      const q = query(
        collection(db, INVENTAIRES_COLLECTION),
        where('vehiculeId', '==', vehiculeId),
        orderBy('dateInventaire', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const historique: InventaireRecord[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        historique.push({
          id: doc.id,
          ...data,
          dateInventaire: data.dateInventaire.toDate()
        } as InventaireRecord);
      });

      return historique;
    } catch (error) {
      console.error('❌ Erreur récupération historique:', error);
      return [];
    }
  }

  // Récupérer les photos du dernier inventaire pour un véhicule
  static async getDernieresPhotos(vehiculeId: string): Promise<{ [materielId: string]: string[] }> {
    try {
      const q = query(
        collection(db, INVENTAIRES_COLLECTION),
        where('vehiculeId', '==', vehiculeId),
        orderBy('dateInventaire', 'desc'),
        limit(1)
      );

      const querySnapshot = await getDocs(q);
      let photosParMateriel: { [materielId: string]: string[] } = {};

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const sections = data.sections || [];
        
        // Parcourir toutes les sections et sous-sections pour trouver les photos
        const extrairePhotos = (section: any) => {
          if (section.materiels) {
            section.materiels.forEach((materiel: any) => {
              if (materiel.photos && materiel.photos.length > 0) {
                photosParMateriel[materiel.id] = materiel.photos;
              }
            });
          }
          
          if (section.sousSections) {
            section.sousSections.forEach((sousSection: any) => {
              extrairePhotos(sousSection);
            });
          }
        };

        sections.forEach(extrairePhotos);
      });


      return photosParMateriel;
      
    } catch (error) {
      console.error('❌ Erreur récupération photos:', error);
      return {};
    }
  }
}

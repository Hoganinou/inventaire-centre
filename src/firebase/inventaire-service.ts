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
      
      console.log('✅ Inventaire sauvegardé avec ID:', docRef.id);
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
}

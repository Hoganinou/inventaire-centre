import { doc, setDoc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from './config';
import type { SOGManualData, SOGDefaut, SOGObservation, ResolvedDefaut } from '../models/sog';

const SOG_MANUAL_COLLECTION = 'sog_manual';

/**
 * Parse les observations depuis Firestore, avec rétrocompatibilité
 * pour l'ancien format (observationSOG: string)
 */
function parseObservations(data: any): SOGObservation[] {
  // Nouveau format : tableau d'observations
  if (Array.isArray(data.observationsSOG) && data.observationsSOG.length > 0) {
    return data.observationsSOG.map((obs: any) => ({
      text: obs.text || '',
      agent: obs.agent || '',
      date: obs.date?.toDate ? obs.date.toDate() : new Date(obs.date || Date.now())
    }));
  }
  // Ancien format : champ string unique → migrer en tableau
  if (data.observationSOG && typeof data.observationSOG === 'string' && data.observationSOG.trim()) {
    return [{
      text: data.observationSOG,
      agent: data.observationSOGAgent || '',
      date: data.lastModified?.toDate ? data.lastModified.toDate() : new Date()
    }];
  }
  return [];
}

export class SOGManualService {

  /**
   * Récupérer les données manuelles SOG d'un véhicule
   */
  static async getManualData(vehiculeId: string): Promise<SOGManualData | null> {
    try {
      const docRef = doc(db, SOG_MANUAL_COLLECTION, vehiculeId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          vehiculeId: data.vehiculeId,
          defautsManuels: (data.defautsManuels || []).map((d: any) => ({
            ...d,
            dateDetection: d.dateDetection?.toDate ? d.dateDetection.toDate() : new Date(d.dateDetection),
            manuel: true
          })),
          observationsSOG: parseObservations(data),
          resolvedDefauts: (data.resolvedDefauts || []).map((r: any) => ({
            chemin: r.chemin || '',
            nom: r.nom || '',
            resolvedBy: r.resolvedBy || '',
            resolvedDate: r.resolvedDate?.toDate ? r.resolvedDate.toDate() : new Date(r.resolvedDate || Date.now()),
            reason: r.reason || ''
          })),
          observationOverride: data.observationOverride !== undefined ? data.observationOverride : undefined,
          lastModified: data.lastModified?.toDate ? data.lastModified.toDate() : new Date(data.lastModified)
        };
      }

      return null;
    } catch (error) {
      console.error('❌ Erreur récupération données manuelles SOG:', error);
      return null;
    }
  }

  /**
   * Récupérer les données manuelles SOG de tous les véhicules
   */
  static async getAllManualData(): Promise<Map<string, SOGManualData>> {
    const result = new Map<string, SOGManualData>();
    try {
      const querySnapshot = await getDocs(collection(db, SOG_MANUAL_COLLECTION));
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        result.set(docSnap.id, {
          vehiculeId: data.vehiculeId,
          defautsManuels: (data.defautsManuels || []).map((d: any) => ({
            ...d,
            dateDetection: d.dateDetection?.toDate ? d.dateDetection.toDate() : new Date(d.dateDetection),
            manuel: true
          })),
          observationsSOG: parseObservations(data),
          resolvedDefauts: (data.resolvedDefauts || []).map((r: any) => ({
            chemin: r.chemin || '',
            nom: r.nom || '',
            resolvedBy: r.resolvedBy || '',
            resolvedDate: r.resolvedDate?.toDate ? r.resolvedDate.toDate() : new Date(r.resolvedDate || Date.now()),
            reason: r.reason || ''
          })),
          observationOverride: data.observationOverride !== undefined ? data.observationOverride : undefined,
          lastModified: data.lastModified?.toDate ? data.lastModified.toDate() : new Date(data.lastModified)
        });
      });
    } catch (error) {
      console.error('❌ Erreur récupération toutes les données manuelles SOG:', error);
    }
    return result;
  }

  /**
   * Sauvegarder les défauts manuels d'un véhicule
   */
  static async saveDefautsManuels(vehiculeId: string, defauts: SOGDefaut[]): Promise<boolean> {
    try {
      const docRef = doc(db, SOG_MANUAL_COLLECTION, vehiculeId);
      const existing = await getDoc(docRef);
      const existingData = existing.exists() ? existing.data() : {};

      await setDoc(docRef, {
        ...existingData,
        vehiculeId,
        defautsManuels: defauts.map(d => {
          const cleaned: Record<string, any> = {
            chemin: d.chemin,
            nom: d.nom,
            dateDetection: d.dateDetection instanceof Date ? d.dateDetection : new Date(d.dateDetection),
            manuel: true
          };
          if (d.details) cleaned.details = d.details;
          if (d.quantite !== undefined) cleaned.quantite = d.quantite;
          if (d.quantiteAttendue !== undefined) cleaned.quantiteAttendue = d.quantiteAttendue;
          return cleaned;
        }),
        lastModified: new Date()
      }, { merge: true });

      return true;
    } catch (error) {
      console.error('❌ Erreur sauvegarde défauts manuels:', error);
      return false;
    }
  }

  /**
   * Ajouter une observation manuelle
   */
  static async addObservation(vehiculeId: string, text: string, agent: string): Promise<boolean> {
    try {
      const docRef = doc(db, SOG_MANUAL_COLLECTION, vehiculeId);
      const existing = await getDoc(docRef);
      const existingData = existing.exists() ? existing.data() : {};
      const currentObs = parseObservations(existingData);

      const newObs: SOGObservation = { text, agent, date: new Date() };

      await setDoc(docRef, {
        ...existingData,
        vehiculeId,
        observationsSOG: [...currentObs, newObs].map(o => ({
          text: o.text,
          agent: o.agent,
          date: o.date instanceof Date ? o.date : new Date(o.date)
        })),
        // Nettoyer les anciens champs
        observationSOG: '',
        observationSOGAgent: '',
        lastModified: new Date()
      }, { merge: true });

      return true;
    } catch (error) {
      console.error('❌ Erreur ajout observation SOG:', error);
      return false;
    }
  }

  /**
   * Supprimer une observation manuelle par index
   */
  static async deleteObservation(vehiculeId: string, index: number): Promise<boolean> {
    try {
      const docRef = doc(db, SOG_MANUAL_COLLECTION, vehiculeId);
      const existing = await getDoc(docRef);
      const existingData = existing.exists() ? existing.data() : {};
      const currentObs = parseObservations(existingData);

      currentObs.splice(index, 1);

      await setDoc(docRef, {
        ...existingData,
        vehiculeId,
        observationsSOG: currentObs.map(o => ({
          text: o.text,
          agent: o.agent,
          date: o.date instanceof Date ? o.date : new Date(o.date)
        })),
        observationSOG: '',
        observationSOGAgent: '',
        lastModified: new Date()
      }, { merge: true });

      return true;
    } catch (error) {
      console.error('❌ Erreur suppression observation SOG:', error);
      return false;
    }
  }

  /**
   * Modifier ou supprimer l'observation d'inventaire
   * newText = null → remettre l'observation originale
   * newText = "" → supprimer l'observation
   * newText = "texte" → remplacer par ce texte
   */
  static async overrideInventoryObservation(vehiculeId: string, newText: string | null): Promise<boolean> {
    try {
      const docRef = doc(db, SOG_MANUAL_COLLECTION, vehiculeId);
      const existing = await getDoc(docRef);
      const existingData = existing.exists() ? existing.data() : {};

      const updateData: any = {
        ...existingData,
        vehiculeId,
        lastModified: new Date()
      };

      if (newText === null) {
        // Remettre l'observation originale : supprimer le champ override
        updateData.observationOverride = null;
      } else {
        updateData.observationOverride = newText;
      }

      await setDoc(docRef, updateData, { merge: true });
      return true;
    } catch (error) {
      console.error('❌ Erreur modification observation inventaire:', error);
      return false;
    }
  }

  /**
   * Marquer un défaut d'inventaire comme résolu
   */
  static async resolveDefaut(vehiculeId: string, chemin: string, nom: string, resolvedBy: string, reason: string): Promise<boolean> {
    try {
      const docRef = doc(db, SOG_MANUAL_COLLECTION, vehiculeId);
      const existing = await getDoc(docRef);
      const existingData = existing.exists() ? existing.data() : {};
      const currentResolved: ResolvedDefaut[] = (existingData.resolvedDefauts || []).map((r: any) => ({
        chemin: r.chemin || '',
        nom: r.nom || '',
        resolvedBy: r.resolvedBy || '',
        resolvedDate: r.resolvedDate?.toDate ? r.resolvedDate.toDate() : new Date(r.resolvedDate || Date.now()),
        reason: r.reason || ''
      }));

      // Vérifier que ce défaut n'est pas déjà résolu
      const alreadyResolved = currentResolved.some(r => r.chemin === chemin && r.nom === nom);
      if (alreadyResolved) return true;

      const newResolved: ResolvedDefaut = {
        chemin,
        nom,
        resolvedBy,
        resolvedDate: new Date(),
        reason
      };

      await setDoc(docRef, {
        ...existingData,
        vehiculeId,
        resolvedDefauts: [...currentResolved, newResolved].map(r => ({
          chemin: r.chemin,
          nom: r.nom,
          resolvedBy: r.resolvedBy,
          resolvedDate: r.resolvedDate instanceof Date ? r.resolvedDate : new Date(r.resolvedDate),
          reason: r.reason || ''
        })),
        lastModified: new Date()
      }, { merge: true });

      return true;
    } catch (error) {
      console.error('❌ Erreur résolution défaut inventaire:', error);
      return false;
    }
  }

  /**
   * Annuler la résolution d'un défaut d'inventaire
   */
  static async unresolveDefaut(vehiculeId: string, chemin: string, nom: string): Promise<boolean> {
    try {
      const docRef = doc(db, SOG_MANUAL_COLLECTION, vehiculeId);
      const existing = await getDoc(docRef);
      const existingData = existing.exists() ? existing.data() : {};
      const currentResolved: ResolvedDefaut[] = (existingData.resolvedDefauts || []).map((r: any) => ({
        chemin: r.chemin || '',
        nom: r.nom || '',
        resolvedBy: r.resolvedBy || '',
        resolvedDate: r.resolvedDate?.toDate ? r.resolvedDate.toDate() : new Date(r.resolvedDate || Date.now()),
        reason: r.reason || ''
      }));

      const filtered = currentResolved.filter(r => !(r.chemin === chemin && r.nom === nom));

      await setDoc(docRef, {
        ...existingData,
        vehiculeId,
        resolvedDefauts: filtered.map(r => ({
          chemin: r.chemin,
          nom: r.nom,
          resolvedBy: r.resolvedBy,
          resolvedDate: r.resolvedDate instanceof Date ? r.resolvedDate : new Date(r.resolvedDate),
          reason: r.reason || ''
        })),
        lastModified: new Date()
      }, { merge: true });

      return true;
    } catch (error) {
      console.error('❌ Erreur annulation résolution défaut:', error);
      return false;
    }
  }

  /**
   * Nettoyer les données manuelles après un nouvel inventaire
   * Efface: défauts manuels, défauts résolus, observation override
   * Conserve: observations SOG (elles restent pertinentes)
   */
  static async clearAfterInventaire(vehiculeId: string): Promise<boolean> {
    try {
      const docRef = doc(db, SOG_MANUAL_COLLECTION, vehiculeId);
      const existing = await getDoc(docRef);
      
      if (!existing.exists()) return true;
      
      const existingData = existing.data();
      
      await setDoc(docRef, {
        ...existingData,
        vehiculeId,
        defautsManuels: [],
        resolvedDefauts: [],
        observationOverride: null,
        lastModified: new Date()
      }, { merge: true });

      console.log('🧹 Données manuelles SOG nettoyées après inventaire pour:', vehiculeId);
      return true;
    } catch (error) {
      console.error('❌ Erreur nettoyage données manuelles SOG:', error);
      return false;
    }
  }
}

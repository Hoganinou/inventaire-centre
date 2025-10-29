import { 
  collection, 
  doc, 
  addDoc, 
  getDocs, 
  getDoc,
  query, 
  where, 
  orderBy, 
  limit,
  updateDoc,
  deleteDoc,
  Timestamp 
} from 'firebase/firestore';
import { db } from './config';
import type { ControleMensuel, ResumeMensuel } from '../models/mensuel';

class MensuelService {
  private collectionName = 'mensuels';

  // Convertir les dates pour Firebase
  private convertDatesForFirebase(mensuel: ControleMensuel): any {
    return {
      ...mensuel,
      dateMensuel: Timestamp.fromDate(mensuel.dateMensuel),
      defauts: mensuel.defauts.map(defaut => ({
        ...defaut,
        dateDetection: Timestamp.fromDate(defaut.dateDetection)
      }))
    };
  }

  // Convertir les dates depuis Firebase
  private convertDatesFromFirebase(data: any): ControleMensuel {
    return {
      ...data,
      dateMensuel: data.dateMensuel?.toDate() || new Date(),
      defauts: (data.defauts || []).map((defaut: any) => ({
        ...defaut,
        dateDetection: defaut.dateDetection?.toDate() || new Date()
      }))
    };
  }

  // Calculer le statut global basé sur les contrôles
  private calculerStatut(mensuel: ControleMensuel): 'OK' | 'ATTENTION' | 'DEFAUT' {
    let hasDefaut = false;
    let hasAttention = false;

    // Vérifier les liquides
    Object.values(mensuel.liquides).forEach(statut => {
      if (statut === 'DEFAUT') hasDefaut = true;
      if (statut === 'A_COMPLETER' || statut === 'A_CHANGER') hasAttention = true;
    });

    // Vérifier les balais
    Object.values(mensuel.balaisEssuieGlace).forEach(statut => {
      if (statut === 'DEFAUT') hasDefaut = true;
      if (statut === 'A_CHANGER') hasAttention = true;
    });

    // Vérifier la pression des pneus (tolérance de ±0.2 bar)
    const tolerance = 0.2;
    const pressions = [
      mensuel.pressionPneus.avantGauche,
      mensuel.pressionPneus.avantDroit,
      mensuel.pressionPneus.arriereGauche,
      mensuel.pressionPneus.arriereDroit
    ];

    pressions.forEach(pression => {
      const diff = Math.abs(pression - mensuel.pressionPneus.pressionRecommandee);
      if (diff > 0.5) hasDefaut = true;
      else if (diff > tolerance) hasAttention = true;
    });

    // Vérifier les défauts
    mensuel.defauts.forEach(defaut => {
      if (defaut.gravite === 'GRAVE') hasDefaut = true;
      if (defaut.gravite === 'MOYEN') hasAttention = true;
    });

    if (hasDefaut) return 'DEFAUT';
    if (hasAttention) return 'ATTENTION';
    return 'OK';
  }

  // Sauvegarder un contrôle mensuel
  async sauvegarderMensuel(mensuel: ControleMensuel): Promise<string> {
    try {
      // Calculer le statut automatiquement
      mensuel.statut = this.calculerStatut(mensuel);
      
      const mensuelData = this.convertDatesForFirebase(mensuel);
      const docRef = await addDoc(collection(db, this.collectionName), mensuelData);
      
      console.log('✅ Contrôle mensuel sauvegardé:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Erreur sauvegarde mensuel:', error);
      throw error;
    }
  }

  // Récupérer tous les contrôles mensuels d'un véhicule
  async getMensuelsByVehicule(vehiculeId: string): Promise<ControleMensuel[]> {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('vehiculeId', '==', vehiculeId),
        orderBy('dateMensuel', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const mensuels: ControleMensuel[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = this.convertDatesFromFirebase(doc.data());
        mensuels.push({ ...data, id: doc.id });
      });
      
      return mensuels;
    } catch (error) {
      console.error('❌ Erreur récupération mensuels véhicule:', error);
      return [];
    }
  }

  // Récupérer le dernier contrôle mensuel d'un véhicule
  async getDernierMensuel(vehiculeId: string): Promise<ControleMensuel | null> {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('vehiculeId', '==', vehiculeId),
        orderBy('dateMensuel', 'desc'),
        limit(1)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return null;
      }
      
      const doc = querySnapshot.docs[0];
      const data = this.convertDatesFromFirebase(doc.data());
      return { ...data, id: doc.id };
    } catch (error) {
      console.error('❌ Erreur récupération dernier mensuel:', error);
      return null;
    }
  }

  // Récupérer un contrôle mensuel par ID
  async getMensuelById(mensuelId: string): Promise<ControleMensuel | null> {
    try {
      const docRef = doc(db, this.collectionName, mensuelId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = this.convertDatesFromFirebase(docSnap.data());
        return { ...data, id: docSnap.id };
      }
      
      return null;
    } catch (error) {
      console.error('❌ Erreur récupération mensuel par ID:', error);
      return null;
    }
  }

  // Mettre à jour un contrôle mensuel
  async updateMensuel(mensuelId: string, mensuel: Partial<ControleMensuel>): Promise<boolean> {
    try {
      const docRef = doc(db, this.collectionName, mensuelId);
      
      // Recalculer le statut si nécessaire
      if (mensuel.liquides || mensuel.balaisEssuieGlace || mensuel.pressionPneus || mensuel.defauts) {
        const mensuelComplet = await this.getMensuelById(mensuelId);
        if (mensuelComplet) {
          const mensuelUpdated = { ...mensuelComplet, ...mensuel };
          mensuel.statut = this.calculerStatut(mensuelUpdated as ControleMensuel);
        }
      }
      
      const mensuelData = this.convertDatesForFirebase(mensuel as ControleMensuel);
      await updateDoc(docRef, mensuelData);
      
      console.log('✅ Contrôle mensuel mis à jour');
      return true;
    } catch (error) {
      console.error('❌ Erreur mise à jour mensuel:', error);
      return false;
    }
  }

  // Supprimer un contrôle mensuel
  async deleteMensuel(mensuelId: string): Promise<boolean> {
    try {
      const docRef = doc(db, this.collectionName, mensuelId);
      await deleteDoc(docRef);
      
      console.log('✅ Contrôle mensuel supprimé');
      return true;
    } catch (error) {
      console.error('❌ Erreur suppression mensuel:', error);
      return false;
    }
  }

  // Récupérer le résumé des derniers contrôles mensuels pour le SOG
  async getResumeMensuels(vehiculeIds: string[]): Promise<ResumeMensuel[]> {
    try {
      const resumes: ResumeMensuel[] = [];
      
      for (const vehiculeId of vehiculeIds) {
        const dernierMensuel = await this.getDernierMensuel(vehiculeId);
        
        const resume: ResumeMensuel = {
          vehiculeId,
          derniereMensuel: dernierMensuel ? {
            date: dernierMensuel.dateMensuel,
            agent: dernierMensuel.agent,
            statut: dernierMensuel.statut,
            kilometres: dernierMensuel.kilometres,
            defautsCount: dernierMensuel.defauts.length
          } : undefined
        };
        
        resumes.push(resume);
      }
      
      return resumes;
    } catch (error) {
      console.error('❌ Erreur récupération résumés mensuels:', error);
      return vehiculeIds.map(id => ({ vehiculeId: id }));
    }
  }

  // Récupérer les statistiques mensuelles
  async getStatistiquesMensuels(): Promise<{
    totalMensuels: number;
    mensuelsCeMois: number;
    vehiculesEnRetard: string[];
  }> {
    try {
      // Total des contrôles
      const allMensuels = await getDocs(collection(db, this.collectionName));
      const totalMensuels = allMensuels.size;
      
      // Contrôles de ce mois
      const debutMois = new Date();
      debutMois.setDate(1);
      debutMois.setHours(0, 0, 0, 0);
      
      const qMois = query(
        collection(db, this.collectionName),
        where('dateMensuel', '>=', Timestamp.fromDate(debutMois))
      );
      
      const mensuelsMois = await getDocs(qMois);
      const mensuelsCeMois = mensuelsMois.size;
      
      // TODO: Implémenter la détection des véhicules en retard
      // (nécessite de connaître la fréquence des contrôles par véhicule)
      
      return {
        totalMensuels,
        mensuelsCeMois,
        vehiculesEnRetard: []
      };
    } catch (error) {
      console.error('❌ Erreur récupération statistiques mensuels:', error);
      return {
        totalMensuels: 0,
        mensuelsCeMois: 0,
        vehiculesEnRetard: []
      };
    }
  }
}

export default new MensuelService();

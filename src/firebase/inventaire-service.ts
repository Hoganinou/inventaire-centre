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

  // Récupérer les défauts du dernier inventaire pour un véhicule
  static async getDerniersDefauts(vehiculeId: string): Promise<{ [materielId: string]: { hasDefaut: boolean; observation?: string } }> {
    try {
      console.log('🔎 Recherche défauts pour véhicule:', vehiculeId);
      
      const q = query(
        collection(db, INVENTAIRES_COLLECTION),
        where('vehiculeId', '==', vehiculeId),
        orderBy('dateInventaire', 'desc'),
        limit(1)
      );

      const querySnapshot = await getDocs(q);
      console.log('📋 Nombre d\'inventaires trouvés:', querySnapshot.size);
      
      let defautsParMateriel: { [materielId: string]: { hasDefaut: boolean; observation?: string } } = {};

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        console.log('📄 Document inventaire trouvé:', doc.id);
        
        // Récupérer UNIQUEMENT les défauts officiels de la liste 'defauts'
        // Ces défauts ont été validés et représentent les vrais problèmes non résolus
        if (data.defauts && Array.isArray(data.defauts)) {
          console.log('📋 Défauts officiels trouvés:', data.defauts.length);
          data.defauts.forEach((defaut: any) => {
            // Extraire l'ID du matériel depuis le chemin ou utiliser le nom
            const materielId = this.extractMaterielIdFromDefaut(defaut);
            if (materielId) {
              defautsParMateriel[materielId] = {
                hasDefaut: true,
                observation: defaut.details || defaut.observation || ''
              };
              console.log(`⚠️ Défaut précédent officiel trouvé pour: ${materielId}, observation: ${defaut.details || defaut.observation || 'aucune'}`);
            }
          });
        } else {
          console.log('📋 Aucun défaut officiel trouvé dans cet inventaire');
        }
      });

      console.log('📦 Défauts extraits du dernier inventaire:', defautsParMateriel);
      return defautsParMateriel;
      
    } catch (error) {
      console.error('❌ Erreur récupération défauts:', error);
      return {};
    }
  }

  // Fonction utilitaire pour extraire l'ID du matériel depuis un défaut
  private static extractMaterielIdFromDefaut(defaut: any): string | null {
    // Si le défaut a un ID direct
    if (defaut.materielId) {
      return defaut.materielId;
    }
    
    // Sinon, essayer d'extraire depuis le nom ou le chemin
    // Par exemple: "Face avant" -> "face_avant"
    if (defaut.nom) {
      let id = defaut.nom.toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[éèê]/g, 'e')
        .replace(/[àâ]/g, 'a')
        .replace(/[ùû]/g, 'u')
        .replace(/[îï]/g, 'i')
        .replace(/[ôö]/g, 'o')
        .replace(/ç/g, 'c')
        .replace(/[^a-z0-9_]/g, '');
      
      // Cas spéciaux de mapping
      if (id === 'voyant_tableau_de_bord') {
        return 'voyant_tableau_bord';
      }
      
      return id;
    }
    
    return null;
  }

  // Récupérer les photos du dernier inventaire pour un véhicule
  static async getDernieresPhotos(vehiculeId: string): Promise<{ [materielId: string]: string[] }> {
    try {
      console.log('🔎 Recherche inventaires pour véhicule:', vehiculeId);
      
      const q = query(
        collection(db, INVENTAIRES_COLLECTION),
        where('vehiculeId', '==', vehiculeId),
        orderBy('dateInventaire', 'desc'),
        limit(1)
      );

      const querySnapshot = await getDocs(q);
      console.log('📋 Nombre d\'inventaires trouvés:', querySnapshot.size);
      
      let photosParMateriel: { [materielId: string]: string[] } = {};

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        console.log('📄 Document inventaire trouvé:', doc.id);
        const sections = data.sections || [];
        console.log('🗂️ Nombre de sections:', sections.length);
        
        // Parcourir toutes les sections et sous-sections pour trouver les photos
        const extrairePhotos = (section: any, path = '') => {
          if (section.materiels) {
            section.materiels.forEach((materiel: any) => {
              const toutesPhotos: string[] = [];
              
              // Récupérer les photos nouvelles (défauts de cet inventaire)
              if (materiel.photos && materiel.photos.length > 0) {
                toutesPhotos.push(...materiel.photos);
              }
              
              // Récupérer les photos anciennes (défauts précédents non réparés)
              // Support rétrocompatibilité : photosAnciennnes ET photosAnciennes
              const photosAnciennes = materiel.photosAnciennes || materiel.photosAnciennnes || [];
              if (photosAnciennes.length > 0) {
                toutesPhotos.push(...photosAnciennes);
              }
              
              // Si le matériel a des photos (défaut non résolu) ou n'est pas en bon état et pas réparé
              if (toutesPhotos.length > 0 && !materiel.bonEtat && !materiel.repare) {
                photosParMateriel[materiel.id] = toutesPhotos;
                console.log(`✅ ${toutesPhotos.length} photos retenues pour ${materiel.nom} (${materiel.id})`);
              }
            });
          }
          
          if (section.sousSections) {
            section.sousSections.forEach((sousSection: any, index: number) => {
              extrairePhotos(sousSection, `${path}/${index}`);
            });
          }
        };

        sections.forEach((section: any, index: number) => extrairePhotos(section, `${index}`));
      });

      console.log('📦 Photos extraites du dernier inventaire:', photosParMateriel);
      return photosParMateriel;
      
    } catch (error) {
      console.error('❌ Erreur récupération photos:', error);
      return {};
    }
  }
}

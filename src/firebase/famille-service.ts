import { db } from './config';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  deleteDoc,
  orderBy,
  query
} from 'firebase/firestore';

export interface FamilleConfig {
  id: string;
  nom: string;
  couleur: string;
  icone?: string;
  ordre: number;
  dateCreation: Date;
  dateModification: Date;
}

class FamilleServiceClass {
  private collectionName = 'familles-config';

  // Familles par défaut
  private getDefaultFamilles(): FamilleConfig[] {
    return [
      {
        id: 'vsav',
        nom: 'VSAV',
        couleur: '#4f7cff',
        icone: '🚑',
        ordre: 1,
        dateCreation: new Date(),
        dateModification: new Date()
      },
      {
        id: 'incendie',
        nom: 'Incendie',
        couleur: '#ef4444',
        icone: '🚒',
        ordre: 2,
        dateCreation: new Date(),
        dateModification: new Date()
      },
      {
        id: 'sauvetage',
        nom: 'Sauvetage',
        couleur: '#f59e0b',
        icone: '🚛',
        ordre: 3,
        dateCreation: new Date(),
        dateModification: new Date()
      },
      {
        id: 'logistique',
        nom: 'Logistique',
        couleur: '#8b5cf6',
        icone: '🚐',
        ordre: 4,
        dateCreation: new Date(),
        dateModification: new Date()
      },
      {
        id: 'secours-specialise',
        nom: 'Secours Spécialisé',
        couleur: '#06b6d4',
        icone: '🔧',
        ordre: 5,
        dateCreation: new Date(),
        dateModification: new Date()
      },
      {
        id: 'divers',
        nom: 'Divers',
        couleur: '#84cc16',
        icone: '🚗',
        ordre: 6,
        dateCreation: new Date(),
        dateModification: new Date()
      }
    ];
  }

  // Obtenir toutes les familles
  async getAllFamilles(): Promise<FamilleConfig[]> {
    try {
      const q = query(
        collection(db, this.collectionName),
        orderBy('ordre', 'asc')
      );
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        // Si aucune famille n'existe, créer les familles par défaut
        await this.initializeDefaultFamilles();
        return this.getDefaultFamilles();
      }

      const familles = snapshot.docs.map(doc => ({
        ...doc.data(),
        dateCreation: doc.data().dateCreation?.toDate(),
        dateModification: doc.data().dateModification?.toDate()
      })) as FamilleConfig[];

      return familles.sort((a, b) => a.ordre - b.ordre);
    } catch (error) {
      console.error('❌ Erreur récupération familles:', error);
      return this.getDefaultFamilles();
    }
  }

  // Initialiser les familles par défaut
  async initializeDefaultFamilles(): Promise<void> {
    try {
      const defaultFamilles = this.getDefaultFamilles();
      const promises = defaultFamilles.map(famille => 
        this.saveFamille(famille)
      );
      await Promise.all(promises);
    } catch (error) {
      console.error('❌ Erreur initialisation familles par défaut:', error);
    }
  }

  // Sauvegarder une famille
  async saveFamille(famille: FamilleConfig): Promise<boolean> {
    try {
      const docRef = doc(db, this.collectionName, famille.id);
      const familleData = {
        ...famille,
        dateModification: new Date()
      };
      await setDoc(docRef, familleData);
      return true;
    } catch (error) {
      console.error('❌ Erreur sauvegarde famille:', error);
      return false;
    }
  }

  // Créer une nouvelle famille
  async createFamille(nom: string, couleur: string, icone?: string): Promise<FamilleConfig | null> {
    try {
      // Générer un ID unique basé sur le nom
      const id = nom.toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

      // Vérifier si l'ID existe déjà
      const existingDoc = await getDoc(doc(db, this.collectionName, id));
      if (existingDoc.exists()) {
        throw new Error('Une famille avec ce nom existe déjà');
      }

      // Obtenir le prochain ordre
      const familles = await this.getAllFamilles();
      const maxOrdre = Math.max(...familles.map(f => f.ordre), 0);

      const nouvelleFamille: FamilleConfig = {
        id,
        nom,
        couleur,
        icone,
        ordre: maxOrdre + 1,
        dateCreation: new Date(),
        dateModification: new Date()
      };

      const success = await this.saveFamille(nouvelleFamille);
      return success ? nouvelleFamille : null;
    } catch (error) {
      console.error('❌ Erreur création famille:', error);
      return null;
    }
  }

  // Supprimer une famille
  async deleteFamille(familleId: string): Promise<boolean> {
    try {
      await deleteDoc(doc(db, this.collectionName, familleId));
      return true;
    } catch (error) {
      console.error('❌ Erreur suppression famille:', error);
      return false;
    }
  }

  // Mettre à jour l'ordre des familles
  async updateFamillesOrder(famillesOrder: { id: string; ordre: number }[]): Promise<boolean> {
    try {
      const updatePromises = famillesOrder.map(async ({ id, ordre }) => {
        const docRef = doc(db, this.collectionName, id);
        await setDoc(docRef, { 
          ordre,
          dateModification: new Date() 
        }, { merge: true });
      });

      await Promise.all(updatePromises);
      return true;
    } catch (error) {
      console.error('❌ Erreur mise à jour ordre familles:', error);
      return false;
    }
  }

  // Obtenir le mapping nom->id pour les familles
  async getFamilleMapping(): Promise<{ [nom: string]: string }> {
    try {
      const familles = await this.getAllFamilles();
      const mapping: { [nom: string]: string } = {};
      familles.forEach(famille => {
        mapping[famille.nom] = famille.id;
      });
      return mapping;
    } catch (error) {
      console.error('❌ Erreur mapping familles:', error);
      return {};
    }
  }

  // Détecter la famille d'un véhicule basé sur son nom
  async detectFamilleFromVehiculeName(nom: string): Promise<string> {
    try {
      const familles = await this.getAllFamilles();
      
      // Règles de détection basées sur le nom
      if (nom.includes('VSAV')) {
        const vsavFamille = familles.find(f => f.nom.toLowerCase().includes('vsav'));
        return vsavFamille?.id || 'vsav';
      }
      if (nom.includes('FPT') || nom.includes('FPTL') || nom.includes('FPTSR')) {
        const incendieFamille = familles.find(f => f.nom.toLowerCase().includes('incendie'));
        return incendieFamille?.id || 'incendie';
      }
      if (nom.includes('CCF') || nom.includes('CCFS')) {
        const sauvtageFamille = familles.find(f => f.nom.toLowerCase().includes('sauvetage'));
        return sauvtageFamille?.id || 'sauvetage';
      }
      if (nom.includes('VTU') || nom.includes('VLCG')) {
        const logistiqueFamille = familles.find(f => f.nom.toLowerCase().includes('logistique'));
        return logistiqueFamille?.id || 'logistique';
      }
      if (nom.includes('VGRIMP')) {
        const specialiseFamille = familles.find(f => f.nom.toLowerCase().includes('spécialisé'));
        return specialiseFamille?.id || 'secours-specialise';
      }
      
      // Par défaut, assigner à "Divers"
      const diversFamille = familles.find(f => f.nom.toLowerCase().includes('divers'));
      return diversFamille?.id || 'divers';
    } catch (error) {
      console.error('❌ Erreur détection famille:', error);
      return 'divers';
    }
  }
}

export const FamilleService = new FamilleServiceClass();
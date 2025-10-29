import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  getDoc, 
  query, 
  where, 
  orderBy, 
  Timestamp 
} from 'firebase/firestore';
import { db } from './config';
import type { ConfigurationMensuel } from '../models/configuration-mensuel';
import { CONFIGURATION_MENSUEL_DEFAUT } from '../models/configuration-mensuel';

class ConfigurationMensuelService {
  private collectionName = 'configurations-mensuel';

  // Convertir une configuration pour Firestore
  private toFirestore(config: ConfigurationMensuel) {
    return {
      ...config,
      dateCreation: Timestamp.fromDate(config.dateCreation),
      dateModification: Timestamp.fromDate(config.dateModification)
    };
  }

  // Convertir depuis Firestore
  private fromFirestore(doc: any): ConfigurationMensuel {
    const data = doc.data();
    return {
      ...data,
      id: doc.id,
      dateCreation: data.dateCreation?.toDate() || new Date(),
      dateModification: data.dateModification?.toDate() || new Date()
    };
  }

  // Sauvegarder une nouvelle configuration
  async sauvegarderConfiguration(config: Omit<ConfigurationMensuel, 'id'>): Promise<string> {
    try {
      const configAvecDates = {
        ...config,
        dateCreation: new Date(),
        dateModification: new Date()
      };

      const docRef = await addDoc(
        collection(db, this.collectionName),
        this.toFirestore(configAvecDates as ConfigurationMensuel)
      );

      return docRef.id;
    } catch (error) {
      console.error('Erreur sauvegarde configuration mensuel:', error);
      throw error;
    }
  }

  // Mettre à jour une configuration existante
  async mettreAJourConfiguration(id: string, config: Partial<ConfigurationMensuel>): Promise<void> {
    try {
      const configAvecModification = {
        ...config,
        dateModification: new Date()
      };

      await updateDoc(
        doc(db, this.collectionName, id),
        this.toFirestore(configAvecModification as ConfigurationMensuel)
      );
    } catch (error) {
      console.error('Erreur mise à jour configuration mensuel:', error);
      throw error;
    }
  }

  // Supprimer une configuration
  async supprimerConfiguration(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, this.collectionName, id));
    } catch (error) {
      console.error('Erreur suppression configuration mensuel:', error);
      throw error;
    }
  }

  // Obtenir toutes les configurations
  async obtenirConfigurations(): Promise<ConfigurationMensuel[]> {
    try {
      const q = query(
        collection(db, this.collectionName),
        orderBy('dateModification', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const configurations = querySnapshot.docs.map(doc => this.fromFirestore(doc));
      
      // Si aucune configuration, retourner la configuration par défaut
      if (configurations.length === 0) {
        await this.initialiserConfigurationDefaut();
        return [CONFIGURATION_MENSUEL_DEFAUT];
      }
      
      return configurations;
    } catch (error) {
      console.error('Erreur récupération configurations mensuel:', error);
      // En cas d'erreur, retourner la configuration par défaut
      return [CONFIGURATION_MENSUEL_DEFAUT];
    }
  }

  // Obtenir une configuration par ID
  async obtenirConfiguration(id: string): Promise<ConfigurationMensuel | null> {
    try {
      if (id === 'default') {
        return CONFIGURATION_MENSUEL_DEFAUT;
      }

      const docSnapshot = await getDoc(doc(db, this.collectionName, id));
      
      if (docSnapshot.exists()) {
        return this.fromFirestore(docSnapshot);
      }
      
      return null;
    } catch (error) {
      console.error('Erreur récupération configuration mensuel:', error);
      return null;
    }
  }

  // Obtenir la configuration active
  async obtenirConfigurationActive(): Promise<ConfigurationMensuel> {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('actif', '==', true),
        orderBy('dateModification', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        return this.fromFirestore(querySnapshot.docs[0]);
      }
      
      // Si aucune configuration active, retourner la configuration par défaut
      return CONFIGURATION_MENSUEL_DEFAUT;
    } catch (error) {
      console.error('Erreur récupération configuration active mensuel:', error);
      return CONFIGURATION_MENSUEL_DEFAUT;
    }
  }

  // Activer une configuration (désactiver les autres)
  async activerConfiguration(id: string): Promise<void> {
    try {
      // Désactiver toutes les configurations
      const configurations = await this.obtenirConfigurations();
      const promises = configurations.map(config => 
        this.mettreAJourConfiguration(config.id, { actif: false })
      );
      await Promise.all(promises);

      // Activer la configuration sélectionnée
      await this.mettreAJourConfiguration(id, { actif: true });
    } catch (error) {
      console.error('Erreur activation configuration mensuel:', error);
      throw error;
    }
  }

  // Initialiser la configuration par défaut
  private async initialiserConfigurationDefaut(): Promise<void> {
    try {
      await this.sauvegarderConfiguration({
        nom: CONFIGURATION_MENSUEL_DEFAUT.nom,
        sections: CONFIGURATION_MENSUEL_DEFAUT.sections,
        pressionRecommandee: CONFIGURATION_MENSUEL_DEFAUT.pressionRecommandee,
        actif: true,
        dateCreation: new Date(),
        dateModification: new Date()
      });
    } catch (error) {
      console.error('Erreur initialisation configuration par défaut:', error);
    }
  }

  // Dupliquer une configuration
  async dupliquerConfiguration(id: string, nouveauNom: string): Promise<string> {
    try {
      const configOriginale = await this.obtenirConfiguration(id);
      
      if (!configOriginale) {
        throw new Error('Configuration introuvable');
      }

      const nouvelleConfig = {
        ...configOriginale,
        nom: nouveauNom,
        actif: false
      };

      // Supprimer l'ID pour créer une nouvelle entrée
      const { id: _, ...configSansId } = nouvelleConfig;
      
      return await this.sauvegarderConfiguration(configSansId);
    } catch (error) {
      console.error('Erreur duplication configuration mensuel:', error);
      throw error;
    }
  }
}

export default new ConfigurationMensuelService();

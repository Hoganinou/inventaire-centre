import { db } from './config';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export interface AdminConfig {
  id: string;
  passwordHash: string;
  lastUpdated: Date;
  createdBy: string;
}

export class AdminAuthService {
  private static readonly COLLECTION_NAME = 'admin-config';
  private static readonly ADMIN_DOC_ID = 'auth';

  // Fonction simple de hachage (pour la démo - en production utiliser bcrypt)
  private static simpleHash(password: string): string {
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  // Initialiser le mot de passe par défaut (à faire une seule fois)
  static async initializeAdminPassword(defaultPassword: string = 'admin123'): Promise<void> {
    try {
      const docRef = doc(db, this.COLLECTION_NAME, this.ADMIN_DOC_ID);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        const adminConfig: AdminConfig = {
          id: this.ADMIN_DOC_ID,
          passwordHash: this.simpleHash(defaultPassword),
          lastUpdated: new Date(),
          createdBy: 'system'
        };
        
        await setDoc(docRef, adminConfig);
        console.log('✅ Mot de passe admin initialisé:', defaultPassword);
      } else {
        console.log('ℹ️ Configuration admin déjà existante');
      }
    } catch (error) {
      console.error('❌ Erreur initialisation mot de passe admin:', error);
      throw new Error('Impossible d\'initialiser le mot de passe admin');
    }
  }

  // Vérifier le mot de passe
  static async verifyPassword(password: string): Promise<boolean> {
    try {
      const docRef = doc(db, this.COLLECTION_NAME, this.ADMIN_DOC_ID);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        console.log('⚠️ Configuration admin non trouvée, initialisation...');
        await this.initializeAdminPassword();
        return this.verifyPassword(password);
      }
      
      const config = docSnap.data() as AdminConfig;
      const inputHash = this.simpleHash(password);
      
      return inputHash === config.passwordHash;
    } catch (error) {
      console.error('❌ Erreur vérification mot de passe:', error);
      return false;
    }
  }

  // Changer le mot de passe
  static async changePassword(currentPassword: string, newPassword: string, changedBy: string): Promise<boolean> {
    try {
      // Vérifier l'ancien mot de passe
      const isCurrentValid = await this.verifyPassword(currentPassword);
      if (!isCurrentValid) {
        throw new Error('Mot de passe actuel incorrect');
      }
      
      // Mettre à jour avec le nouveau mot de passe
      const docRef = doc(db, this.COLLECTION_NAME, this.ADMIN_DOC_ID);
      const updatedConfig: AdminConfig = {
        id: this.ADMIN_DOC_ID,
        passwordHash: this.simpleHash(newPassword),
        lastUpdated: new Date(),
        createdBy: changedBy
      };
      
      await setDoc(docRef, updatedConfig);
      console.log('✅ Mot de passe admin mis à jour');
      return true;
    } catch (error) {
      console.error('❌ Erreur changement mot de passe:', error);
      throw error;
    }
  }

  // Gestion de la session locale
  static setAdminSession(): void {
    sessionStorage.setItem('adminAuthenticated', 'true');
    sessionStorage.setItem('adminLoginTime', Date.now().toString());
  }

  static isAdminAuthenticated(): boolean {
    const isAuth = sessionStorage.getItem('adminAuthenticated') === 'true';
    const loginTime = sessionStorage.getItem('adminLoginTime');
    
    if (!isAuth || !loginTime) return false;
    
    // Session expire après 2 heures
    const sessionDuration = 2 * 60 * 60 * 1000; // 2 heures en millisecondes
    const isExpired = (Date.now() - parseInt(loginTime)) > sessionDuration;
    
    if (isExpired) {
      this.clearAdminSession();
      return false;
    }
    
    return true;
  }

  static clearAdminSession(): void {
    sessionStorage.removeItem('adminAuthenticated');
    sessionStorage.removeItem('adminLoginTime');
  }
}
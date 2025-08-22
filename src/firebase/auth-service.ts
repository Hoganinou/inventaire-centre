import { collection, query, where, getDocs } from 'firebase/firestore';
import { messCaserneDb } from './config';

export interface User {
  id: string;
  name: string;
  pin: string;
  role: string;
  solde?: number;
}

export class AuthService {
  private static readonly COLLECTION_NAME = 'users';

  /**
   * Authentifie un utilisateur avec son nom et PIN
   */
  static async authenticateUser(name: string, pin: string): Promise<User | null> {
    try {
      const usersRef = collection(messCaserneDb, this.COLLECTION_NAME);
      const q = query(
        usersRef, 
        where('name', '==', name),
        where('pin', '==', pin)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return null;
      }
      
      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data() as Omit<User, 'id'>;
      
      const user: User = {
        id: userDoc.id,
        ...userData
      };
      
      return user;
      
    } catch (error) {
      console.error('❌ Erreur lors de l\'authentification:', error);
      return null;
    }
  }

  /**
   * Récupère tous les utilisateurs (pour liste déroulante)
   */
  static async getAllUsers(): Promise<User[]> {
    try {
      const usersRef = collection(messCaserneDb, this.COLLECTION_NAME);
      const querySnapshot = await getDocs(usersRef);
      
      const users: User[] = [];
      querySnapshot.forEach((doc) => {
        const userData = doc.data() as Omit<User, 'id'>;
        users.push({
          id: doc.id,
          ...userData
        });
      });
      
      // Trier par nom
      users.sort((a, b) => a.name.localeCompare(b.name));
      
      return users;
      
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des utilisateurs:', error);
      return [];
    }
  }

  /**
   * Vérifie si un utilisateur existe par son nom
   */
  static async getUserByName(name: string): Promise<User | null> {
    try {
      const usersRef = collection(messCaserneDb, this.COLLECTION_NAME);
      const q = query(usersRef, where('name', '==', name));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return null;
      }
      
      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data() as Omit<User, 'id'>;
      
      return {
        id: userDoc.id,
        ...userData
      };
      
    } catch (error) {
      console.error('❌ Erreur lors de la recherche utilisateur:', error);
      return null;
    }
  }
}

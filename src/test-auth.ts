// Script de test pour vérifier la connexion à MessCaserne
import { AuthService } from './firebase/auth-service';

// Test de récupération des utilisateurs
export async function testConnection() {
  // Test de connexion à MessCaserne
  
  try {
    const users = await AuthService.getAllUsers();
    // Test réussi
    return users;
  } catch (error) {
    console.error('❌ Test échoué:', error);
    return null;
  }
}

// Appel automatique pour test
// Démarrage du test de connexion
testConnection();

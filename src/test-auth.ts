// Script de test pour vérifier la connexion à MessCaserne
import { AuthService } from './firebase/auth-service';

// Test de récupération des utilisateurs
export async function testConnection() {
  console.log('🧪 Test de connexion à MessCaserne...');
  
  try {
    const users = await AuthService.getAllUsers();
    console.log('✅ Test réussi:', users);
    return users;
  } catch (error) {
    console.error('❌ Test échoué:', error);
    return null;
  }
}

// Appel automatique pour test
console.log('🚀 Démarrage du test de connexion...');
testConnection();

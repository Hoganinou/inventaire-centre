// Script pour initialiser des données de test
// Ce script peut être exécuté dans la console du navigateur

async function initializeTestData() {
  console.log('🚀 Initialisation des données de test...');
  
  // Importer les services nécessaires
  const { VehiculeManagementService } = await import('./src/firebase/vehicule-management-service.js');
  const { FamilleService } = await import('./src/firebase/famille-service.js');
  
  try {
    // 1. S'assurer que les familles par défaut existent
    await FamilleService.initializeDefaultFamilles();
    console.log('✅ Familles par défaut créées');
    
    // 2. Récupérer les familles disponibles
    const familles = await FamilleService.getAllFamilles();
    console.log('📋 Familles disponibles:', familles.map(f => `${f.nom} (${f.couleur})`));
    
    // 3. Assigner des familles aux véhicules de test
    const testAssignments = [
      { vehiculeId: 'vsav_1', familleId: 'vsav' },
      { vehiculeId: 'ccf', familleId: 'incendie' },
      { vehiculeId: 'fpt', familleId: 'incendie' },
      { vehiculeId: 'vtu', familleId: 'sauvetage' }
    ];
    
    for (const assignment of testAssignments) {
      try {
        await VehiculeManagementService.updateVehiculeFamilleId(assignment.vehiculeId, assignment.familleId);
        console.log(`✅ ${assignment.vehiculeId} → famille ${assignment.familleId}`);
      } catch (error) {
        console.log(`⚠️  Véhicule ${assignment.vehiculeId} non trouvé, ignoré`);
      }
    }
    
    console.log('🎉 Données de test initialisées avec succès !');
    console.log('💡 Actualisez la page pour voir les changements');
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation:', error);
  }
}

// Fonction pour tester le changement dynamique de couleurs
async function testDynamicColorUpdate() {
  console.log('🎨 Test de mise à jour dynamique des couleurs...');
  
  try {
    const { VehiculeManagementService } = await import('./src/firebase/vehicule-management-service.js');
    
    // Changer la famille du premier véhicule trouvé
    const vehicules = await VehiculeManagementService.getVehiculesWithOrder();
    if (vehicules.length > 0) {
      const vehicule = vehicules[0];
      const nouvelleFamille = vehicule.familleId === 'vsav' ? 'incendie' : 'vsav';
      
      await VehiculeManagementService.updateVehiculeFamilleId(vehicule.id, nouvelleFamille);
      console.log(`✅ Véhicule ${vehicule.id} changé vers famille ${nouvelleFamille}`);
      
      // Déclencher le rafraîchissement si disponible
      if (window.refreshHomePage) {
        window.refreshHomePage();
        console.log('🔄 Page rafraîchie automatiquement');
      } else {
        console.log('💡 Actualisez manuellement la page pour voir le changement');
      }
    }
    
  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
  }
}

// Exposer les fonctions globalement pour les tests
window.initializeTestData = initializeTestData;
window.testDynamicColorUpdate = testDynamicColorUpdate;

console.log('📝 Fonctions de test disponibles:');
console.log('   - initializeTestData() : Initialise des données de test');
console.log('   - testDynamicColorUpdate() : Test le changement dynamique de couleurs');

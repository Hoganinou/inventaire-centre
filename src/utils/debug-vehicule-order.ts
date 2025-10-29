import { VehiculeManagementService } from '../firebase/vehicule-management-service';
import { vehicules } from '../models/vehicules/index';

export async function debugVehiculeOrder() {
  console.log('🔍 Debug de l\'ordre des véhicules...');
  
  try {
    // 1. Vérifier les métadonnées existantes
    const metadatas = await VehiculeManagementService.getAllVehiculeMetadata();
    console.log('📊 Métadonnées trouvées:', metadatas.length);
    
    metadatas.forEach(meta => {
      console.log(`   - ${meta.id}: ordre=${meta.displayOrder}, visible=${meta.visible}, hidden=${meta.isHidden}`);
    });
    
    // 2. Vérifier les véhicules par défaut
    const defaultVehicules = Object.values(vehicules);
    console.log('🚗 Véhicules par défaut:', defaultVehicules.length);
    defaultVehicules.forEach(v => {
      console.log(`   - ${v.id}: ${v.nom}`);
    });
    
    // 3. Vérifier les métadonnées triées
    const sortedMetadatas = await VehiculeManagementService.getVehiculesWithOrder();
    console.log('📋 Ordre actuel (selon displayOrder):');
    sortedMetadatas.forEach((meta, index) => {
      console.log(`   ${index + 1}. ${meta.id} (ordre: ${meta.displayOrder})`);
    });
    
    // 4. Créer les métadonnées manquantes si nécessaire
    const vehiculeIds = defaultVehicules.map(v => v.id);
    const missingMetadata = vehiculeIds.filter(id => 
      !metadatas.some(meta => meta.id === id)
    );
    
    if (missingMetadata.length > 0) {
      console.log('⚠️ Métadonnées manquantes pour:', missingMetadata);
      
      // Créer les métadonnées manquantes
      for (let i = 0; i < missingMetadata.length; i++) {
        const vehiculeId = missingMetadata[i];
        const defaultVehicule = defaultVehicules.find(v => v.id === vehiculeId);
        
        if (defaultVehicule) {
          const newMetadata = {
            id: vehiculeId,
            visible: true,
            isHidden: false,
            displayOrder: (sortedMetadatas.length + i + 1)
          };
          
          console.log(`   ✅ Création métadonnées pour ${vehiculeId} avec ordre ${newMetadata.displayOrder}`);
          await VehiculeManagementService.saveVehiculeMetadata(newMetadata);
        }
      }
    }
    
    console.log('✅ Debug terminé');
    
  } catch (error) {
    console.error('❌ Erreur debug:', error);
  }
}

// Fonction pour réinitialiser l'ordre par défaut
export async function resetVehiculeOrder() {
  console.log('🔄 Réinitialisation de l\'ordre des véhicules...');
  
  try {
    const defaultVehicules = Object.values(vehicules);
    const orders = [
      { id: 'VSAV1', order: 1 },
      { id: 'CCF6_1', order: 2 },
      { id: 'VSAV2', order: 3 },
      // Ajoutez d'autres véhicules selon vos besoins
    ];
    
    for (const { id, order } of orders) {
      const vehicule = defaultVehicules.find(v => v.id === id);
      if (vehicule) {
        const metadata = {
          id: id,
          visible: true,
          isHidden: false,
          displayOrder: order
        };
        
        console.log(`   📝 Mise à jour ${id}: ordre ${order}`);
        await VehiculeManagementService.saveVehiculeMetadata(metadata);
      }
    }
    
    console.log('✅ Ordre réinitialisé');
  } catch (error) {
    console.error('❌ Erreur réinitialisation:', error);
  }
}
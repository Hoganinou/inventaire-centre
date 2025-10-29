import { VehiculeConfigService } from '../firebase/vehicule-config-service';
import { VehiculeManagementService } from '../firebase/vehicule-management-service';
import type { Vehicule } from '../models/inventaire';

// Véhicules de base à créer dans Firebase s'ils n'existent pas
const vehiculesDeBase: Vehicule[] = [
  {
    id: "VSAV1",
    nom: "VSAV 1",
    sections: [],
    isCustom: true,
    editable: true,
    visible: true
  },
  {
    id: "VSAV2", 
    nom: "VSAV 2",
    sections: [],
    isCustom: true,
    editable: true,
    visible: true
  },
  {
    id: "CCF6-1",
    nom: "CCF 6-1",
    sections: [],
    isCustom: true,
    editable: true,
    visible: true
  }
];

export async function initializeVehiculesInFirebase() {
  console.log('🔧 Initialisation des véhicules dans Firebase...');
  
  try {
    // Vérifier les véhicules existants dans Firebase
    const existingVehicules = await VehiculeConfigService.getAllVehiculeConfigs();
    const existingIds = existingVehicules.map((v: Vehicule) => v.id);
    
    console.log('📋 Véhicules existants dans Firebase:', existingIds);
    
    // Créer les véhicules manquants
    for (const vehicule of vehiculesDeBase) {
      if (!existingIds.includes(vehicule.id)) {
        console.log(`   ➕ Création du véhicule ${vehicule.id} (${vehicule.nom})`);
        await VehiculeConfigService.saveVehiculeConfig(vehicule);
        
        // Créer aussi les métadonnées si elles n'existent pas
        const metadata = await VehiculeManagementService.getVehiculeMetadata(vehicule.id);
        if (!metadata || metadata.displayOrder === undefined) {
          const newMetadata = {
            id: vehicule.id,
            visible: true,
            isHidden: false,
            displayOrder: vehicule.id === 'VSAV1' ? 1 : vehicule.id === 'VSAV2' ? 2 : 3
          };
          console.log(`   📝 Création métadonnées ${vehicule.id} avec ordre ${newMetadata.displayOrder}`);
          await VehiculeManagementService.saveVehiculeMetadata(newMetadata);
        }
      } else {
        console.log(`   ✅ ${vehicule.id} existe déjà`);
      }
    }
    
    console.log('✅ Initialisation terminée');
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation:', error);
  }
}

export async function listAllVehiculesFromFirebase() {
  console.log('📋 Liste de tous les véhicules dans Firebase...');
  
  try {
    const vehicules = await VehiculeConfigService.getAllVehiculeConfigs();
    const metadatas = await VehiculeManagementService.getAllVehiculeMetadata();
    
    console.log(`🚗 ${vehicules.length} véhicules trouvés:`);
    vehicules.forEach((v: Vehicule) => {
      const meta = metadatas.find(m => m.id === v.id);
      console.log(`   - ${v.id}: ${v.nom} (ordre: ${meta?.displayOrder || 'non défini'})`);
    });
    
    console.log(`📊 ${metadatas.length} métadonnées trouvées:`);
    metadatas.forEach(meta => {
      console.log(`   - ${meta.id}: ordre=${meta.displayOrder}, visible=${meta.visible}, hidden=${meta.isHidden}`);
    });
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  }
}
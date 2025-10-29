import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  getDocs, 
  where 
} from 'firebase/firestore';
import { db } from './config';
import type { SOGData, SOGVehiculeStatus } from '../models/sog';
import type { InventaireRecord } from '../models/inventaire-record';
import { vehicules } from '../models/vehicules';
import { VehiculeConfigService } from './vehicule-config-service';
import { VehiculeManagementService } from './vehicule-management-service';
import MensuelService from './mensuel-service';
import type { Vehicule } from '../models/inventaire';

export const generateSOGData = async (): Promise<SOGData> => {
  const sogVehicules: SOGVehiculeStatus[] = [];
  
  // Récupérer tous les véhicules (par défaut + personnalisés)
  const allVehicules = new Map<string, Vehicule>();
  
  // D'abord les véhicules par défaut
  Object.values(vehicules).forEach(v => allVehicules.set(v.id, v));
  
  // Puis ajouter/écraser avec les véhicules personnalisés
  try {
    const customVehicules = await VehiculeConfigService.getAllVehiculeConfigs();
    customVehicules.forEach((v: Vehicule) => allVehicules.set(v.id, v));
  } catch (error) {
    console.error('❌ Erreur chargement véhicules personnalisés pour SOG:', error);
  }
  
  // Récupérer les véhicules visibles avec leur ordre d'affichage
  const vehiculesWithOrder = await VehiculeManagementService.getVehiculesWithOrder();
  const visibleVehicules: Vehicule[] = [];
  
  // Créer une map des métadonnées pour un accès rapide
  const metadataMap = new Map();
  vehiculesWithOrder.forEach(meta => metadataMap.set(meta.id, meta));
  
  // Ajouter d'abord les véhicules triés par ordre
  for (const metadata of vehiculesWithOrder) {
    const vehicule = allVehicules.get(metadata.id);
    if (vehicule && metadata.visible !== false) {
      const vehiculeWithCustomName = { ...vehicule };
      if (metadata.customName) {
        vehiculeWithCustomName.nom = metadata.customName;
      }
      visibleVehicules.push(vehiculeWithCustomName);
    }
  }
  
  // Ajouter les véhicules qui n'ont pas encore de métadonnées (nouveaux véhicules)
  for (const vehicule of allVehicules.values()) {
    if (!metadataMap.has(vehicule.id)) {
      try {
        const metadata = await VehiculeManagementService.getVehiculeMetadata(vehicule.id);
        if (metadata && metadata.visible !== false) {
          const vehiculeWithCustomName = { ...vehicule };
          if (metadata.customName) {
            vehiculeWithCustomName.nom = metadata.customName;
          }
          visibleVehicules.push(vehiculeWithCustomName);
        }
      } catch (metadataError) {
        console.error(`❌ Erreur récupération metadata pour ${vehicule.id}:`, metadataError);
        // En cas d'erreur, inclure le véhicule par défaut
        visibleVehicules.push(vehicule);
      }
    }
  }
  
  // Pour chaque véhicule visible
  for (const vehiculeConfig of visibleVehicules) {
    const vehiculeId = vehiculeConfig.id;
    try {
      // Récupérer le dernier inventaire de ce véhicule
      const inventairesQuery = query(
        collection(db, 'inventaires'),
        where('vehiculeId', '==', vehiculeId),
        orderBy('dateInventaire', 'desc'),
        limit(1)
      );
      
      const inventairesSnapshot = await getDocs(inventairesQuery);
      let dernierInventaire: { date: Date; agent: string; agentRole?: string; observation?: string } | undefined = undefined;
      let defauts: any[] = [];
      let statut: 'OK' | 'DEFAUT' | 'NON_VERIFIE' = 'NON_VERIFIE';
      
      if (!inventairesSnapshot.empty) {
        const doc = inventairesSnapshot.docs[0];
        const data = doc.data() as InventaireRecord;
        
        // Convertir la date depuis Firebase Timestamp si nécessaire
        let dateInventaire: Date = data.dateInventaire as Date;
        if (data.dateInventaire && typeof (data.dateInventaire as any).toDate === 'function') {
          dateInventaire = (data.dateInventaire as any).toDate();
        } else if (typeof data.dateInventaire === 'string' || typeof data.dateInventaire === 'number') {
          dateInventaire = new Date(data.dateInventaire);
        } else if (data.dateInventaire instanceof Date) {
          dateInventaire = data.dateInventaire;
        }
        
        dernierInventaire = {
          date: dateInventaire,
          agent: data.agent,
          agentRole: data.agentRole,
          observation: data.observation
        };
        
        // Utiliser directement les défauts sauvegardés (déjà calculés par getDefauts lors de la sauvegarde)
        defauts = (data.defauts || []).map(defaut => ({
          chemin: defaut.chemin,
          nom: defaut.nom,
          details: defaut.details,
          dateDetection: dateInventaire
        }));
        
        statut = defauts.length > 0 ? 'DEFAUT' : 'OK';
      }

      // Récupérer le dernier contrôle mensuel
      let dernierMensuel: any = undefined;
      try {
        const mensuel = await MensuelService.getDernierMensuel(vehiculeId);
        if (mensuel) {
          dernierMensuel = {
            date: mensuel.dateMensuel,
            agent: mensuel.agent,
            statut: mensuel.statut,
            kilometres: mensuel.kilometres,
            defautsCount: mensuel.defauts.length
          };
        }
      } catch (mensuelError) {
        console.error(`Erreur récupération mensuel pour ${vehiculeId}:`, mensuelError);
      }
      
      sogVehicules.push({
        vehiculeId,
        vehiculeName: vehiculeConfig.nom,
        dernierInventaire,
        dernierMensuel,
        defauts,
        statut
      });
      
    } catch (error) {
      console.error(`Erreur lors de la récupération des données pour ${vehiculeId}:`, error);
      
      // Ajouter le véhicule avec un statut d'erreur
      sogVehicules.push({
        vehiculeId,
        vehiculeName: vehiculeConfig.nom || vehiculeId,
        defauts: [],
        statut: 'NON_VERIFIE'
      });
    }
  }
  
  return {
    dateGeneration: new Date(),
    vehicules: sogVehicules
  };
};

export const exportSOGToCSV = (sogData: SOGData): string => {
  const headers = [
    'Véhicule',
    'Statut',
    'Dernière vérification',
    'Agent',
    'Nombre de défauts',
    'Défauts'
  ];
  
  const formatDateForCSV = (date: any): string => {
    try {
      let dateObj: Date;
      
      if (date && typeof date.toDate === 'function') {
        dateObj = date.toDate();
      } else if (date instanceof Date) {
        dateObj = date;
      } else if (date) {
        dateObj = new Date(date);
      } else {
        return 'Jamais vérifié';
      }
      
      if (isNaN(dateObj.getTime())) {
        return 'Date invalide';
      }
      
      return dateObj.toLocaleDateString('fr-FR');
    } catch {
      return 'Date invalide';
    }
  };
  
  const rows = sogData.vehicules.map(vehicule => [
    vehicule.vehiculeName,
    vehicule.statut,
    vehicule.dernierInventaire 
      ? formatDateForCSV(vehicule.dernierInventaire.date)
      : 'Jamais vérifié',
    vehicule.dernierInventaire?.agent || '-',
    vehicule.defauts.length.toString(),
    vehicule.defauts.map(d => d.nom).join('; ')
  ]);
  
  return [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');
};

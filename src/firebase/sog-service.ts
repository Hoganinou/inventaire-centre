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
import { SOGManualService } from './sog-manual-service';
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
  
  // Charger toutes les données manuelles SOG en une seule fois
  const allManualData = await SOGManualService.getAllManualData();
  
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
        defauts = (data.defauts || []).map(defaut => {
          // Générer des détails si absents (rétrocompatibilité avec anciens inventaires)
          let details = defaut.details;
          if (!details) {
            if (defaut.present === false) {
              details = 'Absent';
            } else if (defaut.present === true && defaut.fonctionne === false) {
              details = 'Présent mais ne fonctionne pas';
            }
          }
          
          // Extraire quantite/quantiteAttendue depuis details (format "X/Y")
          let quantite: number | undefined;
          let quantiteAttendue: number | undefined;
          if (details) {
            const matchQuantite = details.match(/^(?:Trouvé\s+)?(\d+)\/(\d+)/);
            if (matchQuantite) {
              quantite = parseInt(matchQuantite[1]);
              quantiteAttendue = parseInt(matchQuantite[2]);
            }
          }
          
          return {
            chemin: defaut.chemin,
            nom: defaut.nom,
            details,
            dateDetection: dateInventaire,
            manuel: false,
            ...(quantite !== undefined && { quantite }),
            ...(quantiteAttendue !== undefined && { quantiteAttendue })
          };
        });
        
        statut = defauts.length > 0 ? 'DEFAUT' : 'OK';
      }

      // Fusionner avec les données manuelles du SOG
      const manualData = allManualData.get(vehiculeId);
      let observationsSOG: import('../models/sog').SOGObservation[] = [];
      
      if (manualData) {
        // Filtrer les défauts d'inventaire résolus
        if (manualData.resolvedDefauts && manualData.resolvedDefauts.length > 0) {
          defauts = defauts.filter(d => 
            !manualData.resolvedDefauts.some(r => r.chemin === d.chemin && r.nom === d.nom)
          );
        }
        // Ajouter les défauts manuels
        if (manualData.defautsManuels && manualData.defautsManuels.length > 0) {
          defauts = [...defauts, ...manualData.defautsManuels];
        }
        observationsSOG = manualData.observationsSOG || [];
        
        // Appliquer l'override de l'observation d'inventaire si défini
        if (dernierInventaire && manualData.observationOverride !== undefined && manualData.observationOverride !== null) {
          dernierInventaire.observation = manualData.observationOverride || undefined;
        }
      }

      // Recalculer le statut après filtrage des défauts résolus et ajout manuels
      if (dernierInventaire || defauts.length > 0) {
        statut = defauts.length > 0 ? 'DEFAUT' : 'OK';
      }

      // Récupérer le dernier contrôle mensuel seulement si activé
      let dernierMensuel: any = undefined;
      const vehiculeMetadata = metadataMap.get(vehiculeId);
      const mensuelActif = vehiculeMetadata?.mensuelActif !== false; // Actif par défaut
      const familleId = vehiculeMetadata?.familleId || undefined;
      
      if (mensuelActif) {
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
      }
      
      sogVehicules.push({
        vehiculeId,
        vehiculeName: vehiculeConfig.nom,
        familleId,
        mensuelActif,
        dernierInventaire,
        dernierMensuel,
        defauts,
        observationsSOG,
        statut
      });
      
    } catch (error) {
      console.error(`Erreur lors de la récupération des données pour ${vehiculeId}:`, error);
      
      // Ajouter le véhicule avec un statut d'erreur
      const errorVehiculeMetadata = metadataMap.get(vehiculeId);
      const errorMensuelActif = errorVehiculeMetadata?.mensuelActif !== false;
      
      sogVehicules.push({
        vehiculeId,
        vehiculeName: vehiculeConfig.nom || vehiculeId,
        mensuelActif: errorMensuelActif,
        defauts: [],
        observationsSOG: [],
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

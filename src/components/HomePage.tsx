import React, { useState, useEffect } from 'react';
import { vehicules } from '../models/vehicules/index';
import { VehiculeConfigService } from '../firebase/vehicule-config-service';
import { VehiculeManagementService } from '../firebase/vehicule-management-service';
import { AdminAuthService } from '../firebase/admin-auth-service';
import { FamilleService } from '../firebase/famille-service';
import AdminLoginModal from './AdminLoginModal';
import { APP_VERSION, BUILD_NUMBER } from '../utils/version';
import type { Vehicule } from '../models/inventaire';
import type { FamilleConfig } from '../firebase/famille-service';
import type { VehiculeMetadata } from '../firebase/vehicule-management-service';

interface Props {
  onSelectVehicule: (vehiculeId: string) => void;
  onOpenAdmin?: () => void;
  onOpenSOG?: () => void;
  onRefreshVehicules?: () => void;
}

const HomePage: React.FC<Props> = ({ onSelectVehicule, onOpenAdmin, onOpenSOG, onRefreshVehicules }) => {
  const [allVehicules, setAllVehicules] = useState<Vehicule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [famillesMap, setFamillesMap] = useState<Map<string, FamilleConfig>>(new Map());
  const [vehiculesMetadata, setVehiculesMetadata] = useState<Map<string, VehiculeMetadata>>(new Map());

  // Charger tous les véhicules au démarrage et quand refreshKey change
  useEffect(() => {
    loadAllVehicules();
    // Initialiser le mot de passe admin par défaut
    AdminAuthService.initializeAdminPassword();
  }, [refreshKey]);

  // Charger les familles au démarrage
  useEffect(() => {
    loadFamilles();
  }, []);

  // Exposer la fonction de rechargement au parent
  useEffect(() => {
    if (onRefreshVehicules) {
      // Passer notre fonction de rechargement au parent
      (window as any).refreshHomePage = () => setRefreshKey(prev => prev + 1);
    }
  }, [onRefreshVehicules]);

  const loadFamilles = async () => {
    try {
      // S'assurer que les familles par défaut existent
      await FamilleService.initializeDefaultFamilles();
      
      const familles = await FamilleService.getAllFamilles();
      const famillesMap = new Map<string, FamilleConfig>();
      familles.forEach(f => famillesMap.set(f.id, f));
      setFamillesMap(famillesMap);
    } catch (error) {
      console.error('❌ Erreur chargement familles:', error);
    }
  };

  const loadAllVehicules = async () => {
    try {
      // D'abord recharger les familles pour avoir les couleurs à jour
      await loadFamilles();
      
      // 1. Obtenir l'ordre des véhicules depuis les métadonnées (triés par displayOrder)
      const vehiculeMetadatas = await VehiculeManagementService.getVehiculesWithOrder();
      
      // Créer un map des métadonnées pour accès rapide
      const metadataMap = new Map<string, VehiculeMetadata>();
      vehiculeMetadatas.forEach(m => metadataMap.set(m.id, m));
      setVehiculesMetadata(metadataMap);
      
      // 2. Charger TOUS les véhicules depuis Firebase
      const customVehicules = await VehiculeConfigService.getAllVehiculeConfigs();
      
      // Créer un map pour un accès rapide
      const vehiculesMap = new Map<string, Vehicule>();
      customVehicules.forEach((v: Vehicule) => vehiculesMap.set(v.id, v));
      
      // 3. Assigner la famille "divers" aux véhicules sans famille
      for (const metadata of vehiculeMetadatas) {
        if (!metadata.familleId) {
          await VehiculeManagementService.updateVehiculeFamilleId(metadata.id, 'divers');
          metadata.familleId = 'divers'; // Mettre à jour localement
        }
      }
      
      // 5. Créer la liste ordonnée en respectant l'ordre des métadonnées
      const orderedVehicules: Vehicule[] = [];
      
      for (const metadata of vehiculeMetadatas) {
        // Chercher le véhicule dans Firebase d'abord
        let vehicule = vehiculesMap.get(metadata.id);
        
        // Si pas trouvé dans Firebase, chercher dans les véhicules par défaut (fallback)
        if (!vehicule) {
          const defaultVehicules = Object.values(vehicules);
          vehicule = defaultVehicules.find(v => v.id === metadata.id);
        }
        
        if (vehicule && metadata.visible !== false && !metadata.isHidden) {
          // Créer une copie pour éviter de modifier l'original
          const vehiculeCopy = { ...vehicule };
          
          // Appliquer le nom personnalisé si disponible
          if (metadata.customName) {
            vehiculeCopy.nom = metadata.customName;
          }
          orderedVehicules.push(vehiculeCopy);
        }
      }
      
      setAllVehicules(orderedVehicules);
      
    } catch (error) {
      console.error('❌ Erreur chargement véhicules page d\'accueil:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filtrer pour exclure l'exemple du menu principal
  const vehiculesDisponibles = allVehicules.filter(v => v.id !== 'EXEMPLE');

  const handleVehiculeClick = (vehiculeId: string) => {
    onSelectVehicule(vehiculeId);
  };

  const handleAdminClick = () => {
    if (AdminAuthService.isAdminAuthenticated()) {
      // Déjà connecté, aller directement à l'admin
      if (onOpenAdmin) onOpenAdmin();
    } else {
      // Afficher le modal de connexion
      setShowAdminLogin(true);
    }
  };

  const handleAdminLoginSuccess = () => {
    setShowAdminLogin(false);
    if (onOpenAdmin) onOpenAdmin();
  };

  const handleAdminLoginCancel = () => {
    setShowAdminLogin(false);
  };

  const getVehiculeColor = (vehiculeId: string): string => {
    // Récupérer les métadonnées du véhicule pour obtenir sa familleId
    const metadata = vehiculesMetadata.get(vehiculeId);
    if (metadata?.familleId) {
      // Récupérer la couleur de la famille
      const famille = famillesMap.get(metadata.familleId);
      if (famille?.couleur) {
        return famille.couleur;
      }
    }
    
    // Utiliser la famille "divers" par défaut si pas de famille assignée
    const familleParDefaut = famillesMap.get('divers');
    if (familleParDefaut?.couleur) {
      return familleParDefaut.couleur;
    }
    
    // Couleur de secours si même la famille "divers" n'existe pas
    return '#6b7280';
  };

  return (
    <div className="homepage-container">
      <div className="homepage-header">
        <div className="homepage-logo">🏢</div>
        <h1 className="homepage-title">Inventaire Caserne</h1>
        <p className="homepage-subtitle">
          Sélectionnez un véhicule pour commencer la vérification
        </p>
        
        <div className="header-actions">
          {onOpenSOG && (
            <button 
              onClick={onOpenSOG}
              className="sog-access-btn"
              title="État Opérationnel des Véhicules (SOG)"
            >
              📊 SOG
            </button>
          )}
        </div>
      </div>

      <div className="vehicules-grid">
        {loading ? (
          <div className="loading-message">🔄 Chargement des véhicules...</div>
        ) : (
          vehiculesDisponibles.map((vehicule) => (
            <div
              key={vehicule.id}
              className="vehicule-card"
              onClick={() => handleVehiculeClick(vehicule.id)}
              style={{ '--vehicule-color': getVehiculeColor(vehicule.id) } as React.CSSProperties}
            >
            <div className="vehicule-info">
              <h3 className="vehicule-nom">{vehicule.nom}</h3>
            </div>
            <div className="vehicule-arrow">▶</div>
          </div>
          ))
        )}
      </div>

      <div className="homepage-footer">
        {onOpenAdmin && (
          <button 
            onClick={handleAdminClick}
            className="admin-access-btn admin-access-btn-footer"
            title="Accès administration"
          >
            ⚙️ Administration
          </button>
        )}
      </div>

      <AdminLoginModal
        isOpen={showAdminLogin}
        onSuccess={handleAdminLoginSuccess}
        onCancel={handleAdminLoginCancel}
      />
      
      {/* Footer avec version */}
      <footer className="app-footer">
        <div className="version-info">
          Version {APP_VERSION} (build {BUILD_NUMBER}) • {new Date().toLocaleDateString('fr-FR')} - © 2025 Inventaire Caserne - CATTINI Julien
        </div>
      </footer>
    </div>
  );
};

export default HomePage;

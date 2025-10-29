import React, { useState, useEffect } from 'react';
import { vehicules } from '../models/vehicules/index';
import { VehiculeConfigService } from '../firebase/vehicule-config-service';
import { VehiculeManagementService } from '../firebase/vehicule-management-service';
import { AdminAuthService } from '../firebase/admin-auth-service';
import AdminLoginModal from './AdminLoginModal';
import type { Vehicule } from '../models/inventaire';

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

  // Charger tous les véhicules au démarrage et quand refreshKey change
  useEffect(() => {
    loadAllVehicules();
    // Initialiser le mot de passe admin par défaut
    AdminAuthService.initializeAdminPassword();
  }, [refreshKey]);

  // Exposer la fonction de rechargement au parent
  useEffect(() => {
    if (onRefreshVehicules) {
      // Passer notre fonction de rechargement au parent
      (window as any).refreshHomePage = () => setRefreshKey(prev => prev + 1);
    }
  }, [onRefreshVehicules]);

  const loadAllVehicules = async () => {
    try {
      // 1. Obtenir l'ordre des véhicules depuis les métadonnées (triés par displayOrder)
      const vehiculeMetadatas = await VehiculeManagementService.getVehiculesWithOrder();
      
      // 2. Charger TOUS les véhicules depuis Firebase
      const customVehicules = await VehiculeConfigService.getAllVehiculeConfigs();
      
      // Créer un map pour un accès rapide
      const vehiculesMap = new Map<string, Vehicule>();
      customVehicules.forEach((v: Vehicule) => vehiculesMap.set(v.id, v));
      
      // 3. Créer la liste ordonnée en respectant l'ordre des métadonnées
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

  const getVehiculeColor = (nom: string): string => {
    if (nom.includes('VSAV')) return 'var(--niveau-1)';
    if (nom.includes('FPT')) return 'var(--niveau-2)';
    if (nom.includes('CCF')) return 'var(--niveau-3)';
    if (nom.includes('VTU')) return 'var(--niveau-4)';
    return 'var(--niveau-5)';
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
          {onOpenAdmin && (
            <button 
              onClick={handleAdminClick}
              className="admin-access-btn"
              title="Accès administration"
            >
              ⚙️ Administration
            </button>
          )}
          
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
              style={{ '--vehicule-color': getVehiculeColor(vehicule.nom) } as React.CSSProperties}
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
        <div className="footer-info">
          <div className="info-item">
            <span className="info-icon">📱</span>
            <span>Scannez le QR code du véhicule ou sélectionnez directement</span>
          </div>
          <div className="info-item">
            <span className="info-icon">📊</span>
            <span>Consultez l'historique avant de commencer</span>
          </div>
          <div className="info-item">
            <span className="info-icon">☁️</span>
            <span>Sauvegarde automatique dans le cloud</span>
          </div>
        </div>

        <div className="version-info">
          <span>Version 2.1</span>
        </div>
      </div>

      <AdminLoginModal
        isOpen={showAdminLogin}
        onSuccess={handleAdminLoginSuccess}
        onCancel={handleAdminLoginCancel}
      />
    </div>
  );
};

export default HomePage;

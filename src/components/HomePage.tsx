import React from 'react';
import { vehicules } from '../models/vehicules/index';

interface Props {
  onSelectVehicule: (vehiculeId: string) => void;
}

const HomePage: React.FC<Props> = ({ onSelectVehicule }) => {
  // Filtrer pour exclure l'exemple du menu principal
  const vehiculesDisponibles = Object.entries(vehicules).filter(([key]) => key !== 'EXEMPLE');

  const handleVehiculeClick = (vehiculeId: string) => {
    onSelectVehicule(vehiculeId);
  };

  const getVehiculeIcon = (nom: string): string => {
    if (nom.includes('VSAV')) return '🚑';
    if (nom.includes('FPT')) return '🚒';
    if (nom.includes('CCF')) return '🚛';
    if (nom.includes('VTU')) return '🚐';
    return '🚗';
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
      </div>

      <div className="vehicules-grid">
        {vehiculesDisponibles.map(([key, vehicule]) => (
          <div
            key={key}
            className="vehicule-card"
            onClick={() => handleVehiculeClick(vehicule.id)}
            style={{ '--vehicule-color': getVehiculeColor(vehicule.nom) } as React.CSSProperties}
          >
            <div className="vehicule-icon">
              {getVehiculeIcon(vehicule.nom)}
            </div>
            <div className="vehicule-info">
              <h3 className="vehicule-nom">{vehicule.nom}</h3>
            </div>
            <div className="vehicule-arrow">▶</div>
          </div>
        ))}
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
    </div>
  );
};

export default HomePage;

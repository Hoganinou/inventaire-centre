import React from 'react';
import type { Vehicule } from '../models/inventaire';

interface Props {
  vehicule: Vehicule;
}

const InventaireComplete: React.FC<Props> = ({ vehicule }) => {
  const handleNewInventaire = () => {
    // Recharger la page pour recommencer le processus
    window.location.reload();
  };

  const handleBackToHome = () => {
    // Retourner à la page d'accueil (sans paramètres de véhicule)
    window.location.href = window.location.origin + window.location.pathname;
  };

  return (
    <div className="inventaire-complete-container">
      <div className="complete-card">
        <div className="complete-icon">✅</div>
        <h1 className="complete-title">Inventaire terminé</h1>
        <div className="complete-vehicule">
          <h2>{vehicule.nom}</h2>
          <p>L'inventaire de ce véhicule a été envoyé avec succès</p>
        </div>
        
        <div className="complete-info">
          <div className="info-item">
            <span className="info-icon">💾</span>
            <span>Données sauvegardées dans la base</span>
          </div>
          <div className="info-item">
            <span className="info-icon">📊</span>
            <span>Rapport envoyé vers Google Sheets</span>
          </div>
        </div>

        <div className="complete-actions">
          <button 
            onClick={handleNewInventaire}
            className="btn-new-inventaire"
          >
            <span className="btn-icon">🔄</span>
            <span className="btn-text">Nouvel inventaire</span>
          </button>
          
          <button 
            onClick={handleBackToHome}
            className="btn-back-home"
          >
            <span className="btn-icon">🏠</span>
            <span className="btn-text">Retour accueil</span>
          </button>
        </div>

        <div className="complete-footer">
          <p>Merci pour votre vérification !</p>
          <p className="complete-timestamp">
            Terminé le {new Date().toLocaleString('fr-FR')}
          </p>
        </div>
      </div>
    </div>
  );
};

export default InventaireComplete;

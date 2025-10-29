import React from 'react';
import type { SOGVehiculeStatus } from '../models/sog';
import './VehiculeDetailModal.css';

interface VehiculeDetailModalProps {
  vehicule: SOGVehiculeStatus | null;
  isOpen: boolean;
  onClose: () => void;
}

const VehiculeDetailModal: React.FC<VehiculeDetailModalProps> = ({ 
  vehicule, 
  isOpen, 
  onClose 
}) => {
  if (!isOpen || !vehicule) return null;

  const formatDate = (date: Date | any) => {
    try {
      let dateObj: Date;
      
      if (date && typeof date.toDate === 'function') {
        dateObj = date.toDate();
      } else if (date instanceof Date) {
        dateObj = date;
      } else if (date) {
        dateObj = new Date(date);
      } else {
        return 'Date invalide';
      }
      
      if (isNaN(dateObj.getTime())) {
        return 'Date invalide';
      }
      
      return new Intl.DateTimeFormat('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(dateObj);
    } catch (error) {
      return 'Date invalide';
    }
  };

  const getTempsEcoule = (date: Date | any) => {
    try {
      let dateObj: Date;
      
      if (date && typeof date.toDate === 'function') {
        dateObj = date.toDate();
      } else if (date instanceof Date) {
        dateObj = date;
      } else if (date) {
        dateObj = new Date(date);
      } else {
        return 'Date inconnue';
      }
      
      if (isNaN(dateObj.getTime())) {
        return 'Date invalide';
      }
      
      const now = new Date();
      const diff = now.getTime() - dateObj.getTime();
      const jours = Math.floor(diff / (1000 * 60 * 60 * 24));
      
      if (jours === 0) return "Aujourd'hui";
      if (jours === 1) return "Hier";
      if (jours < 7) return `Il y a ${jours} jour(s)`;
      if (jours < 30) return `Il y a ${Math.floor(jours / 7)} semaine(s)`;
      return `Il y a ${Math.floor(jours / 30)} mois`;
    } catch (error) {
      return 'Temps inconnu';
    }
  };

  const getVehiculeIcon = (nom: string): string => {
    if (nom.includes('VSAV')) return '🚑';
    if (nom.includes('FPT')) return '🚒';
    if (nom.includes('CCF')) return '🚛';
    if (nom.includes('VTU')) return '🚐';
    return '🚗';
  };

  const getStatutColor = (statut: string) => {
    switch (statut) {
      case 'OK': return 'success';
      case 'DEFAUT': return 'danger';
      case 'NON_VERIFIE': return 'warning';
      default: return 'secondary';
    }
  };

  const getStatutLabel = (statut: string) => {
    switch (statut) {
      case 'OK': return '✓ OK';
      case 'DEFAUT': return '⚠ Défaut(s)';
      case 'NON_VERIFIE': return '? Non vérifié';
      default: return statut;
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleVoirInventaire = () => {
    window.open(`/?vehicule=${vehicule.vehiculeId}`, '_blank');
  };

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-content">
        <div className="modal-header">
          <div className="modal-title">
            <span className="vehicule-icon-modal">{getVehiculeIcon(vehicule.vehiculeName)}</span>
            <h2>{vehicule.vehiculeName}</h2>
            <span className={`statut-badge-modal ${getStatutColor(vehicule.statut)}`}>
              {getStatutLabel(vehicule.statut)}
            </span>
          </div>
          <button className="modal-close" onClick={onClose} title="Fermer">
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="detail-section">
            <h3>📅 Dernière vérification</h3>
            {vehicule.dernierInventaire ? (
              <div className="verification-details">
                <div className="detail-row">
                  <span className="detail-label">Date et heure :</span>
                  <span className="detail-value">
                    {formatDate(vehicule.dernierInventaire.date)}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Agent :</span>
                  <span className="detail-value">
                    {vehicule.dernierInventaire.agent}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Il y a :</span>
                  <span className="detail-value temps-ecoule-modal">
                    {getTempsEcoule(vehicule.dernierInventaire.date)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="no-verification-modal">
                <p>❌ Aucune vérification effectuée</p>
              </div>
            )}
          </div>

          {vehicule.defauts.length > 0 && (
            <div className="detail-section">
              <h3>⚠️ Défauts détectés ({vehicule.defauts.length})</h3>
              <div className="defauts-modal-list">
                {vehicule.defauts.map((defaut, index) => (
                  <div key={index} className="defaut-modal-item">
                    <div className="defaut-modal-nom">{defaut.nom}</div>
                    <div className="defaut-modal-chemin">{defaut.chemin}</div>
                    {defaut.details && (
                      <div className="defaut-modal-details">{defaut.details}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {vehicule.defauts.length === 0 && vehicule.dernierInventaire && (
            <div className="detail-section">
              <h3>✅ État du véhicule</h3>
              <div className="no-defauts-modal">
                <p>Aucun défaut détecté lors de la dernière vérification</p>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-modal btn-secondary" onClick={onClose}>
            Fermer
          </button>
          <button className="btn-modal btn-primary" onClick={handleVoirInventaire}>
            📋 Voir l'inventaire complet
          </button>
        </div>
      </div>
    </div>
  );
};

export default VehiculeDetailModal;

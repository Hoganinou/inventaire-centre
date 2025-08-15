import React from 'react';
import type { InventaireRecord } from '../models/inventaire-record';

interface Props {
  inventaire: InventaireRecord;
  onClose: () => void;
}

const InventaireModal: React.FC<Props> = ({ inventaire, onClose }) => {
  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <h2>📋 Détail de l'inventaire</h2>
            <button className="modal-close" onClick={onClose}>×</button>
          </div>
          <div className="modal-subtitle">
            <span className="modal-vehicule">{inventaire.vehiculeName}</span>
            <span className="modal-date">{formatDate(inventaire.dateInventaire)}</span>
          </div>
        </div>

        <div className="modal-body">
          {/* Informations générales */}
          <div className="modal-section">
            <h3>📊 Résumé</h3>
            <div className="modal-stats">
              <div className="stat-item">
                <div className="stat-icon">👤</div>
                <div className="stat-details">
                  <div className="stat-label">Agent</div>
                  <div className="stat-value">{inventaire.agent}</div>
                </div>
              </div>
              
              <div className="stat-item">
                <div className="stat-icon">📈</div>
                <div className="stat-details">
                  <div className="stat-label">Progression</div>
                  <div className="stat-value">{inventaire.progressPercent}%</div>
                </div>
              </div>
              
              <div className="stat-item">
                <div className="stat-icon">✅</div>
                <div className="stat-details">
                  <div className="stat-label">Validés</div>
                  <div className="stat-value">{inventaire.materielValides}/{inventaire.totalMateriels}</div>
                </div>
              </div>
              
              <div className="stat-item">
                <div className="stat-icon">⚠️</div>
                <div className="stat-details">
                  <div className="stat-label">Défauts</div>
                  <div className="stat-value">{inventaire.defauts.length}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Barre de progression */}
          <div className="modal-section">
            <div className="modal-progress">
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${inventaire.progressPercent}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Défauts détaillés */}
          {inventaire.defauts.length > 0 && (
            <div className="modal-section">
              <h3>🔍 Défauts signalés</h3>
              <div className="modal-defauts">
                {inventaire.defauts.map((defaut, index) => (
                  <div key={`${defaut.chemin}-${defaut.nom}-${index}`} className="modal-defaut-item">
                    <div className="defaut-icon">
                      {defaut.present ? (defaut.fonctionne === false ? '🔧' : '❓') : '❌'}
                    </div>
                    <div className="defaut-info">
                      <div className="defaut-path">{defaut.chemin}</div>
                      <div className="defaut-name">{defaut.nom}</div>
                      {defaut.details && <div className="defaut-details">{defaut.details}</div>}
                    </div>
                    <div className="defaut-status">
                      {!defaut.present ? 'Absent' : 
                       defaut.fonctionne === false ? 'Défaillant' : 'Autre problème'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Observation */}
          {inventaire.observation && (
            <div className="modal-section">
              <h3>💬 Observation</h3>
              <div className="modal-observation">
                {inventaire.observation}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-modal-close" onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

export default InventaireModal;

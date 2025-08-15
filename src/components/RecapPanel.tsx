import React, { useState, useEffect } from 'react';
import { InventaireService } from '../firebase/inventaire-service';
import InventaireModal from './InventaireModal';
import type { InventaireSummary, InventaireRecord } from '../models/inventaire-record';
import type { Vehicule } from '../models/inventaire';

interface Props {
  vehicule: Vehicule;
  onStartInventaire: () => void;
}

const RecapPanel: React.FC<Props> = ({ vehicule, onStartInventaire }) => {
  const [summary, setSummary] = useState<InventaireSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedInventaire, setSelectedInventaire] = useState<InventaireRecord | null>(null);

  useEffect(() => {
    const loadSummary = async () => {
      try {
        setLoading(true);
        const data = await InventaireService.getInventaireSummary(vehicule.id);
        setSummary(data);
      } catch (error) {
        console.warn('Firestore pas encore configuré:', error);
        // Affichage en mode démo si Firestore n'est pas configuré
        setError('Base de données non configurée - Mode démo');
      } finally {
        setLoading(false);
      }
    };

    loadSummary();
  }, [vehicule.id]);

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  if (loading) {
    return (
      <div className="recap-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Chargement des données...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="recap-container">
      <h2 className="recap-title">📋 {vehicule.nom}</h2>
      <p className="recap-subtitle">Résumé des vérifications précédentes</p>

      {summary?.dernierInventaire ? (
        <div className="recap-content">
          {/* État général */}
          <div className="recap-status">
            <div className={`status-card ${summary.nombreDefauts === 0 ? 'status-ok' : 'status-warning'}`}>
              <div className="status-icon">
                {summary.nombreDefauts === 0 ? '✅' : '⚠️'}
              </div>
              <div className="status-text">
                <h3>{summary.nombreDefauts === 0 ? 'Véhicule opérationnel' : `${summary.nombreDefauts} défaut(s) signalé(s)`}</h3>
                <p>Dernier contrôle : {formatDate(summary.dernierInventaire.dateInventaire)}</p>
                <p>Agent : {summary.dernierInventaire.agent}</p>
              </div>
            </div>
          </div>

          {/* Progression */}
          <div className="recap-progress">
            <div className="progress-header">
              <span>Progression du dernier inventaire</span>
              <span>{summary.dernierInventaire.progressPercent}%</span>
            </div>
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${summary.dernierInventaire.progressPercent}%` }}
              ></div>
            </div>
            <div className="progress-details">
              {summary.dernierInventaire.materielValides}/{summary.dernierInventaire.totalMateriels} matériels vérifiés
            </div>
          </div>

          {/* Défauts détaillés */}
          {summary.nombreDefauts > 0 && (
            <div className="recap-defauts">
              <h4>🔍 Défauts signalés :</h4>
              <div className="defauts-list">
                {summary.dernierInventaire.defauts.map((defaut) => (
                  <div key={`${defaut.chemin}-${defaut.nom}`} className="defaut-item">
                    <div className="defaut-icon">
                      {defaut.present ? (defaut.fonctionne === false ? '🔧' : '❓') : '❌'}
                    </div>
                    <div className="defaut-details">
                      <div className="defaut-path">{defaut.chemin}</div>
                      <div className="defaut-name">{defaut.nom}</div>
                      {defaut.details && <div className="defaut-extra">{defaut.details}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Observations */}
          {summary.dernierInventaire.observation && (
            <div className="recap-observation">
              <h4>📝 Observations :</h4>
              <div className="observation-text">
                {summary.dernierInventaire.observation}
              </div>
            </div>
          )}

          {/* Historique récent */}
          {summary.historique.length > 1 && (
            <div className="recap-historique">
              <h4>📊 Historique récent :</h4>
              <div className="historique-list">
                {summary.historique.slice(1, 4).map((record) => (
                  <div 
                    key={record.id} 
                    className="historique-item historique-clickable"
                    onClick={() => setSelectedInventaire(record)}
                    title="Cliquer pour voir les détails"
                  >
                    <div className="historique-date">
                      {formatDate(record.dateInventaire)}
                    </div>
                    <div className="historique-agent">{record.agent}</div>
                    <div className="historique-defauts">
                      {record.defauts.length} défaut(s)
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="recap-no-data">
          <div className="no-data-icon">🆕</div>
          <h3>Première vérification</h3>
          <p>Aucune donnée d'inventaire disponible pour ce véhicule.</p>
          <p>Commencez dès maintenant la première vérification !</p>
        </div>
      )}

      {/* Actions */}
      <div className="recap-actions">
        <button 
          className="btn-start-inventaire"
          onClick={onStartInventaire}
        >
          <span className="btn-icon">🚀</span>
          <span className="btn-text">Commencer la vérification</span>
        </button>
      </div>

      {/* Modal pour afficher les détails d'un inventaire */}
      {selectedInventaire && (
        <InventaireModal 
          inventaire={selectedInventaire}
          onClose={() => setSelectedInventaire(null)}
        />
      )}
    </div>
  );
};

export default RecapPanel;

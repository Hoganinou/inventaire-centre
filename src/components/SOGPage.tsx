import React, { useState, useEffect } from 'react';
import { generateSOGData } from '../firebase/sog-service';
import type { SOGData, SOGVehiculeStatus } from '../models/sog';
import VehiculeDetailModal from './VehiculeDetailModal';
import MensuelModal from './MensuelModal';
import './SOGPage.css';

interface SOGPageProps {
  onReturnHome?: () => void;
}

const SOGPage: React.FC<SOGPageProps> = ({ onReturnHome }) => {
  const [sogData, setSogData] = useState<SOGData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVehicule, setSelectedVehicule] = useState<SOGVehiculeStatus | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMensuelVehicule, setSelectedMensuelVehicule] = useState<{id: string, nom: string} | null>(null);


  useEffect(() => {
    loadSOGData();
  }, []);

  const loadSOGData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await generateSOGData();
      setSogData(data);
    } catch (err) {
      console.error('Erreur lors du chargement du SOG:', err);
      setError('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
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

  const handleOpenModal = (vehicule: SOGVehiculeStatus) => {
    setSelectedVehicule(vehicule);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedVehicule(null);
  };

  const handleShowMensuel = (vehiculeId: string, vehiculeNom: string) => {
    setSelectedMensuelVehicule({ id: vehiculeId, nom: vehiculeNom });
  };

  const handleCloseMensuelModal = () => {
    setSelectedMensuelVehicule(null);
  };

  const getMensuelStatutColor = (statut: string) => {
    switch (statut) {
      case 'OK': return 'success';
      case 'ATTENTION': return 'warning';
      case 'DEFAUT': return 'danger';
      default: return 'secondary';
    }
  };

  const formatDate = (date: Date | any) => {
    try {
      let dateObj: Date;
      
      // Si c'est un Timestamp Firebase
      if (date && typeof date.toDate === 'function') {
        dateObj = date.toDate();
      }
      // Si c'est déjà un objet Date
      else if (date instanceof Date) {
        dateObj = date;
      }
      // Si c'est une string ou un nombre
      else if (date) {
        dateObj = new Date(date);
      }
      // Si c'est null/undefined
      else {
        return 'Date invalide';
      }
      
      // Vérifier si la date est valide
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
      console.error('Erreur formatage date:', error, date);
      return 'Date invalide';
    }
  };

  if (loading) {
    return (
      <div className="sog-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Chargement du SOG...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sog-container">
        <div className="error-message">
          <h3>Erreur</h3>
          <p>{error}</p>
          <button onClick={loadSOGData} className="btn btn-primary">
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  if (!sogData) {
    return (
      <div className="sog-container">
        <div className="no-data">
          <p>Aucune donnée disponible</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sog-container">
      <div className="sog-header">
        <div className="sog-header-left">
          {onReturnHome && (
            <button onClick={onReturnHome} className="btn btn-back">
              ← Retour
            </button>
          )}
          <h1>État Opérationnel des Véhicules (SOG)</h1>
        </div>
        <div className="sog-actions">
          <span className="last-update">
            Généré le {formatDate(sogData.dateGeneration)}
          </span>
          <button onClick={loadSOGData} className="btn btn-secondary">
            🔄 Actualiser
          </button>
        </div>
      </div>

      <div className="sog-table-container">
        <table className="sog-table">
          <thead>
            <tr>
              <th>Véhicule</th>
              <th>Statut</th>
              <th>Date de vérification</th>
              <th>Contrôle mensuel</th>
              <th>Défauts</th>
              <th>Observations</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sogData.vehicules.map((vehicule: SOGVehiculeStatus) => (
              <tr key={vehicule.vehiculeId} className={`row-${getStatutColor(vehicule.statut)}`}>
                <td className="vehicule-name-cell">
                  <div className="vehicule-name-content">
                    <span className="vehicule-name">{vehicule.vehiculeName}</span>
                  </div>
                </td>
                
                <td className="statut-cell">
                  <span className={`statut-badge-table ${getStatutColor(vehicule.statut)}`}>
                    {getStatutLabel(vehicule.statut)}
                  </span>
                </td>
                
                <td className="verification-cell">
                  {vehicule.dernierInventaire ? (
                    <div className="verification-info">
                      <div className="date-time">
                        {formatDate(vehicule.dernierInventaire.date)}
                      </div>
                      <div className="agent-info">
                        par {vehicule.dernierInventaire.agent}
                      </div>
                    </div>
                  ) : (
                    <span className="no-verification-text">❌ Jamais vérifié</span>
                  )}
                </td>
                
                <td className="mensuel-cell">
                  {vehicule.dernierMensuel ? (
                    <div className="mensuel-info">
                      <div className="mensuel-date">
                        {formatDate(vehicule.dernierMensuel.date)}
                      </div>
                      <div className="mensuel-details">
                        <span className={`mensuel-statut ${getMensuelStatutColor(vehicule.dernierMensuel.statut)}`}>
                          {vehicule.dernierMensuel.statut}
                        </span>
                        <span className="mensuel-km">
                          {vehicule.dernierMensuel.kilometres.toLocaleString()} km
                        </span>
                      </div>
                      <button 
                        className="btn-mensuel-details"
                        onClick={() => handleShowMensuel(vehicule.vehiculeId, vehicule.vehiculeName)}
                        title="Voir le détail du contrôle mensuel"
                      >
                        📋
                      </button>
                    </div>
                  ) : (
                    <span className="no-mensuel">❌ Aucun contrôle</span>
                  )}
                </td>
                
                <td className="defauts-cell">
                  {vehicule.defauts.length > 0 ? (
                    <div className="defauts-summary">
                      <div className="defauts-count">
                        {vehicule.defauts.length} défaut{vehicule.defauts.length > 1 ? 's' : ''}
                      </div>
                      <div className="defauts-list-compact">
                        {vehicule.defauts.map((defaut, index) => (
                          <span key={index} className="defaut-item-compact" title={defaut.chemin}>
                            {defaut.nom}
                          </span>
                        )).reduce((prev, curr, index) => 
                          index === 0 ? [curr] : [...prev, ', ', curr], [] as any[]
                        )}
                      </div>
                    </div>
                  ) : (
                    <span className="no-defauts">✓ Aucun</span>
                  )}
                </td>
                
                <td className="observations-cell">
                  {vehicule.dernierInventaire?.observation ? (
                    <div className="observation-text" title={vehicule.dernierInventaire.observation}>
                      {vehicule.dernierInventaire.observation}
                    </div>
                  ) : (
                    <span className="no-observation">-</span>
                  )}
                </td>
                
                <td className="actions-cell">
                  <button 
                    className="btn-action btn-details"
                    onClick={() => handleOpenModal(vehicule)}
                    title="Voir détails"
                  >
                    👁️
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Affichage en cartes pour mobile */}
      <div className="sog-cards-container">
        {sogData.vehicules.map((vehicule: SOGVehiculeStatus) => (
          <div key={vehicule.vehiculeId} className={`sog-card card-${getStatutColor(vehicule.statut)}`}>
            <div className="card-header">
              <span className="card-vehicule-name">{vehicule.vehiculeName}</span>
              <span className={`card-statut ${getStatutColor(vehicule.statut)}`}>
                {getStatutLabel(vehicule.statut)}
              </span>
            </div>
            
            <div className="card-content">
              <div className="card-row">
                <span className="card-label">Vérification :</span>
                <div className="card-value">
                  {vehicule.dernierInventaire ? (
                    <>
                      <div className="card-date">
                        {formatDate(vehicule.dernierInventaire.date)}
                      </div>
                      <div className="card-agent">
                        par {vehicule.dernierInventaire.agent}
                      </div>
                    </>
                  ) : (
                    <span className="card-no-data">❌ Jamais vérifié</span>
                  )}
                </div>
              </div>
              
              {vehicule.dernierMensuel && (
                <div className="card-row">
                  <span className="card-label">Mensuel :</span>
                  <div className="card-value">
                    <div className="card-date">
                      {formatDate(vehicule.dernierMensuel.date)}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center', marginTop: '2px' }}>
                      <span className={`mensuel-statut ${getMensuelStatutColor(vehicule.dernierMensuel.statut)}`}>
                        {vehicule.dernierMensuel.statut}
                      </span>
                      <span className="mensuel-km">
                        {vehicule.dernierMensuel.kilometres.toLocaleString()} km
                      </span>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="card-row">
                <span className="card-label">Défauts :</span>
                <div className="card-value">
                  {vehicule.defauts.length > 0 ? (
                    <div>
                      <div style={{ color: '#dc3545', fontWeight: '600', fontSize: '0.75rem' }}>
                        {vehicule.defauts.length} défaut{vehicule.defauts.length > 1 ? 's' : ''}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#6c757d', marginTop: '2px' }}>
                        {vehicule.defauts.slice(0, 2).map(d => d.nom).join(', ')}
                        {vehicule.defauts.length > 2 && '...'}
                      </div>
                    </div>
                  ) : (
                    <span className="card-success-text">✓ Aucun</span>
                  )}
                </div>
              </div>
              
              {vehicule.dernierInventaire?.observation && (
                <div className="card-row">
                  <span className="card-label">Observations :</span>
                  <div className="card-value" style={{ fontSize: '0.75rem', lineHeight: '1.3' }}>
                    {vehicule.dernierInventaire.observation.length > 50 
                      ? `${vehicule.dernierInventaire.observation.substring(0, 50)}...`
                      : vehicule.dernierInventaire.observation
                    }
                  </div>
                </div>
              )}
            </div>
            
            <div className="card-actions">
              <button 
                className="card-btn"
                onClick={() => handleOpenModal(vehicule)}
              >
                👁️ Voir détails
              </button>
              {vehicule.dernierMensuel && (
                <button 
                  className="card-btn"
                  onClick={() => handleShowMensuel(vehicule.vehiculeId, vehicule.vehiculeName)}
                  style={{ marginLeft: '8px' }}
                >
                  📋 Contrôle mensuel
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      
      <VehiculeDetailModal
        vehicule={selectedVehicule}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />
      
      {selectedMensuelVehicule && (
        <MensuelModal
          vehiculeId={selectedMensuelVehicule.id}
          vehiculeNom={selectedMensuelVehicule.nom}
          onClose={handleCloseMensuelModal}
        />
      )}
    </div>
  );
};

export default SOGPage;

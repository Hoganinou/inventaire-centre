import React, { useState, useEffect } from 'react';
import type { ControleMensuel } from '../models/mensuel';
import MensuelService from '../firebase/mensuel-service';
import './MensuelModal.css';

interface MensuelModalProps {
  vehiculeId: string;
  vehiculeNom: string;
  onClose: () => void;
}

const MensuelModal: React.FC<MensuelModalProps> = ({ vehiculeId, vehiculeNom, onClose }) => {
  const [mensuel, setMensuel] = useState<ControleMensuel | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDernierMensuel = async () => {
      try {
        setLoading(true);
        const dernierMensuel = await MensuelService.getDernierMensuel(vehiculeId);
        setMensuel(dernierMensuel);
      } catch (error) {
        console.error('Erreur chargement dernier mensuel:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDernierMensuel();
  }, [vehiculeId]);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatutColor = (statut: string) => {
    switch (statut) {
      case 'OK': return '#28a745';
      case 'ATTENTION': return '#ffc107';
      case 'DEFAUT': return '#dc3545';
      default: return '#6c757d';
    }
  };

  const getStatutIcon = (statut: string) => {
    switch (statut) {
      case 'OK': return '✓';
      case 'ATTENTION': return '⚠️';
      case 'DEFAUT': return '❌';
      case 'A_COMPLETER': return '🔄';
      case 'A_CHANGER': return '🔧';
      default: return '❓';
    }
  };

  if (loading) {
    return (
      <div className="mensuel-modal">
        <div className="mensuel-modal-content">
          <div className="loading">Chargement...</div>
        </div>
      </div>
    );
  }

  if (!mensuel) {
    return (
      <div className="mensuel-modal">
        <div className="mensuel-modal-content">
          <div className="mensuel-modal-header">
            <h3>Contrôle Mensuel - {vehiculeNom}</h3>
            <button className="btn-close" onClick={onClose}>×</button>
          </div>
          <div className="no-mensuel">
            <p>Aucun contrôle mensuel enregistré pour ce véhicule.</p>
            <button className="btn-primary" onClick={onClose}>Fermer</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mensuel-modal">
      <div className="mensuel-modal-content">
        <div className="mensuel-modal-header">
          <h3>Dernier Contrôle Mensuel - {vehiculeNom}</h3>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>

        <div className="mensuel-modal-body">
          {/* Informations générales */}
          <div className="mensuel-info-section">
            <div className="mensuel-info-grid">
              <div className="info-item">
                <label>Date du contrôle</label>
                <span>{formatDate(mensuel.dateMensuel)}</span>
              </div>
              <div className="info-item">
                <label>Agent</label>
                <span>{mensuel.agent}</span>
              </div>
              <div className="info-item">
                <label>Kilométrage</label>
                <span>{mensuel.kilometres.toLocaleString()} km</span>
              </div>
              <div className="info-item">
                <label>Statut global</label>
                <span 
                  className="statut-badge"
                  style={{ backgroundColor: getStatutColor(mensuel.statut) }}
                >
                  {getStatutIcon(mensuel.statut)} {mensuel.statut}
                </span>
              </div>
            </div>
          </div>

          {/* Contrôles détaillés */}
          <div className="controles-section">
            {/* Liquides */}
            <div className="controle-group">
              <h4>🛢️ Liquides</h4>
              <div className="controle-grid">
                {Object.entries(mensuel.liquides).map(([liquide, statut]) => (
                  <div key={liquide} className="controle-item">
                    <span className="controle-label">
                      {liquide.replace(/([A-Z])/g, ' $1').toLowerCase()}
                    </span>
                    <span 
                      className="controle-statut"
                      style={{ color: getStatutColor(statut) }}
                    >
                      {getStatutIcon(statut)} {statut.replace('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Balais */}
            <div className="controle-group">
              <h4>🧽 Balais d'essuie-glace</h4>
              <div className="controle-grid">
                {Object.entries(mensuel.balaisEssuieGlace).map(([position, statut]) => (
                  <div key={position} className="controle-item">
                    <span className="controle-label">{position}</span>
                    <span 
                      className="controle-statut"
                      style={{ color: getStatutColor(statut || 'OK') }}
                    >
                      {getStatutIcon(statut || 'OK')} {(statut || 'OK').replace('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Pneus */}
            <div className="controle-group">
              <h4>🛞 Pression des pneus</h4>
              <div className="pneus-info">
                <p><strong>Pression recommandée:</strong> {mensuel.pressionPneus.pressionRecommandee} bars</p>
                <div className="controle-grid">
                  {['avantGauche', 'avantDroit', 'arriereGauche', 'arriereDroit'].map(position => {
                    const pression = mensuel.pressionPneus[position as keyof typeof mensuel.pressionPneus];
                    const diff = Math.abs(pression - mensuel.pressionPneus.pressionRecommandee);
                    let statut = 'OK';
                    if (diff > 0.5) statut = 'DEFAUT';
                    else if (diff > 0.2) statut = 'ATTENTION';
                    
                    return (
                      <div key={position} className="controle-item">
                        <span className="controle-label">
                          {position.replace(/([A-Z])/g, ' $1').toLowerCase()}
                        </span>
                        <span 
                          className="controle-statut"
                          style={{ color: getStatutColor(statut) }}
                        >
                          {pression} bars {getStatutIcon(statut)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Lavage */}
            <div className="controle-group">
              <h4>🧼 Lavage</h4>
              <div className="lavage-info">
                {mensuel.lavage.effectue ? (
                  <span className="lavage-effectue">
                    ✅ {mensuel.lavage.typelavage.replace('_', ' ')}
                  </span>
                ) : (
                  <span className="lavage-non-effectue">❌ Non effectué</span>
                )}
              </div>
            </div>
          </div>

          {/* Défauts */}
          {mensuel.defauts.length > 0 && (
            <div className="defauts-section">
              <h4>⚠️ Défauts détectés ({mensuel.defauts.length})</h4>
              <div className="defauts-list">
                {mensuel.defauts.map((defaut, index) => (
                  <div key={index} className="defaut-item">
                    <div className="defaut-header">
                      <span className="defaut-categorie">{defaut.categorie}</span>
                      <span 
                        className="defaut-gravite"
                        style={{ 
                          backgroundColor: 
                            defaut.gravite === 'GRAVE' ? '#dc3545' :
                            defaut.gravite === 'MOYEN' ? '#ffc107' : '#6c757d'
                        }}
                      >
                        {defaut.gravite}
                      </span>
                    </div>
                    <p className="defaut-description">{defaut.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Observations */}
          {mensuel.observations && (
            <div className="observations-section">
              <h4>📝 Observations</h4>
              <p className="observations-text">{mensuel.observations}</p>
            </div>
          )}
        </div>

        <div className="mensuel-modal-footer">
          <button className="btn-primary" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
  );
};

export default MensuelModal;

import React, { useState, useEffect } from 'react';
import type { SOGVehiculeStatus } from '../models/sog';
import type { InventaireRecord } from '../models/inventaire-record';
import type { Vehicule, Section, Materiel } from '../models/inventaire';
import { InventaireService } from '../firebase/inventaire-service';
import { VehiculeConfigService } from '../firebase/vehicule-config-service';
import './VehiculeDetailModal.css';

type ModalView = 'detail' | 'historique' | 'inventaire-complet';

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
  const [currentView, setCurrentView] = useState<ModalView>('detail');
  const [historique, setHistorique] = useState<InventaireRecord[]>([]);
  const [vehiculeConfig, setVehiculeConfig] = useState<Vehicule | null>(null);
  const [loadingHistorique, setLoadingHistorique] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [selectedHistorique, setSelectedHistorique] = useState<InventaireRecord | null>(null);

  // Reset view when modal opens/closes or vehicle changes
  useEffect(() => {
    if (isOpen) {
      setCurrentView('detail');
      setHistorique([]);
      setVehiculeConfig(null);
      setSelectedHistorique(null);
    }
  }, [isOpen, vehicule?.vehiculeId]);

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
      if (isNaN(dateObj.getTime())) return 'Date invalide';
      return new Intl.DateTimeFormat('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      }).format(dateObj);
    } catch { return 'Date invalide'; }
  };

  const formatDateShort = (date: Date | any) => {
    try {
      let dateObj: Date;
      if (date && typeof date.toDate === 'function') dateObj = date.toDate();
      else if (date instanceof Date) dateObj = date;
      else if (date) dateObj = new Date(date);
      else return '?';
      if (isNaN(dateObj.getTime())) return '?';
      return new Intl.DateTimeFormat('fr-FR', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      }).format(dateObj);
    } catch { return '?'; }
  };

  const getTempsEcoule = (date: Date | any) => {
    try {
      let dateObj: Date;
      if (date && typeof date.toDate === 'function') dateObj = date.toDate();
      else if (date instanceof Date) dateObj = date;
      else if (date) dateObj = new Date(date);
      else return 'Date inconnue';
      if (isNaN(dateObj.getTime())) return 'Date invalide';
      const now = new Date();
      const diff = now.getTime() - dateObj.getTime();
      const jours = Math.floor(diff / (1000 * 60 * 60 * 24));
      if (jours === 0) return "Aujourd'hui";
      if (jours === 1) return "Hier";
      if (jours < 7) return `Il y a ${jours} jour(s)`;
      if (jours < 30) return `Il y a ${Math.floor(jours / 7)} semaine(s)`;
      return `Il y a ${Math.floor(jours / 30)} mois`;
    } catch { return 'Temps inconnu'; }
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
    if (e.target === e.currentTarget) onClose();
  };

  // Load historique
  const handleShowHistorique = async () => {
    if (historique.length === 0) {
      setLoadingHistorique(true);
      try {
        const data = await InventaireService.getHistorique(vehicule.vehiculeId);
        setHistorique(data);
      } catch (err) {
        console.error('Erreur chargement historique:', err);
      } finally {
        setLoadingHistorique(false);
      }
    }
    setCurrentView('historique');
  };

  // Load vehicle config for inventaire complet
  const handleShowInventaireComplet = async () => {
    if (!vehiculeConfig) {
      setLoadingConfig(true);
      try {
        const config = await VehiculeConfigService.getVehiculeConfig(vehicule.vehiculeId);
        setVehiculeConfig(config);
      } catch (err) {
        console.error('Erreur chargement config véhicule:', err);
      } finally {
        setLoadingConfig(false);
      }
    }
    setCurrentView('inventaire-complet');
  };

  // Render a material item
  const renderMateriel = (materiel: Materiel, depth: number = 0) => {
    const typeLabel = () => {
      switch (materiel.type) {
        case 'quantite': return `Qté: ${materiel.valeur ?? '?'}`;
        case 'checkbox': case 'checkbox-presence': case 'checkbox-fonction': case 'checkbox-ok': return '☑';
        case 'presence-teste': return '☑⚡';
        case 'presence-plombe': return '☑🔒';
        case 'radio': return 'RAS / Défaut';
        case 'niveau': return '🔋 Niveau';
        case 'etat': return '📊 État';
        case 'date': return '📅 Date';
        case 'texte-libre': return '📝 Texte';
        case 'photo': return '📷 Photo';
        default: return '☑';
      }
    };
    return (
      <div key={materiel.id} className="inv-complet-materiel" style={{ paddingLeft: `${depth * 16}px` }}>
        <span className="inv-complet-materiel-nom">{materiel.nom}</span>
        <span className="inv-complet-materiel-type">{typeLabel()}</span>
      </div>
    );
  };

  // Render a section recursively
  const renderSection = (section: Section, depth: number = 0) => {
    return (
      <div key={section.id} className={`inv-complet-section depth-${Math.min(depth, 3)}`}>
        <div className="inv-complet-section-header" style={{ paddingLeft: `${depth * 12}px` }}>
          {depth === 0 ? '📂' : depth === 1 ? '📁' : '📄'} {section.nom}
          {section.materiels && <span className="inv-complet-count">{section.materiels.length} élément{section.materiels.length > 1 ? 's' : ''}</span>}
        </div>
        {section.materiels && section.materiels.map(m => renderMateriel(m, depth))}
        {section.sousSections && section.sousSections.map(ss => renderSection(ss, depth + 1))}
      </div>
    );
  };

  // Count total items in a vehicle config
  const countMateriels = (sections: Section[]): number => {
    let total = 0;
    const count = (s: Section) => {
      total += s.materiels?.length || 0;
      s.sousSections?.forEach(count);
    };
    sections.forEach(count);
    return total;
  };

  // ---- DETAIL VIEW ----
  const renderDetailView = () => (
    <>
      <div className="modal-body">
        <div className="detail-section">
          <h3>📅 Dernière vérification</h3>
          {vehicule.dernierInventaire ? (
            <div className="verification-details">
              <div className="detail-row">
                <span className="detail-label">Date et heure :</span>
                <span className="detail-value">{formatDate(vehicule.dernierInventaire.date)}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Agent :</span>
                <span className="detail-value">{vehicule.dernierInventaire.agent}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Il y a :</span>
                <span className="detail-value temps-ecoule-modal">{getTempsEcoule(vehicule.dernierInventaire.date)}</span>
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
                  {defaut.details && <div className="defaut-modal-details">{defaut.details}</div>}
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
        <button className="btn-modal btn-outline" onClick={onClose}>
          Fermer
        </button>
        <div className="modal-footer-actions">
          <button className="btn-modal btn-secondary" onClick={handleShowHistorique}>
            📜 Historique
          </button>
          <button className="btn-modal btn-primary" onClick={handleShowInventaireComplet}>
            📋 Inventaire complet
          </button>
        </div>
      </div>
    </>
  );

  // ---- HISTORIQUE VIEW ----
  const renderHistoriqueView = () => (
    <>
      <div className="modal-body">
        {loadingHistorique ? (
          <div className="loading-view">
            <div className="loading-spinner"></div>
            <p>Chargement de l'historique...</p>
          </div>
        ) : historique.length === 0 ? (
          <div className="no-verification-modal">
            <p>📝 Aucun historique d'inventaire pour ce véhicule</p>
          </div>
        ) : selectedHistorique ? (
          // Detail of a specific historique entry
          <div className="historique-detail">
            <button className="btn-back-inline" onClick={() => setSelectedHistorique(null)}>
              ← Retour à la liste
            </button>
            <div className="historique-detail-header">
              <h3>📋 Inventaire du {formatDateShort(selectedHistorique.dateInventaire)}</h3>
              <div className="historique-detail-meta">
                <span>👤 {selectedHistorique.agent}</span>
                {selectedHistorique.agentRole && <span className="role-badge">{selectedHistorique.agentRole}</span>}
              </div>
            </div>

            <div className="historique-detail-stats">
              <div className="stat-card">
                <div className="stat-number">{selectedHistorique.materielValides}</div>
                <div className="stat-label">Validés</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{selectedHistorique.totalMateriels}</div>
                <div className="stat-label">Total</div>
              </div>
              <div className="stat-card stat-defauts">
                <div className="stat-number">{selectedHistorique.defauts.length}</div>
                <div className="stat-label">Défaut{selectedHistorique.defauts.length > 1 ? 's' : ''}</div>
              </div>
            </div>

            {selectedHistorique.observation && (
              <div className="historique-observation">
                <strong>💬 Observation :</strong> {selectedHistorique.observation}
              </div>
            )}

            {selectedHistorique.defauts.length > 0 && (
              <div className="detail-section">
                <h3>⚠️ Défauts ({selectedHistorique.defauts.length})</h3>
                <div className="defauts-modal-list">
                  {selectedHistorique.defauts.map((defaut, index) => (
                    <div key={index} className="defaut-modal-item">
                      <div className="defaut-modal-nom">{defaut.nom}</div>
                      <div className="defaut-modal-chemin">{defaut.chemin}</div>
                      {defaut.details && <div className="defaut-modal-details">{defaut.details}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedHistorique.defauts.length === 0 && (
              <div className="no-defauts-modal">
                <p>✅ Aucun défaut détecté lors de cet inventaire</p>
              </div>
            )}
          </div>
        ) : (
          // List of historique entries
          <div className="historique-list">
            <div className="historique-summary">
              📊 {historique.length} inventaire{historique.length > 1 ? 's' : ''} enregistré{historique.length > 1 ? 's' : ''}
            </div>
            {historique.map((record, index) => (
              <div
                key={record.id || index}
                className={`historique-item ${record.defauts.length > 0 ? 'has-defauts' : 'all-ok'}`}
                onClick={() => setSelectedHistorique(record)}
              >
                <div className="historique-item-left">
                  <div className="historique-date">{formatDateShort(record.dateInventaire)}</div>
                  <div className="historique-agent">👤 {record.agent}</div>
                </div>
                <div className="historique-item-right">
                  <div className={`historique-status ${record.defauts.length > 0 ? 'status-defaut' : 'status-ok'}`}>
                    {record.defauts.length > 0
                      ? `⚠ ${record.defauts.length} défaut${record.defauts.length > 1 ? 's' : ''}`
                      : '✓ RAS'}
                  </div>
                  <div className="historique-score">
                    {record.materielValides}/{record.totalMateriels}
                  </div>
                </div>
                <span className="historique-chevron">›</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="modal-footer">
        <button className="btn-modal btn-secondary" onClick={() => { setCurrentView('detail'); setSelectedHistorique(null); }}>
          ← Retour
        </button>
      </div>
    </>
  );

  // ---- INVENTAIRE COMPLET VIEW ----
  const renderInventaireCompletView = () => (
    <>
      <div className="modal-body">
        {loadingConfig ? (
          <div className="loading-view">
            <div className="loading-spinner"></div>
            <p>Chargement de l'inventaire...</p>
          </div>
        ) : !vehiculeConfig ? (
          <div className="no-verification-modal">
            <p>❌ Configuration du véhicule introuvable</p>
          </div>
        ) : (
          <div className="inv-complet-container">
            <div className="inv-complet-stats">
              <span>📦 {vehiculeConfig.sections.length} section{vehiculeConfig.sections.length > 1 ? 's' : ''}</span>
              <span>🔧 {countMateriels(vehiculeConfig.sections)} éléments au total</span>
            </div>
            {vehiculeConfig.sections.map(section => renderSection(section, 0))}
          </div>
        )}
      </div>

      <div className="modal-footer">
        <button className="btn-modal btn-secondary" onClick={() => setCurrentView('detail')}>
          ← Retour
        </button>
      </div>
    </>
  );

  // Header subtitle based on current view
  const getViewTitle = () => {
    switch (currentView) {
      case 'historique': return 'Historique des inventaires';
      case 'inventaire-complet': return 'Inventaire complet';
      default: return null;
    }
  };

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-content vehicule-detail-modal">
        <div className="modal-header">
          <div className="modal-title">
            <span className="vehicule-icon-modal">{getVehiculeIcon(vehicule.vehiculeName)}</span>
            <div className="modal-title-text">
              <h2>{vehicule.vehiculeName}</h2>
              {getViewTitle() && <span className="modal-view-subtitle">{getViewTitle()}</span>}
            </div>
            {currentView === 'detail' && (
              <span className={`statut-badge-modal ${getStatutColor(vehicule.statut)}`}>
                {getStatutLabel(vehicule.statut)}
              </span>
            )}
          </div>
          <button className="modal-close" onClick={onClose} title="Fermer">
            ✕
          </button>
        </div>

        {currentView === 'detail' && renderDetailView()}
        {currentView === 'historique' && renderHistoriqueView()}
        {currentView === 'inventaire-complet' && renderInventaireCompletView()}
      </div>
    </div>
  );
};

export default VehiculeDetailModal;

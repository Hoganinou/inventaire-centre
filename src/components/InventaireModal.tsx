import React, { useState } from 'react';
import type { InventaireRecord } from '../models/inventaire-record';

interface Props {
  inventaire: InventaireRecord;
  onClose: () => void;
}

interface PhotoModalState {
  isOpen: boolean;
  photos: string[];
  currentIndex: number;
  materielName: string;
}

const InventaireModal: React.FC<Props> = ({ inventaire, onClose }) => {
  const [photoModal, setPhotoModal] = useState<PhotoModalState>({
    isOpen: false,
    photos: [],
    currentIndex: 0,
    materielName: ''
  });

  // Fonction pour extraire les photos de tous les matériels des sections
  const extrairePhotosMateriels = (): { [materielId: string]: { photos: string[], nom: string, repare?: boolean } } => {
    const photosParMateriel: { [materielId: string]: { photos: string[], nom: string, repare?: boolean } } = {};
    
    if (!inventaire.sections) {
      return photosParMateriel;
    }

    const parcourirSection = (section: any, niveau = 0) => {
      if (section.materiels && Array.isArray(section.materiels)) {
        section.materiels.forEach((materiel: any) => {
          let toutesPhotos: string[] = [];
          
          if (materiel.photos && materiel.photos.length > 0) {
            toutesPhotos = [...toutesPhotos, ...materiel.photos];
          }
          
          if (materiel.photosAnciennnes && materiel.photosAnciennnes.length > 0) {
            toutesPhotos = [...toutesPhotos, ...materiel.photosAnciennnes];
          }
          
          if (materiel.photosMateriels && materiel.photosMateriels.length > 0) {
            toutesPhotos = [...toutesPhotos, ...materiel.photosMateriels];
          }
          
          if (toutesPhotos.length > 0) {
            // Normaliser correctement la clé en supprimant les accents et caractères spéciaux
            const cleNormalisee = materiel.nom
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '') // Supprimer les accents
              .replace(/[^a-z0-9]/g, '_')      // Remplacer les caractères spéciaux par _
              .replace(/_+/g, '_')             // Éviter les doubles _
              .replace(/^_|_$/g, '');          // Supprimer _ en début et fin
            
            photosParMateriel[cleNormalisee] = {
              photos: toutesPhotos,
              nom: materiel.nom,
              repare: materiel.repare // Inclure la propriété repare
            };
          }
        });
      }
      
      // Utiliser 'sousSections' qui est la vraie propriété selon les logs
      if (section.sousSections && Array.isArray(section.sousSections)) {
        section.sousSections.forEach((sousSection: any) => {
          parcourirSection(sousSection, niveau + 1);
        });
      }
    };

    inventaire.sections.forEach((section) => {
      parcourirSection(section, 1);
    });
    
    return photosParMateriel;
  };

  const photosMateriels = extrairePhotosMateriels();

  // Fonction pour trouver les photos d'un matériel par son nom
  const trouverPhotosParNom = (nomMateriel: string): string[] => {
    // Créer la clé normalisée comme dans extrairePhotosMateriels
    const cleNormalisee = nomMateriel
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Supprimer les accents
      .replace(/[^a-z0-9]/g, '_')      // Remplacer les caractères spéciaux par _
      .replace(/_+/g, '_')             // Éviter les doubles _
      .replace(/^_|_$/g, '');          // Supprimer _ en début et fin
    
    // Chercher avec la clé normalisée
    if (photosMateriels[cleNormalisee]) {
      return photosMateriels[cleNormalisee].photos;
    }
    
    // Si pas trouvé avec la clé normalisée, chercher par correspondance exacte du nom
    for (const [, data] of Object.entries(photosMateriels)) {
      if (data.nom === nomMateriel) {
        return data.photos;
      }
    }
    
    return [];
  };
  
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
    <div className="modal-backdrop" onClick={handleBackdropClick} style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backdropFilter: 'blur(4px)',
      padding: '1rem'
    }}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{
        backgroundColor: 'white',
        padding: 0,
        borderRadius: '1rem',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        maxWidth: '700px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'hidden'
      }}>
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

          {/* Défauts détaillés */}
          {(inventaire.defauts.length > 0 || Object.keys(photosMateriels).length > 0) && (
            <div className="modal-section">
              <h3>🔍 Défauts signalés</h3>
              <div className="modal-defauts">
                {/* Afficher d'abord SEULEMENT les matériels RÉPARÉS avec photos */}
                {Object.entries(photosMateriels)
                  .filter(([, data]) => data.repare === true) // Seulement les réparés
                  .map(([cle, data]) => {
                  return (
                    <div key={`photo-${cle}`} className="modal-defaut-item">
                      <div className="defaut-icon">
                        ✅ {/* Matériel réparé avec photo */}
                      </div>
                      <div className="defaut-info">
                        <div className="defaut-path">Extérieur &gt; Inspection carrosserie</div>
                        <div className="defaut-name">{data.nom}</div>
                        <div className="defaut-details">✅ Réparé - Photos disponibles</div>
                        
                        {/* Photos du matériel */}
                        <div className="defaut-photos" style={{ marginTop: '0.5rem' }}>
                          <div className="photos-grid" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {data.photos.map((photo: string, index: number) => (
                              <div key={index} className="photo-item">
                                <img 
                                  src={photo} 
                                  alt={`Photo ${index + 1} - ${data.nom}`}
                                  style={{
                                    width: '60px',
                                    height: '60px',
                                    objectFit: 'cover',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    border: '2px solid transparent'
                                  }}
                                  onClick={() => setPhotoModal({ 
                                    isOpen: true,
                                    photos: data.photos, 
                                    currentIndex: index,
                                    materielName: data.nom 
                                  })}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="defaut-status">Réparé</div>
                    </div>
                  );
                })}
                
                {/* Puis afficher les défauts normaux */}
                {inventaire.defauts.map((defaut, index) => {
                  // Chercher les photos dans les matériels actuels
                  const photosMateriels = trouverPhotosParNom(defaut.nom);
                  
                  // Ajouter les photos anciennes si elles existent
                  const photosAnciennnes = (defaut as any).photosAnciennnes || [];
                  
                  // Chercher aussi dans les propriétés alternatives
                  const photosAlternatives = (defaut as any).photos || [];
                  
                  // Combiner toutes les photos disponibles
                  const toutesPhotos = [...photosMateriels, ...photosAnciennnes, ...photosAlternatives];
                  
                  return (
                    <div key={`${defaut.chemin}-${defaut.nom}-${index}`} className="modal-defaut-item">
                      <div className="defaut-icon">
                        {(defaut as any).repare ? '✅' : 
                         defaut.present ? (defaut.fonctionne === false ? '🔧' : '❓') : '❌'}
                      </div>
                      <div className="defaut-info">
                        <div className="defaut-path">{defaut.chemin}</div>
                        <div className="defaut-name">{defaut.nom}</div>
                        {defaut.details && <div className="defaut-details">{defaut.details}</div>}
                        {(defaut as any).repare && <div className="defaut-details">✅ Réparé</div>}
                        
                        {/* Photos du défaut (actuelles et anciennes) */}
                        {toutesPhotos.length > 0 && (
                          <div className="defaut-photos">
                            <div className="photos-label">
                              📷 Photos ({toutesPhotos.length})
                              {photosAnciennnes.length > 0 && <span className="photos-anciennes-label"> - {photosAnciennnes.length} ancienne(s)</span>}
                            </div>
                            <div className="photos-grid">
                              {toutesPhotos.map((photoUrl, photoIndex) => (
                                <img
                                  key={photoIndex}
                                  src={photoUrl}
                                  alt={`Photo ${photoIndex + 1} - ${defaut.nom}`}
                                  className="defaut-photo-thumb"
                                  onClick={() => setPhotoModal({
                                    isOpen: true,
                                    photos: toutesPhotos,
                                    currentIndex: photoIndex,
                                    materielName: defaut.nom
                                  })}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="defaut-status">
                        {(defaut as any).repare ? 'Réparé' :
                         !defaut.present ? 'Absent' : 
                         defaut.fonctionne === false ? 'Défaillant' : 'Autre problème'}
                      </div>
                    </div>
                  );
                })}
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

        {/* Modal pour affichage des photos en grand */}
        {photoModal.isOpen && (
          <div 
            className="photo-modal-backdrop" 
            onClick={() => setPhotoModal(prev => ({ ...prev, isOpen: false }))}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.95)',
              zIndex: 99999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(8px)',
              padding: '1rem'
            }}
          >
            <div 
              className="photo-modal-content" 
              onClick={e => e.stopPropagation()}
              style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                maxWidth: '95vw',
                maxHeight: '95vh',
                overflow: 'hidden',
                boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <div className="photo-modal-header" style={{
                padding: '15px 20px',
                borderBottom: '1px solid #e0e0e0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#f8f9fa'
              }}>
                <h3 style={{ margin: 0, color: '#333', fontSize: '1.1em' }}>📷 Photos - {photoModal.materielName}</h3>
                <button 
                  className="photo-modal-close"
                  onClick={() => setPhotoModal(prev => ({ ...prev, isOpen: false }))}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '1.5em',
                    cursor: 'pointer',
                    color: '#666',
                    padding: '5px 10px',
                    borderRadius: '50%',
                    transition: 'all 0.2s ease'
                  }}
                >
                  ×
                </button>
              </div>
              
              <div className="photo-modal-body" style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '300px',
                maxHeight: '70vh',
                overflow: 'hidden'
              }}>
                <img
                  src={photoModal.photos[photoModal.currentIndex]}
                  alt={`Photo ${photoModal.currentIndex + 1} - ${photoModal.materielName}`}
                  className="photo-modal-img"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                    display: 'block'
                  }}
                />
                
                {photoModal.photos.length > 1 && (
                  <div className="photo-modal-nav" style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '1rem',
                    background: '#f8f9fa',
                    borderTop: '1px solid #e0e0e0'
                  }}>
                    <button
                      className="photo-nav-btn photo-nav-prev"
                      onClick={() => setPhotoModal(prev => ({
                        ...prev,
                        currentIndex: prev.currentIndex > 0 ? prev.currentIndex - 1 : prev.photos.length - 1
                      }))}
                      style={{
                        background: '#007bff',
                        border: 'none',
                        color: 'white',
                        fontSize: '1.5rem',
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      ‹
                    </button>
                    <span className="photo-counter" style={{
                      fontWeight: 500,
                      color: '#495057',
                      fontSize: '0.9rem'
                    }}>
                      {photoModal.currentIndex + 1} / {photoModal.photos.length}
                    </span>
                    <button
                      className="photo-nav-btn photo-nav-next"
                      onClick={() => setPhotoModal(prev => ({
                        ...prev,
                        currentIndex: prev.currentIndex < prev.photos.length - 1 ? prev.currentIndex + 1 : 0
                      }))}
                      style={{
                        background: '#007bff',
                        border: 'none',
                        color: 'white',
                        fontSize: '1.5rem',
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      ›
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

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

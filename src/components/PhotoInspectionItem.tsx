import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import PhotoCapture from './PhotoCapture';
import type { Materiel } from '../models/inventaire';

interface PhotoInspectionItemProps {
  materiel: Materiel;
  onUpdate: (updates: Partial<Materiel>) => void;
}

const PhotoInspectionItem: React.FC<PhotoInspectionItemProps> = ({ materiel, onUpdate }) => {
  const [showPhotoCapture, setShowPhotoCapture] = useState(false);
  // État pour savoir si un problème a été explicitement signalé
  const [problemeSignale, setProblemeSignale] = useState(false);
  // État pour la modal d'agrandissement des photos
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string>('');
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number>(0);
  
  // Charger les photos anciennes depuis l'inventaire précédent (simulation pour l'instant)
  useEffect(() => {
    // TODO: Récupérer les photos de l'inventaire précédent depuis Firebase
    // Pour l'instant, on simule avec des photos d'exemple si il y en a
    if (!materiel.photosAnciennnes && materiel.photos && materiel.photos.length > 0) {
      onUpdate({ photosAnciennnes: materiel.photos, photos: [] });
    }
    
    // Initialiser l'état problème signalé si déjà des photos ou un état défini
    if (materiel.photos && materiel.photos.length > 0) {
      setProblemeSignale(true);
    } else if (materiel.bonEtat === true || materiel.repare === true) {
      setProblemeSignale(false);
    }
  }, []);

  const handleBonEtatChange = (bonEtat: boolean) => {
    // Empêcher de marquer "Bon état" s'il y a déjà des photos de problème
    if (bonEtat && ((materiel.photos && materiel.photos.length > 0) || (materiel.photosAnciennnes && materiel.photosAnciennnes.length > 0))) {
      alert('Impossible de marquer "Bon état" : des photos de problème sont présentes. Veuillez d\'abord les traiter.');
      return;
    }
    
    console.log('✅ Bon état sélectionné pour:', materiel.nom);
    onUpdate({
      bonEtat,
      repare: false,
      photos: bonEtat ? [] : materiel.photos // Vider les photos si bon état
    });
    setProblemeSignale(false); // Reset l'état problème
    if (bonEtat) {
      setShowPhotoCapture(false); // Fermer l'interface photo si bon état
    }
  };

  const handleRepareChange = (repare: boolean) => {
    console.log('🔧 Réparé sélectionné pour:', materiel.nom);
    onUpdate({
      repare,
      bonEtat: false,
      // IMPORTANT: On garde les photos quand on marque "réparé" pour garder la trace du problème
      // photos: repare ? [] : materiel.photos // Ancien comportement qui supprimait les photos
    });
    setProblemeSignale(false); // Reset l'état problème
    if (repare) {
      setShowPhotoCapture(false); // Fermer l'interface photo si réparé
    }
  };

  const handleSignalerProbleme = () => {
    console.log('🚨 Signaler un problème pour:', materiel.nom);
    onUpdate({
      bonEtat: false,
      repare: false
    });
    setProblemeSignale(true); // Marquer qu'un problème a été signalé
    setShowPhotoCapture(false); // Ne pas ouvrir automatiquement la photo
  };

  const handleOpenPhotoCapture = () => {
    console.log('📷 Ouverture interface photo pour:', materiel.nom);
    setShowPhotoCapture(true);
  };

  const handleOpenPhotoModal = (photo: string, index: number) => {
    setSelectedPhoto(photo);
    setSelectedPhotoIndex(index);
    setPhotoModalOpen(true);
  };

  const handleClosePhotoModal = () => {
    setPhotoModalOpen(false);
    setSelectedPhoto('');
  };

  const handleNextPhoto = () => {
    const photos = materiel.photosAnciennnes || [];
    const nextIndex = (selectedPhotoIndex + 1) % photos.length;
    setSelectedPhotoIndex(nextIndex);
    setSelectedPhoto(photos[nextIndex]);
  };

  const handlePrevPhoto = () => {
    const photos = materiel.photosAnciennnes || [];
    const prevIndex = selectedPhotoIndex === 0 ? photos.length - 1 : selectedPhotoIndex - 1;
    setSelectedPhotoIndex(prevIndex);
    setSelectedPhoto(photos[prevIndex]);
  };

  const handlePhotosUpdate = (photos: string[]) => {
    onUpdate({
      photos,
      bonEtat: false,
      repare: false
    });
  };

  const getStatus = () => {
    if (materiel.bonEtat) return 'bon-etat';
    if (materiel.repare) {
      // Si réparé avec des photos, indiquer que c'était un problème documenté
      if (materiel.photos && materiel.photos.length > 0) return 'repare-avec-photos';
      return 'repare';
    }
    if (problemeSignale && materiel.photos && materiel.photos.length > 0) return 'avec-photos';
    if (problemeSignale) return 'probleme-signale';
    if (materiel.photosAnciennnes && materiel.photosAnciennnes.length > 0) return 'photos-anciennes';
    return 'non-verifie';
  };

  const getStatusText = () => {
    if (materiel.bonEtat) return '✓ Bon état';
    if (materiel.repare) {
      if (materiel.photos && materiel.photos.length > 0) {
        return `🔧 Réparé (${materiel.photos.length} photo(s) de preuve)`;
      }
      return '🔧 Réparé';
    }
    if (problemeSignale && materiel.photos && materiel.photos.length > 0) return `📷 ${materiel.photos.length} photo(s)`;
    if (problemeSignale) return '⚠️ Problème signalé';
    if (materiel.photosAnciennnes && materiel.photosAnciennnes.length > 0) return '📅 Photos précédentes';
    return '○ Non vérifié';
  };

  return (
    <div className={`photo-inspection-item ${getStatus()}`}>
      <div className="inspection-header">
        <span className="item-name">{materiel.nom}</span>
        <span className={`status-badge ${getStatus()}`}>
          {getStatusText()}
        </span>
      </div>

      <div className="inspection-controls">
        <button
          className={`control-button ${materiel.bonEtat ? 'active' : ''} ${((materiel.photos && materiel.photos.length > 0) || (materiel.photosAnciennnes && materiel.photosAnciennnes.length > 0)) ? 'disabled' : ''}`}
          onClick={() => handleBonEtatChange(!materiel.bonEtat)}
          disabled={((materiel.photos && materiel.photos.length > 0) || (materiel.photosAnciennnes && materiel.photosAnciennnes.length > 0))}
          title={((materiel.photos && materiel.photos.length > 0) || (materiel.photosAnciennnes && materiel.photosAnciennnes.length > 0)) ? 'Impossible avec des photos présentes' : 'Marquer comme bon état'}
        >
          ✓ Bon état
        </button>

        {materiel.photosAnciennnes && materiel.photosAnciennnes.length > 0 && (
          <button
            className={`control-button ${materiel.repare ? 'active' : ''}`}
            onClick={() => handleRepareChange(!materiel.repare)}
          >
            🔧 Problème réparé
          </button>
        )}

        <button
          className={`control-button ${showPhotoCapture || (materiel.photos && materiel.photos.length > 0) ? 'active' : ''}`}
          onClick={handleSignalerProbleme}
        >
          📷 Signaler un problème
        </button>
      </div>

      {/* Afficher les photos anciennes si elles existent */}
      {materiel.photosAnciennnes && materiel.photosAnciennnes.length > 0 && !materiel.repare && (
        <div className="photos-anciennes">
          <h5>📅 Photos de l'inventaire précédent :</h5>
          <div className="photo-grid">
            {materiel.photosAnciennnes.map((photo, index) => (
              <div 
                key={index} 
                className="photo-item ancien clickable"
                onClick={() => handleOpenPhotoModal(photo, index)}
                title="Cliquer pour agrandir"
              >
                <img src={photo} alt={`Photo ancienne ${index + 1}`} />
                <div className="photo-overlay">Précédent {index + 1}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Interface de capture de photos */}
      {showPhotoCapture && (
        <div className="photo-capture-section">
          <h5>📷 Documenter le problème :</h5>
          <PhotoCapture
            materiel={materiel}
            onPhotoCapture={handlePhotosUpdate}
          />
          <div className="photo-capture-controls">
            <button 
              onClick={() => setShowPhotoCapture(false)}
              className="btn-close-photos"
            >
              Fermer l'appareil photo
            </button>
          </div>
        </div>
      )}

      {/* Afficher la section de documentation selon l'état */}
      {(problemeSignale || (materiel.photos && materiel.photos.length > 0)) && (
        <div className="photos-nouvelles">
          <div className="photos-header">
            <h5>📷 
              {materiel.repare && materiel.photos && materiel.photos.length > 0 
                ? `Preuve de réparation (${materiel.photos.length} photo(s))` 
                : materiel.photos && materiel.photos.length > 0 
                ? `Photos actuelles (${materiel.photos.length})` 
                : 'Documenter le problème'} :
            </h5>
            {!showPhotoCapture && !materiel.repare && (
              <button 
                onClick={handleOpenPhotoCapture}
                className="btn-add-photos"
              >
                ➕ {materiel.photos && materiel.photos.length > 0 ? 'Ajouter des photos' : 'Prendre des photos'}
              </button>
            )}
          </div>
          {materiel.photos && materiel.photos.length > 0 && (
            <div className="photo-grid">
              {materiel.photos.map((photo, index) => (
                <div key={index} className={`photo-item ${materiel.repare ? 'repare' : 'nouveau'}`}>
                  <img src={photo} alt={`Photo ${materiel.repare ? 'de réparation' : 'actuelle'} ${index + 1}`} />
                  <div className="photo-overlay">
                    {materiel.repare ? `Réparation ${index + 1}` : `Photo ${index + 1}`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal d'agrandissement des photos - Utilise un Portal pour être au-dessus de tout */}
      {photoModalOpen && selectedPhoto && createPortal(
        <div 
          className="photo-modal-overlay" 
          onClick={handleClosePhotoModal}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(8px)',
            padding: '1rem'
          }}
        >
          <div 
            className="photo-modal-content" 
            onClick={(e) => e.stopPropagation()}
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
            <div className="photo-modal-header">
              <h4>📅 Photo précédente ({selectedPhotoIndex + 1}/{materiel.photosAnciennnes?.length || 0})</h4>
              <button 
                className="photo-modal-close"
                onClick={handleClosePhotoModal}
              >
                ✕
              </button>
            </div>
            
            <div className="photo-modal-image-container">
              {materiel.photosAnciennnes && materiel.photosAnciennnes.length > 1 && (
                <button 
                  className="photo-nav-button photo-nav-prev"
                  onClick={handlePrevPhoto}
                >
                  ‹
                </button>
              )}
              
              <img 
                src={selectedPhoto} 
                alt={`Photo précédente ${selectedPhotoIndex + 1}`}
                className="photo-modal-image"
              />
              
              {materiel.photosAnciennnes && materiel.photosAnciennnes.length > 1 && (
                <button 
                  className="photo-nav-button photo-nav-next"
                  onClick={handleNextPhoto}
                >
                  ›
                </button>
              )}
            </div>
            
            <div className="photo-modal-footer">
              <p>Photo de l'inventaire précédent • {materiel.nom}</p>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default PhotoInspectionItem;

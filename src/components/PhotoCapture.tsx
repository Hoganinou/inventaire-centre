import React, { useState } from 'react';
import type { Materiel } from '../models/inventaire';

interface PhotoCaptureProps {
  materiel: Materiel;
  onPhotoCapture: (photos: string[]) => void;
  isRecapMode?: boolean; // Nouveau prop pour distinguer le mode récap
}

const PhotoCapture: React.FC<PhotoCaptureProps> = ({ materiel, onPhotoCapture, isRecapMode = false }) => {
  const [photos, setPhotos] = useState<string[]>(materiel.photos || []);

  console.log('📷 PhotoCapture chargé pour:', materiel.nom, 'avec', photos.length, 'photos existantes');

  const removeAllPhotos = () => {
    if (confirm('Êtes-vous sûr de vouloir supprimer toutes les photos ?')) {
      console.log('🗑️ Suppression de toutes les photos - Mode récap:', isRecapMode);
      
      // Pour l'instant, on ne gère que la suppression locale
      // TODO: Implémenter la suppression Firebase Storage plus tard si nécessaire
      setPhotos([]);
      onPhotoCapture([]);
    }
  };

  const removePhoto = (index: number) => {
    if (confirm('Supprimer cette photo ?')) {
      console.log('🗑️ Suppression photo index:', index, '- Mode récap:', isRecapMode);
      
      // Pour l'instant, on ne gère que la suppression locale
      // TODO: Implémenter la suppression Firebase Storage plus tard si nécessaire
      const newPhotos = photos.filter((_, i) => i !== index);
      setPhotos(newPhotos);
      onPhotoCapture(newPhotos);
    }
  };

  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            const newPhotos = [...photos, e.target.result as string];
            setPhotos(newPhotos);
            onPhotoCapture(newPhotos);
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  return (
    <div className="photo-capture">
      <div className="photo-actions">
        <label className="btn-camera">
          📷 Prendre une photo
          <input 
            type="file" 
            accept="image/*" 
            capture="environment"
            onChange={handleFileInput}
            style={{ display: 'none' }}
          />
        </label>
        <label className="btn-file">
          📁 Choisir depuis galerie
          <input 
            type="file" 
            accept="image/*" 
            multiple 
            onChange={handleFileInput}
            style={{ display: 'none' }}
          />
        </label>
      </div>

      {photos.length > 0 && (
        <div className="photo-gallery">
          <div className="photo-gallery-header">
            <h4>Photos capturées ({photos.length})</h4>
            <button 
              onClick={removeAllPhotos}
              className="btn-remove-all"
              title="Supprimer toutes les photos"
            >
              🗑️ Tout supprimer
            </button>
          </div>
          <div className="photo-grid">
            {photos.map((photo, index) => (
              <div key={index} className="photo-item">
                <img src={photo} alt={`Photo ${index + 1}`} />
                <button 
                  onClick={() => removePhoto(index)}
                  className="btn-remove-photo mobile-friendly"
                  title="Supprimer cette photo"
                >
                  ❌
                </button>
                <div className="photo-number">{index + 1}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PhotoCapture;

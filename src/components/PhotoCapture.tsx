import React, { useState, useRef } from 'react';
import type { Materiel } from '../models/inventaire';

interface PhotoCaptureProps {
  materiel: Materiel;
  onPhotoCapture: (photos: string[]) => void;
}

const PhotoCapture: React.FC<PhotoCaptureProps> = ({ materiel, onPhotoCapture }) => {
  const [photos, setPhotos] = useState<string[]>(materiel.photos || []);
  const [isCapturing, setIsCapturing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  console.log('📷 PhotoCapture chargé pour:', materiel.nom, 'avec', photos.length, 'photos existantes');

  const startCamera = async () => {
    console.log('📷 Tentative de démarrage de la caméra...');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment', // Utilise la caméra arrière sur mobile
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        } 
      });
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCapturing(true);
      console.log('✅ Caméra démarrée avec succès');
    } catch (error) {
      console.error('❌ Erreur lors de l\'accès à la caméra:', error);
      alert('Impossible d\'accéder à la caméra. Veuillez vérifier les permissions.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCapturing(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const photoDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        
        const newPhotos = [...photos, photoDataUrl];
        setPhotos(newPhotos);
        onPhotoCapture(newPhotos);
        
        stopCamera();
      }
    }
  };

  const removePhoto = (index: number) => {
    const newPhotos = photos.filter((_, i) => i !== index);
    setPhotos(newPhotos);
    onPhotoCapture(newPhotos);
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
        {!isCapturing && (
          <>
            <button onClick={startCamera} className="btn-camera">
              📷 Prendre une photo
            </button>
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
          </>
        )}
        
        {isCapturing && (
          <div className="camera-view">
            <video ref={videoRef} className="camera-preview" autoPlay playsInline />
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            <div className="camera-controls">
              <button onClick={capturePhoto} className="btn-capture">
                📷 Capturer
              </button>
              <button onClick={stopCamera} className="btn-cancel">
                ❌ Annuler
              </button>
            </div>
          </div>
        )}
      </div>

      {photos.length > 0 && (
        <div className="photo-gallery">
          <h4>Photos capturées ({photos.length})</h4>
          <div className="photo-grid">
            {photos.map((photo, index) => (
              <div key={index} className="photo-item">
                <img src={photo} alt={`Photo ${index + 1}`} />
                <button 
                  onClick={() => removePhoto(index)}
                  className="btn-remove-photo"
                  title="Supprimer cette photo"
                >
                  ❌
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PhotoCapture;

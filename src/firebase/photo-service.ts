import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './config';

export class PhotoService {
  
  // Convertir base64 en Blob
  private static base64ToBlob(base64: string): Blob {
    const base64Data = base64.split(',')[1]; // Enlever le préfixe data:image/...;base64,
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: 'image/jpeg' });
  }

  // Uploader une photo vers Firebase Storage
  static async uploadPhoto(
    base64Image: string, 
    vehiculeId: string, 
    materielPath: string, 
    photoIndex: number
  ): Promise<string> {
    try {
      // Créer un nom de fichier unique
      const timestamp = Date.now();
      const fileName = `${vehiculeId}/${materielPath.replace(/[^a-zA-Z0-9]/g, '_')}_${photoIndex}_${timestamp}.jpg`;
      
      // Créer une référence vers le fichier
      const storageRef = ref(storage, `inventaires/${fileName}`);
      
      // Convertir base64 en Blob
      const blob = this.base64ToBlob(base64Image);
      
      // Uploader le fichier
      console.log(`📤 Upload photo: ${fileName}`);
      const snapshot = await uploadBytes(storageRef, blob);
      
      // Obtenir l'URL de téléchargement
      const downloadURL = await getDownloadURL(snapshot.ref);
      console.log(`✅ Photo uploadée: ${downloadURL}`);
      
      return downloadURL;
    } catch (error) {
      console.error('❌ Erreur upload photo:', error);
      throw error;
    }
  }

  // Uploader toutes les photos d'un matériel
  static async uploadMaterielPhotos(
    materiel: any,
    vehiculeId: string,
    materielPath: string
  ): Promise<string[]> {
    if (!materiel.photos || materiel.photos.length === 0) {
      return [];
    }

    const uploadPromises = materiel.photos.map((photo: string, index: number) => 
      this.uploadPhoto(photo, vehiculeId, materielPath, index)
    );

    return Promise.all(uploadPromises);
  }

  // Supprimer une photo (optionnel, pour plus tard)
  static async deletePhoto(photoURL: string): Promise<void> {
    try {
      // Extraire le chemin du fichier depuis l'URL
      const pathStart = photoURL.indexOf('/o/') + 3;
      const pathEnd = photoURL.indexOf('?');
      const filePath = decodeURIComponent(photoURL.substring(pathStart, pathEnd));
      
      const storageRef = ref(storage, filePath);
      await deleteObject(storageRef);
      console.log(`🗑️ Photo supprimée: ${filePath}`);
    } catch (error) {
      console.error('❌ Erreur suppression photo:', error);
      throw error;
    }
  }
}

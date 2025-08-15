import { useState } from 'react'
import './App.css'
import InventairePanel from './components/InventairePanel'
import RecapPanel from './components/RecapPanel'
import InventaireComplete from './components/InventaireComplete'
import HomePage from './components/HomePage'
import { vehicules } from './models/vehicules/index'

// Fonction utilitaire pour lire le paramètre d'URL (insensible à la casse)
function getVehiculeIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('vehicule');
}

function findVehicule(vehiculeId: string | null) {
  if (!vehiculeId) return { vehicule: vehicules.EXEMPLE, notFound: false };
  const key = vehiculeId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (vehicules[key]) return { vehicule: vehicules[key], notFound: false };
  const found = Object.values(vehicules).find(v => v.id.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === key);
  if (found) return { vehicule: found, notFound: false };
  return { vehicule: vehicules.EXEMPLE, notFound: true };
}

function App() {
  const vehiculeId = getVehiculeIdFromUrl();
  const { vehicule, notFound } = findVehicule(vehiculeId);
  
  // État pour gérer le workflow : 'home', 'recap', 'inventaire' ou 'termine'
  const [currentView, setCurrentView] = useState<'home' | 'recap' | 'inventaire' | 'termine'>(
    vehiculeId ? 'recap' : 'home'
  );
  const [selectedVehicule, setSelectedVehicule] = useState(vehicule);

  const handleSelectVehicule = (newVehiculeId: string) => {
    const found = Object.values(vehicules).find(v => v.id === newVehiculeId);
    if (found) {
      setSelectedVehicule(found);
      // Mettre à jour l'URL sans recharger la page
      window.history.pushState({}, '', `?vehicule=${newVehiculeId}`);
      setCurrentView('recap');
    }
  };

  const handleStartInventaire = () => {
    setCurrentView('inventaire');
  };

  const handleInventaireComplete = () => {
    setCurrentView('termine');
  };

  const handleReturnHome = () => {
    setCurrentView('home');
    // Nettoyer l'URL
    window.history.pushState({}, '', '/');
  };

  return (
    <div>
      <div style={{color: 'blue', textAlign: 'center'}}>page test : v2.0</div>
      {notFound && currentView !== 'home' && (
        <div style={{color: 'red', textAlign: 'center', margin: '1rem'}}>Véhicule non trouvé, affichage du véhicule par défaut.</div>
      )}
      
      {currentView === 'home' && (
        <HomePage onSelectVehicule={handleSelectVehicule} />
      )}
      
      {currentView === 'recap' && (
        <RecapPanel 
          vehicule={selectedVehicule} 
          onStartInventaire={handleStartInventaire}
          onReturnHome={handleReturnHome}
        />
      )}
      
      {currentView === 'inventaire' && (
        <InventairePanel 
          vehicule={selectedVehicule} 
          onInventaireComplete={handleInventaireComplete}
        />
      )}
      
      {currentView === 'termine' && (
        <InventaireComplete vehicule={selectedVehicule} />
      )}
    </div>
  )
}

export default App

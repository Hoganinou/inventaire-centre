import { useState } from 'react'
import './App.css'
import InventairePanel from './components/InventairePanel'
import RecapPanel from './components/RecapPanel'
import InventaireComplete from './components/InventaireComplete'
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
  
  // État pour gérer le workflow : 'recap', 'inventaire' ou 'termine'
  const [currentView, setCurrentView] = useState<'recap' | 'inventaire' | 'termine'>('recap');

  const handleStartInventaire = () => {
    setCurrentView('inventaire');
  };

  const handleInventaireComplete = () => {
    setCurrentView('termine');
  };

  return (
    <div>
      <div style={{color: 'blue', textAlign: 'center'}}>page test : v1-2</div>
      {notFound && (
        <div style={{color: 'red', textAlign: 'center', margin: '1rem'}}>Véhicule non trouvé, affichage du véhicule par défaut.</div>
      )}
      
      {currentView === 'recap' && (
        <RecapPanel 
          vehicule={vehicule} 
          onStartInventaire={handleStartInventaire} 
        />
      )}
      
      {currentView === 'inventaire' && (
        <InventairePanel 
          vehicule={vehicule} 
          onInventaireComplete={handleInventaireComplete}
        />
      )}
      
      {currentView === 'termine' && (
        <InventaireComplete vehicule={vehicule} />
      )}
    </div>
  )
}

export default App

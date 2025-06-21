import './App.css'
import InventairePanel from './components/InventairePanel'
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

  return (
    <div>
      <div style={{color: 'blue', textAlign: 'center'}}>DEBUG: build du 21/06/2025</div>
      {notFound && (
        <div style={{color: 'red', textAlign: 'center', margin: '1rem'}}>Véhicule non trouvé, affichage du véhicule par défaut.</div>
      )}
      <InventairePanel vehicule={vehicule} />
    </div>
  )
}

export default App

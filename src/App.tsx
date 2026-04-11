import { useState, useEffect } from 'react'
import './App.css'
import InventairePanel from './components/InventairePanel'
import RecapPanel from './components/RecapPanel'
import InventaireComplete from './components/InventaireComplete'
import HomePage from './components/HomePage'
import AdminPanel from './components/AdminPanel'
import SOGPage from './components/SOGPage'
import MensuelPanel from './components/MensuelPanel'
import { vehicules } from './models/vehicules/index'
import { VehiculeConfigService } from './firebase/vehicule-config-service'
import type { Vehicule } from './models/inventaire'
import { handleVersionCheck } from './utils/version'
import UpdateNotification from './components/UpdateNotification'

// Fonction utilitaire pour lire les paramètres d'URL
function getUrlParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    vehicule: params.get('vehicule')
  };
}

function App() {
  const { vehicule: vehiculeId } = getUrlParams();
  
  // État pour gérer le workflow : 'home', 'recap', 'inventaire', 'termine', 'admin', 'sog'
  const [currentView, setCurrentView] = useState<'home' | 'recap' | 'inventaire' | 'termine' | 'admin' | 'sog' | 'mensuel'>('home');
  const [selectedVehicule, setSelectedVehicule] = useState<Vehicule | null>(null);
  const [allVehicules, setAllVehicules] = useState<Vehicule[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Charger tous les véhicules au démarrage et gérer l'URL
  useEffect(() => {
    const initializeApp = async () => {
      setIsLoading(true);
      
      // Vérifier les mises à jour de version
      handleVersionCheck();
      
      // Charger tous les véhicules
      await loadAllVehicules();
      
      // Si un véhicule est spécifié dans l'URL, le chercher
      if (vehiculeId) {
        const foundVehicule = await findVehiculeById(vehiculeId);
        if (foundVehicule) {
          setSelectedVehicule(foundVehicule);
          setCurrentView('recap');
          setNotFound(false);
        } else {
          setNotFound(true);
          setCurrentView('recap');
        }
      }
      
      setIsLoading(false);
    };
    
    initializeApp();
  }, [vehiculeId]);

  const findVehiculeById = async (vehiculeId: string): Promise<Vehicule | null> => {
    try {
      // D'abord chercher dans les véhicules par défaut
      const key = vehiculeId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      if (vehicules[key]) return vehicules[key];
      
      const foundDefault = Object.values(vehicules).find(v => 
        v.id.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === key
      );
      if (foundDefault) return foundDefault;
      
      // Ensuite chercher dans Firebase
      const customVehicule = await VehiculeConfigService.getVehiculeConfig(vehiculeId);
      if (customVehicule) return customVehicule;
      
      // Chercher parmi tous les véhicules personnalisés avec correspondance d'ID
      const allCustomVehicules = await VehiculeConfigService.getAllVehiculeConfigs();
      const foundCustom = allCustomVehicules.find(v => 
        v.id.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === key
      );
      
      return foundCustom || null;
    } catch (error) {
      console.error('❌ Erreur recherche véhicule:', error);
      return null;
    }
  };

  const loadAllVehicules = async () => {
    try {
      // Combiner véhicules par défaut et véhicules personnalisés
      const defaultVehicules = Object.values(vehicules);
      const customVehicules = await VehiculeConfigService.getAllVehiculeConfigs();
      
      // Éviter les doublons (priorité aux versions personnalisées)
      const allVehiculesMap = new Map<string, Vehicule>();
      
      // D'abord les véhicules par défaut
      defaultVehicules.forEach(v => allVehiculesMap.set(v.id, v));
      
      // Puis écraser avec les versions personnalisées si elles existent
      customVehicules.forEach((v: Vehicule) => allVehiculesMap.set(v.id, v));
      
      const combinedVehicules = Array.from(allVehiculesMap.values());
      setAllVehicules(combinedVehicules);
      
    } catch (error) {
      console.error('❌ Erreur chargement véhicules:', error);
      // En cas d'erreur, utiliser seulement les véhicules par défaut
      setAllVehicules(Object.values(vehicules));
    }
  };

  const handleSelectVehicule = (newVehiculeId: string) => {
    // Chercher d'abord dans tous les véhicules chargés
    let found = allVehicules.find(v => v.id === newVehiculeId);
    
    // Si pas trouvé, chercher dans les véhicules par défaut comme fallback
    if (!found) {
      found = Object.values(vehicules).find(v => v.id === newVehiculeId);
    }
    
    if (found) {
      setSelectedVehicule(found);
      // Mettre à jour l'URL sans recharger la page
      window.history.pushState({}, '', `?vehicule=${newVehiculeId}`);
      setCurrentView('recap');
    } else {
      console.error('❌ Véhicule non trouvé:', newVehiculeId);
    }
  };

  const handleStartInventaire = async () => {
    if (!selectedVehicule) return;
    
    // Recharger la configuration depuis Firebase pour s'assurer d'avoir la dernière version
    try {
      console.log('🔄 Rechargement de la configuration pour:', selectedVehicule.id);
      const latestConfig = await VehiculeConfigService.getVehiculeConfig(selectedVehicule.id);
      if (latestConfig) {
        console.log('✅ Configuration mise à jour trouvée:', latestConfig);
        setSelectedVehicule(latestConfig);
      } else {
        console.log('ℹ️ Pas de configuration personnalisée, utilisation de la version par défaut');
      }
    } catch (error) {
      console.error('❌ Erreur lors du rechargement de la configuration:', error);
      // Continuer avec la configuration existante en cas d'erreur
    }
    
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

  const handleOpenAdmin = () => {
    setCurrentView('admin');
  };

  const handleOpenSOG = () => {
    setCurrentView('sog');
  };

  const handleOpenMensuel = () => {
    setCurrentView('mensuel');
  };

  return (
    <div>
      {isLoading && (
        <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh'}}>
          <div>Chargement...</div>
        </div>
      )}
      
      {!isLoading && (
        <>
          {notFound && currentView !== 'home' && (
            <div style={{color: 'red', textAlign: 'center', margin: '1rem'}}>Véhicule non trouvé, affichage du véhicule par défaut.</div>
          )}
          
          {currentView === 'home' && (
            <HomePage 
              onSelectVehicule={handleSelectVehicule} 
              onOpenAdmin={handleOpenAdmin}
              onOpenSOG={handleOpenSOG}
            />
          )}
          
          {currentView === 'recap' && selectedVehicule && (
            <RecapPanel 
              vehicule={selectedVehicule!} 
              onStartInventaire={handleStartInventaire}
              onReturnHome={handleReturnHome}
              onOpenMensuel={handleOpenMensuel}
            />
          )}
          
          {currentView === 'inventaire' && selectedVehicule && (
            <InventairePanel 
              vehicule={selectedVehicule!} 
              onInventaireComplete={handleInventaireComplete}
              onReturnHome={handleReturnHome}
            />
          )}
          
          {currentView === 'termine' && selectedVehicule && (
            <InventaireComplete vehicule={selectedVehicule!} />
          )}
          
          {currentView === 'admin' && (
            <AdminPanel onReturnHome={handleReturnHome} />
          )}
          
          {currentView === 'sog' && (
            <SOGPage onReturnHome={handleReturnHome} />
          )}
          
          {currentView === 'mensuel' && selectedVehicule && (
            <MensuelPanel
              vehicule={selectedVehicule!}
              onClose={() => setCurrentView('recap')}
              onMensuelSaved={() => setCurrentView('recap')}
            />
          )}
        </>
      )}
      
      {/* Composant de notification de mise à jour */}
      <UpdateNotification />
    </div>
  )
}

export default App

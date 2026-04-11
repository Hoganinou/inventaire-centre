import React, { useState, useEffect } from 'react';
import type { Vehicule, Section, Materiel } from '../models/inventaire';
import { vehicules } from '../models/vehicules/index';
import { VehiculeConfigService } from '../firebase/vehicule-config-service';
import { VehiculeManagementService } from '../firebase/vehicule-management-service';
import configurationMensuelleService from '../firebase/configuration-mensuelle-service';
import type { ConfigurationMensuelle } from '../firebase/configuration-mensuelle-service';
import { AdminAuthService } from '../firebase/admin-auth-service';
import { migrateVehiculeToNewFormat, validateImportedVehicule, cleanImportedVehicule } from '../utils/vehicule-migration';
import { VEHICULE_ICONS, ICON_CATEGORIES } from '../utils/vehicule-icons';
import VehiculeOrderManager from './VehiculeOrderManager';
import FamilleManager from './FamilleManager';
import '../App.css';

interface Props {
  onReturnHome: () => void;
}

const AdminPanel: React.FC<Props> = ({ onReturnHome }) => {
  const [selectedVehicule, setSelectedVehicule] = useState<string>('');
  const [currentVehicule, setCurrentVehicule] = useState<Vehicule | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [hasChanges, setHasChanges] = useState(false);
  const [message, setMessage] = useState('');
  const [allVehicules, setAllVehicules] = useState<Vehicule[]>([]);
  
  // États pour la création de nouveau véhicule
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newVehiculeForm, setNewVehiculeForm] = useState({
    id: '',
    nom: ''
  });

  // États pour la gestion des véhicules
  const [showManageModal, setShowManageModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showIconsModal, setShowIconsModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showFamilleModal, setShowFamilleModal] = useState(false);
  const [renameForm, setRenameForm] = useState({ vehiculeId: '', newName: '' });
  const [duplicateForm, setDuplicateForm] = useState({ sourceId: '', newId: '', newName: '' });
  const [importForm, setImportForm] = useState({ jsonContent: '', fileName: '' });
  const [vehiculeVisibility, setVehiculeVisibility] = useState<{ [key: string]: boolean }>({});

  // États pour la configuration des contrôles mensuels  
  const [showConfigMensuelModal, setShowConfigMensuelModal] = useState(false);
  const [configurations, setConfigurations] = useState<ConfigurationMensuelle[]>([]);
  const [configurationActive, setConfigurationActive] = useState<ConfigurationMensuelle | null>(null);
  const [editingConfig, setEditingConfig] = useState<ConfigurationMensuelle | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // États pour la gestion du mot de passe admin
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // États pour le déplacement entre sections
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveItem, setMoveItem] = useState<{
    type: 'section' | 'materiel';
    sourcePath: number[];
    sourceIndex: number;
    item: Section | Materiel;
  } | null>(null);

  // États pour la copie entre véhicules
  const [showCopyToVehicleModal, setShowCopyToVehicleModal] = useState(false);
  const [copyItem, setCopyItem] = useState<{
    type: 'section' | 'materiel';
    sourcePath: number[];
    sourceIndex: number;
    item: Section | Materiel;
    sourceVehicleId: string;
  } | null>(null);
  const [selectedDestinationVehicle, setSelectedDestinationVehicle] = useState('');
  const [destinationVehicleSections, setDestinationVehicleSections] = useState<Section[]>([]);

  // Charger tous les véhicules au démarrage
  useEffect(() => {
    loadAllVehicules();
    loadVehiculeVisibilities();
    loadConfigurationsMensuelles();
  }, []);

  // Charger les configurations mensuelles
  const loadConfigurationsMensuelles = async () => {
    try {
      const configs = await configurationMensuelleService.getToutesLesConfigurations();
      setConfigurations(configs);
      
      const activeConfig = await configurationMensuelleService.getConfigurationActive();
      setConfigurationActive(activeConfig);
    } catch (error) {
      console.error('❌ Erreur chargement configurations mensuelles:', error);
    }
  };

  // Fonction pour charger la visibilité de tous les véhicules
  const loadVehiculeVisibilities = async () => {
    try {
      // Récupérer tous les véhicules disponibles
      const allConfigs = await VehiculeConfigService.getAllVehiculeConfigs();
      const defaultVehicules = Object.values(vehicules);
      
      const visibilityMap: { [key: string]: boolean } = {};
      
      // Vérifier la visibilité des véhicules personnalisés
      for (const config of allConfigs) {
        const metadata = await VehiculeManagementService.getVehiculeMetadata(config.id);
        visibilityMap[config.id] = metadata?.visible !== false; // Visible par défaut
      }
      
      // Vérifier la visibilité des véhicules par défaut
      for (const vehicule of defaultVehicules) {
        if (!visibilityMap.hasOwnProperty(vehicule.id)) {
          const metadata = await VehiculeManagementService.getVehiculeMetadata(vehicule.id);
          visibilityMap[vehicule.id] = metadata?.visible !== false; // Visible par défaut
        }
      }
      
      setVehiculeVisibility(visibilityMap);
    } catch (error) {
      console.error('Erreur lors du chargement des visibilités:', error);
    }
  };

  // Charger le véhicule sélectionné
  useEffect(() => {
    if (selectedVehicule) {
      loadVehiculeConfig(selectedVehicule);
    }
  }, [selectedVehicule]);

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
    }
  };

  const loadVehiculeConfig = async (vehiculeId: string) => {
    try {
      // D'abord essayer de charger depuis Firebase
      const customConfig = await VehiculeConfigService.getVehiculeConfig(vehiculeId);
      
      if (customConfig) {
        setCurrentVehicule(customConfig);
        setSections(JSON.parse(JSON.stringify(customConfig.sections)));
      } else {
        // Fallback vers la configuration par défaut avec migration
        const vehicule = Object.values(vehicules).find(v => v.id === vehiculeId);
        if (vehicule) {
          // Appliquer la migration automatique
          const migratedVehicule = migrateVehiculeToNewFormat(vehicule);
          
          // Sauvegarder automatiquement la version migrée dans Firebase
          try {
            await VehiculeConfigService.saveVehiculeConfig(migratedVehicule);
          } catch (error) {
            // Erreur sauvegarde migration - continuer quand même
          }
          
          setCurrentVehicule(migratedVehicule);
          setSections(JSON.parse(JSON.stringify(migratedVehicule.sections)));
        }
      }
      
      setHasChanges(false);
    } catch (error) {
      console.error('❌ Erreur chargement configuration:', error);
      setMessage('❌ Erreur lors du chargement de la configuration');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleVehiculeChange = (vehiculeId: string) => {
    if (hasChanges) {
      if (!confirm('⚠️ Vous avez des modifications non sauvegardées. Continuer ?')) {
        return;
      }
    }
    setSelectedVehicule(vehiculeId);
  };

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const updateMaterielName = (sectionIndex: number, materielIndex: number, newName: string, subSectionIndex?: number, path?: number[]) => {
    const newSections = [...sections];
    let targetSection: Section | null = null;
    
    // Navigation vers la section cible
    if (path && path.length > 0) {
      // Le path contient le chemin complet : [sectionIndex, subIndex1, subIndex2, ...]
      const mainSectionIndex = path[0];
      const subPath = path.slice(1);
      targetSection = findSectionByPath(newSections, mainSectionIndex, subPath);
    } else {
      // Logique existante pour compatibilité
      targetSection = newSections[sectionIndex];
      if (subSectionIndex !== undefined && targetSection?.sousSections) {
        targetSection = targetSection.sousSections[subSectionIndex];
      }
    }
    
    if (targetSection?.materiels && targetSection.materiels[materielIndex]) {
      targetSection.materiels[materielIndex].nom = newName;
      setSections(newSections);
      setHasChanges(true);
    }
  };

  const updateMaterielType = (sectionIndex: number, materielIndex: number, newType: string, subSectionIndex?: number, path?: number[]) => {
    const newSections = [...sections];
    let targetSection: Section | null = null;
    
    // Navigation vers la section cible
    if (path && path.length > 0) {
      // Le path contient le chemin complet : [sectionIndex, subIndex1, subIndex2, ...]
      const mainSectionIndex = path[0];
      const subPath = path.slice(1);
      targetSection = findSectionByPath(newSections, mainSectionIndex, subPath);
    } else {
      // Logique existante pour compatibilité
      targetSection = newSections[sectionIndex];
      if (subSectionIndex !== undefined && targetSection.sousSections) {
        targetSection = targetSection.sousSections[subSectionIndex];
      }
    }
    
    if (targetSection?.materiels) {
      const materiel = targetSection.materiels[materielIndex];
      materiel.type = newType as 'checkbox' | 'checkbox-presence' | 'checkbox-fonction' | 'checkbox-ok' | 'radio' | 'quantite' | 'select' | 'photo' | 'niveau' | 'etat' | 'conformite' | 'statut-ternaire' | 'date' | 'texte-libre';
      
      // Réinitialiser les valeurs selon le type
      switch (newType) {
        case 'quantite':
          materiel.valeur = 1;
          delete materiel.options;
          break;
        case 'select':
          materiel.options = ['Option 1', 'Option 2'];
          delete materiel.valeur;
          break;
        case 'radio':
          materiel.options = ['RAS', 'Voyant(s) allumé(s)']; // Labels par défaut
          materiel.valeur = false; // Par défaut RAS
          materiel.estPresent = false;
          break;
        case 'photo':
          delete materiel.valeur;
          delete materiel.options;
          break;
        case 'checkbox-presence':
          delete materiel.valeur;
          delete materiel.options;
          materiel.estPresent = false;
          delete materiel.fonctionne; // Pas besoin du fonctionnement
          break;
        case 'checkbox-ok':
          delete materiel.options;
          materiel.valeur = false; // Par défaut non coché
          delete materiel.estPresent;
          delete materiel.fonctionne;
          break;
        case 'niveau':
          materiel.options = ['Plein', 'Moyen', 'Bas', 'Vide'];
          materiel.valeur = 'Plein'; // Par défaut
          break;
        case 'etat':
        case 'statut-ternaire':
          materiel.options = ['Bon', 'Moyen', 'Mauvais'];
          materiel.valeur = 'Bon'; // Par défaut
          break;
        case 'conformite':
          materiel.options = ['Conforme', 'Non conforme'];
          materiel.valeur = 'Conforme'; // Par défaut
          break;
        case 'date':
          materiel.valeur = new Date().toISOString().split('T')[0]; // Date du jour par défaut
          delete materiel.options;
          break;
        case 'texte-libre':
          materiel.valeur = '';
          delete materiel.options;
          break;
        case 'checkbox-fonction':
        case 'checkbox':
        default: // checkbox avec présence ET fonction (pour compatibilité legacy)
          delete materiel.valeur;
          delete materiel.options;
          materiel.estPresent = false;
          materiel.fonctionne = false;
          break;
      }
    }
    
    setSections(newSections);
    setHasChanges(true);
  };

  // Fonction utilitaire pour naviguer vers une section par son chemin
  const findSectionByPath = (sections: Section[], mainIndex: number, path: number[] = []): Section | null => {
    let targetSection = sections[mainIndex];
    if (!targetSection) return null;
    
    for (const pathIndex of path) {
      if (targetSection.sousSections && targetSection.sousSections[pathIndex]) {
        targetSection = targetSection.sousSections[pathIndex];
      } else {
        return null;
      }
    }
    return targetSection;
  };

  const addMateriel = (sectionIndex: number, subSectionIndex?: number, path?: number[]) => {
    const newSections = [...sections];
    let targetSection: Section | null = null;
    
    // Navigation vers la section cible
    if (path && path.length > 0) {
      // Le path contient le chemin complet : [sectionIndex, subIndex1, subIndex2, ...]
      const mainSectionIndex = path[0];
      const subPath = path.slice(1);
      targetSection = findSectionByPath(newSections, mainSectionIndex, subPath);
    } else {
      // Logique existante pour compatibilité
      targetSection = newSections[sectionIndex];
      if (subSectionIndex !== undefined && targetSection.sousSections) {
        targetSection = targetSection.sousSections[subSectionIndex];
      }
    }
    
    if (!targetSection) {
      console.error('❌ Section cible non trouvée');
      return;
    }
    
    if (!targetSection.materiels) {
      targetSection.materiels = [];
    }
    
    const newMateriel: Materiel = {
      id: `materiel_${Date.now()}`,
      nom: 'Nouveau matériel',
      type: 'checkbox-presence'
    };
    
    targetSection.materiels.push(newMateriel);
    setSections(newSections);
    setHasChanges(true);
    
    // Ouvrir automatiquement la section pour voir le nouveau matériel
    const sectionKey = path && path.length > 0 
      ? `${sectionIndex}_${path.join('_')}` 
      : subSectionIndex !== undefined 
        ? `${sectionIndex}_${subSectionIndex}` 
        : `${sectionIndex}`;
    const newExpanded = new Set(expandedSections);
    newExpanded.add(sectionKey);
    setExpandedSections(newExpanded);
  };

  // Fonctions de réorganisation des sections
  const moveSectionUp = (sectionIndex: number) => {
    if (sectionIndex === 0) return;
    const newSections = [...sections];
    [newSections[sectionIndex - 1], newSections[sectionIndex]] = [newSections[sectionIndex], newSections[sectionIndex - 1]];
    setSections(newSections);
    setHasChanges(true);
  };

  const moveSectionDown = (sectionIndex: number) => {
    if (sectionIndex === sections.length - 1) return;
    const newSections = [...sections];
    [newSections[sectionIndex], newSections[sectionIndex + 1]] = [newSections[sectionIndex + 1], newSections[sectionIndex]];
    setSections(newSections);
    setHasChanges(true);
  };

  // Fonctions de réorganisation des sous-sections
  const moveSubSectionUp = (sectionIndex: number, subSectionIndex: number) => {
    if (subSectionIndex === 0) return;
    const newSections = [...sections];
    const sousSections = newSections[sectionIndex].sousSections!;
    [sousSections[subSectionIndex - 1], sousSections[subSectionIndex]] = [sousSections[subSectionIndex], sousSections[subSectionIndex - 1]];
    setSections(newSections);
    setHasChanges(true);
  };

  const moveSubSectionDown = (sectionIndex: number, subSectionIndex: number) => {
    const newSections = [...sections];
    const sousSections = newSections[sectionIndex].sousSections!;
    if (subSectionIndex === sousSections.length - 1) return;
    [sousSections[subSectionIndex], sousSections[subSectionIndex + 1]] = [sousSections[subSectionIndex + 1], sousSections[subSectionIndex]];
    setSections(newSections);
    setHasChanges(true);
  };

  // Fonctions de réorganisation des matériels
  const moveMaterielUp = (sectionIndex: number, materielIndex: number, subSectionIndex?: number, path?: number[]) => {
    if (materielIndex === 0) return;
    const newSections = [...sections];
    let targetSection: Section | null = null;
    
    // Navigation vers la section cible
    if (path && path.length > 0) {
      const mainSectionIndex = path[0];
      const subPath = path.slice(1);
      targetSection = findSectionByPath(newSections, mainSectionIndex, subPath);
    } else {
      targetSection = newSections[sectionIndex];
      if (subSectionIndex !== undefined && targetSection.sousSections) {
        targetSection = targetSection.sousSections[subSectionIndex];
      }
    }
    
    if (targetSection?.materiels) {
      [targetSection.materiels[materielIndex - 1], targetSection.materiels[materielIndex]] = 
      [targetSection.materiels[materielIndex], targetSection.materiels[materielIndex - 1]];
      setSections(newSections);
      setHasChanges(true);
    }
  };

  const moveMaterielDown = (sectionIndex: number, materielIndex: number, subSectionIndex?: number, path?: number[]) => {
    const newSections = [...sections];
    let targetSection: Section | null = null;
    
    // Navigation vers la section cible
    if (path && path.length > 0) {
      const mainSectionIndex = path[0];
      const subPath = path.slice(1);
      targetSection = findSectionByPath(newSections, mainSectionIndex, subPath);
    } else {
      targetSection = newSections[sectionIndex];
      if (subSectionIndex !== undefined && targetSection.sousSections) {
        targetSection = targetSection.sousSections[subSectionIndex];
      }
    }
    
    if (targetSection?.materiels && materielIndex < targetSection.materiels.length - 1) {
      [targetSection.materiels[materielIndex], targetSection.materiels[materielIndex + 1]] = 
      [targetSection.materiels[materielIndex + 1], targetSection.materiels[materielIndex]];
      setSections(newSections);
      setHasChanges(true);
    }
  };

  const removeMateriel = (sectionIndex: number, materielIndex: number, subSectionIndex?: number, path?: number[]) => {
    if (!confirm('Supprimer ce matériel ?')) return;
    
    const newSections = [...sections];
    let targetSection: Section | null = null;
    
    // Navigation vers la section cible
    if (path && path.length > 0) {
      const mainSectionIndex = path[0];
      const subPath = path.slice(1);
      targetSection = findSectionByPath(newSections, mainSectionIndex, subPath);
    } else {
      targetSection = newSections[sectionIndex];
      if (subSectionIndex !== undefined && targetSection.sousSections) {
        targetSection = targetSection.sousSections[subSectionIndex];
      }
    }
    
    if (targetSection?.materiels) {
      targetSection.materiels.splice(materielIndex, 1);
    }
    
    setSections(newSections);
    setHasChanges(true);
  };

  const removeSubSection = (path: number[]) => {
    if (path.length < 2) return; // Au minimum [sectionIndex, subSectionIndex]
    
    const newSections = [...sections];
    const mainSectionIndex = path[0];
    const subPath = path.slice(0, -1); // Tout sauf le dernier index
    const indexToRemove = path[path.length - 1]; // Le dernier index
    
    // Trouver la section parent de celle à supprimer
    const parentSection = findSectionByPath(newSections, mainSectionIndex, subPath.slice(1));
    
    if (parentSection && parentSection.sousSections) {
      parentSection.sousSections.splice(indexToRemove, 1);
      setSections(newSections);
      setHasChanges(true);
    } else {
      console.error('❌ Section parent non trouvée pour suppression');
    }
  };

  const addSection = () => {
    const newSection: Section = {
      id: `section_${Date.now()}`,
      nom: 'Nouvelle section',
      materiels: []
    };
    
    const newSections = [...sections, newSection];
    setSections(newSections);
    setHasChanges(true);
    
    // Ouvrir automatiquement la nouvelle section
    const newSectionIndex = newSections.length - 1;
    const sectionKey = `${newSectionIndex}`;
    const newExpanded = new Set(expandedSections);
    newExpanded.add(sectionKey);
    setExpandedSections(newExpanded);
  };

  // Fonction helper pour rendre les destinations de manière récursive
  const renderMoveDestinations = (section: Section, path: number[], depth: number): React.ReactNode => {
    if (!moveItem) return null;
    
    const isDisabled = moveItem.type === 'section' && 
      JSON.stringify(moveItem.sourcePath.slice(0, path.length)) === JSON.stringify(path);
    
    return (
      <div key={`${path.join('-')}`} style={{ marginLeft: `${depth * 1}rem` }}>
        <button
          className="move-destination-btn move-destination-sub"
          onClick={() => moveItemToDestination(path)}
          disabled={isDisabled}
        >
          {'└'.repeat(depth)} 📂 {section.nom}
        </button>
        {section.sousSections && section.sousSections.map((subSection, subIndex) => 
          renderMoveDestinations(subSection, [...path, subIndex], depth + 1)
        )}
      </div>
    );
  };

  // Fonctions de déplacement entre sections
  const initiateMoveSection = (sourcePath: number[], sourceIndex: number) => {
    const sourceSection = findSectionByPath(sections, sourcePath[0], sourcePath.slice(1));
    if (sourceSection?.sousSections && sourceSection.sousSections[sourceIndex]) {
      setMoveItem({
        type: 'section',
        sourcePath,
        sourceIndex,
        item: sourceSection.sousSections[sourceIndex]
      });
      setShowMoveModal(true);
    }
  };

  const initiateMoveMatériel = (sourcePath: number[], sourceIndex: number) => {
    const sourceSection = findSectionByPath(sections, sourcePath[0], sourcePath.slice(1));
    if (sourceSection?.materiels && sourceSection.materiels[sourceIndex]) {
      setMoveItem({
        type: 'materiel',
        sourcePath,
        sourceIndex,
        item: sourceSection.materiels[sourceIndex]
      });
      setShowMoveModal(true);
    }
  };

  const moveItemToDestination = (destinationPath: number[]) => {
    if (!moveItem) return;

    const newSections = [...sections];
    
    // Trouver et retirer l'élément source
    const sourceSection = findSectionByPath(newSections, moveItem.sourcePath[0], moveItem.sourcePath.slice(1));
    if (!sourceSection) return;

    let movedItem: Section | Materiel;
    
    if (moveItem.type === 'section' && sourceSection.sousSections) {
      movedItem = sourceSection.sousSections.splice(moveItem.sourceIndex, 1)[0];
    } else if (moveItem.type === 'materiel' && sourceSection.materiels) {
      movedItem = sourceSection.materiels.splice(moveItem.sourceIndex, 1)[0];
    } else {
      return;
    }

    // Trouver la section de destination
    const destinationSection = findSectionByPath(newSections, destinationPath[0], destinationPath.slice(1));
    if (!destinationSection) return;

    // Ajouter l'élément à la destination
    if (moveItem.type === 'section') {
      if (!destinationSection.sousSections) {
        destinationSection.sousSections = [];
      }
      destinationSection.sousSections.push(movedItem as Section);
    } else if (moveItem.type === 'materiel') {
      if (!destinationSection.materiels) {
        destinationSection.materiels = [];
      }
      destinationSection.materiels.push(movedItem as Materiel);
    }

    setSections(newSections);
    setHasChanges(true);
    
    // Fermer le modal
    setShowMoveModal(false);
    setMoveItem(null);
  };

  // Fonctions pour la copie entre véhicules
  const initiateCopyToVehicle = (sourcePath: number[], sourceIndex: number, type: 'section' | 'materiel') => {
    const sourceSection = findSectionByPath(sections, sourcePath[0], sourcePath.slice(1));
    let item: Section | Materiel | null = null;

    if (type === 'section' && sourceSection?.sousSections) {
      item = sourceSection.sousSections[sourceIndex];
    } else if (type === 'materiel' && sourceSection?.materiels) {
      item = sourceSection.materiels[sourceIndex];
    }

    if (item && currentVehicule) {
      setCopyItem({
        type,
        sourcePath,
        sourceIndex,
        item: JSON.parse(JSON.stringify(item)), // Deep copy pour éviter les références
        sourceVehicleId: currentVehicule.id
      });
      setShowCopyToVehicleModal(true);
    }
  };

  // Fonction utilitaire pour générer des IDs uniques
  const generateUniqueId = (baseId: string, existingIds: string[]): string => {
    let newId = baseId;
    let counter = 1;
    
    while (existingIds.includes(newId)) {
      newId = `${baseId}_copie_${counter}`;
      counter++;
    }
    
    return newId;
  };

  // Fonction récursive pour récupérer tous les IDs d'une structure
  const getAllIds = (sections: Section[]): string[] => {
    const ids: string[] = [];
    
    sections.forEach(section => {
      ids.push(section.id);
      
      if (section.materiels) {
        section.materiels.forEach(materiel => {
          ids.push(materiel.id);
        });
      }
      
      if (section.sousSections) {
        ids.push(...getAllIds(section.sousSections));
      }
    });
    
    return ids;
  };

  // Fonction récursive pour mettre à jour tous les IDs d'une section copiée
  const updateAllIds = (item: Section | Materiel, existingIds: string[]): void => {
    if ('sousSections' in item || 'materiels' in item) {
      // C'est une section
      const section = item as Section;
      section.id = generateUniqueId(section.id, existingIds);
      existingIds.push(section.id);
      
      if (section.materiels) {
        section.materiels.forEach(materiel => {
          materiel.id = generateUniqueId(materiel.id, existingIds);
          existingIds.push(materiel.id);
        });
      }
      
      if (section.sousSections) {
        section.sousSections.forEach(sousSection => {
          updateAllIds(sousSection, existingIds);
        });
      }
    } else {
      // C'est un matériel
      const materiel = item as Materiel;
      materiel.id = generateUniqueId(materiel.id, existingIds);
      existingIds.push(materiel.id);
    }
  };

  const loadDestinationVehicleSections = async (vehiculeId: string) => {
    try {
      // Charger d'abord la configuration personnalisée si elle existe
      const customConfig = await VehiculeConfigService.getVehiculeConfig(vehiculeId);
      if (customConfig) {
        setDestinationVehicleSections(customConfig.sections);
        return;
      }
      
      // Sinon, charger la configuration par défaut
      const defaultVehicule = Object.values(vehicules).find(v => v.id === vehiculeId);
      if (defaultVehicule) {
        setDestinationVehicleSections(defaultVehicule.sections);
      }
    } catch (error) {
      console.error('❌ Erreur chargement sections destination:', error);
      setDestinationVehicleSections([]);
    }
  };

  const copyItemToVehicle = async (destinationVehicleId: string, destinationSectionIndex: number) => {
    if (!copyItem) return;

    try {
      setMessage('⏳ Copie en cours...');
      
      // Charger la configuration du véhicule de destination
      const destinationConfig = await VehiculeConfigService.getVehiculeConfig(destinationVehicleId);
      let destinationSections: Section[];
      
      if (destinationConfig) {
        destinationSections = [...destinationConfig.sections];
      } else {
        // Utiliser la configuration par défaut
        const defaultVehicule = Object.values(vehicules).find(v => v.id === destinationVehicleId);
        if (!defaultVehicule) {
          setMessage('❌ Véhicule de destination introuvable');
          setTimeout(() => setMessage(''), 3000);
          return;
        }
        destinationSections = JSON.parse(JSON.stringify(defaultVehicule.sections));
      }

      // Créer une copie de l'élément avec des IDs uniques
      const itemCopy = JSON.parse(JSON.stringify(copyItem.item));
      const existingIds = getAllIds(destinationSections);
      updateAllIds(itemCopy, existingIds);

      // Ajouter l'élément copié à la section de destination
      const destinationSection = destinationSections[destinationSectionIndex];
      if (!destinationSection) {
        setMessage('❌ Section de destination invalide');
        setTimeout(() => setMessage(''), 3000);
        return;
      }

      if (copyItem.type === 'section') {
        if (!destinationSection.sousSections) {
          destinationSection.sousSections = [];
        }
        destinationSection.sousSections.push(itemCopy as Section);
      } else if (copyItem.type === 'materiel') {
        if (!destinationSection.materiels) {
          destinationSection.materiels = [];
        }
        destinationSection.materiels.push(itemCopy as Materiel);
      }

      // Créer le véhicule de destination mis à jour
      const destinationVehiculeNom = allVehicules.find(v => v.id === destinationVehicleId)?.nom || destinationVehicleId;
      const updatedDestinationVehicule: Vehicule = {
        id: destinationVehicleId,
        nom: destinationVehiculeNom,
        sections: destinationSections,
        isCustom: true
      };

      // Sauvegarder la configuration mise à jour
      const success = await VehiculeConfigService.saveVehiculeConfig(updatedDestinationVehicule);
      
      if (success) {
        setMessage(`✅ ${copyItem.type === 'section' ? 'Section' : 'Matériel'} copié vers ${destinationVehiculeNom}`);
        
        // Fermer la modal
        setShowCopyToVehicleModal(false);
        setCopyItem(null);
        setSelectedDestinationVehicle('');
        setDestinationVehicleSections([]);
      } else {
        setMessage('❌ Erreur lors de la sauvegarde');
      }
    } catch (error) {
      console.error('❌ Erreur copie vers véhicule:', error);
      setMessage('❌ Erreur lors de la copie');
    }
    
    setTimeout(() => setMessage(''), 4000);
  };

  const removeSection = (sectionIndex: number) => {
    if (!confirm('Supprimer cette section et tous ses matériels ?')) return;
    
    const newSections = sections.filter((_, index) => index !== sectionIndex);
    setSections(newSections);
    setHasChanges(true);
  };

  const addSubSection = (sectionIndex: number, path?: number[]) => {
    const newSections = [...sections];
    let parentSection: Section | null = null;
    
    // Navigation vers la section cible
    if (path && path.length > 0) {
      // Le path représente le chemin vers la section où nous voulons ajouter la sous-section
      // Le premier élément est l'index de la section principale
      const mainSectionIndex = path[0];
      const subPath = path.slice(1);
      parentSection = findSectionByPath(newSections, mainSectionIndex, subPath);
    } else {
      // Logique existante pour compatibilité
      parentSection = newSections[sectionIndex];
    }
    
    if (!parentSection) {
      console.error('❌ Section parent non trouvée');
      return;
    }
    
    if (!parentSection.sousSections) {
      parentSection.sousSections = [];
    }
    
    const newSubSection: Section = {
      id: `subsection_${Date.now()}`,
      nom: 'Nouvelle sous-section',
      materiels: []
    };
    
    parentSection.sousSections.push(newSubSection);
    setSections(newSections);
    setHasChanges(true);
    
    // Ouvrir automatiquement la section parent pour voir la nouvelle sous-section
    const parentSectionKey = path && path.length > 0 
      ? `${sectionIndex}_${path.join('_')}` 
      : `${sectionIndex}`;
    const newExpanded = new Set(expandedSections);
    newExpanded.add(parentSectionKey);
    setExpandedSections(newExpanded);
  };

  const saveChanges = async () => {
    if (!currentVehicule) return;
    
    setMessage('💾 Sauvegarde en cours...');
    
    try {
      const updatedVehicule = {
        ...currentVehicule,
        sections: sections
      };
      
      // Sauvegarder dans Firebase
      await VehiculeConfigService.saveVehiculeConfig(updatedVehicule);
      
      setMessage('✅ Configuration sauvegardée avec succès !');
      setHasChanges(false);
    } catch (error) {
      console.error('❌ Erreur sauvegarde:', error);
      setMessage('❌ Erreur lors de la sauvegarde');
    }
    
    setTimeout(() => setMessage(''), 3000);
  };

  // Fonctions pour créer un nouveau véhicule
  const createNewVehicule = async () => {
    if (!newVehiculeForm.id.trim() || !newVehiculeForm.nom.trim()) {
      setMessage('❌ Veuillez remplir tous les champs');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    // Vérifier que l'ID n'existe pas déjà
    const vehiculeIdUpper = newVehiculeForm.id.toUpperCase();
    if (allVehicules.some(v => v.id === vehiculeIdUpper)) {
      setMessage('❌ Un véhicule avec cet ID existe déjà');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    try {
      // Créer un nouveau véhicule avec une structure de base
      const nouveauVehicule: Vehicule = {
        id: vehiculeIdUpper,
        nom: newVehiculeForm.nom,
        sections: [
          {
            id: 'general',
            nom: 'Général',
            materiels: [
              {
                id: 'etat_general',
                nom: 'État général du véhicule',
                type: 'checkbox-presence'
              }
            ]
          }
        ]
      };

      // Sauvegarder dans Firebase
      await VehiculeConfigService.saveVehiculeConfig(nouveauVehicule);
      
      // Recharger la liste des véhicules
      await loadAllVehicules();
      
      // Fermer la modal et sélectionner le nouveau véhicule
      setShowCreateModal(false);
      setNewVehiculeForm({ id: '', nom: '' });
      setSelectedVehicule(vehiculeIdUpper);
      
      setMessage('✅ Nouveau véhicule créé avec succès !');
      setTimeout(() => setMessage(''), 3000);
      
    } catch (error) {
      console.error('❌ Erreur création véhicule:', error);
      setMessage('❌ Erreur lors de la création du véhicule');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const cancelCreateVehicule = () => {
    setShowCreateModal(false);
    setNewVehiculeForm({ id: '', nom: '' });
  };

  // Fonctions de gestion des véhicules
  const toggleVehiculeVisibility = async (vehiculeId: string) => {
    try {
      const success = await VehiculeManagementService.toggleVehiculeVisibility(vehiculeId);
      if (success) {
        // Recharger la visibilité pour mettre à jour l'état
        await loadVehiculeVisibilities();
        await loadAllVehicules();
        setMessage('✅ Visibilité du véhicule mise à jour');
      } else {
        setMessage('❌ Erreur lors de la mise à jour de la visibilité');
      }
    } catch (error) {
      console.error('❌ Erreur toggle visibilité:', error);
      setMessage('❌ Erreur lors de la mise à jour de la visibilité');
    }
    setTimeout(() => setMessage(''), 3000);
  };

  const openRenameModal = (vehiculeId: string, currentName: string) => {
    setRenameForm({ vehiculeId, newName: currentName });
    setShowRenameModal(true);
  };

  const renameVehicule = async () => {
    if (!renameForm.newName.trim()) {
      setMessage('❌ Veuillez saisir un nouveau nom');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    try {
      const success = await VehiculeManagementService.renameVehicule(renameForm.vehiculeId, renameForm.newName);
      if (success) {
        await loadAllVehicules();
        setShowRenameModal(false);
        setRenameForm({ vehiculeId: '', newName: '' });
        setMessage('✅ Véhicule renommé avec succès');
      } else {
        setMessage('❌ Erreur lors du renommage');
      }
    } catch (error) {
      console.error('❌ Erreur renommage:', error);
      setMessage('❌ Erreur lors du renommage');
    }
    setTimeout(() => setMessage(''), 3000);
  };

  const deleteVehicule = async (vehiculeId: string, vehiculeNom: string) => {
    // Double confirmation pour éviter les suppressions accidentelles
    const firstConfirm = confirm(
      `⚠️ ATTENTION: Vous allez supprimer définitivement le véhicule "${vehiculeNom}" (ID: ${vehiculeId}).\n\n` +
      `Cette action est IRRÉVERSIBLE et supprimera:\n` +
      `• La configuration personnalisée du véhicule\n` +
      `• Tous les métadonnées associées\n` +
      `• L'historique des modifications\n\n` +
      `Êtes-vous sûr de vouloir continuer ?`
    );
    
    if (!firstConfirm) return;
    
    const secondConfirm = confirm(
      `🔥 DERNIÈRE CONFIRMATION\n\n` +
      `Tapez le nom du véhicule pour confirmer la suppression:\n` +
      `Véhicule à supprimer: "${vehiculeNom}"\n\n` +
      `Voulez-vous vraiment supprimer ce véhicule ?`
    );
    
    if (!secondConfirm) return;

    try {
      setMessage('⏳ Suppression en cours...');
      
      const success = await VehiculeManagementService.deleteVehicule(vehiculeId);
      
      if (success) {
        // Recharger les listes pour refléter la suppression
        await loadAllVehicules();
        await loadVehiculeVisibilities();
        
        // Si le véhicule supprimé était sélectionné, désélectionner
        if (selectedVehicule === vehiculeId) {
          setSelectedVehicule('');
          setCurrentVehicule(null);
          setSections([]);
          setHasChanges(false);
        }
        
        setMessage('✅ Véhicule supprimé avec succès');
      } else {
        setMessage('❌ Erreur lors de la suppression du véhicule');
      }
    } catch (error) {
      console.error('❌ Erreur suppression véhicule:', error);
      setMessage('❌ Erreur lors de la suppression du véhicule');
    }
    
    setTimeout(() => setMessage(''), 5000);
  };

  const openDuplicateModal = (vehiculeId: string) => {
    setDuplicateForm({ 
      sourceId: vehiculeId, 
      newId: `${vehiculeId}_COPIE`, 
      newName: `${allVehicules.find(v => v.id === vehiculeId)?.nom || ''} - Copie` 
    });
    setShowDuplicateModal(true);
  };

  const duplicateVehicule = async () => {
    if (!duplicateForm.newId.trim() || !duplicateForm.newName.trim()) {
      setMessage('❌ Veuillez remplir tous les champs');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    // Vérifier que l'ID n'existe pas déjà
    const newIdUpper = duplicateForm.newId.toUpperCase();
    if (allVehicules.some(v => v.id === newIdUpper)) {
      setMessage('❌ Un véhicule avec cet ID existe déjà');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    try {
      const originalVehicule = allVehicules.find(v => v.id === duplicateForm.sourceId);
      if (!originalVehicule) {
        setMessage('❌ Véhicule source introuvable');
        setTimeout(() => setMessage(''), 3000);
        return;
      }

      const success = await VehiculeManagementService.duplicateVehicule(
        originalVehicule, 
        newIdUpper, 
        duplicateForm.newName
      );

      if (success) {
        await loadAllVehicules();
        setShowDuplicateModal(false);
        setDuplicateForm({ sourceId: '', newId: '', newName: '' });
        setSelectedVehicule(newIdUpper);
        setMessage('✅ Véhicule dupliqué avec succès');
      } else {
        setMessage('❌ Erreur lors de la duplication');
      }
    } catch (error) {
      console.error('❌ Erreur duplication:', error);
      setMessage('❌ Erreur lors de la duplication');
    }
    setTimeout(() => setMessage(''), 3000);
  };

  const exportConfig = () => {
    if (!currentVehicule) return;
    
    const config = {
      ...currentVehicule,
      sections: sections
    };
    
    const dataStr = JSON.stringify(config, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${currentVehicule.id}_config.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Fonction d'import JSON
  const importVehiculeFromJSON = async () => {
    if (!importForm.jsonContent.trim()) {
      setMessage('❌ Veuillez coller le contenu JSON');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    try {
      // Parser le JSON
      const vehiculeData = JSON.parse(importForm.jsonContent);
      
      // Valider les données
      const validation = validateImportedVehicule(vehiculeData);
      if (!validation.isValid) {
        setMessage(`❌ JSON invalide: ${validation.errors.join(', ')}`);
        setTimeout(() => setMessage(''), 3000);
        return;
      }

      // Vérifier que l'ID n'existe pas déjà
      const vehiculeIdUpper = vehiculeData.id.toUpperCase();
      if (allVehicules.some(v => v.id === vehiculeIdUpper)) {
        setMessage('❌ Un véhicule avec cet ID existe déjà');
        setTimeout(() => setMessage(''), 3000);
        return;
      }

      // Nettoyer et migrer le véhicule
      const cleanedVehicule = cleanImportedVehicule(vehiculeData);

      // Sauvegarder dans Firebase
      const success = await VehiculeConfigService.saveVehiculeConfig(cleanedVehicule);
      
      if (success) {
        await loadAllVehicules();
        setShowImportModal(false);
        setImportForm({ jsonContent: '', fileName: '' });
        setSelectedVehicule(vehiculeIdUpper);
        setMessage('✅ Véhicule importé avec succès !');
      } else {
        setMessage('❌ Erreur lors de l\'import');
      }
    } catch (error) {
      console.error('❌ Erreur import JSON:', error);
      if (error instanceof SyntaxError) {
        setMessage('❌ Format JSON invalide');
      } else {
        setMessage('❌ Erreur lors de l\'import du véhicule');
      }
    }
    setTimeout(() => setMessage(''), 3000);
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setImportForm({
          jsonContent: content,
          fileName: file.name
        });
      };
      reader.readAsText(file);
    }
  };

  // Gestion du changement de mot de passe
  const handlePasswordChange = async () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordError('Tous les champs sont obligatoires');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Les nouveaux mots de passe ne correspondent pas');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setPasswordError('Le nouveau mot de passe doit contenir au moins 6 caractères');
      return;
    }

    setPasswordLoading(true);
    setPasswordError('');

    try {
      const success = await AdminAuthService.changePassword(
        passwordForm.currentPassword,
        passwordForm.newPassword,
        'Admin' // Remplacer par le nom de l'utilisateur connecté si disponible
      );

      if (success) {
        alert('✅ Mot de passe modifié avec succès !');
        setShowPasswordModal(false);
        setPasswordForm({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
      }
    } catch (error: any) {
      setPasswordError(error.message || 'Erreur lors du changement de mot de passe');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleCancelPasswordChange = () => {
    setShowPasswordModal(false);
    setPasswordForm({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
    setPasswordError('');
  };

  // Fonction utilitaire pour trouver et modifier un matériel par son ID
  const updateMaterielQuantiteById = (materielId: string, nouvelleValeur: number) => {
    const findAndUpdateMateriel = (sections: Section[]): boolean => {
      for (const section of sections) {
        // Vérifier les matériels de la section principale
        if (section.materiels) {
          const materielIndex = section.materiels.findIndex(m => m.id === materielId);
          if (materielIndex !== -1) {
            section.materiels[materielIndex].valeur = nouvelleValeur;
            return true;
          }
        }
        
        // Vérifier récursivement dans les sous-sections
        if (section.sousSections && findAndUpdateMateriel(section.sousSections)) {
          return true;
        }
      }
      return false;
    };
    
    const newSections = [...sections];
    if (findAndUpdateMateriel(newSections)) {
      setSections(newSections);
      setHasChanges(true);
      return true;
    } else {
      return false;
    }
  };

  const renderMateriel = (materiel: Materiel, sectionIndex: number, materielIndex: number, subSectionIndex?: number, path?: number[]) => {
    return (
    <div key={materiel.id} className="admin-materiel-item">
      <div className="admin-materiel-header">
        <input
          type="text"
          value={materiel.nom}
          onChange={(e) => updateMaterielName(sectionIndex, materielIndex, e.target.value, subSectionIndex, path)}
          className="admin-input admin-materiel-name"
        />
        <select
          value={materiel.type || 'checkbox-presence'}
          onChange={(e) => updateMaterielType(sectionIndex, materielIndex, e.target.value, subSectionIndex, path)}
          className="admin-select admin-materiel-type"
        >
          <option value="checkbox-presence">Présence seulement</option>
          <option value="checkbox-fonction">Présence et Fonction</option>
          <option value="checkbox-ok">Case à cocher "OK"</option>
          <option value="radio">Boutons radio</option>
          <option value="quantite">Quantité</option>
          <option value="select">Liste déroulante</option>
          <option value="niveau">Niveau (Plein/Moyen/Bas/Vide)</option>
          <option value="etat">État (Bon/Moyen/Mauvais)</option>
          <option value="conformite">Conformité (Conforme/Non conforme)</option>
          <option value="statut-ternaire">Statut (Bon/Moyen/Mauvais)</option>
          <option value="date">Date</option>
          <option value="texte-libre">Texte libre</option>
          <option value="photo">Photo</option>
        </select>
        
        {/* Boutons de déplacement pour les matériels */}
        <div className="admin-move-buttons">
          <button
            onClick={() => moveMaterielUp(sectionIndex, materielIndex, subSectionIndex, path)}
            className="admin-btn admin-btn-move"
            title="Déplacer vers le haut"
            disabled={materielIndex === 0}
          >
            ⬆️
          </button>
          <button
            onClick={() => moveMaterielDown(sectionIndex, materielIndex, subSectionIndex, path)}
            className="admin-btn admin-btn-move"
            title="Déplacer vers le bas"
            disabled={(() => {
              const newSections = [...sections];
              let targetSection = newSections[sectionIndex];
              if (subSectionIndex !== undefined && targetSection?.sousSections) {
                targetSection = targetSection.sousSections[subSectionIndex];
              }
              return !targetSection?.materiels || materielIndex === targetSection.materiels.length - 1;
            })()}
          >
            ⬇️
          </button>
        </div>
        
        <button
          onClick={() => {
            const materielPath = path || (subSectionIndex !== undefined ? [sectionIndex, subSectionIndex] : [sectionIndex]);
            initiateMoveMatériel(materielPath, materielIndex);
          }}
          className="admin-btn admin-btn-info"
          title="Déplacer vers une autre section"
        >
          📦
        </button>
        
        <button
          onClick={() => {
            const materielPath = path || (subSectionIndex !== undefined ? [sectionIndex, subSectionIndex] : [sectionIndex]);
            initiateCopyToVehicle(materielPath, materielIndex, 'materiel');
          }}
          className="admin-btn admin-btn-success"
          title="Copier vers un autre véhicule"
        >
          🚚
        </button>
        
        <button
          onClick={() => removeMateriel(sectionIndex, materielIndex, subSectionIndex, path)}
          className="admin-btn admin-btn-danger"
          title="Supprimer"
        >
          🗑️
        </button>
      </div>
      
      {materiel.type === 'quantite' && (
        <div className="admin-materiel-config">
          <label>
            Quantité attendue:
            <input
              type="number"
              min="0"
              value={materiel.valeur || 1}
              onChange={(e) => {
                // Utiliser la nouvelle fonction basée sur l'ID
                const nouvelleValeur = parseInt(e.target.value);
                if (!updateMaterielQuantiteById(materiel.id, nouvelleValeur)) {
                  // Fallback vers l'ancienne méthode si la nouvelle échoue
                  const newSections = [...sections];
                  let targetSection = newSections[sectionIndex];
                  
                  if (subSectionIndex !== undefined && targetSection?.sousSections) {
                    targetSection = targetSection.sousSections[subSectionIndex];
                  }
                  
                  if (targetSection?.materiels && targetSection.materiels[materielIndex]) {
                    targetSection.materiels[materielIndex].valeur = nouvelleValeur;
                    setSections(newSections);
                    setHasChanges(true);
                  }
                }
              }}
              className="admin-input admin-input-small"
            />
          </label>
        </div>
      )}
      
      {materiel.type === 'radio' && (
        <div className="admin-materiel-config">
          <label>Labels des boutons (RAS / Défaut):</label>
          <div className="admin-radio-config">
            <input
              type="text"
              value={materiel.options?.[0] || 'RAS'}
              onChange={(e) => {
                const newSections = [...sections];
                let targetSection = newSections[sectionIndex];
                if (subSectionIndex !== undefined && targetSection?.sousSections) {
                  targetSection = targetSection.sousSections[subSectionIndex];
                }
                if (targetSection?.materiels && targetSection.materiels[materielIndex]) {
                  if (!targetSection.materiels[materielIndex].options) {
                    targetSection.materiels[materielIndex].options = ['RAS', 'Voyant(s) allumé(s)'];
                  }
                  targetSection.materiels[materielIndex].options![0] = e.target.value;
                  setSections(newSections);
                  setHasChanges(true);
                }
              }}
              className="admin-input"
              placeholder="RAS"
            />
            <input
              type="text"
              value={materiel.options?.[1] || 'Voyant(s) allumé(s)'}
              onChange={(e) => {
                const newSections = [...sections];
                let targetSection = newSections[sectionIndex];
                if (subSectionIndex !== undefined && targetSection?.sousSections) {
                  targetSection = targetSection.sousSections[subSectionIndex];
                }
                if (targetSection?.materiels && targetSection.materiels[materielIndex]) {
                  if (!targetSection.materiels[materielIndex].options) {
                    targetSection.materiels[materielIndex].options = ['RAS', 'Voyant(s) allumé(s)'];
                  }
                  targetSection.materiels[materielIndex].options![1] = e.target.value;
                  setSections(newSections);
                  setHasChanges(true);
                }
              }}
              className="admin-input"
              placeholder="Défaut"
            />
          </div>
        </div>
      )}
      
      {materiel.type === 'select' && (
        <div className="admin-materiel-config">
          <label>Options (une par ligne):</label>
          <textarea
            value={materiel.options?.join('\n') || ''}
            onChange={(e) => {
              const newSections = [...sections];
              let targetSection = newSections[sectionIndex];
              if (subSectionIndex !== undefined && targetSection?.sousSections) {
                targetSection = targetSection.sousSections[subSectionIndex];
              }
              if (targetSection?.materiels && targetSection.materiels[materielIndex]) {
                targetSection.materiels[materielIndex].options = e.target.value.split('\n').filter(o => o.trim());
                setSections(newSections);
                setHasChanges(true);
              }
            }}
            className="admin-textarea"
            rows={3}
            placeholder="Option 1&#10;Option 2&#10;Option 3"
          />
        </div>
      )}
    </div>
    );
  };

  const renderSection = (section: Section, sectionIndex: number, isSubSection = false, parentIndex?: number, pathFromRoot: number[] = []) => {
    const sectionKey = isSubSection ? `${parentIndex}_${pathFromRoot.join('_')}` : `${sectionIndex}`;
    const isExpanded = expandedSections.has(sectionKey);
    
    return (
      <div key={section.id} className={`admin-section ${isSubSection ? 'admin-subsection' : ''}`}>
        <div className="admin-section-header">
          <button
            onClick={() => toggleSection(sectionKey)}
            className="admin-expand-btn"
          >
            {isExpanded ? '▼' : '▶'}
          </button>
          <input
            type="text"
            value={section.nom}
            onChange={(e) => {
              const newSections = [...sections];
              if (pathFromRoot.length === 0) {
                // Section principale
                newSections[sectionIndex].nom = e.target.value;
              } else {
                // Sous-section
                const targetSection = findSectionByPath(newSections, pathFromRoot[0], pathFromRoot.slice(1));
                if (targetSection) {
                  targetSection.nom = e.target.value;
                }
              }
              setSections(newSections);
              setHasChanges(true);
            }}
            className="admin-input admin-section-name"
          />
          <div className="admin-section-actions">
            {/* Boutons de déplacement pour les sections */}
            {!isSubSection && (
              <div className="admin-move-buttons">
                <button
                  onClick={() => moveSectionUp(sectionIndex)}
                  className="admin-btn admin-btn-move"
                  title="Déplacer vers le haut"
                  disabled={sectionIndex === 0}
                >
                  ⬆️
                </button>
                <button
                  onClick={() => moveSectionDown(sectionIndex)}
                  className="admin-btn admin-btn-move"
                  title="Déplacer vers le bas"
                  disabled={sectionIndex === sections.length - 1}
                >
                  ⬇️
                </button>
              </div>
            )}
            
            {/* Boutons de déplacement pour les sous-sections */}
            {isSubSection && parentIndex !== undefined && (
              <div className="admin-move-buttons">
                <button
                  onClick={() => moveSubSectionUp(parentIndex, sectionIndex)}
                  className="admin-btn admin-btn-move"
                  title="Déplacer vers le haut"
                  disabled={sectionIndex === 0}
                >
                  ⬆️
                </button>
                <button
                  onClick={() => moveSubSectionDown(parentIndex, sectionIndex)}
                  className="admin-btn admin-btn-move"
                  title="Déplacer vers le bas"
                  disabled={sectionIndex === (sections[parentIndex]?.sousSections?.length ?? 1) - 1}
                >
                  ⬇️
                </button>
              </div>
            )}
            
            <button
              onClick={() => {
                if (isSubSection) {
                  // Pour les sous-sections, ajouter une sous-sous-section
                  // On utilise le premier élément du path (index de la section principale)
                  // et on passe le path complet incluant l'index de la sous-section actuelle
                  const fullPath = [...pathFromRoot];
                  addSubSection(pathFromRoot[0], fullPath);
                } else {
                  // Pour les sections principales
                  addSubSection(sectionIndex);
                }
              }}
              className="admin-btn admin-btn-secondary"
              title="Ajouter sous-section"
            >
              ➕ Sous-section
            </button>
            <button
              onClick={() => {
                if (isSubSection) {
                  // Pour les sous-sections profondes, utiliser le chemin complet
                  addMateriel(pathFromRoot[0], undefined, pathFromRoot);
                } else {
                  // Pour les sections principales
                  addMateriel(sectionIndex);
                }
              }}
              className="admin-btn admin-btn-secondary"
              title="Ajouter matériel"
            >
              ➕ Matériel
            </button>
            {isSubSection && (
              <>
                <button
                  onClick={() => {
                    const sourcePath = pathFromRoot.slice(0, -1); // Chemin parent
                    const sourceIndex = pathFromRoot[pathFromRoot.length - 1]; // Index dans le parent
                    initiateMoveSection(sourcePath, sourceIndex);
                  }}
                  className="admin-btn admin-btn-info"
                  title="Déplacer cette sous-section vers une autre section"
                >
                  📦
                </button>
                
                <button
                  onClick={() => {
                    const sourcePath = pathFromRoot.slice(0, -1); // Chemin parent
                    const sourceIndex = pathFromRoot[pathFromRoot.length - 1]; // Index dans le parent
                    initiateCopyToVehicle(sourcePath, sourceIndex, 'section');
                  }}
                  className="admin-btn admin-btn-success"
                  title="Copier cette sous-section vers un autre véhicule"
                >
                  🚚
                </button>
              </>
            )}
            {!isSubSection && (
              <button
                onClick={() => {
                  initiateCopyToVehicle([], sectionIndex, 'section');
                }}
                className="admin-btn admin-btn-success"
                title="Copier cette section vers un autre véhicule"
              >
                🚚
              </button>
            )}
            <button
              onClick={() => {
                if (isSubSection) {
                  if (!confirm('Supprimer cette sous-section ?')) return;
                  removeSubSection(pathFromRoot);
                } else {
                  removeSection(sectionIndex);
                }
              }}
              className="admin-btn admin-btn-danger"
              title="Supprimer"
            >
              🗑️
            </button>
          </div>
        </div>
        
        {isExpanded && (
          <div className="admin-section-content">
            {/* Matériels de la section */}
            {section.materiels?.map((materiel, materielIndex) => 
              renderMateriel(materiel, isSubSection ? parentIndex! : sectionIndex, materielIndex, isSubSection ? sectionIndex : undefined, isSubSection ? pathFromRoot : undefined)
            )}
            
            {/* Sous-sections */}
            {section.sousSections?.map((subSection, subIndex) => {
              const newPath = isSubSection ? [...pathFromRoot, subIndex] : [sectionIndex, subIndex];
              return renderSection(subSection, subIndex, true, isSubSection ? parentIndex : sectionIndex, newPath);
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h1>⚙️ Administration des Véhicules</h1>
        <div className="admin-header-actions">
          <button 
            onClick={() => {
              AdminAuthService.clearAdminSession();
              alert('🔓 Déconnexion réussie. Vous devrez vous reconnecter pour accéder à l\'administration.');
              onReturnHome();
            }}
            className="admin-btn admin-btn-logout"
            title="Se déconnecter de l'administration"
          >
            🔓 Déconnexion
          </button>
          <button 
            onClick={() => {
              if (hasChanges && !confirm('⚠️ Modifications non sauvegardées. Continuer ?')) return;
              onReturnHome();
            }}
            className="admin-btn admin-btn-home"
          >
            🏠 Accueil
          </button>
        </div>
      </div>

      <div className="admin-toolbar">
        <div className="admin-vehicle-selector">
          <label>
            Véhicule à modifier:
            <select
              value={selectedVehicule}
              onChange={(e) => handleVehiculeChange(e.target.value)}
              className="admin-select"
            >
              <option value="">-- Sélectionner un véhicule --</option>
              {allVehicules.map(vehicule => (
                <option key={vehicule.id} value={vehicule.id}>
                  {vehicule.nom} {vehiculeVisibility[vehicule.id] === false ? '(Masqué)' : ''}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="admin-vehicle-actions">
          <button
            onClick={() => setShowCreateModal(true)}
            className="admin-btn admin-btn-success"
            title="Créer un nouveau véhicule"
          >
            ➕ Nouveau Véhicule
          </button>
          
          <button
            onClick={() => setShowImportModal(true)}
            className="admin-btn admin-btn-secondary"
            title="Importer un véhicule depuis JSON"
          >
            📤 Importer JSON
          </button>
          
          <button
            onClick={() => setShowIconsModal(true)}
            className="admin-btn admin-btn-info"
            title="Voir toutes les icônes disponibles"
          >
            🎨 Icônes disponibles
          </button>
          
          <button
            onClick={() => setShowOrderModal(true)}
            className="admin-btn admin-btn-info"
            title="Gérer l'ordre d'affichage des véhicules"
          >
            🔄 Ordre des véhicules
          </button>
          
          <button
            onClick={() => setShowFamilleModal(true)}
            className="admin-btn admin-btn-info"
            title="Gérer les familles de véhicules"
          >
            🏷️ Familles
          </button>
          
          <button
            onClick={() => setShowConfigMensuelModal(true)}
            className="admin-btn admin-btn-info"
            title="Gérer les configurations des contrôles mensuels"
          >
            📋 Config. Mensuels
          </button>
          
          {selectedVehicule && (
            <button
              onClick={() => setShowManageModal(true)}
              className="admin-btn admin-btn-secondary"
              title="Gérer ce véhicule"
            >
              ⚙️ Gérer
            </button>
          )}
        </div>

        {currentVehicule && (
          <div className="admin-actions">
            <button
              onClick={saveChanges}
              disabled={!hasChanges}
              className={`admin-btn ${hasChanges ? 'admin-btn-primary' : 'admin-btn-disabled'}`}
            >
              💾 Sauvegarder
            </button>
            <button
              onClick={exportConfig}
              className="admin-btn admin-btn-secondary"
            >
              📥 Exporter JSON
            </button>
            <button
              onClick={() => {
                if (!confirm('⚠️ Êtes-vous sûr de vouloir réinitialiser vers la configuration par défaut ? Toutes les modifications seront perdues.')) return;
                
                const vehicule = Object.values(vehicules).find(v => v.id === selectedVehicule);
                if (vehicule) {
                  setSections(JSON.parse(JSON.stringify(vehicule.sections)));
                  setHasChanges(true);
                  setMessage('🔄 Configuration réinitialisée vers défaut');
                  setTimeout(() => setMessage(''), 3000);
                }
              }}
              className="admin-btn admin-btn-secondary"
            >
              🔄 Réinitialiser
            </button>
            <button
              onClick={addSection}
              className="admin-btn admin-btn-secondary"
            >
              ➕ Nouvelle section
            </button>
          </div>
        )}
      </div>

      {message && (
        <div className="admin-message">
          {message}
        </div>
      )}

      {currentVehicule && (
        <div className="admin-content">
          <div className="admin-vehicle-info">
            <h2>📋 {currentVehicule.nom}</h2>
            <p>ID: {currentVehicule.id}</p>
            {hasChanges && (
              <div className="admin-changes-indicator">
                ⚠️ Modifications non sauvegardées
              </div>
            )}
          </div>

          <div className="admin-sections">
            {sections.map((section, index) => renderSection(section, index))}
          </div>
        </div>
      )}

      {!selectedVehicule && (
        <div className="admin-welcome">
          <div className="admin-welcome-content">
            <h3>🚗 Gestion des Configurations Véhicules</h3>
            <p>Sélectionnez un véhicule pour modifier sa configuration d'inventaire.</p>
            <ul>
              <li>✏️ Modifier les noms des sections et matériels</li>
              <li>🔧 Changer les types de contrôle</li>
              <li>➕ Ajouter/supprimer sections et matériels</li>
              <li>💾 Sauvegarder les modifications</li>
              <li>📥 Exporter la configuration</li>
            </ul>
          </div>
        </div>
      )}

      {/* Modal de création de nouveau véhicule */}
      {showCreateModal && (
        <div className="modal-backdrop" onClick={cancelCreateVehicule}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>➕ Créer un nouveau véhicule</h2>
              <button 
                onClick={cancelCreateVehicule} 
                className="modal-close-btn"
                title="Fermer"
              >
                ✕
              </button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="vehicule-id">
                  ID du véhicule (ex: VSAV2, FPT, etc.):
                </label>
                <input
                  id="vehicule-id"
                  type="text"
                  value={newVehiculeForm.id}
                  onChange={(e) => setNewVehiculeForm(prev => ({ 
                    ...prev, 
                    id: e.target.value.toUpperCase() 
                  }))}
                  className="admin-input"
                  placeholder="VSAV2"
                  maxLength={20}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="vehicule-nom">
                  Nom du véhicule:
                </label>
                <input
                  id="vehicule-nom"
                  type="text"
                  value={newVehiculeForm.nom}
                  onChange={(e) => setNewVehiculeForm(prev => ({ 
                    ...prev, 
                    nom: e.target.value 
                  }))}
                  className="admin-input"
                  placeholder="VSAV 2"
                  maxLength={50}
                />
              </div>
              
              <div className="form-note">
                ℹ️ Le véhicule sera créé avec une structure de base que vous pourrez ensuite personnaliser.
              </div>
            </div>
            
            <div className="modal-footer">
              <button 
                onClick={cancelCreateVehicule}
                className="admin-btn admin-btn-secondary"
              >
                Annuler
              </button>
              <button 
                onClick={createNewVehicule}
                className="admin-btn admin-btn-primary"
                disabled={!newVehiculeForm.id.trim() || !newVehiculeForm.nom.trim()}
              >
                ✅ Créer le véhicule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de gestion du véhicule */}
      {showManageModal && currentVehicule && (
        <div className="modal-backdrop" onClick={() => setShowManageModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>⚙️ Gérer: {currentVehicule.nom}</h2>
              <button 
                onClick={() => setShowManageModal(false)} 
                className="modal-close-btn"
                title="Fermer"
              >
                ✕
              </button>
            </div>
            
            <div className="modal-body">
              <div className="manage-actions">
                <button
                  onClick={() => {
                    setShowManageModal(false);
                    openRenameModal(currentVehicule.id, currentVehicule.nom);
                  }}
                  className="admin-btn admin-btn-primary"
                  title="Renommer ce véhicule"
                >
                  ✏️ Renommer
                </button>
                
                <button
                  onClick={() => {
                    setShowManageModal(false);
                    openDuplicateModal(currentVehicule.id);
                  }}
                  className="admin-btn admin-btn-secondary"
                  title="Créer une copie de ce véhicule"
                >
                  📄 Dupliquer
                </button>
                
                <button
                  onClick={() => {
                    const isCurrentlyVisible = vehiculeVisibility[currentVehicule.id] !== false;
                    const action = isCurrentlyVisible ? 'masquer' : 'afficher';
                    if (confirm(`Voulez-vous ${action} le véhicule "${currentVehicule.nom}" ${isCurrentlyVisible ? 'de la liste' : 'dans la liste'} ?`)) {
                      toggleVehiculeVisibility(currentVehicule.id);
                      setShowManageModal(false);
                    }
                  }}
                  className="admin-btn admin-btn-warning"
                  title={vehiculeVisibility[currentVehicule.id] !== false ? "Masquer ce véhicule" : "Afficher ce véhicule"}
                >
                  {vehiculeVisibility[currentVehicule.id] !== false ? '� Masquer' : '👁️ Afficher'}
                </button>
                
                <button
                  onClick={() => {
                    setShowManageModal(false);
                    deleteVehicule(currentVehicule.id, currentVehicule.nom);
                  }}
                  className="admin-btn admin-btn-danger"
                  title="Supprimer définitivement ce véhicule"
                >
                  🗑️ Supprimer
                </button>
              </div>
              
              <div className="manage-info">
                <p><strong>ID:</strong> {currentVehicule.id}</p>
                <p><strong>Sections:</strong> {currentVehicule.sections.length}</p>
                <p><strong>Type:</strong> {currentVehicule.isCustom ? 'Personnalisé' : 'Par défaut'}</p>
                <p>
                  <strong>Visibilité:</strong> 
                  <span className={`visibility-status ${vehiculeVisibility[currentVehicule.id] !== false ? 'visible' : 'hidden'}`}>
                    {vehiculeVisibility[currentVehicule.id] !== false ? (
                      <>👁️ Visible</>
                    ) : (
                      <>🙈 Masqué</>
                    )}
                  </span>
                </p>
              </div>
            </div>
            
            <div className="modal-footer">
              <button 
                onClick={() => setShowManageModal(false)}
                className="admin-btn admin-btn-secondary"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de renommage */}
      {showRenameModal && (
        <div className="modal-backdrop" onClick={() => setShowRenameModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>✏️ Renommer le véhicule</h2>
              <button 
                onClick={() => setShowRenameModal(false)} 
                className="modal-close-btn"
                title="Fermer"
              >
                ✕
              </button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="rename-input">
                  Nouveau nom:
                </label>
                <input
                  id="rename-input"
                  type="text"
                  value={renameForm.newName}
                  onChange={(e) => setRenameForm(prev => ({ 
                    ...prev, 
                    newName: e.target.value 
                  }))}
                  className="admin-input"
                  placeholder="Nouveau nom du véhicule"
                  maxLength={50}
                />
              </div>
            </div>
            
            <div className="modal-footer">
              <button 
                onClick={() => setShowRenameModal(false)}
                className="admin-btn admin-btn-secondary"
              >
                Annuler
              </button>
              <button 
                onClick={renameVehicule}
                className="admin-btn admin-btn-primary"
                disabled={!renameForm.newName.trim()}
              >
                ✅ Renommer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de duplication */}
      {showDuplicateModal && (
        <div className="modal-backdrop" onClick={() => setShowDuplicateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📄 Dupliquer le véhicule</h2>
              <button 
                onClick={() => setShowDuplicateModal(false)} 
                className="modal-close-btn"
                title="Fermer"
              >
                ✕
              </button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="duplicate-id">
                  ID du nouveau véhicule:
                </label>
                <input
                  id="duplicate-id"
                  type="text"
                  value={duplicateForm.newId}
                  onChange={(e) => setDuplicateForm(prev => ({ 
                    ...prev, 
                    newId: e.target.value.toUpperCase() 
                  }))}
                  className="admin-input"
                  placeholder="VSAV3"
                  maxLength={20}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="duplicate-name">
                  Nom du nouveau véhicule:
                </label>
                <input
                  id="duplicate-name"
                  type="text"
                  value={duplicateForm.newName}
                  onChange={(e) => setDuplicateForm(prev => ({ 
                    ...prev, 
                    newName: e.target.value 
                  }))}
                  className="admin-input"
                  placeholder="VSAV 3"
                  maxLength={50}
                />
              </div>
              
              <div className="form-note">
                ℹ️ Le véhicule sera dupliqué avec toute sa configuration actuelle.
              </div>
            </div>
            
            <div className="modal-footer">
              <button 
                onClick={() => setShowDuplicateModal(false)}
                className="admin-btn admin-btn-secondary"
              >
                Annuler
              </button>
              <button 
                onClick={duplicateVehicule}
                className="admin-btn admin-btn-primary"
                disabled={!duplicateForm.newId.trim() || !duplicateForm.newName.trim()}
              >
                ✅ Dupliquer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal d'import JSON */}
      {showImportModal && (
        <div className="modal-backdrop" onClick={() => setShowImportModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📤 Importer un véhicule JSON</h2>
              <button 
                onClick={() => setShowImportModal(false)} 
                className="modal-close-btn"
                title="Fermer"
              >
                ✕
              </button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="file-import">
                  Importer depuis un fichier:
                </label>
                <input
                  id="file-import"
                  type="file"
                  accept=".json"
                  onChange={handleFileImport}
                  className="admin-input"
                />
                {importForm.fileName && (
                  <div className="form-note">
                    📁 Fichier sélectionné: {importForm.fileName}
                  </div>
                )}
              </div>
              
              <div className="form-group">
                <label htmlFor="json-content">
                  Ou coller le contenu JSON:
                </label>
                <textarea
                  id="json-content"
                  value={importForm.jsonContent}
                  onChange={(e) => setImportForm(prev => ({ 
                    ...prev, 
                    jsonContent: e.target.value 
                  }))}
                  className="admin-textarea"
                  rows={10}
                  placeholder='{\n  "id": "VSAV3",\n  "nom": "VSAV 3",\n  "sections": [...]\n}'
                />
              </div>
              
              <div className="form-note">
                ℹ️ Le véhicule sera automatiquement migré vers le nouveau format s'il utilise d'anciens types de matériels.
              </div>
            </div>
            
            <div className="modal-footer">
              <button 
                onClick={() => setShowImportModal(false)}
                className="admin-btn admin-btn-secondary"
              >
                Annuler
              </button>
              <button 
                onClick={importVehiculeFromJSON}
                className="admin-btn admin-btn-primary"
                disabled={!importForm.jsonContent.trim()}
              >
                ✅ Importer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal pour afficher toutes les icônes disponibles */}
      {showIconsModal && (
        <div className="modal-backdrop" onClick={() => setShowIconsModal(false)}>
          <div className="modal-content icon-selector-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🎨 Icônes disponibles pour les véhicules</h2>
              <button className="modal-close-btn" onClick={() => setShowIconsModal(false)} title="Fermer">✕</button>
            </div>
            
            <div className="icon-selector-content">
              <div className="search-section">
                <p style={{ margin: 0, color: '#64748b', textAlign: 'center' }}>
                  Liste complète des {VEHICULE_ICONS.length} icônes disponibles pour identifier vos véhicules
                </p>
              </div>

              {/* Affichage par catégorie */}
              <div style={{ padding: '1.5rem', flex: 1, overflowY: 'auto' }}>
                {Object.entries(ICON_CATEGORIES).map(([category, icons]) => (
                  <div key={category} style={{ marginBottom: '2rem' }}>
                    <h3 style={{ 
                      fontSize: '1.1rem', 
                      fontWeight: 600, 
                      color: '#1e293b', 
                      marginBottom: '1rem',
                      borderBottom: '2px solid #e5e7eb',
                      paddingBottom: '0.5rem'
                    }}>
                      {category} ({icons.length})
                    </h3>
                    <div className="icons-grid" style={{ marginBottom: 0 }}>
                      {icons.map((icon) => (
                        <div
                          key={icon.id}
                          className="icon-item"
                          style={{ cursor: 'default' }}
                          title={icon.description}
                        >
                          <div className="icon-emoji">{icon.emoji}</div>
                          <div className="icon-name">{icon.name}</div>
                          <div className="icon-category" style={{ fontSize: '0.7rem', opacity: 0.7 }}>
                            {icon.id}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de gestion de l'ordre des véhicules */}
      {showOrderModal && (
        <VehiculeOrderManager
          onClose={() => setShowOrderModal(false)}
          onOrderUpdated={() => {
            // Recharger la liste pour refléter le nouvel ordre
            loadAllVehicules();
            loadVehiculeVisibilities();
          }}
        />
      )}

      {/* Modal de gestion des familles */}
      {showFamilleModal && (
        <FamilleManager
          onClose={() => setShowFamilleModal(false)}
          onFamillesUpdated={() => {
            // Recharger la liste pour refléter les nouvelles familles
            loadAllVehicules();
            loadVehiculeVisibilities();
          }}
        />
      )}

      {/* Modal de gestion des configurations mensuelles */}
      {showConfigMensuelModal && (
        <div className="modal-backdrop" onClick={() => setShowConfigMensuelModal(false)}>
          <div className="modal-content config-mensuel-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📋 Gestion des Configurations Mensuelles</h2>
              <button 
                onClick={() => setShowConfigMensuelModal(false)} 
                className="modal-close-btn"
                title="Fermer"
              >
                ✕
              </button>
            </div>
            
            <div className="modal-body">
              <div className="config-mensuel-content">
                <div className="config-mensuel-header">
                  <h3>Configuration active</h3>
                  {configurationActive ? (
                    <div className="config-active-info">
                      <span className="config-name">📋 {configurationActive.nom}</span>
                      <span className="config-description">{configurationActive.description}</span>
                      <small>Créée le {configurationActive.dateCreation.toLocaleDateString()}</small>
                    </div>
                  ) : (
                    <div className="config-no-active">
                      ⚠️ Aucune configuration active - La configuration par défaut sera utilisée
                    </div>
                  )}
                </div>

                <div className="config-mensuel-actions">
                  <button
                    onClick={async () => {
                      const nom = prompt('Nom de la nouvelle configuration:', 'Ma Configuration Personnalisée');
                      if (!nom) return;
                      
                      const description = prompt('Description de la configuration:', 'Configuration personnalisée pour les contrôles mensuels');
                      if (!description) return;

                      try {
                        await configurationMensuelleService.creerNouvelleConfiguration(nom, description, 'admin');
                        await loadConfigurationsMensuelles();
                        setMessage('✅ Nouvelle configuration créée avec succès');
                        setTimeout(() => setMessage(''), 3000);
                      } catch (error) {
                        console.error('❌ Erreur création configuration:', error);
                        setMessage('❌ Erreur lors de la création de la configuration');
                        setTimeout(() => setMessage(''), 3000);
                      }
                    }}
                    className="admin-btn admin-btn-primary"
                  >
                    ➕ Créer une nouvelle configuration
                  </button>
                  
                  {!configurationActive && (
                    <button
                      onClick={async () => {
                        try {
                          await configurationMensuelleService.creerConfigurationParDefaut();
                          await loadConfigurationsMensuelles();
                          setMessage('✅ Configuration par défaut créée');
                          setTimeout(() => setMessage(''), 3000);
                        } catch (error) {
                          console.error('❌ Erreur création configuration par défaut:', error);
                          setMessage('❌ Erreur lors de la création de la configuration par défaut');
                          setTimeout(() => setMessage(''), 3000);
                        }
                      }}
                      className="admin-btn admin-btn-secondary"
                      style={{ marginLeft: '1rem' }}
                    >
                      🔧 Créer config. par défaut
                    </button>
                  )}
                </div>

                <div className="config-mensuel-list">
                  <h3>Toutes les configurations ({configurations.length})</h3>
                  {configurations.length === 0 ? (
                    <div className="config-empty">
                      <p>📋 Aucune configuration personnalisée trouvée.</p>
                      <p>La configuration par défaut sera automatiquement utilisée.</p>
                    </div>
                  ) : (
                    <div className="config-list">
                      {configurations.map((config) => (
                        <div key={config.id} className={`config-item ${config.actif ? 'active' : ''}`}>
                          <div className="config-item-header">
                            <span className="config-item-name">
                              {config.actif ? '🟢' : '⚪'} {config.nom}
                            </span>
                            <span className="config-item-status">
                              {config.actif ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          <div className="config-item-description">{config.description}</div>
                          <div className="config-item-meta">
                            <small>
                              {config.sections.length} sections • 
                              Créée le {config.dateCreation.toLocaleDateString()} • 
                              Modifiée le {config.dateModification.toLocaleDateString()}
                            </small>
                          </div>
                          <div className="config-item-actions">
                            {!config.actif && (
                              <button
                                onClick={async () => {
                                  try {
                                    await configurationMensuelleService.activerConfiguration(config.id);
                                    await loadConfigurationsMensuelles();
                                    setMessage('✅ Configuration activée');
                                    setTimeout(() => setMessage(''), 3000);
                                  } catch (error) {
                                    console.error('❌ Erreur activation:', error);
                                    setMessage('❌ Erreur lors de l\'activation');
                                    setTimeout(() => setMessage(''), 3000);
                                  }
                                }}
                                className="admin-btn admin-btn-success"
                                title="Activer cette configuration"
                              >
                                ✅ Activer
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setEditingConfig(config);
                                setShowEditModal(true);
                              }}
                              className="admin-btn admin-btn-info"
                              title="Modifier cette configuration"
                            >
                              ✏️ Modifier
                            </button>
                            <button
                              onClick={async () => {
                                try {
                                  const nouveauNom = `${config.nom} - Copie`;
                                  await configurationMensuelleService.dupliquerConfiguration(config.id, nouveauNom, 'admin');
                                  await loadConfigurationsMensuelles();
                                  setMessage('✅ Configuration dupliquée');
                                  setTimeout(() => setMessage(''), 3000);
                                } catch (error) {
                                  console.error('❌ Erreur duplication:', error);
                                  setMessage('❌ Erreur lors de la duplication');
                                  setTimeout(() => setMessage(''), 3000);
                                }
                              }}
                              className="admin-btn admin-btn-secondary"
                              title="Dupliquer cette configuration"
                            >
                              📄 Dupliquer
                            </button>
                            <button
                              onClick={async () => {
                                if (!confirm(`⚠️ Êtes-vous sûr de vouloir supprimer "${config.nom}" ?`)) return;
                                try {
                                  await configurationMensuelleService.supprimerConfiguration(config.id);
                                  await loadConfigurationsMensuelles();
                                  setMessage('✅ Configuration supprimée');
                                  setTimeout(() => setMessage(''), 3000);
                                } catch (error) {
                                  console.error('❌ Erreur suppression:', error);
                                  setMessage('❌ Erreur lors de la suppression');
                                  setTimeout(() => setMessage(''), 3000);
                                }
                              }}
                              className="admin-btn admin-btn-danger"
                              title="Supprimer cette configuration"
                              disabled={config.actif}
                            >
                              🗑️ Supprimer
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="config-mensuel-info">
                  <h4>ℹ️ À propos des configurations mensuelles</h4>
                  <ul>
                    <li>📋 Les contrôles mensuels permettent de vérifier régulièrement l'état des véhicules</li>
                    <li>⚙️ Vous pouvez personnaliser les sections et éléments de contrôle</li>
                    <li>🟢 Une seule configuration peut être active à la fois</li>
                    <li>📝 Les modifications nécessitent une interface d'édition avancée (à venir)</li>
                    <li>💾 Toutes les configurations sont sauvegardées dans Firebase</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div className="modal-footer">
              <button 
                onClick={() => setShowConfigMensuelModal(false)}
                className="admin-btn admin-btn-secondary"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal d'édition des configurations mensuelles */}
      {showEditModal && editingConfig && (
        <div className="modal-backdrop" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>✏️ Modifier la Configuration</h2>
              <button 
                onClick={() => setShowEditModal(false)} 
                className="modal-close-btn"
                title="Fermer"
              >
                ✕
              </button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="config-name">Nom de la configuration</label>
                <input
                  id="config-name"
                  type="text"
                  value={editingConfig.nom}
                  onChange={(e) => setEditingConfig({
                    ...editingConfig,
                    nom: e.target.value
                  })}
                  className="admin-input"
                  placeholder="Nom de la configuration"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="config-description">Description</label>
                <textarea
                  id="config-description"
                  value={editingConfig.description}
                  onChange={(e) => setEditingConfig({
                    ...editingConfig,
                    description: e.target.value
                  })}
                  className="admin-input"
                  rows={3}
                  placeholder="Description de la configuration"
                />
              </div>

              <div className="config-sections-editor">
                <h4>📋 Configuration des sections</h4>
                
                {/* Sections disponibles avec cases à cocher */}
                {[
                  { type: 'liquides', nom: 'Contrôle des liquides', description: 'Vérification des niveaux (huile, liquide de frein, lave-glace)' },
                  { type: 'balais', nom: 'Balais d\'essuie-glace', description: 'État et efficacité des essuie-glaces' },
                  { type: 'pneus', nom: 'Pression des pneus', description: 'Contrôle de la pression et de l\'état des pneumatiques' },
                  { type: 'lavage', nom: 'Lavage', description: 'Nettoyage du véhicule (optionnel)' },
                  { type: 'defauts', nom: 'Défauts détectés', description: 'Signalement des anomalies rencontrées' },
                  { type: 'observations', nom: 'Observations générales', description: 'Commentaires libres sur l\'état du véhicule' },
                  { type: 'personnalise', nom: 'Informations générales', description: 'Données de base du contrôle (agent, date, etc.)' }
                ].map((sectionType) => {
                  const isSelected = editingConfig.sections.some(s => s.type === sectionType.type);
                  const sectionData = editingConfig.sections.find(s => s.type === sectionType.type);
                  
                  return (
                    <div key={sectionType.type} className="section-config-item">
                      <div className="section-config-header">
                        <label className="section-checkbox-label">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              const newSections = [...editingConfig.sections];
                              if (e.target.checked) {
                                // Ajouter la section
                                const newSection = {
                                  id: `section_${sectionType.type}_${Date.now()}`,
                                  nom: sectionType.nom,
                                  type: sectionType.type as any,
                                  obligatoire: sectionType.type === 'personnalise' || sectionType.type === 'liquides' || sectionType.type === 'balais' || sectionType.type === 'pneus',
                                  ordre: newSections.length + 1
                                };
                                newSections.push(newSection);
                              } else {
                                // Retirer la section
                                const index = newSections.findIndex(s => s.type === sectionType.type);
                                if (index > -1) {
                                  newSections.splice(index, 1);
                                }
                              }
                              setEditingConfig({ ...editingConfig, sections: newSections });
                            }}
                            className="section-checkbox"
                          />
                          <span className="section-checkbox-title">{sectionType.nom}</span>
                          {sectionData?.obligatoire && <span className="section-required">*</span>}
                        </label>
                        <span className="section-description">{sectionType.description}</span>
                      </div>
                      
                      {isSelected && (
                        <div className="section-config-details">
                          <label className="section-config-option">
                            <input
                              type="checkbox"
                              checked={sectionData?.obligatoire || false}
                              onChange={(e) => {
                                const newSections = editingConfig.sections.map(s => 
                                  s.type === sectionType.type 
                                    ? { ...s, obligatoire: e.target.checked }
                                    : s
                                );
                                setEditingConfig({ ...editingConfig, sections: newSections });
                              }}
                              disabled={sectionType.type === 'personnalise'} // Les infos générales sont toujours obligatoires
                            />
                            Section obligatoire
                            {sectionType.type === 'personnalise' && <span className="config-note">(toujours obligatoire)</span>}
                          </label>
                          
                          {/* Configuration spécifique selon le type de section */}
                          {sectionType.type === 'liquides' && (
                            <div className="section-specific-config">
                              <h5>Configuration des liquides</h5>
                              
                              {/* Choix du type de contrôle */}
                              <div className="form-group">
                                <label>Type de contrôle</label>
                                <select 
                                  value={sectionData?.config?.typeControle || 'niveau'}
                                  onChange={(e) => {
                                    const newSections = editingConfig.sections.map(s => {
                                      if (s.type === sectionType.type) {
                                        return {
                                          ...s,
                                          config: {
                                            ...s.config,
                                            typeControle: e.target.value,
                                            liquides: s.config?.liquides || [],
                                            options: e.target.value === 'niveau' ? ["OK", "A_COMPLETER", "A_CHANGER", "DEFAUT"] : ["OK", "DEFAUT"]
                                          }
                                        };
                                      }
                                      return s;
                                    });
                                    setEditingConfig({ ...editingConfig, sections: newSections });
                                  }}
                                  className="admin-input"
                                >
                                  <option value="niveau">Contrôle de niveau (OK/À compléter/À changer/Défaut)</option>
                                  <option value="etat">État simple (OK/Défaut)</option>
                                </select>
                              </div>

                              {/* Configuration des options */}
                              <div className="form-group">
                                <label>Options disponibles (séparées par des virgules)</label>
                                <input 
                                  type="text" 
                                  value={sectionData?.config?.options?.join(', ') || (sectionData?.config?.typeControle === 'etat' ? "OK, DEFAUT" : "OK, A_COMPLETER, A_CHANGER, DEFAUT")}
                                  onChange={(e) => {
                                    const options = e.target.value.split(',').map(opt => opt.trim()).filter(opt => opt);
                                    const newSections = editingConfig.sections.map(s => {
                                      if (s.type === sectionType.type) {
                                        return {
                                          ...s,
                                          config: {
                                            ...s.config,
                                            options
                                          }
                                        };
                                      }
                                      return s;
                                    });
                                    setEditingConfig({ ...editingConfig, sections: newSections });
                                  }}
                                  className="config-input"
                                />
                              </div>

                              {/* Sélection des liquides */}
                              <div className="config-checkboxes">
                                <h6>Liquides à contrôler :</h6>
                                {[
                                  { id: 'huile', label: 'Huile moteur' },
                                  { id: 'liquideRefroidissement', label: 'Liquide de refroidissement' },
                                  { id: 'liquideFrein', label: 'Liquide de frein' },
                                  { id: 'liquideDirectionAssistee', label: 'Liquide direction assistée' },
                                  { id: 'lave-glace', label: 'Lave-glace' }
                                ].map(liquide => {
                                  const isChecked = sectionData?.config?.liquides?.some((l: any) => l.nom === liquide.id) ?? (liquide.id !== 'lave-glace');
                                  return (
                                    <label key={liquide.id} className="config-checkbox">
                                      <input 
                                        type="checkbox" 
                                        checked={isChecked}
                                        onChange={(e) => {
                                          const newSections = editingConfig.sections.map(s => {
                                            if (s.type === sectionType.type) {
                                              const currentLiquides = s.config?.liquides || [];
                                              let newLiquides;
                                              if (e.target.checked) {
                                                // Ajouter le liquide s'il n'existe pas
                                                if (!currentLiquides.some((l: any) => l.nom === liquide.id)) {
                                                  newLiquides = [...currentLiquides, { nom: liquide.id, label: liquide.label }];
                                                } else {
                                                  newLiquides = currentLiquides;
                                                }
                                              } else {
                                                // Retirer le liquide
                                                newLiquides = currentLiquides.filter((l: any) => l.nom !== liquide.id);
                                              }
                                              return {
                                                ...s,
                                                config: {
                                                  ...s.config,
                                                  liquides: newLiquides,
                                                  options: ["OK", "A_COMPLETER", "A_CHANGER", "DEFAUT"]
                                                }
                                              };
                                            }
                                            return s;
                                          });
                                          setEditingConfig({ ...editingConfig, sections: newSections });
                                        }}
                                      />
                                      {liquide.label}
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          
                          {sectionType.type === 'pneus' && (
                            <div className="section-specific-config">
                              <h5>Configuration des pneus</h5>
                              
                              {/* Choix du type de contrôle */}
                              <div className="form-group">
                                <label>Type de contrôle</label>
                                <select 
                                  value={sectionData?.config?.typeControle || 'pression'}
                                  onChange={(e) => {
                                    const newSections = editingConfig.sections.map(s => {
                                      if (s.type === sectionType.type) {
                                        const newConfig: any = {
                                          ...s.config,
                                          typeControle: e.target.value,
                                          positions: s.config?.positions || []
                                        };
                                        
                                        // Gérer les options selon le type
                                        if (e.target.value === 'etat') {
                                          newConfig.options = ["OK", "DEFAUT", "A_VERIFIER"];
                                          // Supprimer pressionRecommandee si on passe en mode état
                                          delete newConfig.pressionRecommandee;
                                        } else if (e.target.value === 'pression') {
                                          newConfig.pressionRecommandee = s.config?.pressionRecommandee || 2.2;
                                          // Supprimer options si on passe en mode pression
                                          delete newConfig.options;
                                        }
                                        
                                        return {
                                          ...s,
                                          config: newConfig
                                        };
                                      }
                                      return s;
                                    });
                                    setEditingConfig({ ...editingConfig, sections: newSections });
                                  }}
                                  className="admin-input"
                                >
                                  <option value="pression">Saisie de pression (bars)</option>
                                  <option value="etat">État OK/Défaut</option>
                                </select>
                              </div>

                              {/* Configuration de la pression recommandée (si type pression) */}
                              {sectionData?.config?.typeControle === 'pression' && (
                                <div className="form-group">
                                  <label>Pression recommandée (bars)</label>
                                  <input 
                                    type="number" 
                                    step="0.1" 
                                    min="1.0" 
                                    max="5.0" 
                                    value={sectionData?.config?.pressionRecommandee || 2.2}
                                    onChange={(e) => {
                                      const newSections = editingConfig.sections.map(s => {
                                        if (s.type === sectionType.type) {
                                          return {
                                            ...s,
                                            config: {
                                              ...s.config,
                                              pressionRecommandee: parseFloat(e.target.value) || 2.2
                                            }
                                          };
                                        }
                                        return s;
                                      });
                                      setEditingConfig({ ...editingConfig, sections: newSections });
                                    }}
                                    className="config-input-small"
                                  />
                                </div>
                              )}

                              {/* Configuration des options d'état (si type état) */}
                              {sectionData?.config?.typeControle === 'etat' && (
                                <div className="form-group">
                                  <label>Options disponibles (séparées par des virgules)</label>
                                  <input 
                                    type="text" 
                                    value={sectionData?.config?.options?.join(', ') || "OK, DEFAUT, A_VERIFIER"}
                                    onChange={(e) => {
                                      const options = e.target.value.split(',').map(opt => opt.trim()).filter(opt => opt);
                                      const newSections = editingConfig.sections.map(s => {
                                        if (s.type === sectionType.type) {
                                          return {
                                            ...s,
                                            config: {
                                              ...s.config,
                                              options
                                            }
                                          };
                                        }
                                        return s;
                                      });
                                      setEditingConfig({ ...editingConfig, sections: newSections });
                                    }}
                                    className="config-input"
                                  />
                                </div>
                              )}

                              {/* Sélection des positions de pneus */}
                              <div className="config-checkboxes">
                                <h6>Positions à contrôler :</h6>
                                {[
                                  { id: 'avantGauche', label: 'Avant gauche' },
                                  { id: 'avantDroit', label: 'Avant droit' },
                                  { id: 'arriereGauche', label: 'Arrière gauche' },
                                  { id: 'arriereDroit', label: 'Arrière droit' },
                                  { id: 'roueSecours', label: 'Roue de secours' }
                                ].map(pneu => {
                                  const isChecked = sectionData?.config?.positions?.some((p: any) => p.nom === pneu.id) ?? (pneu.id !== 'roueSecours');
                                  return (
                                    <label key={pneu.id} className="config-checkbox">
                                      <input 
                                        type="checkbox" 
                                        checked={isChecked}
                                        onChange={(e) => {
                                          const newSections = editingConfig.sections.map(s => {
                                            if (s.type === sectionType.type) {
                                              const currentPositions = s.config?.positions || [];
                                              let newPositions;
                                              if (e.target.checked) {
                                                // Ajouter la position si elle n'existe pas
                                                if (!currentPositions.some((p: any) => p.nom === pneu.id)) {
                                                  newPositions = [...currentPositions, { nom: pneu.id, label: pneu.label }];
                                                } else {
                                                  newPositions = currentPositions;
                                                }
                                              } else {
                                                // Retirer la position
                                                newPositions = currentPositions.filter((p: any) => p.nom !== pneu.id);
                                              }
                                              return {
                                                ...s,
                                                config: {
                                                  ...s.config,
                                                  positions: newPositions
                                                }
                                              };
                                            }
                                            return s;
                                          });
                                          setEditingConfig({ ...editingConfig, sections: newSections });
                                        }}
                                      />
                                      {pneu.label}
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          
                          {sectionType.type === 'balais' && (
                            <div className="section-specific-config">
                              <h5>Configuration des essuie-glaces</h5>
                              
                              {/* Choix du type de contrôle */}
                              <div className="form-group">
                                <label>Type de contrôle</label>
                                <select 
                                  value={sectionData?.config?.typeControle || 'etat'}
                                  onChange={(e) => {
                                    const newSections = editingConfig.sections.map(s => {
                                      if (s.type === sectionType.type) {
                                        return {
                                          ...s,
                                          config: {
                                            ...s.config,
                                            typeControle: e.target.value,
                                            positions: s.config?.positions || [],
                                            options: e.target.value === 'etat' ? ["OK", "A_CHANGER", "DEFAUT"] : ["OK", "DEFAUT"]
                                          }
                                        };
                                      }
                                      return s;
                                    });
                                    setEditingConfig({ ...editingConfig, sections: newSections });
                                  }}
                                  className="admin-input"
                                >
                                  <option value="etat">État détaillé (OK/À changer/Défaut)</option>
                                  <option value="simple">État simple (OK/Défaut)</option>
                                </select>
                              </div>

                              {/* Configuration des options */}
                              <div className="form-group">
                                <label>Options disponibles (séparées par des virgules)</label>
                                <input 
                                  type="text" 
                                  value={sectionData?.config?.options?.join(', ') || (sectionData?.config?.typeControle === 'simple' ? "OK, DEFAUT" : "OK, A_CHANGER, DEFAUT")}
                                  onChange={(e) => {
                                    const options = e.target.value.split(',').map(opt => opt.trim()).filter(opt => opt);
                                    const newSections = editingConfig.sections.map(s => {
                                      if (s.type === sectionType.type) {
                                        return {
                                          ...s,
                                          config: {
                                            ...s.config,
                                            options
                                          }
                                        };
                                      }
                                      return s;
                                    });
                                    setEditingConfig({ ...editingConfig, sections: newSections });
                                  }}
                                  className="config-input"
                                />
                              </div>

                              {/* Sélection des positions */}
                              <div className="config-checkboxes">
                                <h6>Essuie-glaces à contrôler :</h6>
                                {[
                                  { id: 'avant', label: 'Essuie-glace avant' },
                                  { id: 'arriere', label: 'Essuie-glace arrière' }
                                ].map(balai => {
                                  const isChecked = sectionData?.config?.positions?.some((p: any) => p.nom === balai.id) ?? true;
                                  return (
                                    <label key={balai.id} className="config-checkbox">
                                      <input 
                                        type="checkbox" 
                                        checked={isChecked}
                                        onChange={(e) => {
                                          const newSections = editingConfig.sections.map(s => {
                                            if (s.type === sectionType.type) {
                                              const currentPositions = s.config?.positions || [];
                                              let newPositions;
                                              if (e.target.checked) {
                                                // Ajouter la position si elle n'existe pas
                                                if (!currentPositions.some((p: any) => p.nom === balai.id)) {
                                                  newPositions = [...currentPositions, { nom: balai.id, label: balai.label }];
                                                } else {
                                                  newPositions = currentPositions;
                                                }
                                              } else {
                                                // Retirer la position
                                                newPositions = currentPositions.filter((p: any) => p.nom !== balai.id);
                                              }
                                              return {
                                                ...s,
                                                config: {
                                                  ...s.config,
                                                  positions: newPositions,
                                                  options: ["OK", "A_CHANGER", "DEFAUT"]
                                                }
                                              };
                                            }
                                            return s;
                                          });
                                          setEditingConfig({ ...editingConfig, sections: newSections });
                                        }}
                                      />
                                      {balai.label}
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          
                          {sectionType.type === 'defauts' && (
                            <div className="section-specific-config">
                              <h5>Configuration des défauts</h5>
                              <div className="form-group">
                                <label>Catégories de défauts (séparées par des virgules)</label>
                                <input 
                                  type="text" 
                                  value={sectionData?.config?.categories?.join(', ') || "Mécanique, Électrique, Carrosserie, Équipement"}
                                  onChange={(e) => {
                                    const categories = e.target.value.split(',').map(cat => cat.trim()).filter(cat => cat);
                                    const newSections = editingConfig.sections.map(s => 
                                      s.type === sectionType.type 
                                        ? { 
                                            ...s, 
                                            config: { 
                                              ...s.config, 
                                              categories,
                                              gravites: s.config?.gravites || ["Mineur", "Modéré", "Majeur", "Critique"]
                                            }
                                          }
                                        : s
                                    );
                                    setEditingConfig({ ...editingConfig, sections: newSections });
                                  }}
                                  className="config-input"
                                />
                              </div>
                              <div className="form-group">
                                <label>Niveaux de gravité (séparés par des virgules)</label>
                                <input 
                                  type="text" 
                                  value={sectionData?.config?.gravites?.join(', ') || "Mineur, Modéré, Majeur, Critique"}
                                  onChange={(e) => {
                                    const gravites = e.target.value.split(',').map(grav => grav.trim()).filter(grav => grav);
                                    const newSections = editingConfig.sections.map(s => 
                                      s.type === sectionType.type 
                                        ? { 
                                            ...s, 
                                            config: { 
                                              ...s.config, 
                                              gravites,
                                              categories: s.config?.categories || ["Mécanique", "Électrique", "Carrosserie", "Équipement"]
                                            }
                                          }
                                        : s
                                    );
                                    setEditingConfig({ ...editingConfig, sections: newSections });
                                  }}
                                  className="config-input"
                                />
                              </div>
                            </div>
                          )}
                          
                          {sectionType.type === 'observations' && (
                            <div className="section-specific-config">
                              <h5>Configuration des observations</h5>
                              <div className="form-group">
                                <label>Texte d'aide</label>
                                <input 
                                  type="text" 
                                  value={sectionData?.config?.placeholder || "Observations complémentaires sur l'état du véhicule..."}
                                  onChange={(e) => {
                                    const newSections = editingConfig.sections.map(s => 
                                      s.type === sectionType.type 
                                        ? { 
                                            ...s, 
                                            config: { 
                                              ...s.config, 
                                              placeholder: e.target.value,
                                              maxLength: s.config?.maxLength || 500
                                            }
                                          }
                                        : s
                                    );
                                    setEditingConfig({ ...editingConfig, sections: newSections });
                                  }}
                                  className="config-input"
                                />
                              </div>
                              <div className="form-group">
                                <label>Limite de caractères</label>
                                <input 
                                  type="number" 
                                  min="100" 
                                  max="2000" 
                                  value={sectionData?.config?.maxLength || 500}
                                  onChange={(e) => {
                                    const newSections = editingConfig.sections.map(s => 
                                      s.type === sectionType.type 
                                        ? { 
                                            ...s, 
                                            config: { 
                                              ...s.config, 
                                              maxLength: parseInt(e.target.value) || 500,
                                              placeholder: s.config?.placeholder || "Observations complémentaires sur l'état du véhicule..."
                                            }
                                          }
                                        : s
                                    );
                                    setEditingConfig({ ...editingConfig, sections: newSections });
                                  }}
                                  className="config-input-small"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                
                {/* Affichage des sections personnalisées existantes */}
                <div className="custom-sections-existing">
                  <h4>🔧 Sections personnalisées existantes</h4>
                  {editingConfig.sections
                    .filter(section => !['liquides', 'balais', 'pneus', 'lavage', 'defauts', 'observations', 'personnalise'].includes(section.type) || (section.type === 'personnalise' && section.id !== 'info-generales'))
                    .map((customSection) => (
                      <div key={customSection.id} className="custom-section-item">
                        <div className="custom-section-header">
                          <span className="custom-section-name">📝 {customSection.nom}</span>
                          <div className="custom-section-actions">
                            <label className="section-config-option">
                              <input
                                type="checkbox"
                                checked={customSection.obligatoire}
                                onChange={(e) => {
                                  const newSections = editingConfig.sections.map(s => 
                                    s.id === customSection.id 
                                      ? { ...s, obligatoire: e.target.checked }
                                      : s
                                  );
                                  setEditingConfig({ ...editingConfig, sections: newSections });
                                }}
                              />
                              Obligatoire
                            </label>
                            <button
                              onClick={() => {
                                if (confirm(`Êtes-vous sûr de vouloir supprimer la section "${customSection.nom}" ?`)) {
                                  const newSections = editingConfig.sections.filter(s => s.id !== customSection.id);
                                  setEditingConfig({ ...editingConfig, sections: newSections });
                                }
                              }}
                              className="admin-btn admin-btn-danger admin-btn-small"
                              title="Supprimer cette section"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                        {customSection.config?.description && (
                          <div className="custom-section-description">{customSection.config.description}</div>
                        )}
                        <div className="custom-section-details">
                          <span className="section-type-badge">
                            {customSection.config?.type === 'checklist' && '☑️ Liste à cocher'}
                            {customSection.config?.type === 'textarea' && '📝 Zone de texte'}
                            {customSection.config?.type === 'select' && '📋 Liste déroulante'}
                            {customSection.config?.type === 'number' && '🔢 Valeur numérique'}
                          </span>
                        </div>
                      </div>
                    ))}
                  {editingConfig.sections.filter(section => !['liquides', 'balais', 'pneus', 'lavage', 'defauts', 'observations', 'personnalise'].includes(section.type) || (section.type === 'personnalise' && section.id !== 'info-generales')).length === 0 && (
                    <div className="no-custom-sections">
                      <p>📝 Aucune section personnalisée définie. Utilisez le formulaire ci-dessous pour en ajouter.</p>
                    </div>
                  )}
                </div>
                
                {/* Section pour ajouter une nouvelle section personnalisée */}
                <div className="add-custom-section">
                  <h4>➕ Ajouter une section personnalisée</h4>
                  <div className="custom-section-form">
                    <div className="form-row">
                      <div className="form-group">
                        <label>Nom de la section</label>
                        <input
                          type="text"
                          placeholder="Ex: Contrôle électrique, Vérification carrosserie..."
                          className="admin-input"
                          id="new-section-name"
                        />
                      </div>
                      <div className="form-group">
                        <label>Description</label>
                        <input
                          type="text"
                          placeholder="Description de cette section..."
                          className="admin-input"
                          id="new-section-description"
                        />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Type de contrôle</label>
                        <select className="admin-input" id="new-section-type">
                          <option value="checklist">Liste à cocher</option>
                          <option value="textarea">Zone de texte libre</option>
                          <option value="select">Liste déroulante</option>
                          <option value="number">Valeur numérique</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="checkbox-label">
                          <input type="checkbox" id="new-section-required" defaultChecked />
                          Section obligatoire
                        </label>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        const nameInput = document.getElementById('new-section-name') as HTMLInputElement;
                        const descInput = document.getElementById('new-section-description') as HTMLInputElement;
                        const typeSelect = document.getElementById('new-section-type') as HTMLSelectElement;
                        const requiredCheck = document.getElementById('new-section-required') as HTMLInputElement;
                        
                        if (!nameInput.value.trim()) {
                          alert('Veuillez saisir un nom pour la section');
                          return;
                        }
                        
                        const newSection = {
                          id: `custom_${Date.now()}`,
                          nom: nameInput.value.trim(),
                          type: 'personnalise' as const,
                          obligatoire: requiredCheck.checked,
                          ordre: editingConfig.sections.length + 1,
                          config: {
                            type: typeSelect.value,
                            description: descInput.value.trim(),
                            ...(typeSelect.value === 'checklist' && { elements: [] }),
                            ...(typeSelect.value === 'textarea' && { placeholder: 'Saisir les informations...' }),
                            ...(typeSelect.value === 'select' && { options: [] }),
                            ...(typeSelect.value === 'number' && { min: 0, max: 100 })
                          }
                        };
                        
                        setEditingConfig({
                          ...editingConfig,
                          sections: [...editingConfig.sections, newSection]
                        });
                        
                        // Reset form
                        nameInput.value = '';
                        descInput.value = '';
                        typeSelect.selectedIndex = 0;
                        requiredCheck.checked = true;
                      }}
                      className="admin-btn admin-btn-success"
                      style={{ marginTop: '1rem' }}
                    >
                      ➕ Ajouter cette section
                    </button>
                  </div>
                </div>
              </div>

              <div className="form-note">
                <p>ℹ️ <strong>Instructions:</strong></p>
                <ul>
                  <li>Cochez les sections que vous souhaitez inclure dans cette configuration</li>
                  <li>Les sections marquées d'un (*) sont obligatoires par défaut</li>
                  <li>Vous pouvez rendre une section optionnelle en décochant "Section obligatoire"</li>
                  <li>Les "Informations générales" sont toujours obligatoires</li>
                </ul>
              </div>
            </div>
            
            <div className="modal-footer">
              <button 
                onClick={() => setShowEditModal(false)}
                className="admin-btn admin-btn-secondary"
              >
                Annuler
              </button>
              <button 
                onClick={async () => {
                  try {
                    // Réorganiser les sections par ordre
                    const sectionsOrdered = editingConfig.sections
                      .map((section, index) => ({ ...section, ordre: index + 1 }))
                      .sort((a, b) => a.ordre - b.ordre);

                    await configurationMensuelleService.mettreAJourConfiguration(
                      editingConfig.id, 
                      {
                        nom: editingConfig.nom,
                        description: editingConfig.description,
                        sections: sectionsOrdered
                      }, 
                      'admin'
                    );
                    await loadConfigurationsMensuelles();
                    setShowEditModal(false);
                    setEditingConfig(null);
                    setMessage('✅ Configuration mise à jour avec succès');
                    setTimeout(() => setMessage(''), 3000);
                  } catch (error) {
                    console.error('❌ Erreur mise à jour:', error);
                    setMessage('❌ Erreur lors de la mise à jour');
                    setTimeout(() => setMessage(''), 3000);
                  }
                }}
                className="admin-btn admin-btn-primary"
                disabled={!editingConfig.nom.trim() || editingConfig.sections.length === 0}
              >
                ✅ Sauvegarder les modifications
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de changement de mot de passe */}
      {showPasswordModal && (
        <div className="admin-modal-overlay">
          <div className="admin-modal password-modal">
            <div className="admin-modal-header">
              <h3>🔑 Changer le mot de passe</h3>
              <button 
                onClick={handleCancelPasswordChange}
                className="admin-modal-close"
                disabled={passwordLoading}
              >
                ×
              </button>
            </div>

            <div className="admin-modal-content">
              <div className="password-form">
                <div className="form-group">
                  <label>Mot de passe actuel :</label>
                  <input
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({
                      ...passwordForm,
                      currentPassword: e.target.value
                    })}
                    placeholder="Saisissez votre mot de passe actuel"
                    className="admin-input"
                    disabled={passwordLoading}
                  />
                </div>

                <div className="form-group">
                  <label>Nouveau mot de passe :</label>
                  <input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({
                      ...passwordForm,
                      newPassword: e.target.value
                    })}
                    placeholder="Saisissez le nouveau mot de passe (min. 6 caractères)"
                    className="admin-input"
                    disabled={passwordLoading}
                  />
                </div>

                <div className="form-group">
                  <label>Confirmer le nouveau mot de passe :</label>
                  <input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({
                      ...passwordForm,
                      confirmPassword: e.target.value
                    })}
                    placeholder="Confirmez le nouveau mot de passe"
                    className="admin-input"
                    disabled={passwordLoading}
                  />
                </div>

                {passwordError && (
                  <div className="error-message">
                    ⚠️ {passwordError}
                  </div>
                )}

                <div className="password-requirements">
                  <h4>Exigences du mot de passe :</h4>
                  <ul>
                    <li className={passwordForm.newPassword.length >= 6 ? 'valid' : ''}>
                      Au moins 6 caractères
                    </li>
                    <li className={passwordForm.newPassword === passwordForm.confirmPassword && passwordForm.confirmPassword ? 'valid' : ''}>
                      Les mots de passe correspondent
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="admin-modal-actions">
              <button 
                onClick={handleCancelPasswordChange}
                className="admin-btn admin-btn-secondary"
                disabled={passwordLoading}
              >
                Annuler
              </button>
              <button 
                onClick={handlePasswordChange}
                className="admin-btn admin-btn-success"
                disabled={passwordLoading || !passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword}
              >
                {passwordLoading ? '🔄 Modification...' : '✅ Changer le mot de passe'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de déplacement d'éléments */}
      {showMoveModal && moveItem && (
        <div className="admin-modal-overlay">
          <div className="admin-modal">
            <div className="admin-modal-header">
              <h3>
                📦 Déplacer {moveItem.type === 'section' ? 'la sous-section' : 'le matériel'} "{moveItem.item.nom}"
              </h3>
              <button
                onClick={() => {
                  setShowMoveModal(false);
                  setMoveItem(null);
                }}
                className="admin-modal-close"
              >
                ✕
              </button>
            </div>

            <div className="admin-modal-body">
              <p>Sélectionnez la section de destination :</p>
              <div className="move-destination-list">
                {sections.map((section, sectionIndex) => (
                  <div key={section.id} className="move-section-group">
                    <button
                      className="move-destination-btn move-destination-main"
                      onClick={() => moveItemToDestination([sectionIndex])}
                      disabled={moveItem.type === 'section' && moveItem.sourcePath[0] === sectionIndex && moveItem.sourcePath.length === 1}
                    >
                      📁 {section.nom}
                    </button>
                    {section.sousSections && section.sousSections.map((subSection, subIndex) => 
                      renderMoveDestinations(subSection, [sectionIndex, subIndex], 1)
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="admin-modal-footer">
              <button
                onClick={() => {
                  setShowMoveModal(false);
                  setMoveItem(null);
                }}
                className="admin-btn admin-btn-secondary"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de copie vers un autre véhicule */}
      {showCopyToVehicleModal && copyItem && (
        <div className="modal-backdrop" onClick={() => {
          setShowCopyToVehicleModal(false);
          setCopyItem(null);
          setSelectedDestinationVehicle('');
          setDestinationVehicleSections([]);
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🚚 Copier {copyItem.type === 'section' ? 'la section' : 'le matériel'} "{copyItem.item.nom}"</h2>
              <button 
                onClick={() => {
                  setShowCopyToVehicleModal(false);
                  setCopyItem(null);
                  setSelectedDestinationVehicle('');
                  setDestinationVehicleSections([]);
                }} 
                className="modal-close-btn"
                title="Fermer"
              >
                ✕
              </button>
            </div>
            
            <div className="modal-body">
              <div className="copy-source-info">
                <p><strong>Élément à copier:</strong> {copyItem.item.nom}</p>
                <p><strong>Type:</strong> {copyItem.type === 'section' ? 'Section' : 'Matériel'}</p>
                <p><strong>Depuis le véhicule:</strong> {allVehicules.find(v => v.id === copyItem.sourceVehicleId)?.nom}</p>
              </div>
              
              <hr style={{ margin: '1rem 0' }} />
              
              <div className="destination-selection">
                <label htmlFor="destination-vehicle">
                  Véhicule de destination:
                </label>
                <select
                  id="destination-vehicle"
                  value={selectedDestinationVehicle}
                  onChange={async (e) => {
                    const vehicleId = e.target.value;
                    setSelectedDestinationVehicle(vehicleId);
                    if (vehicleId) {
                      await loadDestinationVehicleSections(vehicleId);
                    } else {
                      setDestinationVehicleSections([]);
                    }
                  }}
                  className="admin-select"
                  style={{ marginBottom: '1rem' }}
                >
                  <option value="">-- Sélectionner un véhicule --</option>
                  {allVehicules
                    .filter(v => v.id !== copyItem.sourceVehicleId) // Exclure le véhicule source
                    .map(vehicule => (
                      <option key={vehicule.id} value={vehicule.id}>
                        {vehicule.nom}
                      </option>
                    ))
                  }
                </select>
              </div>
              
              {selectedDestinationVehicle && destinationVehicleSections.length > 0 && (
                <div className="destination-sections">
                  <label>Ajouter à la section:</label>
                  <div className="section-list">
                    {destinationVehicleSections.map((section, index) => (
                      <div key={section.id} className="section-option">
                        <button
                          onClick={() => copyItemToVehicle(selectedDestinationVehicle, index)}
                          className="admin-btn admin-btn-primary section-choice-btn"
                          style={{ 
                            width: '100%', 
                            textAlign: 'left', 
                            marginBottom: '0.5rem',
                            justifyContent: 'flex-start'
                          }}
                        >
                          📁 {section.nom}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {selectedDestinationVehicle && destinationVehicleSections.length === 0 && (
                <div className="no-sections-message">
                  <p style={{ color: '#64748b', textAlign: 'center' }}>
                    Chargement des sections...
                  </p>
                </div>
              )}
            </div>
            
            <div className="modal-footer">
              <button 
                onClick={() => {
                  setShowCopyToVehicleModal(false);
                  setCopyItem(null);
                  setSelectedDestinationVehicle('');
                  setDestinationVehicleSections([]);
                }}
                className="admin-btn admin-btn-secondary"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;

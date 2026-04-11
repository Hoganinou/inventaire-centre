import React, { useState, useEffect, useCallback } from 'react';
import { generateSOGData } from '../firebase/sog-service';
import { SOGManualService } from '../firebase/sog-manual-service';
import { InventaireService } from '../firebase/inventaire-service';
import { VehiculeConfigService } from '../firebase/vehicule-config-service';
import { FamilleService } from '../firebase/famille-service';
import type { FamilleConfig } from '../firebase/famille-service';
import { vehicules as defaultVehicules } from '../models/vehicules/index';
import type { SOGData, SOGVehiculeStatus, SOGDefaut, ResolvedDefaut } from '../models/sog';
import type { Vehicule, Section } from '../models/inventaire';
import VehiculeDetailModal from './VehiculeDetailModal';
import './SOGPage.css';

interface SOGPageProps {
  onReturnHome?: () => void;
}

// Helper: extraire tous les matériels d'un véhicule avec leur chemin
interface MaterielOption {
  chemin: string;
  nom: string;
  sectionNom: string;
  type?: string; // Type du matériel (quantite, checkbox, etc.)
  quantiteAttendue?: number; // Quantité attendue pour les matériels de type 'quantite'
}

const extractMateriels = (sections: Section[], parentPath: string = ''): MaterielOption[] => {
  const result: MaterielOption[] = [];
  for (const section of sections) {
    const sectionPath = parentPath ? `${parentPath} > ${section.nom}` : section.nom;
    if (section.materiels) {
      for (const mat of section.materiels) {
        result.push({
          chemin: sectionPath,
          nom: mat.nom,
          sectionNom: section.nom,
          type: mat.type,
          quantiteAttendue: mat.type === 'quantite' ? (mat.valeur as number) : undefined
        });
      }
    }
    if (section.sousSections) {
      result.push(...extractMateriels(section.sousSections, sectionPath));
    }
  }
  return result;
};

const SOGPage: React.FC<SOGPageProps> = ({ onReturnHome }) => {
  const [sogData, setSogData] = useState<SOGData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVehicule, setSelectedVehicule] = useState<SOGVehiculeStatus | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // États pour le modal de défauts
  const [showDefautsModal, setShowDefautsModal] = useState(false);
  const [defautsVehicule, setDefautsVehicule] = useState<SOGVehiculeStatus | null>(null);
  const [defautsManuels, setDefautsManuels] = useState<SOGDefaut[]>([]);
  const [defautsInventaire, setDefautsInventaire] = useState<SOGDefaut[]>([]);
  const [materielsDisponibles, setMaterielsDisponibles] = useState<MaterielOption[]>([]);
  const [loadingMateriels, setLoadingMateriels] = useState(false);
  const [searchMateriel, setSearchMateriel] = useState('');
  const [showAddDefaut, setShowAddDefaut] = useState(false);
  const [newDefautDetails, setNewDefautDetails] = useState('');
  const [newDefautQuantite, setNewDefautQuantite] = useState<number | ''>('');
  const [selectedMaterielForQuantite, setSelectedMaterielForQuantite] = useState<MaterielOption | null>(null);
  const [savingDefauts, setSavingDefauts] = useState(false);

  // États pour la résolution de défauts d'inventaire
  const [resolvedDefauts, setResolvedDefauts] = useState<ResolvedDefaut[]>([]);
  const [showResolvedDefauts, setShowResolvedDefauts] = useState(false);
  const [showResolveConfirm, setShowResolveConfirm] = useState<{chemin: string; nom: string; details?: string} | null>(null);
  const [resolveAgent, setResolveAgent] = useState('');
  const [resolveReason, setResolveReason] = useState('');
  const [savingResolve, setSavingResolve] = useState(false);

  // États pour le modal d'observations
  const [showObservationModal, setShowObservationModal] = useState(false);
  const [observationVehicule, setObservationVehicule] = useState<SOGVehiculeStatus | null>(null);
  const [newObsText, setNewObsText] = useState('');
  const [newObsAgent, setNewObsAgent] = useState('');
  const [savingObservation, setSavingObservation] = useState(false);
  // États pour l'édition de l'observation d'inventaire
  const [editingInvObs, setEditingInvObs] = useState(false);
  const [editInvObsText, setEditInvObsText] = useState('');
  const [originalInvObs, setOriginalInvObs] = useState<string | null>(null); // observation originale de l'inventaire
  const [hasObsOverride, setHasObsOverride] = useState(false); // true si l'observation a été modifiée via SOG

  // Aide
  const [showHelp, setShowHelp] = useState(false);

  // Familles pour les couleurs
  const [famillesMap, setFamillesMap] = useState<Map<string, FamilleConfig>>(new Map());

  useEffect(() => {
    loadSOGData();
  }, []);

  const loadSOGData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [data, familles] = await Promise.all([
        generateSOGData(),
        FamilleService.getAllFamilles()
      ]);
      const fMap = new Map<string, FamilleConfig>();
      familles.forEach(f => fMap.set(f.id, f));
      setFamillesMap(fMap);
      setSogData(data);
    } catch (err) {
      console.error('Erreur lors du chargement du SOG:', err);
      setError('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const getStatutColor = (statut: string) => {
    switch (statut) {
      case 'OK': return 'success';
      case 'DEFAUT': return 'danger';
      case 'NON_VERIFIE': return 'warning';
      default: return 'secondary';
    }
  };

  const getStatutLabel = (statut: string) => {
    switch (statut) {
      case 'OK': return '✓ OK';
      case 'DEFAUT': return '⚠ Défaut(s)';
      case 'NON_VERIFIE': return '? Non vérifié';
      default: return statut;
    }
  };

  const handleOpenModal = (vehicule: SOGVehiculeStatus) => {
    setSelectedVehicule(vehicule);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedVehicule(null);
  };

  // ========== Gestion des défauts manuels ==========

  const loadVehiculeMateriels = useCallback(async (vehiculeId: string) => {
    setLoadingMateriels(true);
    try {
      // Chercher d'abord dans les configs personnalisées, puis dans les défauts
      let vehiculeConfig: Vehicule | null = await VehiculeConfigService.getVehiculeConfig(vehiculeId);
      if (!vehiculeConfig) {
        // Chercher dans les véhicules par défaut
        const defaultV = Object.values(defaultVehicules).find(v => v.id === vehiculeId);
        if (defaultV) {
          vehiculeConfig = defaultV;
        }
      }
      if (vehiculeConfig && vehiculeConfig.sections) {
        const materiels = extractMateriels(vehiculeConfig.sections);
        setMaterielsDisponibles(materiels);
      } else {
        setMaterielsDisponibles([]);
      }
    } catch (err) {
      console.error('Erreur chargement matériels:', err);
      setMaterielsDisponibles([]);
    } finally {
      setLoadingMateriels(false);
    }
  }, []);

  const handleOpenDefautsModal = useCallback(async (vehicule: SOGVehiculeStatus) => {
    setDefautsVehicule(vehicule);
    // Séparer défauts inventaire vs défauts manuels
    const inventaire = vehicule.defauts.filter(d => !d.manuel);
    const manuels = vehicule.defauts.filter(d => d.manuel);
    setDefautsInventaire(inventaire);
    setDefautsManuels(manuels);
    setShowAddDefaut(false);
    setSearchMateriel('');
    setNewDefautDetails('');
    setNewDefautQuantite('');
    setSelectedMaterielForQuantite(null);
    setShowResolveConfirm(null);
    setResolveAgent('');
    setResolveReason('');
    setShowDefautsModal(true);
    // Charger les défauts résolus et les matériels
    try {
      const manualData = await SOGManualService.getManualData(vehicule.vehiculeId);
      setResolvedDefauts(manualData?.resolvedDefauts || []);
    } catch {
      setResolvedDefauts([]);
    }
    await loadVehiculeMateriels(vehicule.vehiculeId);
  }, [loadVehiculeMateriels]);

  const handleSelectMateriel = useCallback((materiel: MaterielOption) => {
    if (materiel.type === 'quantite') {
      // Pour les matériels avec quantité, afficher le sélecteur de quantité
      setSelectedMaterielForQuantite(materiel);
      setNewDefautQuantite('');
    } else {
      // Ajout direct pour les autres types
      const newDefaut: SOGDefaut = {
        chemin: materiel.chemin,
        nom: materiel.nom,
        details: newDefautDetails || undefined,
        dateDetection: new Date(),
        manuel: true
      };
      setDefautsManuels(prev => [...prev, newDefaut]);
      setNewDefautDetails('');
      setNewDefautQuantite('');
      setSelectedMaterielForQuantite(null);
      setSearchMateriel('');
      setShowAddDefaut(false);
    }
  }, [newDefautDetails]);

  const handleConfirmDefautWithQuantite = useCallback(() => {
    if (!selectedMaterielForQuantite) return;
    const quantite = typeof newDefautQuantite === 'number' ? newDefautQuantite : undefined;
    const newDefaut: SOGDefaut = {
      chemin: selectedMaterielForQuantite.chemin,
      nom: selectedMaterielForQuantite.nom,
      details: newDefautDetails || undefined,
      quantite: quantite,
      quantiteAttendue: selectedMaterielForQuantite.quantiteAttendue,
      dateDetection: new Date(),
      manuel: true
    };
    setDefautsManuels(prev => [...prev, newDefaut]);
    setNewDefautDetails('');
    setNewDefautQuantite('');
    setSelectedMaterielForQuantite(null);
    setSearchMateriel('');
    setShowAddDefaut(false);
  }, [selectedMaterielForQuantite, newDefautQuantite, newDefautDetails]);

  const handleRemoveDefautManuel = useCallback((index: number) => {
    setDefautsManuels(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleResolveDefaut = useCallback(async () => {
    if (!defautsVehicule || !showResolveConfirm || !resolveAgent.trim()) return;
    setSavingResolve(true);
    try {
      const success = await SOGManualService.resolveDefaut(
        defautsVehicule.vehiculeId,
        showResolveConfirm.chemin,
        showResolveConfirm.nom,
        resolveAgent.trim(),
        resolveReason.trim()
      );
      if (success) {
        // Retirer de la liste locale
        setDefautsInventaire(prev => prev.filter(d => 
          !(d.chemin === showResolveConfirm.chemin && d.nom === showResolveConfirm.nom)
        ));
        setResolvedDefauts(prev => [...prev, {
          chemin: showResolveConfirm.chemin,
          nom: showResolveConfirm.nom,
          resolvedBy: resolveAgent.trim(),
          resolvedDate: new Date(),
          reason: resolveReason.trim()
        }]);
        setShowResolveConfirm(null);
        setResolveAgent('');
        setResolveReason('');
        await loadSOGData();
      }
    } catch (err) {
      console.error('Erreur résolution défaut:', err);
    } finally {
      setSavingResolve(false);
    }
  }, [defautsVehicule, showResolveConfirm, resolveAgent, resolveReason]);

  const handleUnresolveDefaut = useCallback(async (resolved: ResolvedDefaut) => {
    if (!defautsVehicule) return;
    if (!window.confirm(`Remettre "${resolved.nom}" comme défaut actif ?`)) return;
    try {
      const success = await SOGManualService.unresolveDefaut(
        defautsVehicule.vehiculeId,
        resolved.chemin,
        resolved.nom
      );
      if (success) {
        setResolvedDefauts(prev => prev.filter(r => 
          !(r.chemin === resolved.chemin && r.nom === resolved.nom)
        ));
        // Remettre dans la liste inventaire
        setDefautsInventaire(prev => [...prev, {
          chemin: resolved.chemin,
          nom: resolved.nom,
          dateDetection: new Date(),
          manuel: false
        }]);
        await loadSOGData();
      }
    } catch (err) {
      console.error('Erreur annulation résolution:', err);
    }
  }, [defautsVehicule]);

  const handleSaveDefauts = useCallback(async () => {
    if (!defautsVehicule) return;
    setSavingDefauts(true);
    try {
      const success = await SOGManualService.saveDefautsManuels(
        defautsVehicule.vehiculeId,
        defautsManuels
      );
      if (success) {
        setShowDefautsModal(false);
        // Recharger les données
        await loadSOGData();
      }
    } catch (err) {
      console.error('Erreur sauvegarde défauts:', err);
    } finally {
      setSavingDefauts(false);
    }
  }, [defautsVehicule, defautsManuels]);

  // ========== Gestion des observations ==========

  const handleOpenObservationModal = useCallback(async (vehicule: SOGVehiculeStatus) => {
    setObservationVehicule(vehicule);
    setNewObsText('');
    setNewObsAgent('');
    setEditingInvObs(false);
    setEditInvObsText('');
    setOriginalInvObs(null);
    setHasObsOverride(false);
    setShowObservationModal(true);
    // Charger les données manuelles pour savoir si l'observation a été modifiée
    try {
      const manualData = await SOGManualService.getManualData(vehicule.vehiculeId);
      if (manualData?.observationOverride !== undefined && manualData?.observationOverride !== null) {
        setHasObsOverride(true);
        // L'observation affichée dans vehicule.dernierInventaire.observation est déjà l'override
        // On doit récupérer l'originale depuis l'inventaire directement
        const summary = await InventaireService.getInventaireSummary(vehicule.vehiculeId);
        setOriginalInvObs(summary.dernierInventaire?.observation || null);
      }
    } catch {
      // Ignorer les erreurs
    }
  }, []);

  const handleAddObservation = useCallback(async () => {
    if (!observationVehicule || !newObsText.trim()) return;
    setSavingObservation(true);
    try {
      const success = await SOGManualService.addObservation(
        observationVehicule.vehiculeId,
        newObsText.trim(),
        newObsAgent.trim()
      );
      if (success) {
        setNewObsText('');
        setNewObsAgent('');
        await loadSOGData();
        // Mettre à jour le véhicule local pour le modal
        setObservationVehicule(prev => {
          if (!prev) return prev;
          return { ...prev, observationsSOG: [...prev.observationsSOG, { text: newObsText.trim(), agent: newObsAgent.trim(), date: new Date() }] };
        });
      }
    } catch (err) {
      console.error('Erreur ajout observation:', err);
    } finally {
      setSavingObservation(false);
    }
  }, [observationVehicule, newObsText, newObsAgent]);

  const handleDeleteObservation = useCallback(async (index: number) => {
    if (!observationVehicule) return;
    setSavingObservation(true);
    try {
      const success = await SOGManualService.deleteObservation(
        observationVehicule.vehiculeId,
        index
      );
      if (success) {
        await loadSOGData();
        setObservationVehicule(prev => {
          if (!prev) return prev;
          const updated = [...prev.observationsSOG];
          updated.splice(index, 1);
          return { ...prev, observationsSOG: updated };
        });
      }
    } catch (err) {
      console.error('Erreur suppression observation:', err);
    } finally {
      setSavingObservation(false);
    }
  }, [observationVehicule]);

  // ========== Gestion de l'observation d'inventaire (modifier/supprimer) ==========

  const handleEditInvObservation = useCallback(() => {
    if (!observationVehicule) return;
    const currentObs = observationVehicule.dernierInventaire?.observation || '';
    setEditInvObsText(currentObs);
    setEditingInvObs(true);
  }, [observationVehicule]);

  const handleSaveInvObservation = useCallback(async () => {
    if (!observationVehicule) return;
    setSavingObservation(true);
    try {
      const success = await SOGManualService.overrideInventoryObservation(
        observationVehicule.vehiculeId,
        editInvObsText.trim()
      );
      if (success) {
        setEditingInvObs(false);
        setHasObsOverride(true);
        // Mettre à jour localement
        setObservationVehicule(prev => {
          if (!prev || !prev.dernierInventaire) return prev;
          return {
            ...prev,
            dernierInventaire: {
              ...prev.dernierInventaire,
              observation: editInvObsText.trim() || undefined
            }
          };
        });
        await loadSOGData();
      }
    } catch (err) {
      console.error('Erreur modification observation inventaire:', err);
    } finally {
      setSavingObservation(false);
    }
  }, [observationVehicule, editInvObsText]);

  const handleDeleteInvObservation = useCallback(async () => {
    if (!observationVehicule) return;
    if (!window.confirm('Supprimer cette observation d\'inventaire ?')) return;
    setSavingObservation(true);
    try {
      const success = await SOGManualService.overrideInventoryObservation(
        observationVehicule.vehiculeId,
        '' // chaîne vide = supprimée
      );
      if (success) {
        setHasObsOverride(true);
        // Stocker l'originale si pas encore fait
        if (!originalInvObs && observationVehicule.dernierInventaire?.observation) {
          setOriginalInvObs(observationVehicule.dernierInventaire.observation);
        }
        setObservationVehicule(prev => {
          if (!prev || !prev.dernierInventaire) return prev;
          return {
            ...prev,
            dernierInventaire: {
              ...prev.dernierInventaire,
              observation: undefined
            }
          };
        });
        await loadSOGData();
      }
    } catch (err) {
      console.error('Erreur suppression observation inventaire:', err);
    } finally {
      setSavingObservation(false);
    }
  }, [observationVehicule, originalInvObs]);

  const handleRestoreInvObservation = useCallback(async () => {
    if (!observationVehicule || !originalInvObs) return;
    setSavingObservation(true);
    try {
      const success = await SOGManualService.overrideInventoryObservation(
        observationVehicule.vehiculeId,
        null // null = remettre l'originale
      );
      if (success) {
        setHasObsOverride(false);
        setObservationVehicule(prev => {
          if (!prev || !prev.dernierInventaire) return prev;
          return {
            ...prev,
            dernierInventaire: {
              ...prev.dernierInventaire,
              observation: originalInvObs
            }
          };
        });
        await loadSOGData();
      }
    } catch (err) {
      console.error('Erreur restauration observation inventaire:', err);
    } finally {
      setSavingObservation(false);
    }
  }, [observationVehicule, originalInvObs]);

  // Obtenir la couleur de la famille d'un véhicule
  const getFamilleColor = useCallback((vehicule: SOGVehiculeStatus): string | undefined => {
    if (vehicule.familleId && famillesMap.has(vehicule.familleId)) {
      return famillesMap.get(vehicule.familleId)!.couleur;
    }
    return undefined;
  }, [famillesMap]);

  // Filtrer les matériels par recherche
  const filteredMateriels = materielsDisponibles.filter(m =>
    m.nom.toLowerCase().includes(searchMateriel.toLowerCase()) ||
    m.chemin.toLowerCase().includes(searchMateriel.toLowerCase())
  );

  const formatDate = (date: Date | any) => {
    try {
      let dateObj: Date;
      
      // Si c'est un Timestamp Firebase
      if (date && typeof date.toDate === 'function') {
        dateObj = date.toDate();
      }
      // Si c'est déjà un objet Date
      else if (date instanceof Date) {
        dateObj = date;
      }
      // Si c'est une string ou un nombre
      else if (date) {
        dateObj = new Date(date);
      }
      // Si c'est null/undefined
      else {
        return 'Date invalide';
      }
      
      // Vérifier si la date est valide
      if (isNaN(dateObj.getTime())) {
        return 'Date invalide';
      }
      
      return new Intl.DateTimeFormat('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(dateObj);
    } catch (error) {
      console.error('Erreur formatage date:', error, date);
      return 'Date invalide';
    }
  };

  if (loading) {
    return (
      <div className="sog-container">
        <div className="loading-indicator">
          <div className="loading-dots">
            <span></span><span></span><span></span>
          </div>
          <p>Chargement du SOG...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sog-container">
        <div className="error-message">
          <h3>Erreur</h3>
          <p>{error}</p>
          <button onClick={loadSOGData} className="btn btn-primary">
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  if (!sogData) {
    return (
      <div className="sog-container">
        <div className="no-data">
          <p>Aucune donnée disponible</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sog-container">
      <div className="sog-header">
        <div className="sog-header-left">
          {onReturnHome && (
            <button onClick={onReturnHome} className="btn btn-back">
              ← Retour
            </button>
          )}
          <span className="sog-logo-emoji">🏢</span>
          <h1>État Opérationnel des Véhicules (SOG)</h1>
        </div>
        <div className="sog-actions">
          <span className="last-update">
            Généré le {formatDate(sogData.dateGeneration)}
          </span>
          <button onClick={loadSOGData} className="btn btn-secondary">
            🔄 Actualiser
          </button>
          <button onClick={() => setShowHelp(true)} className="btn btn-help" title="Aide">
            ?
          </button>
        </div>
      </div>

      <div className="sog-table-container">
        <table className="sog-table">
          <thead>
            <tr>
              <th>Véhicule</th>
              <th>Statut</th>
              <th>Date de vérification</th>
              <th>Contrôle mensuel</th>
              <th>Défauts</th>
              <th>Observations</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sogData.vehicules.map((vehicule: SOGVehiculeStatus) => (
              <tr key={vehicule.vehiculeId} className={`row-${getStatutColor(vehicule.statut)}`}
                style={getFamilleColor(vehicule) ? { borderLeft: `4px solid ${getFamilleColor(vehicule)}` } : undefined}
              >
                <td className="vehicule-name-cell">
                  <div className="vehicule-name-content">
                    <span className="vehicule-name">{vehicule.vehiculeName}</span>
                  </div>
                </td>
                
                <td className="statut-cell">
                  <span className={`statut-badge-table ${getStatutColor(vehicule.statut)}`}>
                    {getStatutLabel(vehicule.statut)}
                  </span>
                </td>
                
                <td className="verification-cell">
                  {vehicule.dernierInventaire ? (
                    <div className="verification-info">
                      <div className="date-time">
                        {formatDate(vehicule.dernierInventaire.date)}
                      </div>
                      <div className="agent-info">
                        par {vehicule.dernierInventaire.agent}
                      </div>
                    </div>
                  ) : (
                    <span className="no-verification-text">❌ Jamais vérifié</span>
                  )}
                </td>
                
                {/* Cellule contrôle mensuel */}
                <td className="mensuel-cell">
                  {vehicule.mensuelActif ? (
                    vehicule.dernierMensuel ? (
                      <div className="mensuel-info">
                        <span className={`mensuel-statut mensuel-${vehicule.dernierMensuel.statut.toLowerCase()}`}>
                          {vehicule.dernierMensuel.statut === 'OK' ? '✓ OK' : vehicule.dernierMensuel.statut === 'ATTENTION' ? '⚡ Attention' : '⚠ Défaut'}
                        </span>
                        <div className="mensuel-date">{formatDate(vehicule.dernierMensuel.date)}</div>
                        <div className="mensuel-agent">par {vehicule.dernierMensuel.agent}</div>
                        <div className="mensuel-km">{vehicule.dernierMensuel.kilometres} km</div>
                      </div>
                    ) : (
                      <span className="no-mensuel">📋 Aucun contrôle</span>
                    )
                  ) : (
                    <span className="mensuel-inactif">— désactivé</span>
                  )}
                </td>
                
                <td className="defauts-cell defauts-cell-clickable" onClick={() => handleOpenDefautsModal(vehicule)} title="Cliquer pour gérer les défauts">
                  {vehicule.defauts.length > 0 ? (
                    <div className="defauts-summary">
                      <div className="defauts-count">
                        {vehicule.defauts.length} défaut{vehicule.defauts.length > 1 ? 's' : ''}
                      </div>
                      <div className="defauts-list-compact">
                        {vehicule.defauts.map((defaut, index) => {
                          // Déterminer si le détail est pertinent à afficher (pas les infos évidentes)
                          const isQuantiteDetail = defaut.quantiteAttendue !== undefined || (defaut.details && /^\d+\/\d+$/.test(defaut.details));
                          const detailsUtiles = defaut.details 
                            && defaut.details !== 'Absent'
                            && defaut.details !== 'Non coché (OK)'
                            && defaut.details !== 'Non vérifié'
                            && defaut.details !== 'Texte non renseigné'
                            && defaut.details !== 'Date non renseignée'
                            && !defaut.details.startsWith('Trouvé ')
                            && !isQuantiteDetail
                            ? defaut.details 
                            : null;
                          // Pour les quantités : extraire X/Y depuis details si quantiteAttendue n'est pas défini
                          const quantiteMatch = !defaut.quantiteAttendue && defaut.details ? defaut.details.match(/^(?:Trouvé\s+)?(\d+)\/(\d+)/) : null;
                          const displayQuantite = defaut.quantiteAttendue !== undefined ? defaut.quantite : (quantiteMatch ? parseInt(quantiteMatch[1]) : undefined);
                          const displayQuantiteAttendue = defaut.quantiteAttendue !== undefined ? defaut.quantiteAttendue : (quantiteMatch ? parseInt(quantiteMatch[2]) : undefined);
                          return (
                            <span key={index} className={`defaut-item-compact ${defaut.manuel ? 'defaut-manuel' : ''}`} title={`${defaut.chemin}${defaut.details ? ' — ' + defaut.details : ''}${defaut.manuel ? ' (manuel)' : ''}`}>
                              {defaut.manuel && '✏️ '}{defaut.nom}{displayQuantiteAttendue !== undefined && <span className="defaut-quantite-inline"> ({displayQuantite !== undefined ? displayQuantite : '?'}/{displayQuantiteAttendue})</span>}{detailsUtiles && <span className="defaut-detail-inline"> ({detailsUtiles})</span>}
                            </span>
                          );
                        }).reduce((prev, curr, index) => 
                          index === 0 ? [curr] : [...prev, ' ', curr], [] as any[]
                        )}
                      </div>
                    </div>
                  ) : (
                    <span className="no-defauts">✓ Aucun <span className="click-hint">＋</span></span>
                  )}
                </td>
                
                <td className="observations-cell observations-cell-clickable" onClick={() => handleOpenObservationModal(vehicule)} title="Cliquer pour gérer les observations">
                  {(vehicule.observationsSOG?.length > 0 || vehicule.dernierInventaire?.observation) ? (
                    <div className="observations-summary">
                      {vehicule.observationsSOG?.length > 0 && (
                        <div className="obs-compact-group">
                          <span className="obs-compact-count">
                            📌 {vehicule.observationsSOG.length} obs. SOG
                          </span>
                          <div className="obs-compact-list">
                            {vehicule.observationsSOG.map((obs, idx) => (
                              <span key={idx} className="obs-item-compact obs-item-sog" title={obs.text + (obs.agent ? ` — ${obs.agent}` : '')}>
                                {obs.text.length > 30 ? `${obs.text.substring(0, 30)}…` : obs.text}
                                {obs.agent && <span className="obs-agent-mini">({obs.agent})</span>}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {vehicule.dernierInventaire?.observation && (
                        <div className="obs-compact-inv">
                          <span className="obs-item-compact obs-item-inv" title={vehicule.dernierInventaire.observation}>
                            📋 {vehicule.dernierInventaire.observation.length > 35 
                              ? `${vehicule.dernierInventaire.observation.substring(0, 35)}…`
                              : vehicule.dernierInventaire.observation
                            }
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="no-observation">- <span className="click-hint">＋</span></span>
                  )}
                </td>
                
                <td className="actions-cell">
                  <button 
                    className="btn-action btn-details"
                    onClick={() => handleOpenModal(vehicule)}
                    title="Voir détails"
                  >
                    👁️
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Affichage en cartes pour mobile */}
      <div className="sog-cards-container">
        {sogData.vehicules.map((vehicule: SOGVehiculeStatus) => (
          <div key={vehicule.vehiculeId} className={`sog-card card-${getStatutColor(vehicule.statut)}`}
            style={getFamilleColor(vehicule) ? { borderLeftColor: getFamilleColor(vehicule) } : undefined}
          >
            <div className="card-header">
              <span className="card-vehicule-name">{vehicule.vehiculeName}</span>
              <span className={`card-statut ${getStatutColor(vehicule.statut)}`}>
                {getStatutLabel(vehicule.statut)}
              </span>
            </div>
            
            <div className="card-content">
              <div className="card-row">
                <span className="card-label">Vérification :</span>
                <div className="card-value">
                  {vehicule.dernierInventaire ? (
                    <>
                      <div className="card-date">
                        {formatDate(vehicule.dernierInventaire.date)}
                      </div>
                      <div className="card-agent">
                        par {vehicule.dernierInventaire.agent}
                      </div>
                    </>
                  ) : (
                    <span className="card-no-data">❌ Jamais vérifié</span>
                  )}
                </div>
              </div>
              
              {/* Contrôle mensuel sur carte mobile */}
              {vehicule.mensuelActif && (
                <div className="card-row">
                  <span className="card-label">Mensuel :</span>
                  <div className="card-value">
                    {vehicule.dernierMensuel ? (
                      <div>
                        <span className={`mensuel-statut mensuel-${vehicule.dernierMensuel.statut.toLowerCase()}`}>
                          {vehicule.dernierMensuel.statut === 'OK' ? '✓ OK' : vehicule.dernierMensuel.statut === 'ATTENTION' ? '⚡ Attention' : '⚠ Défaut'}
                        </span>
                        <div style={{ fontSize: '0.7rem', color: '#6c757d' }}>
                          {formatDate(vehicule.dernierMensuel.date)} — {vehicule.dernierMensuel.kilometres} km
                        </div>
                      </div>
                    ) : (
                      <span className="card-no-data">📋 Aucun contrôle</span>
                    )}
                  </div>
                </div>
              )}
              
              <div className="card-row card-row-clickable" onClick={() => handleOpenDefautsModal(vehicule)}>
                <span className="card-label">Défauts :</span>
                <div className="card-value">
                  {vehicule.defauts.length > 0 ? (
                    <div>
                      <div style={{ color: '#dc3545', fontWeight: '600', fontSize: '0.75rem' }}>
                        {vehicule.defauts.length} défaut{vehicule.defauts.length > 1 ? 's' : ''}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#6c757d', marginTop: '2px' }}>
                        {vehicule.defauts.slice(0, 2).map(d => `${d.manuel ? '✏️ ' : ''}${d.nom}${d.details ? ' (' + d.details + ')' : ''}`).join(', ')}
                        {vehicule.defauts.length > 2 && '...'}
                      </div>
                    </div>
                  ) : (
                    <span className="card-success-text">✓ Aucun <span className="click-hint">＋</span></span>
                  )}
                </div>
              </div>
              
              <div className="card-row card-row-clickable" onClick={() => handleOpenObservationModal(vehicule)}>
                <span className="card-label">Observations :</span>
                <div className="card-value" style={{ fontSize: '0.75rem', lineHeight: '1.3' }}>
                  {(vehicule.observationsSOG?.length > 0 || vehicule.dernierInventaire?.observation) ? (
                    <div className="observations-stack-card">
                      {vehicule.observationsSOG?.length > 0 && (
                        <div className="card-obs-group-sog">
                          <div className="card-obs-group-header">📌 SOG</div>
                          {vehicule.observationsSOG.map((obs, idx) => (
                            <div key={idx} className="card-obs-manual">
                              {obs.text.length > 40 ? `${obs.text.substring(0, 40)}...` : obs.text}
                              {obs.agent && <span className="observation-agent-tag">— {obs.agent}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                      {vehicule.dernierInventaire?.observation && (
                        <div className="card-obs-inventaire">
                          📋 {vehicule.dernierInventaire.observation.length > 40 
                            ? `${vehicule.dernierInventaire.observation.substring(0, 40)}...`
                            : vehicule.dernierInventaire.observation
                          }
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="no-observation">- <span className="click-hint">＋</span></span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="card-actions">
              <button 
                className="card-btn"
                onClick={() => handleOpenModal(vehicule)}
              >
                👁️ Voir détails
              </button>
            </div>
          </div>
        ))}
      </div>
      
      <VehiculeDetailModal
        vehicule={selectedVehicule}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />

      {/* ========== Modal Aide ========== */}
      {showHelp && (
        <div className="sog-modal-overlay" onClick={() => setShowHelp(false)}>
          <div className="sog-modal sog-modal-help" onClick={e => e.stopPropagation()}>
            <div className="sog-modal-header">
              <h2>❓ Aide — Page SOG</h2>
              <button className="sog-modal-close" onClick={() => setShowHelp(false)}>✕</button>
            </div>
            <div className="sog-modal-body help-content">

              <section className="help-section">
                <h3>📋 Présentation</h3>
                <p>La page <strong>SOG</strong> centralise l'état opérationnel de tous les véhicules. Elle combine les <strong>résultats des inventaires</strong> et les <strong>informations manuelles</strong> (défauts, observations).</p>
              </section>

              <section className="help-section">
                <h3>🖥️ Le tableau</h3>
                <table className="help-table">
                  <thead><tr><th>Colonne</th><th>Description</th></tr></thead>
                  <tbody>
                    <tr><td><strong>Véhicule</strong></td><td>Nom avec couleur de famille</td></tr>
                    <tr><td><strong>Statut</strong></td><td>✓ OK · ⚠ Défaut(s) · ? Non vérifié</td></tr>
                    <tr><td><strong>Date</strong></td><td>Dernier inventaire (agent + date)</td></tr>
                    <tr><td><strong>Défauts</strong></td><td>Liste des défauts — <em>cliquer pour gérer</em></td></tr>
                    <tr><td><strong>Observations</strong></td><td>Notes SOG et inventaire — <em>cliquer pour gérer</em></td></tr>
                    <tr><td><strong>Actions</strong></td><td>👁️ Fiche détaillée du véhicule</td></tr>
                  </tbody>
                </table>
              </section>

              <section className="help-section">
                <h3>🔧 Gérer les défauts</h3>
                <p>Cliquer sur la cellule <strong>Défauts</strong> d'un véhicule pour ouvrir le modal :</p>
                <ul>
                  <li><strong>Défauts d'inventaire</strong> — détectés automatiquement. Bouton <strong>✅</strong> pour les résoudre (nom + raison obligatoires).</li>
                  <li><strong>Défauts résolus</strong> — masqués par défaut, cliquer pour déplier. Bouton <strong>↩️</strong> pour remettre actif.</li>
                  <li><strong>Défauts manuels</strong> — ajoutés par le SOG. Rechercher un matériel → cliquer → <strong>💾 Enregistrer</strong>.</li>
                </ul>
              </section>

              <section className="help-section">
                <h3>📝 Gérer les observations</h3>
                <p>Cliquer sur la cellule <strong>Observations</strong> pour ouvrir le modal :</p>
                <ul>
                  <li><strong>Observations d'inventaire</strong> — en lecture seule (grisé)</li>
                  <li><strong>Observations SOG</strong> — ajout/suppression immédiate</li>
                  <li>Saisir un texte + nom d'agent → <strong>➕ Ajouter</strong></li>
                </ul>
              </section>

              <section className="help-section">
                <h3>👁️ Fiche détaillée</h3>
                <p>Le bouton <strong>👁️</strong> ouvre 3 vues :</p>
                <ul>
                  <li><strong>Détail</strong> — informations générales et défauts</li>
                  <li><strong>Historique</strong> — tous les inventaires passés</li>
                  <li><strong>Inventaire complet</strong> — arborescence du matériel</li>
                </ul>
              </section>

              <section className="help-section">
                <h3>📊 Récapitulatif des actions</h3>
                <table className="help-table">
                  <thead><tr><th>Action</th><th>Comment</th><th>Sauvegarde</th></tr></thead>
                  <tbody>
                    <tr><td>Résoudre un défaut</td><td>✅ → nom + raison</td><td>Immédiate</td></tr>
                    <tr><td>Remettre actif</td><td>↩️ → confirmation</td><td>Immédiate</td></tr>
                    <tr><td>Ajouter défaut manuel</td><td>＋ → rechercher → 💾</td><td>Au clic Enregistrer</td></tr>
                    <tr><td>Supprimer défaut manuel</td><td>🗑️ → 💾</td><td>Au clic Enregistrer</td></tr>
                    <tr><td>Ajouter observation</td><td>Texte + agent → ➕</td><td>Immédiate</td></tr>
                    <tr><td>Supprimer observation</td><td>🗑️</td><td>Immédiate</td></tr>
                  </tbody>
                </table>
              </section>

              <section className="help-section help-section-tip">
                <p>💡 <strong>Astuce</strong> : le bouton <strong>🔄 Actualiser</strong> recharge les données depuis le serveur si un autre utilisateur a fait des modifications.</p>
              </section>

            </div>
            <div className="sog-modal-footer">
              <div className="sog-modal-footer-right">
                <button className="sog-btn sog-btn-secondary" onClick={() => setShowHelp(false)}>✕ Fermer</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========== Modal Gestion des Défauts ========== */}
      {showDefautsModal && defautsVehicule && (
        <div className="sog-modal-overlay" onClick={() => setShowDefautsModal(false)}>
          <div className="sog-modal" onClick={e => e.stopPropagation()}>
            <div className="sog-modal-header">
              <h2>🔧 Défauts — {defautsVehicule.vehiculeName}</h2>
              <button className="sog-modal-close" onClick={() => setShowDefautsModal(false)}>✕</button>
            </div>
            
            <div className="sog-modal-body">
              {/* Défauts issus de l'inventaire */}
              {defautsInventaire.length > 0 && (
                <div className="defauts-section">
                  <h3 className="defauts-section-title">📋 Défauts d'inventaire ({defautsInventaire.length})</h3>
                  <div className="defauts-list">
                    {defautsInventaire.map((defaut, index) => (
                      <div key={`inv-${index}`} className="defaut-row defaut-row-inventaire">
                        <div className="defaut-info">
                          <span className="defaut-nom">{defaut.nom}</span>
                          <span className="defaut-chemin">{defaut.chemin}</span>
                          {defaut.quantiteAttendue !== undefined && (
                            <span className="defaut-quantite">
                              📦 {defaut.quantite !== undefined ? defaut.quantite : '?'} / {defaut.quantiteAttendue}
                            </span>
                          )}
                          {defaut.details && <span className="defaut-details">{defaut.details}</span>}
                        </div>
                        <button
                          className="defaut-resolve-btn"
                          onClick={() => {
                            setShowResolveConfirm({ chemin: defaut.chemin, nom: defaut.nom, details: defaut.details });
                            setResolveAgent('');
                            setResolveReason('');
                          }}
                          title="Marquer comme résolu"
                        >
                          ✅
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Panneau de confirmation de résolution */}
              {showResolveConfirm && (
                <div className="resolve-confirm-panel">
                  <div className="resolve-confirm-header">
                    ✅ Résoudre : <strong>{showResolveConfirm.nom}</strong>
                  </div>
                  <div className="resolve-confirm-body">
                    <input
                      type="text"
                      className="sog-input"
                      placeholder="Votre nom (obligatoire)"
                      value={resolveAgent}
                      onChange={e => setResolveAgent(e.target.value)}
                      autoFocus
                    />
                    <select
                      className="sog-input"
                      value={resolveReason}
                      onChange={e => setResolveReason(e.target.value)}
                    >
                      <option value="">Raison (optionnel)</option>
                      <option value="Réapprovisionné">Réapprovisionné</option>
                      <option value="Erreur d'inventaire">Erreur d'inventaire</option>
                      <option value="Remplacé">Remplacé</option>
                      <option value="Réparé">Réparé</option>
                      <option value="Autre">Autre</option>
                    </select>
                    <div className="resolve-confirm-actions">
                      <button
                        className="sog-btn sog-btn-cancel"
                        onClick={() => setShowResolveConfirm(null)}
                      >
                        Annuler
                      </button>
                      <button
                        className="sog-btn sog-btn-resolve"
                        onClick={handleResolveDefaut}
                        disabled={!resolveAgent.trim() || savingResolve}
                      >
                        {savingResolve ? '⏳...' : '✅ Confirmer'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Défauts résolus (cachés par défaut, filtrés < 2 mois) */}
              {(() => {
                const deuxMois = new Date();
                deuxMois.setMonth(deuxMois.getMonth() - 2);
                const recentResolved = resolvedDefauts.filter(r => r.resolvedDate >= deuxMois);
                if (recentResolved.length === 0) return null;
                return (
                  <div className="defauts-section defauts-section-resolved">
                    <button
                      className="resolved-toggle-btn"
                      onClick={() => setShowResolvedDefauts(prev => !prev)}
                    >
                      {showResolvedDefauts ? '▼' : '▶'} ✅ Défauts résolus ({recentResolved.length})
                    </button>
                    {showResolvedDefauts && (
                      <div className="defauts-list">
                        {recentResolved.map((resolved, index) => (
                          <div key={`res-${index}`} className="defaut-row defaut-row-resolved">
                            <div className="defaut-info">
                              <span className="defaut-nom defaut-nom-resolved">{resolved.nom}</span>
                              <span className="defaut-chemin">{resolved.chemin}</span>
                              <span className="defaut-resolved-info">
                                {resolved.reason && <span className="resolved-reason">{resolved.reason}</span>}
                                {' '}par {resolved.resolvedBy} le {resolved.resolvedDate.toLocaleDateString('fr-FR')}
                              </span>
                            </div>
                            <button
                              className="defaut-unresolve-btn"
                              onClick={() => handleUnresolveDefaut(resolved)}
                              title="Remettre comme défaut actif"
                            >
                              ↩️
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Défauts manuels (modifiables) */}
              <div className="defauts-section">
                <h3 className="defauts-section-title">✏️ Défauts manuels (SOG)</h3>
                {defautsManuels.length > 0 ? (
                  <div className="defauts-list">
                    {defautsManuels.map((defaut, index) => (
                      <div key={`man-${index}`} className="defaut-row defaut-row-manuel">
                        <div className="defaut-info">
                          <span className="defaut-nom">{defaut.nom}</span>
                          <span className="defaut-chemin">{defaut.chemin}</span>
                          {defaut.quantiteAttendue !== undefined && (
                            <span className="defaut-quantite">
                              📦 {defaut.quantite !== undefined ? defaut.quantite : '?'} / {defaut.quantiteAttendue}
                            </span>
                          )}
                          {defaut.details && <span className="defaut-details">💬 {defaut.details}</span>}
                        </div>
                        <button
                          className="defaut-remove-btn"
                          onClick={() => handleRemoveDefautManuel(index)}
                          title="Supprimer ce défaut"
                        >
                          🗑️
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="defauts-empty">Aucun défaut manuel ajouté</p>
                )}
              </div>

              {/* Bouton pour ajouter un défaut */}
              {!showAddDefaut ? (
                <button className="sog-btn sog-btn-add" onClick={() => setShowAddDefaut(true)}>
                  ＋ Ajouter un défaut
                </button>
              ) : (
                <div className="add-defaut-panel">
                  <h4>Sélectionner le matériel en défaut :</h4>
                  <input
                    type="text"
                    className="sog-search-input"
                    placeholder="🔍 Rechercher un matériel..."
                    value={searchMateriel}
                    onChange={e => setSearchMateriel(e.target.value)}
                    autoFocus
                  />
                  <div className="add-defaut-details-row">
                    <input
                      type="text"
                      className="sog-input"
                      placeholder="Détails du défaut (optionnel)"
                      value={newDefautDetails}
                      onChange={e => setNewDefautDetails(e.target.value)}
                    />
                  </div>

                  {/* Panneau de sélection de quantité pour les matériels type quantité */}
                  {selectedMaterielForQuantite && (
                    <div className="quantite-selector-panel">
                      <div className="quantite-selector-header">
                        <span className="quantite-selector-nom">{selectedMaterielForQuantite.nom}</span>
                        <span className="quantite-selector-attendue">
                          Quantité attendue : <strong>{selectedMaterielForQuantite.quantiteAttendue}</strong>
                        </span>
                      </div>
                      <div className="quantite-selector-input-row">
                        <label>Quantité trouvée :</label>
                        <div className="quantite-selector-controls">
                          <button
                            className="quantite-btn quantite-btn-minus"
                            onClick={() => setNewDefautQuantite(prev => typeof prev === 'number' && prev > 0 ? prev - 1 : 0)}
                          >−</button>
                          <input
                            type="number"
                            className="quantite-input"
                            min="0"
                            max={selectedMaterielForQuantite.quantiteAttendue ?? 999}
                            value={newDefautQuantite}
                            onChange={e => {
                              const val = e.target.value;
                              if (val === '') setNewDefautQuantite('');
                              else {
                                const num = parseInt(val, 10);
                                if (!isNaN(num) && num >= 0) setNewDefautQuantite(num);
                              }
                            }}
                            autoFocus
                          />
                          <button
                            className="quantite-btn quantite-btn-plus"
                            onClick={() => setNewDefautQuantite(prev => typeof prev === 'number' ? prev + 1 : 1)}
                          >+</button>
                        </div>
                      </div>
                      <div className="quantite-selector-actions">
                        <button
                          className="sog-btn sog-btn-cancel"
                          onClick={() => { setSelectedMaterielForQuantite(null); setNewDefautQuantite(''); }}
                        >
                          ← Retour
                        </button>
                        <button
                          className="sog-btn sog-btn-primary"
                          onClick={handleConfirmDefautWithQuantite}
                        >
                          ✓ Ajouter le défaut
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Liste des matériels (masquée quand sélection quantité en cours) */}
                  {!selectedMaterielForQuantite && (
                    <>
                      {loadingMateriels ? (
                        <div className="materiels-loading">Chargement des matériels...</div>
                      ) : (
                        <div className="materiels-list">
                          {filteredMateriels.length > 0 ? (
                            filteredMateriels.map((materiel, index) => (
                              <div
                                key={index}
                                className="materiel-option"
                                onClick={() => handleSelectMateriel(materiel)}
                              >
                                <span className="materiel-nom">
                                  {materiel.nom}
                                  {materiel.type === 'quantite' && (
                                    <span className="materiel-quantite-badge">× {materiel.quantiteAttendue}</span>
                                  )}
                                </span>
                                <span className="materiel-chemin">{materiel.chemin}</span>
                              </div>
                            ))
                          ) : (
                            <div className="materiels-empty">
                              {searchMateriel ? 'Aucun matériel trouvé' : 'Aucun matériel disponible'}
                            </div>
                          )}
                        </div>
                      )}
                      <button className="sog-btn sog-btn-cancel" onClick={() => { setShowAddDefaut(false); setSearchMateriel(''); setSelectedMaterielForQuantite(null); }}>
                        Annuler
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="sog-modal-footer">
              <button className="sog-btn sog-btn-secondary" onClick={() => setShowDefautsModal(false)}>
                Annuler
              </button>
              <button className="sog-btn sog-btn-primary" onClick={handleSaveDefauts} disabled={savingDefauts}>
                {savingDefauts ? '⏳ Sauvegarde...' : '💾 Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== Modal Gestion des Observations ========== */}
      {showObservationModal && observationVehicule && (
        <div className="sog-modal-overlay" onClick={() => setShowObservationModal(false)}>
          <div className="sog-modal sog-modal-sm" onClick={e => e.stopPropagation()}>
            <div className="sog-modal-header">
              <h2>📝 Observations — {observationVehicule.vehiculeName}</h2>
              <button className="sog-modal-close" onClick={() => setShowObservationModal(false)}>✕</button>
            </div>
            
            <div className="sog-modal-body">
              {/* Observation de l'inventaire (modifiable/supprimable) */}
              {(observationVehicule.dernierInventaire?.observation || (hasObsOverride && originalInvObs)) && (
                <div className="obs-section obs-section-inventaire">
                  <h4 className="obs-section-header obs-section-header-inventaire">
                    📋 Observation d'inventaire
                    {hasObsOverride && (
                      <span className="obs-section-badge obs-section-badge-modified">modifiée</span>
                    )}
                  </h4>
                  
                  {/* Mode supprimée : observation originale barrée + bouton restaurer */}
                  {hasObsOverride && !observationVehicule.dernierInventaire?.observation && originalInvObs && (
                    <div className="obs-inv-deleted">
                      <div className="obs-inv-deleted-text">
                        <span className="obs-inv-strikethrough">{originalInvObs}</span>
                        <span className="obs-inv-deleted-badge">supprimée</span>
                      </div>
                      <button
                        className="obs-inv-btn obs-inv-btn-restore"
                        onClick={handleRestoreInvObservation}
                        disabled={savingObservation}
                        title="Restaurer l'observation originale"
                      >
                        ↩️ Restaurer
                      </button>
                    </div>
                  )}
                  
                  {/* Mode édition */}
                  {editingInvObs && (
                    <div className="obs-inv-edit">
                      <textarea
                        className="sog-textarea"
                        value={editInvObsText}
                        onChange={e => setEditInvObsText(e.target.value)}
                        rows={3}
                        placeholder="Modifier l'observation..."
                      />
                      <div className="obs-inv-edit-actions">
                        <button
                          className="obs-inv-btn obs-inv-btn-save"
                          onClick={handleSaveInvObservation}
                          disabled={savingObservation}
                        >
                          {savingObservation ? '⏳...' : '✓ Enregistrer'}
                        </button>
                        <button
                          className="obs-inv-btn obs-inv-btn-cancel"
                          onClick={() => setEditingInvObs(false)}
                          disabled={savingObservation}
                        >
                          ✕ Annuler
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* Mode lecture avec boutons d'action */}
                  {!editingInvObs && observationVehicule.dernierInventaire?.observation && (
                    <div className="obs-inv-display">
                      <div className="observation-readonly-box">
                        {observationVehicule.dernierInventaire.observation}
                      </div>
                      <div className="obs-inv-actions">
                        <button
                          className="obs-inv-btn obs-inv-btn-edit"
                          onClick={handleEditInvObservation}
                          disabled={savingObservation}
                          title="Modifier l'observation"
                        >
                          ✏️ Modifier
                        </button>
                        <button
                          className="obs-inv-btn obs-inv-btn-delete"
                          onClick={handleDeleteInvObservation}
                          disabled={savingObservation}
                          title="Supprimer l'observation"
                        >
                          🗑️ Supprimer
                        </button>
                        {hasObsOverride && originalInvObs && (
                          <button
                            className="obs-inv-btn obs-inv-btn-restore"
                            onClick={handleRestoreInvObservation}
                            disabled={savingObservation}
                            title="Restaurer l'observation originale"
                          >
                            ↩️ Restaurer
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Liste des observations manuelles existantes */}
              {observationVehicule.observationsSOG?.length > 0 && (
                <div className="obs-section obs-section-existing">
                  <h4 className="obs-section-header obs-section-header-existing">
                    📌 Observations SOG
                    <span className="obs-section-badge obs-section-badge-count">{observationVehicule.observationsSOG.length}</span>
                  </h4>
                  <div className="obs-list">
                    {observationVehicule.observationsSOG.map((obs, idx) => (
                      <div key={idx} className="obs-list-item">
                        <div className="obs-list-content">
                          <div className="obs-list-text">{obs.text}</div>
                          <div className="obs-list-meta">
                            {obs.agent && <span className="obs-list-agent">👤 {obs.agent}</span>}
                            <span className="obs-list-date">📅 {obs.date instanceof Date ? obs.date.toLocaleDateString('fr-FR') : new Date(obs.date).toLocaleDateString('fr-FR')}</span>
                          </div>
                        </div>
                        <button 
                          className="obs-list-delete"
                          onClick={() => handleDeleteObservation(idx)}
                          disabled={savingObservation}
                          title="Supprimer cette observation"
                        >
                          🗑️
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Formulaire d'ajout d'une nouvelle observation */}
              <div className="obs-section obs-section-new">
                <h4 className="obs-section-header obs-section-header-new">
                  ✏️ Nouvelle observation
                </h4>
                <div className="observation-agent-field">
                  <label className="observation-agent-label">👤 Agent :</label>
                  <input
                    type="text"
                    className="sog-input observation-agent-input"
                    placeholder="Nom de l'agent..."
                    value={newObsAgent}
                    onChange={e => setNewObsAgent(e.target.value)}
                  />
                </div>
                <textarea
                  className="sog-textarea"
                  placeholder="Saisir l'observation..."
                  value={newObsText}
                  onChange={e => setNewObsText(e.target.value)}
                  rows={3}
                />
                <button 
                  className="obs-btn-add" 
                  onClick={handleAddObservation} 
                  disabled={savingObservation || !newObsText.trim()}
                >
                  {savingObservation ? '⏳ Ajout en cours...' : '➕ Ajouter l\'observation'}
                </button>
              </div>
            </div>

            <div className="sog-modal-footer">
              <div className="sog-modal-footer-right">
                <button className="sog-btn sog-btn-secondary" onClick={() => setShowObservationModal(false)}>
                  ✕ Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
    </div>
  );
};

export default SOGPage;

import React, { useState, useEffect } from 'react';
import { VehiculeManagementService } from '../firebase/vehicule-management-service';
import type { VehiculeMetadata } from '../firebase/vehicule-management-service';
import { FamilleService } from '../firebase/famille-service';
import type { FamilleConfig } from '../firebase/famille-service';
import { vehicules } from '../models/vehicules/index';

interface Props {
  onClose: () => void;
  onOrderUpdated: () => void;
}

interface VehiculeOrderItem {
  id: string;
  name: string;
  displayOrder: number;
  metadata: VehiculeMetadata;
  familleId: string;
  familleNom: string;
}

const VehiculeOrderManager: React.FC<Props> = ({ onClose, onOrderUpdated }) => {
  const [vehiculeList, setVehiculeList] = useState<VehiculeOrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [groupByFamille, setGroupByFamille] = useState(false);
  const [selectedFamille, setSelectedFamille] = useState<string>('all');
  const [famillesList, setFamillesList] = useState<FamilleConfig[]>([]);

  useEffect(() => {
    loadVehiculeOrder();
  }, []);

  const loadVehiculeOrder = async () => {
    try {
      setLoading(true);
      
      // Charger les familles disponibles
      const familles = await FamilleService.getAllFamilles();
      setFamillesList(familles);
      
      // Créer un mapping ID -> nom de famille
      const familleMapping: { [id: string]: string } = {};
      familles.forEach(f => {
        familleMapping[f.id] = f.nom;
      });
      
      // Charger tous les véhicules personnalisés depuis Firebase
      const { VehiculeConfigService } = await import('../firebase/vehicule-config-service');
      const customVehicules = await VehiculeConfigService.getAllVehiculeConfigs();
      const metadatas = await VehiculeManagementService.getAllVehiculeMetadata();
      
      // Créer la liste des véhicules avec leurs ordres
      const vehiculeItems: VehiculeOrderItem[] = [];
      
      // Ajouter tous les véhicules personnalisés depuis Firebase
      for (const vehicule of customVehicules) {
        const metadata = metadatas.find(m => m.id === vehicule.id) || {
          id: vehicule.id,
          visible: true,
          isHidden: false,
          displayOrder: 999
        };
        
        if (!metadata.isHidden) {
          // Déterminer la famille
          let familleId = metadata.familleId;
          if (!familleId) {
            familleId = await FamilleService.detectFamilleFromVehiculeName(vehicule.nom);
          }
          
          const familleNom = familleMapping[familleId] || 'Divers';
          
          vehiculeItems.push({
            id: vehicule.id,
            name: metadata.customName || vehicule.nom,
            displayOrder: metadata.displayOrder || 999,
            metadata,
            familleId,
            familleNom
          });
        }
      }
      
      // Ajouter les véhicules par défaut qui n'ont pas de version personnalisée
      for (const vehiculeId of Object.keys(vehicules)) {
        // Vérifier si ce véhicule n'existe pas déjà dans les véhicules personnalisés
        const alreadyExists = customVehicules.some(cv => cv.id === vehiculeId);
        if (!alreadyExists) {
          const vehicule = vehicules[vehiculeId];
          const metadata = metadatas.find(m => m.id === vehiculeId) || {
            id: vehiculeId,
            visible: true,
            isHidden: false,
            displayOrder: 999
          };
          
          if (!metadata.isHidden) {
            // Déterminer la famille
            let familleId = metadata.familleId;
            if (!familleId) {
              familleId = await FamilleService.detectFamilleFromVehiculeName(vehicule.nom);
            }
            
            const familleNom = familleMapping[familleId] || 'Divers';
            
            vehiculeItems.push({
              id: vehiculeId,
              name: metadata.customName || vehicule.nom,
              displayOrder: metadata.displayOrder || 999,
              metadata,
              familleId,
              familleNom
            });
          }
        }
      }
      
      // Trier par ordre d'affichage
      vehiculeItems.sort((a, b) => a.displayOrder - b.displayOrder);
      
      setVehiculeList(vehiculeItems);
    } catch (error) {
      console.error('Erreur chargement ordre véhicules:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      return;
    }

    const newList = [...vehiculeList];
    const draggedItem = newList[draggedIndex];
    
    // Supprimer l'élément de sa position actuelle
    newList.splice(draggedIndex, 1);
    
    // L'insérer à la nouvelle position
    newList.splice(dropIndex, 0, draggedItem);
    
    // Mettre à jour les ordres
    newList.forEach((item, index) => {
      item.displayOrder = index + 1;
    });
    
    setVehiculeList(newList);
    setDraggedIndex(null);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    
    const newList = [...vehiculeList];
    [newList[index], newList[index - 1]] = [newList[index - 1], newList[index]];
    
    // Mettre à jour les ordres
    newList.forEach((item, idx) => {
      item.displayOrder = idx + 1;
    });
    
    setVehiculeList(newList);
  };

  const handleMoveDown = (index: number) => {
    if (index === vehiculeList.length - 1) return;
    
    const newList = [...vehiculeList];
    [newList[index], newList[index + 1]] = [newList[index + 1], newList[index]];
    
    // Mettre à jour les ordres
    newList.forEach((item, idx) => {
      item.displayOrder = idx + 1;
    });
    
    setVehiculeList(newList);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      const vehiculeOrders = vehiculeList.map(item => ({
        id: item.id,
        order: item.displayOrder
      }));
      
      const success = await VehiculeManagementService.updateVehiculeDisplayOrder(vehiculeOrders);
      
      if (success) {
        onOrderUpdated();
        onClose();
      } else {
        alert('Erreur lors de la sauvegarde de l\'ordre des véhicules');
      }
    } catch (error) {
      console.error('❌ Erreur sauvegarde ordre:', error);
      alert('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleFamilleChange = async (vehiculeId: string, nouvelleFamilleId: string) => {
    try {
      console.log(`🔄 Changement famille: ${vehiculeId} -> ${nouvelleFamilleId}`);
      
      const success = await VehiculeManagementService.updateVehiculeFamilleId(vehiculeId, nouvelleFamilleId);
      
      if (success) {
        console.log('✅ Famille mise à jour avec succès');
        
        // Trouver le nom de la famille
        const famille = famillesList.find(f => f.id === nouvelleFamilleId);
        const familleNom = famille?.nom || 'Divers';
        
        // Mettre à jour la liste locale
        const updatedList = vehiculeList.map(item => 
          item.id === vehiculeId ? { ...item, familleId: nouvelleFamilleId, familleNom } : item
        );
        setVehiculeList(updatedList);
        
        // Notifier le parent que les données ont changé
        onOrderUpdated();
        
        // Déclencher le rechargement de la HomePage si disponible
        if ((window as any).refreshHomePage) {
          (window as any).refreshHomePage();
        }
        
        console.log(`✅ Interface mise à jour: ${vehiculeId} maintenant dans ${familleNom}`);
      } else {
        console.error('❌ Échec de la mise à jour de la famille');
        alert('Erreur lors de la sauvegarde de la famille');
      }
    } catch (error) {
      console.error('❌ Erreur mise à jour famille:', error);
      alert('Erreur lors de la mise à jour de la famille');
    }
  };

  const getFilteredVehiculeList = () => {
    if (selectedFamille === 'all') {
      return vehiculeList;
    }
    return vehiculeList.filter(vehicule => vehicule.familleId === selectedFamille);
  };

  const getVehiculesByFamille = () => {
    const grouped: { [familleId: string]: VehiculeOrderItem[] } = {};
    vehiculeList.forEach(vehicule => {
      if (!grouped[vehicule.familleId]) {
        grouped[vehicule.familleId] = [];
      }
      grouped[vehicule.familleId].push(vehicule);
    });
    return grouped;
  };

  if (loading) {
    return (
      <div className="modal-backdrop">
        <div className="modal-content">
          <div className="modal-header">
            <h2>Gestion de l'ordre des véhicules</h2>
            <button onClick={onClose} className="modal-close">×</button>
          </div>
          <div className="modal-body">
            <div className="loading">Chargement...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <h2>🔄 Gestion de l'ordre des véhicules</h2>
          <button onClick={onClose} className="modal-close">×</button>
        </div>
        <div className="modal-body">
          <p className="order-instructions">
            Faites glisser les véhicules pour modifier leur ordre d'affichage dans le panneau SOG, 
            ou utilisez les boutons de direction.
          </p>

          {/* Options d'affichage et de filtrage */}
          <div className="vehicule-options">
            <div className="option-group">
              <label>
                <input
                  type="checkbox"
                  checked={groupByFamille}
                  onChange={(e) => setGroupByFamille(e.target.checked)}
                />
                Grouper par famille
              </label>
            </div>
            
            <div className="option-group">
              <label>Filtrer par famille :</label>
              <select 
                value={selectedFamille} 
                onChange={(e) => setSelectedFamille(e.target.value)}
                className="famille-select"
              >
                <option value="all">Toutes les familles</option>
                {famillesList.map(famille => (
                  <option key={famille.id} value={famille.id}>{famille.nom}</option>
                ))}
              </select>
            </div>
          </div>
          
          {/* Affichage groupé par famille ou liste simple */}
          {groupByFamille ? (
            <div className="vehicules-by-famille">
              {Object.entries(getVehiculesByFamille()).map(([familleId, vehicules]) => {
                const famille = famillesList.find(f => f.id === familleId);
                const familleNom = famille?.nom || familleId;
                return (
                  <div key={familleId} className="famille-group">
                    <h4 className="famille-title">{familleNom} ({vehicules.length})</h4>
                    <div className="vehicule-order-list">
                      {vehicules.map((item) => (
                        <div
                          key={item.id}
                          className={`vehicule-order-item ${draggedIndex === vehiculeList.indexOf(item) ? 'dragging' : ''}`}
                          draggable
                          onDragStart={(e) => handleDragStart(e, vehiculeList.indexOf(item))}
                          onDragOver={handleDragOver}
                          onDragEnter={handleDragEnter}
                          onDrop={(e) => handleDrop(e, vehiculeList.indexOf(item))}
                        >
                          <div className="drag-handle">⋮⋮</div>
                          <div className="order-number">{vehiculeList.indexOf(item) + 1}</div>
                          <div className="vehicule-info">
                            <span className="vehicule-name">{item.name}</span>
                            <select 
                              value={item.familleId} 
                              onChange={(e) => handleFamilleChange(item.id, e.target.value)}
                              className="famille-mini-select"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {famillesList.map(f => (
                                <option key={f.id} value={f.id}>{f.nom}</option>
                              ))}
                            </select>
                        </div>
                        <div className="order-controls">
                          <button
                            onClick={() => handleMoveUp(vehiculeList.indexOf(item))}
                            disabled={vehiculeList.indexOf(item) === 0}
                            className="order-btn"
                            title="Monter"
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => handleMoveDown(vehiculeList.indexOf(item))}
                            disabled={vehiculeList.indexOf(item) === vehiculeList.length - 1}
                            className="order-btn"
                            title="Descendre"
                          >
                            ↓
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            </div>
          ) : (
            <div className="vehicule-order-list">
            {getFilteredVehiculeList().map((item) => {
              const realIndex = vehiculeList.indexOf(item);
              return (
                <div
                  key={item.id}
                  className={`vehicule-order-item ${draggedIndex === realIndex ? 'dragging' : ''}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, realIndex)}
                  onDragOver={handleDragOver}
                  onDragEnter={handleDragEnter}
                  onDrop={(e) => handleDrop(e, realIndex)}
                >
                  <div className="drag-handle">⋮⋮</div>
                  <div className="order-number">{realIndex + 1}</div>
                  <div className="vehicule-info">
                    <span className="vehicule-name">{item.name}</span>
                    <select 
                      value={item.familleId} 
                      onChange={(e) => handleFamilleChange(item.id, e.target.value)}
                      className="famille-mini-select"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {famillesList.map(f => (
                        <option key={f.id} value={f.id}>{f.nom}</option>
                      ))}
                    </select>
                  </div>
                  <div className="order-controls">
                    <button
                      onClick={() => handleMoveUp(realIndex)}
                      disabled={realIndex === 0}
                      className="order-btn"
                      title="Monter"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => handleMoveDown(realIndex)}
                      disabled={realIndex === vehiculeList.length - 1}
                      className="order-btn"
                      title="Descendre"
                    >
                      ↓
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="admin-btn admin-btn-secondary">
            Annuler
          </button>
          <button
            onClick={handleSave}
            className="admin-btn admin-btn-primary"
            disabled={saving}
          >
            {saving ? 'Sauvegarde...' : '💾 Sauvegarder l\'ordre'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VehiculeOrderManager;

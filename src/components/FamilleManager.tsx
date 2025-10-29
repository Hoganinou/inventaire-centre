import React, { useState, useEffect } from 'react';
import { FamilleService } from '../firebase/famille-service';
import type { FamilleConfig } from '../firebase/famille-service';

interface Props {
  onClose: () => void;
  onFamillesUpdated: () => void;
}

const FamilleManager: React.FC<Props> = ({ onClose, onFamillesUpdated }) => {
  const [familles, setFamilles] = useState<FamilleConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [editingFamille, setEditingFamille] = useState<FamilleConfig | null>(null);
  const [newFamille, setNewFamille] = useState({
    nom: '',
    couleur: '#4f7cff',
    icone: ''
  });
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    loadFamilles();
  }, []);

  const loadFamilles = async () => {
    try {
      setLoading(true);
      const loadedFamilles = await FamilleService.getAllFamilles();
      setFamilles(loadedFamilles);
    } catch (error) {
      console.error('❌ Erreur chargement familles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      const famillesOrder = familles.map((famille, index) => ({
        id: famille.id,
        ordre: index + 1
      }));
      
      const success = await FamilleService.updateFamillesOrder(famillesOrder);
      
      if (success) {
        onFamillesUpdated();
        onClose();
      } else {
        alert('Erreur lors de la sauvegarde de l\'ordre des familles');
      }
    } catch (error) {
      console.error('❌ Erreur sauvegarde ordre familles:', error);
      alert('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleAddFamille = async () => {
    try {
      if (!newFamille.nom.trim()) {
        alert('Le nom de la famille est obligatoire');
        return;
      }

      setSaving(true);
      const createdFamille = await FamilleService.createFamille(
        newFamille.nom,
        newFamille.couleur,
        newFamille.icone
      );

      if (createdFamille) {
        setFamilles([...familles, createdFamille]);
        setNewFamille({ nom: '', couleur: '#4f7cff', icone: '' });
        setShowAddForm(false);
      } else {
        alert('Erreur lors de la création de la famille');
      }
    } catch (error) {
      console.error('❌ Erreur création famille:', error);
      alert('Erreur lors de la création');
    } finally {
      setSaving(false);
    }
  };

  const handleEditFamille = async (famille: FamilleConfig) => {
    try {
      setSaving(true);
      const success = await FamilleService.saveFamille(famille);
      
      if (success) {
        setFamilles(familles.map(f => f.id === famille.id ? famille : f));
        setEditingFamille(null);
      } else {
        alert('Erreur lors de la modification de la famille');
      }
    } catch (error) {
      console.error('❌ Erreur modification famille:', error);
      alert('Erreur lors de la modification');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFamille = async (familleId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette famille ? Cette action est irréversible.')) {
      return;
    }

    try {
      setSaving(true);
      const success = await FamilleService.deleteFamille(familleId);
      
      if (success) {
        setFamilles(familles.filter(f => f.id !== familleId));
      } else {
        alert('Erreur lors de la suppression de la famille');
      }
    } catch (error) {
      console.error('❌ Erreur suppression famille:', error);
      alert('Erreur lors de la suppression');
    } finally {
      setSaving(false);
    }
  };

  // Fonctions de drag & drop
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

    const newList = [...familles];
    const draggedItem = newList[draggedIndex];
    
    // Supprimer l'élément de sa position actuelle
    newList.splice(draggedIndex, 1);
    
    // L'insérer à la nouvelle position
    newList.splice(dropIndex, 0, draggedItem);
    
    // Mettre à jour les ordres
    newList.forEach((item, index) => {
      item.ordre = index + 1;
    });
    
    setFamilles(newList);
    setDraggedIndex(null);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    
    const newList = [...familles];
    [newList[index], newList[index - 1]] = [newList[index - 1], newList[index]];
    
    // Mettre à jour les ordres
    newList.forEach((item, idx) => {
      item.ordre = idx + 1;
    });
    
    setFamilles(newList);
  };

  const handleMoveDown = (index: number) => {
    if (index === familles.length - 1) return;
    
    const newList = [...familles];
    [newList[index], newList[index + 1]] = [newList[index + 1], newList[index]];
    
    // Mettre à jour les ordres
    newList.forEach((item, idx) => {
      item.ordre = idx + 1;
    });
    
    setFamilles(newList);
  };

  if (loading) {
    return (
      <div className="modal-backdrop">
        <div className="modal-content">
          <div className="modal-header">
            <h2>Gestion des familles de véhicules</h2>
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
      <div className="modal-content" style={{ maxWidth: '700px' }}>
        <div className="modal-header">
          <h2>🏷️ Gestion des familles de véhicules</h2>
          <button onClick={onClose} className="modal-close">×</button>
        </div>
        <div className="modal-body">
          <p className="order-instructions">
            Configurez les familles de véhicules et leur ordre d'affichage.
          </p>

          {/* Bouton d'ajout */}
          <div style={{ marginBottom: '1.5rem' }}>
            <button 
              onClick={() => setShowAddForm(!showAddForm)}
              className="admin-btn admin-btn-primary"
            >
              ➕ Ajouter une famille
            </button>
          </div>

          {/* Formulaire d'ajout */}
          {showAddForm && (
            <div className="famille-form">
              <h4>Nouvelle famille</h4>
              <div className="form-group">
                <label>Nom :</label>
                <input
                  type="text"
                  value={newFamille.nom}
                  onChange={(e) => setNewFamille({...newFamille, nom: e.target.value})}
                  placeholder="Ex: Ambulances"
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label>Couleur :</label>
                <input
                  type="color"
                  value={newFamille.couleur}
                  onChange={(e) => setNewFamille({...newFamille, couleur: e.target.value})}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label>Icône (optionnel) :</label>
                <input
                  type="text"
                  value={newFamille.icone}
                  onChange={(e) => setNewFamille({...newFamille, icone: e.target.value})}
                  placeholder="Ex: 🚑"
                  className="form-input"
                />
              </div>
              <div className="form-actions">
                <button onClick={handleAddFamille} className="admin-btn admin-btn-primary">
                  Créer
                </button>
                <button onClick={() => setShowAddForm(false)} className="admin-btn admin-btn-secondary">
                  Annuler
                </button>
              </div>
            </div>
          )}
          
          {/* Liste des familles */}
          <div className="vehicule-order-list">
            {familles.map((famille, index) => (
              <div
                key={famille.id}
                className={`vehicule-order-item ${draggedIndex === index ? 'dragging' : ''}`}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDrop={(e) => handleDrop(e, index)}
              >
                <div className="drag-handle">⋮⋮</div>
                <div className="order-number">{index + 1}</div>
                
                {editingFamille?.id === famille.id ? (
                  // Mode édition
                  <div className="famille-edit-form">
                    <input
                      type="text"
                      value={editingFamille.nom}
                      onChange={(e) => setEditingFamille({...editingFamille, nom: e.target.value})}
                      className="form-input"
                    />
                    <input
                      type="color"
                      value={editingFamille.couleur}
                      onChange={(e) => setEditingFamille({...editingFamille, couleur: e.target.value})}
                      className="form-input"
                      style={{ width: '60px' }}
                    />
                    <input
                      type="text"
                      value={editingFamille.icone || ''}
                      onChange={(e) => setEditingFamille({...editingFamille, icone: e.target.value})}
                      placeholder="Icône"
                      className="form-input"
                      style={{ width: '80px' }}
                    />
                    <button onClick={() => handleEditFamille(editingFamille)} className="admin-btn admin-btn-primary">
                      ✅
                    </button>
                    <button onClick={() => setEditingFamille(null)} className="admin-btn admin-btn-secondary">
                      ❌
                    </button>
                  </div>
                ) : (
                  // Mode affichage
                  <>
                    <div className="famille-info">
                      <div className="famille-preview">
                        <div 
                          className="famille-color-preview" 
                          style={{ backgroundColor: famille.couleur }}
                        />
                        <span className="famille-icone">{famille.icone}</span>
                        <span className="famille-nom">{famille.nom}</span>
                      </div>
                    </div>
                    <div className="famille-actions">
                      <button
                        onClick={() => setEditingFamille(famille)}
                        className="admin-btn admin-btn-secondary"
                        title="Modifier"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDeleteFamille(famille.id)}
                        className="admin-btn admin-btn-danger"
                        title="Supprimer"
                      >
                        🗑️
                      </button>
                    </div>
                  </>
                )}
                
                <div className="order-controls">
                  <button
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0}
                    className="order-btn"
                    title="Monter"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => handleMoveDown(index)}
                    disabled={index === familles.length - 1}
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

export default FamilleManager;
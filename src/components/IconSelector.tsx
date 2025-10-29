import React, { useState } from 'react';
import { VEHICULE_ICONS, ICON_CATEGORIES } from '../utils/vehicule-icons';
import type { VehiculeIcon, IconCategory } from '../utils/vehicule-icons';

interface Props {
  selectedIcon?: string; // ID de l'icône sélectionnée
  onIconSelect: (iconId: string) => void;
  onClose: () => void;
}

const IconSelector: React.FC<Props> = ({ selectedIcon, onIconSelect, onClose }) => {
  const [selectedCategory, setSelectedCategory] = useState<IconCategory>('Secours à la personne');
  const [searchTerm, setSearchTerm] = useState('');

  // Filtrer les icônes par recherche
  const filteredIcons = searchTerm 
    ? VEHICULE_ICONS.filter(icon => 
        icon.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        icon.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        icon.category.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : ICON_CATEGORIES[selectedCategory] || [];

  const handleIconClick = (icon: VehiculeIcon) => {
    onIconSelect(icon.id);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content icon-selector-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🎨 Choisir une icône</h2>
          <button className="modal-close-btn" onClick={onClose} title="Fermer">✕</button>
        </div>
        
        <div className="icon-selector-content">
          {/* Barre de recherche */}
          <div className="search-section">
            <input
              type="text"
              placeholder="Rechercher une icône..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>

          {/* Onglets de catégories (si pas de recherche) */}
          {!searchTerm && (
            <div className="category-tabs">
              {Object.keys(ICON_CATEGORIES).map((category) => (
                <button
                  key={category}
                  className={`category-tab ${selectedCategory === category ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(category as IconCategory)}
                >
                  {category}
                </button>
              ))}
            </div>
          )}

          {/* Grille d'icônes */}
          <div className="icons-grid">
            {filteredIcons.length > 0 ? (
              filteredIcons.map((icon) => (
                <div
                  key={icon.id}
                  className={`icon-item ${selectedIcon === icon.id ? 'selected' : ''}`}
                  onClick={() => handleIconClick(icon)}
                  title={icon.description}
                >
                  <div className="icon-emoji">{icon.emoji}</div>
                  <div className="icon-name">{icon.name}</div>
                  {searchTerm && (
                    <div className="icon-category">{icon.category}</div>
                  )}
                </div>
              ))
            ) : (
              <div className="no-results">
                <span>🔍</span>
                <p>Aucune icône trouvée</p>
                {searchTerm && (
                  <button 
                    className="clear-search-btn"
                    onClick={() => setSearchTerm('')}
                  >
                    Effacer la recherche
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default IconSelector;

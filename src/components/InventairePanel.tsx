import React, { useState, useEffect } from 'react';
// QRCodeCanvas supprimé car plus utilisé
import type { Vehicule, Section, Materiel } from '../models/inventaire';
import { InventaireService } from '../firebase/inventaire-service';
import type { InventaireRecord } from '../models/inventaire-record';
import PhotoInspectionItem from './PhotoInspectionItem';
import '../App.css';

interface Props {
  vehicule: Vehicule;
  onInventaireComplete?: () => void;
}

// Composant récursif pour afficher sections et sous-sections sans panneau déroulant
const SectionPanel: React.FC<{
  section: Section;
  path: string;
  niveau: number; // Ajout du niveau hiérarchique
  updateSection: (path: string, materielIdx: number, field: 'estPresent' | 'fonctionne') => void;
}> = ({ section, path, niveau, updateSection }) => {
  return (
    <div className={`section-panel niveau-${niveau}`}>
      <div className={`section-header-static niveau-${niveau}`}>{section.nom}</div>
      <div className="section-content open">
        {section.materiels && section.materiels.map((m, mIdx) => (
          <div className={`materiel-row niveau-${niveau}-materiel`} key={m.id}>
            <span>{m.nom}</span>
            <div className="controls">
              <label>
                Présent
                <input type="checkbox" checked={m.estPresent} onChange={() => updateSection(path, mIdx, 'estPresent')} />
              </label>
              <label>
                Fonctionne
                <input type="checkbox" checked={m.fonctionne} onChange={() => updateSection(path, mIdx, 'fonctionne')} />
              </label>
            </div>
          </div>
        ))}
        {section.sousSections && section.sousSections.map((ss, ssIdx) => (
          <div key={ss.id} style={{ marginLeft: 16 }}>
            <SectionPanel
              section={ss}
              path={`${path}.${ssIdx}`}
              niveau={niveau + 1} // Incrémente le niveau pour les sous-sections
              updateSection={updateSection}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

const findSectionByPath = (sections: Section[], path: string[]): Section | null => {
  let current: Section | undefined = sections[parseInt(path[0])];
  for (let i = 1; i < path.length; i++) {
    if (!current || !current.sousSections) return null;
    current = current.sousSections[parseInt(path[i])];
  }
  return current || null;
};

// Fonction utilitaire pour retrouver le path d'un matériel dans l'état (corrigée pour être accessible)
function findSectionPath(sections: Section[], target: Section, path: string[] = []): string | null {
  for (let i = 0; i < sections.length; i++) {
    if (sections[i] === target) return [...path, String(i)].join('.');
    if (sections[i].sousSections) {
      const sub = findSectionPath(sections[i].sousSections!, target, [...path, String(i)]);
      if (sub) return sub;
    }
  }
  return null;
}

// Fonction utilitaire pour calculer la profondeur d'une section
function getSectionDepth(sections: Section[], target: Section, currentDepth: number = 1): number {
  for (const section of sections) {
    if (section === target) return currentDepth;
    if (section.sousSections) {
      const subDepth = getSectionDepth(section.sousSections, target, currentDepth + 1);
      if (subDepth > 0) return subDepth;
    }
  }
  return 1; // profondeur par défaut
}

// Fonction utilitaire pour extraire les matériels manquants ou défectueux
type Defaut = { chemin: string; nom: string; present: boolean; fonctionne?: boolean; details?: string };
function getDefauts(sections: Section[], parentPath: string[] = []): Defaut[] {
  let defauts: Defaut[] = [];
  sections.forEach((section) => {
    const path = [...parentPath, section.nom];
    if (section.materiels) {
      section.materiels.forEach((m) => {
        // Si le matériel a la propriété fonctionne, on vérifie les deux. Sinon, seulement estPresent (ou valeur)
        if (m.hasOwnProperty('fonctionne')) {
          if (!m.estPresent || !m.fonctionne) {
            defauts.push({
              chemin: path.join(' > '),
              nom: m.nom,
              present: m.estPresent ?? false,
              fonctionne: m.fonctionne ?? false,
            });
          }
        } else {
          // Pour les matériels à quantité ou select, on peut aussi signaler si valeur n'est pas correcte (optionnel)
          if (m.type === 'quantite') {
            const quantiteAttendue = m.valeur ?? 0;
            const quantiteReelle = m.quantiteReelle ?? quantiteAttendue; // Par défaut = attendue
            const isVerified = m.estPresent ?? false;
            
            // Défaut si pas vérifié ou si quantité réelle < quantité attendue
            if (!isVerified || quantiteReelle < quantiteAttendue) {
              defauts.push({
                chemin: path.join(' > '),
                nom: m.nom,
                present: isVerified && quantiteReelle >= quantiteAttendue,
                details: isVerified ? `Trouvé: ${quantiteReelle}/${quantiteAttendue}` : 'Non vérifié'
              });
            }
          } else if (m.type === 'select' && (!m.valeur || m.valeur === '')) {
            defauts.push({
              chemin: path.join(' > '),
              nom: m.nom,
              present: false,
            });
          } else if ((!m.type || m.type === 'checkbox') && !m.estPresent) {
            defauts.push({
              chemin: path.join(' > '),
              nom: m.nom,
              present: false,
            });
          }
        }
      });
    }
    if (section.sousSections) {
      defauts = defauts.concat(getDefauts(section.sousSections, path));
    }
  });
  return defauts;
}

// Fonction utilitaire pour aplatir tous les matériels d'une section (et sous-sections)
function flattenMateriels(section: Section, parentPath: string[] = []): { chemin: string[], materiel: Materiel, sectionRef: Section, materielIdx: number, path: string }[] {
  let result: { chemin: string[], materiel: Materiel, sectionRef: Section, materielIdx: number, path: string }[] = [];
  if (section.materiels) {
    section.materiels.forEach((m, idx) => {
      result.push({
        chemin: [...parentPath, section.nom],
        materiel: m,
        sectionRef: section,
        materielIdx: idx,
        path: '' // sera calculé plus bas
      });
    });
  }
  if (section.sousSections) {
    section.sousSections.forEach((ss) => {
      result = result.concat(flattenMateriels(ss, [...parentPath, section.nom]));
    });
  }
  return result;
}

// Fonction utilitaire pour regrouper les matériels par sous-partie (dernier élément du chemin)
function groupMaterielsBySousPartie(materielsList: { chemin: string[], materiel: Materiel, sectionRef: Section, materielIdx: number, path: string }[]) {
  const groups: { [key: string]: typeof materielsList } = {};
  materielsList.forEach(item => {
    const key = item.chemin.slice(1).join(' > ') || 'Général';
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  });
  return groups;
}

const WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbyKJCoykSVFlimaD2e7l_FX-4o7lARsZem-Zp-z0fXdzLWqdLmZpuhHGwR_fRUJTfXG/exec";

const InventairePanel: React.FC<Props> = ({ vehicule, onInventaireComplete }) => {
  const [etat, setEtat] = useState<Section[]>(vehicule.sections.map(s => JSON.parse(JSON.stringify(s))));
  const [agent, setAgent] = useState('');
  const [observation, setObservation] = useState('');
  const [message, setMessage] = useState('');
  // Navigation par grande section principale
  const [sectionIdx, setSectionIdx] = useState(0);
  const [showSummary, setShowSummary] = useState(false); // Nouvel état pour le panneau de résumé
  const currentSection = etat[sectionIdx];
  // On aplatit tous les matériels de la section courante
  const materielsList = flattenMateriels(currentSection);
  const groupedMateriels = groupMaterielsBySousPartie(materielsList);

  // Charger les photos du dernier inventaire au démarrage
  useEffect(() => {
    const chargerPhotosAnciennes = async () => {
      try {
        console.log('🔍 Chargement des photos précédentes pour', vehicule.id);
        const photosParMateriel = await InventaireService.getDernieresPhotos(vehicule.id);
        
        if (Object.keys(photosParMateriel).length > 0) {
          console.log('📷 Photos trouvées, mise à jour de l\'état...');
          
          setEtat(prev => {
            const copy = JSON.parse(JSON.stringify(prev));
            
            // Fonction récursive pour mettre à jour les photos dans les sections
            const mettreAJourPhotos = (section: any) => {
              if (section.materiels) {
                section.materiels.forEach((materiel: any) => {
                  if (photosParMateriel[materiel.id]) {
                    materiel.photosAnciennnes = photosParMateriel[materiel.id];
                    console.log(`📷 Photos assignées à ${materiel.nom}:`, materiel.photosAnciennnes);
                  }
                });
              }
              
              if (section.sousSections) {
                section.sousSections.forEach((sousSection: any) => {
                  mettreAJourPhotos(sousSection);
                });
              }
            };

            copy.forEach(mettreAJourPhotos);
            return copy;
          });
        }
      } catch (error) {
        console.warn('⚠️ Erreur lors du chargement des photos précédentes:', error);
      }
    };

    chargerPhotosAnciennes();
  }, [vehicule.id]); // Se déclenche quand on change de véhicule

  const updateSection = (path: string, materielIdx: number, field: 'estPresent' | 'fonctionne') => {
    setEtat(prev => {
      const pathArr = path.split('.').filter(Boolean);
      const copy = JSON.parse(JSON.stringify(prev));
      let section = findSectionByPath(copy, pathArr);
      if (section && section.materiels) {
        section.materiels[materielIdx][field] = !section.materiels[materielIdx][field];
      }
      return copy;
    });
  };

  // Ajout d'une fonction pour mettre à jour la valeur d'un matériel selon son type
  const updateMaterielValeur = (path: string, materielIdx: number, valeur: any) => {
    setEtat(prev => {
      const pathArr = path.split('.').filter(Boolean);
      const copy = JSON.parse(JSON.stringify(prev));
      let section = findSectionByPath(copy, pathArr);
      if (section && section.materiels) {
        section.materiels[materielIdx].valeur = valeur;
        // Pour compatibilité, on peut aussi mettre à jour estPresent/fonctionne si type checkbox
        if (typeof valeur === 'boolean') {
          section.materiels[materielIdx].estPresent = valeur;
        }
      }
      return copy;
    });
  };

  // Fonction spécialisée pour mettre à jour plusieurs champs d'un matériel photo
  const updateMaterielPhotoFields = (path: string, materielIdx: number, updates: Partial<Materiel>) => {
    setEtat(prev => {
      const pathArr = path.split('.').filter(Boolean);
      const copy = JSON.parse(JSON.stringify(prev));
      let section = findSectionByPath(copy, pathArr);
      if (section && section.materiels) {
        // Mettre à jour tous les champs fournis
        section.materiels[materielIdx] = { ...section.materiels[materielIdx], ...updates };
      }
      return copy;
    });
  };

  // Fonction spécifique pour mettre à jour la quantité réelle d'un matériel de type 'quantite'
  const updateQuantiteReelle = (path: string, materielIdx: number, quantiteReelle: number) => {
    setEtat(prev => {
      const pathArr = path.split('.').filter(Boolean);
      const copy = JSON.parse(JSON.stringify(prev));
      let section = findSectionByPath(copy, pathArr);
      if (section && section.materiels) {
        section.materiels[materielIdx].quantiteReelle = quantiteReelle;
      }
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('Envoi en cours...');
    
    try {
      const defauts = getDefauts(etat);
      
      // 1. Sauvegarde dans Firestore
      const inventaireRecord: InventaireRecord = {
        vehiculeId: vehicule.id,
        vehiculeName: vehicule.nom,
        agent: agent || 'Agent non spécifié',
        dateInventaire: new Date(),
        defauts: defauts,
        // Inclure les sections complètes pour sauvegarder les photos
        sections: JSON.parse(JSON.stringify(etat)),
        observation: observation || '',
        materielValides: getCompletedMaterials(),
        totalMateriels: getTotalMaterials(),
        progressPercent: 0 // Sera calculé après
      };

      // Calculer le pourcentage de progression
      inventaireRecord.progressPercent = inventaireRecord.totalMateriels > 0 
        ? Math.round((inventaireRecord.materielValides / inventaireRecord.totalMateriels) * 100) 
        : 0;

      // Debug: compter les photos avant sauvegarde
      let totalPhotos = 0;
      const compterPhotos = (section: Section) => {
        if (section.materiels) {
          section.materiels.forEach(materiel => {
            if (materiel.photos && materiel.photos.length > 0) {
              totalPhotos += materiel.photos.length;
              console.log(`📷 Sauvegarde: ${materiel.nom} - ${materiel.photos.length} photo(s)`);
            }
          });
        }
        if (section.sousSections) {
          section.sousSections.forEach(compterPhotos);
        }
      };
      inventaireRecord.sections?.forEach(compterPhotos);
      console.log(`💾 Sauvegarde de l'inventaire avec ${totalPhotos} photo(s) au total`);

      await InventaireService.saveInventaire(inventaireRecord);
      
      // 2. Envoi vers Google Sheets (existant)
      await fetch(WEBHOOK_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent,
          observation,
          defauts
        })
      });
      
      setMessage('✅ Inventaire sauvegardé et envoyé avec succès !');
      
      // Attendre un peu pour que l'utilisateur voit le message, puis passer à la page de confirmation
      setTimeout(() => {
        if (onInventaireComplete) {
          onInventaireComplete();
        }
      }, 2000);
      
      setAgent('');
      setObservation('');
      setEtat(vehicule.sections.map(s => JSON.parse(JSON.stringify(s)))); // Reset inventaire
      
    } catch (err) {
      console.error('Erreur lors de la sauvegarde/envoi:', err);
      setMessage("❌ Erreur lors de l'envoi");
    }
    
    setTimeout(() => setMessage(''), 5000);
  };

  // Navigation entre les sections principales et le résumé
  const goNext = () => {
    if (sectionIdx < etat.length - 1) {
      setSectionIdx(idx => idx + 1);
    } else {
      // Dernière section atteinte → afficher le résumé
      setShowSummary(true);
    }
  };
  
  const goPrev = () => {
    if (showSummary) {
      // Retour du résumé vers la dernière section
      setShowSummary(false);
    } else {
      setSectionIdx(idx => Math.max(idx - 1, 0));
    }
  };

  const backToInventory = () => {
    setShowSummary(false);
    setSectionIdx(etat.length - 1); // Revenir à la dernière section
  };

  // Calcul des statistiques pour feedback visuel
  const getTotalMaterials = () => {
    return etat.reduce((total, section) => {
      const materielsList = flattenMateriels(section);
      return total + materielsList.length;
    }, 0);
  };

  const getCompletedMaterials = () => {
    return etat.reduce((completed, section) => {
      const materielsList = flattenMateriels(section);
      return completed + materielsList.filter(item => {
        const m = item.materiel;
        if (m.type === 'quantite') {
          const quantiteAttendue = m.valeur ?? 0;
          const quantiteReelle = m.quantiteReelle ?? quantiteAttendue; // Par défaut = attendue
          const isVerified = m.estPresent ?? false;
          return isVerified && quantiteReelle > 0; // Vérifié avec une quantité
        }
        if (m.type === 'select') return (m.valeur ?? '') !== '';
        if (m.type === 'photo') {
          // Pour les photos : soit bon état, soit réparé, soit photos présentes
          return m.bonEtat || m.repare || (m.photos && m.photos.length > 0);
        }
        return m.valeur ?? m.estPresent ?? false;
      }).length;
    }, 0);
  };

  const totalMaterials = getTotalMaterials();
  const completedMaterials = getCompletedMaterials();
  const progressPercent = totalMaterials > 0 ? Math.round((completedMaterials / totalMaterials) * 100) : 0;

  // Fonction pour vérifier si une section est complètement validée
  const isSectionComplete = (section: Section): boolean => {
    const materielsList = flattenMateriels(section);
    return materielsList.every(item => {
      const m = item.materiel;
      if (m.type === 'quantite') {
        const quantiteAttendue = m.valeur ?? 0;
        const quantiteReelle = m.quantiteReelle ?? quantiteAttendue;
        const isVerified = m.estPresent ?? false;
        return isVerified && quantiteReelle > 0;
      }
      if (m.type === 'select') return (m.valeur ?? '') !== '';
      if (m.type === 'photo') {
        // Pour les photos : soit bon état, soit réparé, soit photos présentes
        return m.bonEtat || m.repare || (m.photos && m.photos.length > 0);
      }
      return m.valeur ?? m.estPresent ?? false;
    });
  };

  // Fonction pour obtenir l'icône et la couleur selon l'état de la section
  const getSectionStatus = (section: Section, idx: number) => {
    if (idx > sectionIdx) return null; // Section non encore visitée
    
    const isComplete = isSectionComplete(section);
    const materielsList = flattenMateriels(section);
    const completedItems = materielsList.filter(item => {
      const m = item.materiel;
      if (m.type === 'quantite') {
        const quantiteAttendue = m.valeur ?? 0;
        const quantiteReelle = m.quantiteReelle ?? quantiteAttendue;
        const isVerified = m.estPresent ?? false;
        return isVerified && quantiteReelle > 0;
      }
      if (m.type === 'select') return (m.valeur ?? '') !== '';
      if (m.type === 'photo') {
        // Pour les photos : soit bon état, soit réparé, soit photos présentes
        return m.bonEtat || m.repare || (m.photos && m.photos.length > 0);
      }
      return m.valeur ?? m.estPresent ?? false;
    }).length;
    
    if (isComplete) {
      return { icon: '✓', className: 'tab-check-complete' };
    } else if (completedItems > 0) {
      return { icon: '⚠️', className: 'tab-check-partial' };
    } else if (idx < sectionIdx) {
      return { icon: '○', className: 'tab-check-empty' };
    }
    return null;
  };

  // UseEffect pour scroll automatique lors des changements de section
  useEffect(() => {
    console.log('🔄 Navigation détectée - section:', sectionIdx, 'showSummary:', showSummary);
    
    const scrollToTopElement = () => {
      // Chercher l'élément titre en haut de la page
      const titleElement = document.querySelector('h2');
      if (titleElement) {
        console.log('⬆️ Scroll vers l\'élément titre...');
        titleElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
        
        // Sécurité avec scroll manuel
        setTimeout(() => {
          window.scrollTo(0, 0);
          console.log('✅ Scroll de sécurité vers position 0');
        }, 300);
      } else {
        console.log('⬆️ Élément titre non trouvé, scroll classique...');
        window.scrollTo(0, 0);
      }
    };
    
    const timeoutId = setTimeout(scrollToTopElement, 150);
    return () => clearTimeout(timeoutId);
  }, [sectionIdx, showSummary]);

  // Si on affiche le résumé, rendu différent
  if (showSummary) {
    return (
      <>
        <h2 style={{textAlign: 'center', color: '#1a237e', margin: '1.2rem 0 0.5rem 0'}}>{vehicule.nom}</h2>
        
        {/* Indicateur de progression global */}
        <div className="progress-container">
          <div className="progress-info">
            <span className="progress-text">Progression globale: {completedMaterials}/{totalMaterials}</span>
            <span className="progress-percent">{progressPercent}%</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{width: `${progressPercent}%`}}></div>
          </div>
        </div>

        <div className="inventaire-container">
          {/* Formulaire de résumé */}
          <form onSubmit={handleSubmit} className="final-form" autoComplete="off">
            <div className="form-summary">
              <h3>📋 Résumé de l'inventaire</h3>
              <div className="summary-stats">
                <div className="stat-item">
                  <span className="stat-label">Matériels vérifiés:</span>
                  <span className="stat-value">{completedMaterials}/{totalMaterials}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Progression:</span>
                  <span className="stat-value">{progressPercent}%</span>
                </div>
                <div className="stat-item alert">
                  <span className="stat-label">⚠️ Matériels manquants:</span>
                  <span className="stat-value">{getDefauts(etat).length}</span>
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">
                <span className="label-text">👤 Nom de l'agent :</span>
                <input 
                  type="text" 
                  value={agent} 
                  onChange={(e) => setAgent(e.target.value)}
                  className="form-input"
                  placeholder="Entrer le nom de l'agent"
                  required
                />
              </label>
            </div>

            <div className="form-group">
              <label className="form-label">
                <span className="label-text">📝 Observations :</span>
                <textarea 
                  value={observation} 
                  onChange={(e) => setObservation(e.target.value)}
                  className="form-textarea"
                  rows={3}
                  placeholder="Observations générales, anomalies détectées..."
                />
              </label>
            </div>

            <button type="submit" className="btn-envoyer-enhanced">
              <span className="btn-icon">📤</span>
              <span className="btn-text">Envoyer l'inventaire</span>
            </button>

            {message && <div className="message-container"><p className="message">{message}</p></div>}
          </form>

          {/* Navigation de retour */}
          <div className="navigation-controls">
            <button onClick={backToInventory} className="nav-button nav-prev">
              <span className="nav-icon">←</span>
              <span className="nav-text">Retour à l'inventaire</span>
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <h2 style={{textAlign: 'center', color: '#1a237e', margin: '1.2rem 0 0.5rem 0'}}>{vehicule.nom}</h2>
      
      {/* Indicateur de progression global */}
      <div className="progress-container">
        <div className="progress-info">
          <span className="progress-text">Progression globale: {completedMaterials}/{totalMaterials}</span>
          <span className="progress-percent">{progressPercent}%</span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{width: `${progressPercent}%`}}></div>
        </div>
      </div>

      {/* Navigation par onglets */}
      <div className="section-tabs">
        {etat.map((section, idx) => {
          const status = getSectionStatus(section, idx);
          return (
            <button
              key={section.id}
              className={`section-tab ${idx === sectionIdx && !showSummary ? 'active' : ''}`}
              onClick={() => {
                setSectionIdx(idx);
                setShowSummary(false);
              }}
            >
              <span className="tab-number">{idx + 1}</span>
              <span className="tab-name">{section.nom}</span>
              {status && <span className={`tab-check ${status.className}`}>{status.icon}</span>}
            </button>
          );
        })}
      </div>

      <div className="inventaire-container">
        <div className="section-panel niveau-1">
          <div className={`section-header-static niveau-1`}>
            {currentSection.nom}
            <span className="section-progress">
              {sectionIdx + 1}/{etat.length}
            </span>
          </div>
          <div className="section-content open">
            {Object.entries(groupedMateriels).map(([groupe, items], idx) => (
              <div key={groupe} style={{marginBottom: '1.1rem'}}>
                <div className={`groupe-titre groupe-${idx % 8}`}>{groupe}</div>
                {items.map(item => {
                  const path = findSectionPath(etat, item.sectionRef);
                  const materiel = item.materiel;
                  const sectionDepth = getSectionDepth(etat, item.sectionRef);
                  // Affichage dynamique selon le type de matériel
                  return (
                    <div className={`materiel-row niveau-${sectionDepth}-materiel groupe-${idx % 8}-materiel`} key={materiel.id}>
                      <span className="materiel-name">{materiel.nom}</span>
                      <div className="controls-enhanced">
                        {(!materiel.type || materiel.type === 'checkbox') && (
                          <label className="control-checkbox">
                            <input 
                              type="checkbox" 
                              checked={materiel.valeur ?? materiel.estPresent ?? false} 
                              onChange={() => path && updateMaterielValeur(path, item.materielIdx, !(materiel.valeur ?? materiel.estPresent ?? false))} 
                            />
                            <span className="checkbox-label">Présent</span>
                          </label>
                        )}
                        {materiel.type === 'quantite' && (
                          <>
                            <div className="quantity-display">
                              <span className="quantity-expected">Attendu: {materiel.valeur ?? 0}</span>
                              <input 
                                type="number" 
                                min={0} 
                                value={materiel.quantiteReelle ?? materiel.valeur ?? 0} 
                                onChange={e => path && updateQuantiteReelle(path, item.materielIdx, Number(e.target.value))} 
                                className="quantity-input-inline"
                                title="Quantité trouvée (modifiable si différente)"
                              />
                            </div>
                            <label className="control-checkbox-quick">
                              <input 
                                type="checkbox" 
                                checked={materiel.estPresent ?? false} 
                                onChange={() => {
                                  if (path) {
                                    // Si pas encore de quantité réelle définie, on prend la valeur attendue
                                    if (materiel.quantiteReelle === undefined) {
                                      updateQuantiteReelle(path, item.materielIdx, materiel.valeur ?? 0);
                                    }
                                    updateSection(path, item.materielIdx, 'estPresent');
                                  }
                                }} 
                              />
                              <span className="checkbox-label">✓ OK</span>
                            </label>
                          </>
                        )}
                        {materiel.type === 'select' && (
                          <label className="control-select">
                            <span className="select-label">État</span>
                            <select 
                              value={materiel.valeur ?? ''} 
                              onChange={e => path && updateMaterielValeur(path, item.materielIdx, e.target.value)} 
                              className="select-input"
                            >
                              <option value="">Choisir...</option>
                              {materiel.options?.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          </label>
                        )}
                        {materiel.type === 'photo' && (
                          <PhotoInspectionItem
                            materiel={materiel}
                            onUpdate={(updates) => {
                              if (path) {
                                updateMaterielPhotoFields(path, item.materielIdx, updates);
                              }
                            }}
                          />
                        )}
                        {/* Pour compatibilité, on affiche "Fonctionne" seulement si la propriété existe dans le matériel */}
                        {((!materiel.type || materiel.type === 'checkbox') && materiel.hasOwnProperty('fonctionne')) && (
                          <label className="control-checkbox">
                            <input 
                              type="checkbox" 
                              checked={materiel.fonctionne ?? false} 
                              onChange={() => path && updateSection(path, item.materielIdx, 'fonctionne')} 
                            />
                            <span className="checkbox-label">Fonctionne</span>
                          </label>
                        )}
                        {/* Indicateur visuel de statut */}
                        <div className={`status-indicator ${(() => {
                          if (materiel.type === 'quantite') {
                            const quantiteAttendue = materiel.valeur ?? 0;
                            const quantiteReelle = materiel.quantiteReelle ?? quantiteAttendue; // Par défaut = attendue
                            const isVerified = materiel.estPresent ?? false;
                            
                            if (isVerified && quantiteReelle >= quantiteAttendue) return 'status-ok';
                            if (isVerified && quantiteReelle < quantiteAttendue) return 'status-warning';
                            if (!isVerified) return 'status-empty';
                            return 'status-empty';
                          } else if (materiel.type === 'select') {
                            return (materiel.valeur ?? '') !== '' ? 'status-ok' : 'status-empty';
                          } else if (materiel.type === 'photo') {
                            // Nouveau système pour les photos
                            if (materiel.bonEtat) return 'status-ok';
                            if (materiel.repare) return 'status-ok';
                            if (materiel.photos && materiel.photos.length > 0) return 'status-warning'; // Problème documenté
                            if (materiel.photosAnciennnes && materiel.photosAnciennnes.length > 0) return 'status-pending'; // À vérifier
                            return 'status-empty';
                          } else {
                            const isPresent = materiel.valeur ?? materiel.estPresent ?? false;
                            const isFunctional = materiel.fonctionne ?? true;
                            if (isPresent && isFunctional) return 'status-ok';
                            if (isPresent && !isFunctional) return 'status-warning';
                            return 'status-empty';
                          }
                        })()}`}>
                          {(() => {
                            if (materiel.type === 'quantite') {
                              const quantiteAttendue = materiel.valeur ?? 0;
                              const quantiteReelle = materiel.quantiteReelle ?? quantiteAttendue; // Par défaut = attendue
                              const isVerified = materiel.estPresent ?? false;
                              
                              if (isVerified && quantiteReelle >= quantiteAttendue) return '✓';
                              if (isVerified && quantiteReelle < quantiteAttendue) return '⚠️';
                              return '○';
                            } else if (materiel.type === 'select') {
                              return (materiel.valeur ?? '') !== '' ? '✓' : '○';
                            } else if (materiel.type === 'photo') {
                              return (materiel.photos ?? []).length > 0 ? '📷' : '○';
                            } else {
                              const isPresent = materiel.valeur ?? materiel.estPresent ?? false;
                              const isFunctional = materiel.fonctionne ?? true;
                              if (isPresent && isFunctional) return '✓';
                              if (isPresent && !isFunctional) return '⚠️';
                              return '○';
                            }
                          })()}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        
        {/* Boutons de navigation améliorés */}
        <div className="navigation-controls">
          {sectionIdx > 0 && (
            <button onClick={goPrev} className="nav-button nav-prev">
              <span className="nav-icon">←</span>
              <span className="nav-text">Précédent</span>
            </button>
          )}
          
          <div className="nav-info">
            <div className="nav-progress">Étape {sectionIdx + 1} sur {etat.length}</div>
            <div className="nav-section">{currentSection.nom}</div>
          </div>
          
          {sectionIdx < etat.length - 1 ? (
            <button onClick={goNext} className="nav-button nav-next">
              <span className="nav-text">Suivant</span>
              <span className="nav-icon">→</span>
            </button>
          ) : (
            <button onClick={goNext} className="nav-button nav-submit">
              <span className="nav-text">Résumé</span>
              <span className="nav-icon">📋</span>
            </button>
          )}
        </div>
      </div>
    </>
  );
};
export default InventairePanel;

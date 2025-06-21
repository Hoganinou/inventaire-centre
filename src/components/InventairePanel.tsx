import React, { useState } from 'react';
// QRCodeCanvas supprimé car plus utilisé
import type { Vehicule, Section, Materiel } from '../models/inventaire';
import '../App.css';

interface Props {
  vehicule: Vehicule;
}

// Composant récursif pour afficher sections et sous-sections sans panneau déroulant
const SectionPanel: React.FC<{
  section: Section;
  path: string;
  updateSection: (path: string, materielIdx: number, field: 'estPresent' | 'fonctionne') => void;
}> = ({ section, path, updateSection }) => {
  return (
    <div className="section-panel">
      <div className="section-header-static">{section.nom}</div>
      <div className="section-content open">
        {section.materiels && section.materiels.map((m, mIdx) => (
          <div className="materiel-row" key={m.id}>
            <span>{m.nom}</span>
            <label>
              Présent
              <input type="checkbox" checked={m.estPresent} onChange={() => updateSection(path, mIdx, 'estPresent')} />
            </label>
            <label>
              Fonctionne
              <input type="checkbox" checked={m.fonctionne} onChange={() => updateSection(path, mIdx, 'fonctionne')} />
            </label>
          </div>
        ))}
        {section.sousSections && section.sousSections.map((ss, ssIdx) => (
          <div key={ss.id} style={{ marginLeft: 16 }}>
            <SectionPanel
              section={ss}
              path={`${path}.${ssIdx}`}
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

// Fonction utilitaire pour extraire les matériels manquants ou défectueux
type Defaut = { chemin: string; nom: string; present: boolean; fonctionne?: boolean };
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
          if (m.type === 'quantite' && (!m.valeur || m.valeur <= 0)) {
            defauts.push({
              chemin: path.join(' > '),
              nom: m.nom,
              present: false,
            });
          } else if (m.type === 'select' && (!m.valeur || m.valeur === '')) {
            defauts.push({
              chemin: path.join(' > '),
              nom: m.nom,
              present: false,
            });
          } else if (m.type !== 'quantite' && m.type !== 'select' && !m.estPresent) {
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

const InventairePanel: React.FC<Props> = ({ vehicule }) => {
  const [etat, setEtat] = useState<Section[]>(vehicule.sections.map(s => JSON.parse(JSON.stringify(s))));
  const [agent, setAgent] = useState('');
  const [observation, setObservation] = useState('');
  const [message, setMessage] = useState('');
  // Navigation par grande section principale
  const [sectionIdx, setSectionIdx] = useState(0);
  const currentSection = etat[sectionIdx];
  // On aplatit tous les matériels de la section courante
  const materielsList = flattenMateriels(currentSection);
  const groupedMateriels = groupMaterielsBySousPartie(materielsList);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('Envoi en cours...');
    try {
      const defauts = getDefauts(etat);
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
      setMessage('Inventaire envoyé (confirmation non garantie) !');
      setAgent('');
      setObservation('');
      setEtat(vehicule.sections.map(s => JSON.parse(JSON.stringify(s)))); // Reset inventaire
    } catch (err) {
      setMessage("Erreur lors de l'envoi");
    }
    setTimeout(() => setMessage(''), 4000);
  };

  // Navigation entre les sections principales
  const goNext = () => setSectionIdx(idx => Math.min(idx + 1, etat.length - 1));
  const goPrev = () => setSectionIdx(idx => Math.max(idx - 1, 0));

  return (
    <>
      <h2 style={{textAlign: 'center', color: '#1a237e', margin: '1.2rem 0 0.5rem 0'}}>{vehicule.nom}</h2>
      <div className="inventaire-container">
        <div className="section-panel">
          <div className={`section-header-static groupe-titre groupe-${sectionIdx % 8}`}>
            {currentSection.nom}
          </div>
          <div className="section-content open">
            {Object.entries(groupedMateriels).map(([groupe, items], idx) => (
              <div key={groupe} style={{marginBottom: '1.1rem'}}>
                <div className={`groupe-titre groupe-${idx % 8}`}>{groupe}</div>
                {items.map(item => {
                  const path = findSectionPath(etat, item.sectionRef);
                  const materiel = item.materiel;
                  // Affichage dynamique selon le type de matériel
                  return (
                    <div className="materiel-row" key={materiel.id}>
                      <span>{materiel.nom}</span>
                      {(!materiel.type || materiel.type === 'checkbox') && (
                        <label>
                          Présent
                          <input type="checkbox" checked={materiel.valeur ?? materiel.estPresent ?? false} onChange={() => path && updateMaterielValeur(path, item.materielIdx, !(materiel.valeur ?? materiel.estPresent ?? false))} />
                        </label>
                      )}
                      {materiel.type === 'quantite' && (
                        <label>
                          Quantité
                          <input type="number" min={0} value={materiel.valeur ?? ''} onChange={e => path && updateMaterielValeur(path, item.materielIdx, Number(e.target.value))} style={{width:'70px',marginLeft:8}} />
                        </label>
                      )}
                      {materiel.type === 'select' && (
                        <label>
                          État
                          <select value={materiel.valeur ?? ''} onChange={e => path && updateMaterielValeur(path, item.materielIdx, e.target.value)} style={{marginLeft:8}}>
                            <option value="">Choisir...</option>
                            {materiel.options?.map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        </label>
                      )}
                      {/* Pour compatibilité, on affiche "Fonctionne" seulement si la propriété existe dans le matériel */}
                      {((!materiel.type || materiel.type === 'checkbox') && materiel.hasOwnProperty('fonctionne')) && (
                        <label>
                          Fonctionne
                          <input type="checkbox" checked={materiel.fonctionne ?? false} onChange={() => path && updateSection(path, item.materielIdx, 'fonctionne')} />
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', margin: '1rem 0' }}>
          {sectionIdx > 0 && (
            <button onClick={goPrev} style={{ flex: 1, marginRight: 8 }}>
              Précédent
            </button>
          )}
          {sectionIdx < etat.length - 1 && (
            <button onClick={goNext} style={{ flex: 1, marginLeft: 8 }}>
              Suivant
            </button>
          )}
        </div>
        {/* Formulaire agent, observation, bouton en bas, seulement à la dernière étape */}
        {sectionIdx === etat.length - 1 && (
          <form
            onSubmit={handleSubmit}
            autoComplete="off"
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
                e.preventDefault();
              }
            }}
            style={{ marginTop: 24 }}
          >
            <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <label style={{ fontWeight: 500, width: '100%' }}>
                Nom de l'agent :
                <input
                  type="text"
                  value={agent}
                  onChange={e => setAgent(e.target.value)}
                  required
                  style={{ marginTop: 6, width: '100%', padding: '4px 8px', borderRadius: 4, border: '1px solid #ccc', boxSizing: 'border-box' }}
                />
              </label>
            </div>
            <div style={{ margin: '1.5rem 0 1rem 0', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <label style={{ fontWeight: 500, width: '100%' }}>
                Observations :
                <textarea
                  value={observation}
                  onChange={e => setObservation(e.target.value)}
                  rows={3}
                  style={{ width: '100%', marginTop: 6, borderRadius: 4, border: '1px solid #ccc', padding: 6, boxSizing: 'border-box' }}
                />
              </label>
            </div>
            <button type="submit" className="btn-envoyer" style={{ display: 'block', margin: '1.2rem auto 0 auto' }}>Envoyer l'inventaire</button>
            {message && <div style={{ color: 'green', marginTop: 12 }}>{message}</div>}
          </form>
        )}
      </div>
    </>
  );
};

export default InventairePanel;

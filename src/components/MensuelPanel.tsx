import React, { useState, useEffect } from 'react';
import type { ControleMensuel } from '../models/mensuel';
import type { Vehicule } from '../models/inventaire';
import MensuelService from '../firebase/mensuel-service';
import configurationMensuelleService from '../firebase/configuration-mensuelle-service';
import type { ConfigurationMensuelle, SectionMensuelle } from '../firebase/configuration-mensuelle-service';
import './MensuelPanel.css';

interface MensuelPanelProps {
  vehicule: Vehicule;
  onClose: () => void;
  onMensuelSaved: () => void;
}

const MensuelPanel: React.FC<MensuelPanelProps> = ({ vehicule, onClose, onMensuelSaved }) => {
  const [configuration, setConfiguration] = useState<ConfigurationMensuelle | null>(null);
  const [loading, setLoading] = useState(true);
  const [mensuel, setMensuel] = useState<ControleMensuel>({
    vehiculeId: vehicule.id,
    dateMensuel: new Date(),
    agent: '',
    kilometres: 0,
    liquides: {
      huile: 'OK',
      liquideRefroidissement: 'OK',
      liquideFrein: 'OK',
      liquideDirectionAssistee: 'OK'
    },
    balaisEssuieGlace: {
      avant: 'OK',
      arriere: 'OK'
    },
    pressionPneus: {
      avantGauche: 2.2,
      avantDroit: 2.2,
      arriereGauche: 2.2,
      arriereDroit: 2.2,
      pressionRecommandee: 2.2
    },
    lavage: {
      effectue: false,
      typelavage: 'EXTERIEUR'
    },
    observations: '',
    defauts: [],
    statut: 'OK'
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const chargerConfiguration = async () => {
      try {
        console.log('[MensuelPanel] Début chargement configuration');
        const config = await configurationMensuelleService.getConfigurationActive();
        console.log('[MensuelPanel] Configuration chargée:', config);
        setConfiguration(config);
        console.log('[MensuelPanel] Configuration définie dans state, sections:', config.sections.length);
      } catch (error) {
        console.error('[MensuelPanel] Erreur chargement configuration:', error);
      } finally {
        setLoading(false);
      }
    };

    chargerConfiguration();
  }, []);

  const handleInputChange = (field: string, value: any) => {
    console.log(`[MensuelPanel] Changement champ: ${field} = ${value}`);
    
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setMensuel(prev => {
        const parentValue = prev[parent as keyof ControleMensuel];
        if (typeof parentValue === 'object' && parentValue !== null) {
          return {
            ...prev,
            [parent]: {
              ...parentValue,
              [child]: value
            }
          };
        }
        return prev;
      });
    } else {
      setMensuel(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const ajouterDefaut = () => {
    const nouveauDefaut = {
      categorie: 'AUTRE' as const,
      gravite: 'MINEUR' as const,
      description: '',
      dateDetection: new Date()
    };
    setMensuel(prev => ({
      ...prev,
      defauts: [...prev.defauts, nouveauDefaut]
    }));
  };

  const updateDefaut = (index: number, field: string, value: string) => {
    setMensuel(prev => ({
      ...prev,
      defauts: prev.defauts.map((defaut, i) => 
        i === index ? { ...defaut, [field]: value } : defaut
      )
    }));
  };

  const supprimerDefaut = (index: number) => {
    setMensuel(prev => ({
      ...prev,
      defauts: prev.defauts.filter((_, i) => i !== index)
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      console.log('[MensuelPanel] Début sauvegarde mensuel:', mensuel);
      const mensuelId = await MensuelService.sauvegarderMensuel(mensuel);
      console.log('[MensuelPanel] Mensuel sauvegardé avec ID:', mensuelId);
      alert('Contrôle mensuel sauvegardé avec succès !');
      onMensuelSaved();
      onClose();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      alert('Erreur lors de la sauvegarde du contrôle mensuel');
    } finally {
      setSaving(false);
    }
  };

  const renderSectionGenerales = (_section: SectionMensuelle) => {
    return (
      <div style={{ marginBottom: '1.1rem' }}>
        <div className="groupe-titre groupe-0">Informations générales</div>
        <div className="materiel-row niveau-2-materiel groupe-0-materiel">
          <span className="materiel-name">Agent responsable</span>
          <div className="controls-enhanced">
            <input
              type="text"
              value={mensuel.agent}
              onChange={(e) => handleInputChange('agent', e.target.value)}
              style={{ 
                width: '200px', 
                padding: '0.5rem', 
                border: '1px solid #ccc', 
                borderRadius: '4px',
                fontSize: '14px'
              }}
              placeholder="Nom de l'agent"
            />
          </div>
        </div>
        <div className="materiel-row niveau-2-materiel groupe-0-materiel">
          <span className="materiel-name">Kilométrage</span>
          <div className="controls-enhanced">
            <input
              type="number"
              value={mensuel.kilometres}
              onChange={(e) => handleInputChange('kilometres', Number(e.target.value))}
              style={{ 
                width: '120px', 
                padding: '0.5rem', 
                border: '1px solid #ccc', 
                borderRadius: '4px',
                fontSize: '14px'
              }}
              placeholder="0"
            />
            <span style={{ marginLeft: '0.5rem', color: '#666', fontSize: '14px' }}>km</span>
          </div>
        </div>
      </div>
    );
  };

  const renderSectionLiquides = (section: SectionMensuelle) => {
    // Utiliser la configuration de la section ou une configuration par défaut
    const liquidesConfig = section.config?.liquides || [
      { nom: "huile", label: "Huile moteur" },
      { nom: "liquideRefroidissement", label: "Liquide de refroidissement" },
      { nom: "liquideFrein", label: "Liquide de frein" },
      { nom: "liquideDirectionAssistee", label: "Liquide direction assistée" }
    ];
    const optionsConfig = section.config?.options || ["OK", "A_COMPLETER", "A_CHANGER", "DEFAUT"];

    return (
      <div style={{ marginBottom: '1.1rem' }}>
        <div className="groupe-titre groupe-1">Contrôle des liquides</div>
        {liquidesConfig.map((liquideConfig: any) => {
          const etat = (mensuel.liquides as any)[liquideConfig.nom] || 'OK';
          return (
            <div key={liquideConfig.nom} className="materiel-row niveau-2-materiel groupe-1-materiel">
              <span className="materiel-name">{liquideConfig.label}</span>
              <div className="controls-enhanced">
                <select
                  value={etat}
                  onChange={(e) => handleInputChange(`liquides.${liquideConfig.nom}`, e.target.value)}
                  style={{ 
                    padding: '0.5rem', 
                    border: '1px solid #ccc', 
                    borderRadius: '4px',
                    fontSize: '14px',
                    minWidth: '140px'
                  }}
                >
                  {optionsConfig.map((option: string) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderSectionBalais = (section: SectionMensuelle) => {
    // Utiliser la configuration de la section ou une configuration par défaut
    const positionsConfig = section.config?.positions || [
      { nom: "avant", label: "Avant" },
      { nom: "arriere", label: "Arrière" }
    ];
    const optionsConfig = section.config?.options || ["OK", "A_CHANGER", "DEFAUT"];

    return (
      <div style={{ marginBottom: '1.1rem' }}>
        <div className="groupe-titre groupe-2">Balais d'essuie-glace</div>
        {positionsConfig.map((positionConfig: any) => {
          const etat = (mensuel.balaisEssuieGlace as any)[positionConfig.nom] || 'OK';
          return (
            <div key={positionConfig.nom} className="materiel-row niveau-2-materiel groupe-2-materiel">
              <span className="materiel-name">Balai {positionConfig.label}</span>
              <div className="controls-enhanced">
                <select
                  value={etat}
                  onChange={(e) => handleInputChange(`balaisEssuieGlace.${positionConfig.nom}`, e.target.value)}
                  style={{ 
                    padding: '0.5rem', 
                    border: '1px solid #ccc', 
                    borderRadius: '4px',
                    fontSize: '14px',
                    minWidth: '140px'
                  }}
                >
                  {optionsConfig.map((option: string) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderSectionPneus = (section: SectionMensuelle) => {
    // Utiliser la configuration de la section ou une configuration par défaut
    const positionsConfig = section.config?.positions || [
      { nom: "avantGauche", label: "Avant gauche" },
      { nom: "avantDroit", label: "Avant droit" },
      { nom: "arriereGauche", label: "Arrière gauche" },
      { nom: "arriereDroit", label: "Arrière droit" }
    ];
    const typeControle = section.config?.typeControle || 'pression';

    return (
      <div style={{ marginBottom: '1.1rem' }}>
        <div className="groupe-titre groupe-3">Pression des pneus</div>
        
        {/* Affichage de la pression recommandée si c'est un contrôle de pression */}
        {typeControle === 'pression' && section.config?.pressionRecommandee && (
          <div className="materiel-row niveau-2-materiel groupe-3-materiel">
            <span className="materiel-name">Pression recommandée</span>
            <div className="controls-enhanced">
              <span style={{ 
                padding: '0.5rem', 
                background: '#e9ecef', 
                borderRadius: '4px',
                fontSize: '14px',
                color: '#495057'
              }}>
                {section.config.pressionRecommandee} bars
              </span>
            </div>
          </div>
        )}

        {positionsConfig.map((positionConfig: any) => {
          if (typeControle === 'pression') {
            // Mode saisie de pression
            const pression = (mensuel.pressionPneus as any)[positionConfig.nom] || 0;
            return (
              <div key={positionConfig.nom} className="materiel-row niveau-2-materiel groupe-3-materiel">
                <span className="materiel-name">{positionConfig.label}</span>
                <div className="controls-enhanced">
                  <input
                    type="number"
                    step="0.1"
                    value={pression}
                    onChange={(e) => handleInputChange(`pressionPneus.${positionConfig.nom}`, Number(e.target.value))}
                    style={{ 
                      width: '80px', 
                      padding: '0.5rem', 
                      border: '1px solid #ccc', 
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                  />
                  <span style={{ marginLeft: '0.5rem', color: '#666', fontSize: '14px' }}>bars</span>
                </div>
              </div>
            );
          } else {
            // Mode état (OK/Défaut)
            const etat = (mensuel.pressionPneus as any)[positionConfig.nom] || 'OK';
            const options = section.config?.options || ["OK", "DEFAUT", "A_VERIFIER"];
            return (
              <div key={positionConfig.nom} className="materiel-row niveau-2-materiel groupe-3-materiel">
                <span className="materiel-name">{positionConfig.label}</span>
                <div className="controls-enhanced">
                  <select
                    value={etat}
                    onChange={(e) => handleInputChange(`pressionPneus.${positionConfig.nom}`, e.target.value)}
                    style={{ 
                      padding: '0.5rem', 
                      border: '1px solid #ccc', 
                      borderRadius: '4px',
                      fontSize: '14px',
                      minWidth: '140px'
                    }}
                  >
                    {options.map((option: string) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
              </div>
            );
          }
        })}
      </div>
    );
  };

  const renderSectionPersonnalisee = (section: SectionMensuelle) => {
    // Si c'est la section "Informations générales", utiliser renderSectionGenerales
    if (section.nom.toLowerCase().includes('général') || section.id === 'info-generales') {
      return renderSectionGenerales(section);
    }

    return (
      <div style={{ marginBottom: '1.1rem' }}>
        <div className="groupe-titre groupe-5">{section.nom}</div>
        
        {/* Type checklist - cases à cocher */}
        {section.config?.type === 'checklist' && (
          <div>
            {section.config.elements?.map((element: string, index: number) => (
              <div key={index} className="materiel-row niveau-2-materiel groupe-5-materiel">
                <span className="materiel-name">{element}</span>
                <div className="controls-enhanced">
                  <label className="checkbox-container">
                    <input
                      type="checkbox"
                      onChange={(e) => handleInputChange(`${section.id}.${element}`, e.target.checked)}
                    />
                    <span className="checkmark"></span>
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Type textarea - zone de texte libre */}
        {section.config?.type === 'textarea' && (
          <div className="materiel-row niveau-2-materiel groupe-5-materiel">
            <span className="materiel-name">Commentaires</span>
            <div className="controls-enhanced">
              <textarea
                placeholder={section.config.placeholder || 'Saisir les informations...'}
                rows={section.config.rows || 3}
                value={mensuel[section.id] || ''}
                onChange={(e) => handleInputChange(section.id, e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: '0.5rem', 
                  border: '1px solid #ccc', 
                  borderRadius: '4px',
                  resize: 'vertical',
                  fontFamily: 'inherit'
                }}
              />
            </div>
          </div>
        )}

        {/* Type select - liste déroulante */}
        {section.config?.type === 'select' && (
          <div className="materiel-row niveau-2-materiel groupe-5-materiel">
            <span className="materiel-name">Sélection</span>
            <div className="controls-enhanced">
              <select
                value={mensuel[section.id] || ''}
                onChange={(e) => handleInputChange(section.id, e.target.value)}
                style={{ 
                  padding: '0.5rem', 
                  border: '1px solid #ccc', 
                  borderRadius: '4px',
                  fontSize: '14px',
                  minWidth: '140px'
                }}
              >
                <option value="">-- Choisir --</option>
                {section.config.options?.map((option: string, index: number) => (
                  <option key={index} value={option}>{option}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Type number - valeur numérique */}
        {section.config?.type === 'number' && (
          <div className="materiel-row niveau-2-materiel groupe-5-materiel">
            <span className="materiel-name">Valeur</span>
            <div className="controls-enhanced">
              <input
                type="number"
                min={section.config.min || 0}
                max={section.config.max || 100}
                value={mensuel[section.id] || ''}
                onChange={(e) => handleInputChange(section.id, Number(e.target.value))}
                style={{ 
                  width: '120px', 
                  padding: '0.5rem', 
                  border: '1px solid #ccc', 
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>
          </div>
        )}

        {/* Configuration par défaut si aucun type spécifique */}
        {!section.config?.type && (
          <div className="materiel-row niveau-2-materiel groupe-5-materiel">
            <span className="materiel-name">Informations</span>
            <div className="controls-enhanced">
              <input
                type="text"
                placeholder="Saisir les informations..."
                value={mensuel[section.id] || ''}
                onChange={(e) => handleInputChange(section.id, e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: '0.5rem', 
                  border: '1px solid #ccc', 
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderSectionLavage = (_section: SectionMensuelle) => {
    return (
      <div style={{ marginBottom: '1.1rem' }}>
        <div className="groupe-titre groupe-4">Lavage du véhicule</div>
        <div className="materiel-row niveau-2-materiel groupe-4-materiel">
          <span className="materiel-name">Lavage effectué</span>
          <div className="controls-enhanced">
            <label style={{ display: 'flex', alignItems: 'center', fontSize: '14px' }}>
              <input
                type="checkbox"
                checked={mensuel.lavage.effectue}
                onChange={(e) => handleInputChange('lavage.effectue', e.target.checked)}
                style={{ marginRight: '0.5rem' }}
              />
              Effectué
            </label>
          </div>
        </div>
        {mensuel.lavage.effectue && (
          <div className="materiel-row niveau-2-materiel groupe-4-materiel">
            <span className="materiel-name">Type de lavage</span>
            <div className="controls-enhanced">
              <select
                value={mensuel.lavage.typelavage}
                onChange={(e) => handleInputChange('lavage.typelavage', e.target.value)}
                style={{ 
                  padding: '0.5rem', 
                  border: '1px solid #ccc', 
                  borderRadius: '4px',
                  fontSize: '14px',
                  minWidth: '140px'
                }}
              >
                <option value="EXTERIEUR">Extérieur</option>
                <option value="INTERIEUR">Intérieur</option>
                <option value="COMPLET">Complet</option>
              </select>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderSectionDefauts = (_section: SectionMensuelle) => {
    return (
      <div style={{ padding: '1rem', background: '#ffffff' }}>
        <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#f8f9fa', borderRadius: '4px' }}>
          <h4 style={{ color: '#2c3e50', marginBottom: '0.5rem' }}>Défauts identifiés</h4>
          {mensuel.defauts.map((defaut, index) => (
            <div key={index} style={{ 
              marginBottom: '1rem', 
              padding: '0.75rem', 
              border: '1px solid #ddd', 
              borderRadius: '4px',
              background: '#fff'
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto auto 1fr auto', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                <select
                  value={defaut.categorie}
                  onChange={(e) => updateDefaut(index, 'categorie', e.target.value)}
                  style={{ padding: '0.25rem', border: '1px solid #ccc', borderRadius: '4px' }}
                >
                  <option value="LIQUIDES">Liquides</option>
                  <option value="BALAIS">Balais</option>
                  <option value="PNEUS">Pneus</option>
                  <option value="LAVAGE">Lavage</option>
                  <option value="AUTRE">Autre</option>
                </select>
                
                <select
                  value={defaut.gravite}
                  onChange={(e) => updateDefaut(index, 'gravite', e.target.value)}
                  style={{ padding: '0.25rem', border: '1px solid #ccc', borderRadius: '4px' }}
                >
                  <option value="MINEUR">Mineur</option>
                  <option value="MOYEN">Moyen</option>
                  <option value="GRAVE">Grave</option>
                </select>
                
                <span></span>
                
                <button 
                  onClick={() => supprimerDefaut(index)}
                  style={{ 
                    padding: '0.25rem 0.5rem', 
                    background: '#dc3545', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  🗑️
                </button>
              </div>
              
              <textarea
                placeholder="Description du défaut..."
                value={defaut.description}
                onChange={(e) => updateDefaut(index, 'description', e.target.value)}
                style={{ 
                  width: '100%', 
                  minHeight: '60px', 
                  padding: '0.5rem', 
                  border: '1px solid #ccc', 
                  borderRadius: '4px',
                  resize: 'vertical'
                }}
              />
            </div>
          ))}
          
          <button 
            onClick={ajouterDefaut}
            style={{ 
              padding: '0.5rem 1rem', 
              background: '#28a745', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            + Ajouter un défaut
          </button>
        </div>
      </div>
    );
  };

  const renderSectionObservations = (section: SectionMensuelle) => {
    return (
      <div style={{ marginBottom: '1.1rem' }}>
        <div className="materiel-row niveau-2-materiel groupe-0-materiel">
          <span className="materiel-name">Observations complémentaires</span>
          <div className="controls-enhanced" style={{ width: '100%' }}>
            <textarea
              placeholder={section.config?.placeholder || "Observations complémentaires..."}
              value={mensuel.observations || ''}
              onChange={(e) => handleInputChange('observations', e.target.value)}
              rows={4}
              style={{ 
                width: '100%', 
                padding: '0.5rem', 
                border: '1px solid #ccc', 
                borderRadius: '4px',
                resize: 'vertical',
                fontSize: '14px',
                fontFamily: 'inherit'
              }}
            />
          </div>
        </div>
      </div>
    );
  };

  const renderSectionGenerique = (section: SectionMensuelle) => {
    return (
      <div style={{ padding: '1rem', background: '#ffffff' }}>
        <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#f8f9fa', borderRadius: '4px' }}>
          <h4 style={{ color: '#2c3e50', marginBottom: '0.5rem' }}>Section: {section.nom}</h4>
          <div style={{ padding: '1rem', background: '#fff3cd', borderRadius: '4px', border: '1px solid #ffeaa7' }}>
            <p style={{ color: '#856404', margin: 0, fontSize: '14px' }}>
              <strong>Type:</strong> {section.type}<br/>
              Cette section nécessite une interface spécifique qui n'est pas encore implémentée.
            </p>
          </div>
        </div>
      </div>
    );
  };

  const renderSection = (section: SectionMensuelle) => {
    console.log(`[MensuelPanel] Rendu de la section: ${section.nom} (type: ${section.type})`);
    
    // Traitement spécial uniquement pour la section avec l'ID exact 'info-generales'
    if (section.id === 'info-generales') {
      return renderSectionGenerales(section);
    }
    
    switch (section.type) {
      case 'liquides':
        return renderSectionLiquides(section);
      case 'balais':
        return renderSectionBalais(section);
      case 'pneus':
        return renderSectionPneus(section);
      case 'lavage':
        return renderSectionLavage(section);
      case 'defauts':
        return renderSectionDefauts(section);
      case 'observations':
        return renderSectionObservations(section);
      case 'personnalise':
        return renderSectionPersonnalisee(section);
      default:
        return renderSectionGenerique(section);
    }
  };

  if (loading) {
    return (
      <div className="mensuel-container">
        <div className="mensuel-header">
          <h2>Contrôle Mensuel - {vehicule.nom}</h2>
          <button className="btn-back-home" onClick={onClose}>
            <span className="btn-icon">🏠</span>
            <span className="btn-text">Retour</span>
          </button>
        </div>
        <div style={{ textAlign: 'center', padding: '2rem', color: '#333' }}>
          <div>Chargement de la configuration...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="inventaire-container">
      <div className="inventaire-header">
        <h2>Contrôle Mensuel - {vehicule.nom}</h2>
        <button className="btn-back-home" onClick={onClose}>
          <span className="btn-icon">🏠</span>
          <span className="btn-text">Retour</span>
        </button>
      </div>

      <div className="inventaire-content">
        {configuration?.sections.map((section, index) => (
          <div key={section.nom} className="section-panel niveau-1">
            <div className="section-header-static niveau-1">
              {section.nom}
              <span className="section-progress">{index + 1}/{configuration.sections.length}</span>
            </div>
            <div className="section-content open">
              {renderSection(section)}
            </div>
          </div>
        ))}

        <div className="actions-panel">
          <button 
            className="btn-primary btn-save" 
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Sauvegarde...' : 'Sauvegarder le contrôle'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MensuelPanel;
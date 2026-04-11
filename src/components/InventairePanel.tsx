import React, { useState, useEffect, useRef, useMemo } from 'react';
// QRCodeCanvas supprimé car plus utilisé
import type { Vehicule, Section, Materiel } from '../models/inventaire';
import { InventaireService } from '../firebase/inventaire-service';
import { SOGManualService } from '../firebase/sog-manual-service';
import { PhotoService } from '../firebase/photo-service';
import type { InventaireRecord } from '../models/inventaire-record';
import PhotoInspectionItem from './PhotoInspectionItem';
import type { User } from '../firebase/auth-service';
import '../App.css';

interface Props {
  vehicule: Vehicule;
  onInventaireComplete?: () => void;
  onReturnHome?: () => void;
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
              {/* Afficher la checkbox OK pour tous les types checkbox */}
              {(m.type === 'checkbox-presence' || m.type === 'checkbox-fonction' || m.type === 'checkbox' || !m.type) && (
                <label>
                  OK
                  <input type="checkbox" checked={m.estPresent} onChange={() => updateSection(path, mIdx, 'estPresent')} />
                </label>
              )}
              {/* Afficher la checkbox Fonctionne seulement pour checkbox-fonction et checkbox (legacy) */}
              {(m.type === 'checkbox-fonction' || m.type === 'checkbox' || (!m.type && m.hasOwnProperty('fonctionne'))) && (
                <label className={!m.estPresent ? 'label-disabled' : ''}>
                  Fonctionne
                  <input type="checkbox" checked={m.fonctionne} onChange={() => updateSection(path, mIdx, 'fonctionne')} disabled={!m.estPresent} />
                </label>
              )}
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
        // Logique spéciale pour les matériels de type photo
        if (m.type === 'photo') {
          // Si le matériel n'est pas marqué comme "bon état" ET pas marqué comme "réparé"
          // alors c'est un défaut (même si une photo est présente - la photo documente le défaut)
          if (!m.bonEtat && !m.repare) {
            const hasNewPhotos = !!(m.photos && m.photos.length > 0);
            const hasOldPhotos = !!(m.photosAnciennes && m.photosAnciennes.length > 0);
            const hasAnyPhotos = hasNewPhotos || hasOldPhotos;
            
            defauts.push({
              chemin: path.join(' > '),
              nom: m.nom,
              present: hasAnyPhotos, // true si défaut documenté par photo (nouvelle ou ancienne)
              details: hasNewPhotos ? 'Défaut documenté par photo' : 
                       hasOldPhotos ? 'Défaut précédent (photos anciennes)' : 'Défaut non documenté'
            });
          }
        }
        // Logique spéciale pour matériels radio
        else if ((m as any).type === 'radio') {
          // Si valeur === true, c'est qu'il y a un voyant allumé (défaut)
          // MAIS exclure si le défaut a été marqué comme réparé
          if (m.valeur === true && m.statutReparation !== 'repare') {
            defauts.push({
              chemin: path.join(' > '),
              nom: m.nom,
              present: true,
              details: 'Voyant(s) allumé(s)' + (m.observation ? ` - ${m.observation}` : '')
            });
          }
          // Si valeur === false, c'est RAS (pas de défaut)
          // Si valeur === undefined, c'est non vérifié (pas de défaut non plus car pas encore contrôlé)
        }
        // Nouveau système : si le matériel a un type checkbox-presence (présence seulement)
        else if (m.type === 'checkbox-presence') {
          if (!m.estPresent) {
            defauts.push({
              chemin: path.join(' > '),
              nom: m.nom,
              present: m.estPresent ?? false,
              details: 'Absent',
            });
          }
        }
        // Si le matériel a un type checkbox-fonction (présence ET fonction)
        else if (m.type === 'checkbox-fonction') {
          if (!m.estPresent || !m.fonctionne) {
            const isPresent = m.estPresent ?? false;
            const isFonctionnel = m.fonctionne ?? false;
            defauts.push({
              chemin: path.join(' > '),
              nom: m.nom,
              present: isPresent,
              fonctionne: isFonctionnel,
              details: !isPresent ? 'Absent' : (!isFonctionnel ? 'Présent mais ne fonctionne pas' : undefined),
            });
          }
        }
        // Legacy : Si le matériel a SEULEMENT fonctionne (sans estPresent), on vérifie seulement fonctionne
        // MAIS on exclut les matériels qui ont un type défini (pour éviter les conflits)
        else if (m.hasOwnProperty('fonctionne') && !m.hasOwnProperty('estPresent') && !m.type) {
          if (!m.fonctionne) {
            defauts.push({
              chemin: path.join(' > '),
              nom: m.nom,
              present: true, // Il est présent mais ne fonctionne pas
              fonctionne: m.fonctionne ?? false,
              details: 'Présent mais ne fonctionne pas',
            });
          }
        }
        // Legacy : Si le matériel a les deux propriétés estPresent ET fonctionne
        // MAIS on exclut les matériels qui ont un type défini (pour éviter les conflits)
        else if (m.hasOwnProperty('fonctionne') && m.hasOwnProperty('estPresent') && !m.type) {
          if (!m.estPresent || !m.fonctionne) {
            const isPresent = m.estPresent ?? false;
            const isFonctionnel = m.fonctionne ?? false;
            defauts.push({
              chemin: path.join(' > '),
              nom: m.nom,
              present: isPresent,
              fonctionne: isFonctionnel,
              details: !isPresent ? 'Absent' : (!isFonctionnel ? 'Présent mais ne fonctionne pas' : undefined),
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
                details: isVerified ? `${quantiteReelle}/${quantiteAttendue}` : 'Non vérifié'
              });
            }
          } else if (m.type === 'select' && (!m.valeur || m.valeur === '')) {
            defauts.push({
              chemin: path.join(' > '),
              nom: m.nom,
              present: false,
            });
          } else if (m.type === 'checkbox-ok' && !m.valeur) {
            defauts.push({
              chemin: path.join(' > '),
              nom: m.nom,
              present: false,
              details: 'Non coché (OK)'
            });
          } else if (m.type === 'presence-teste') {
            // Type présence + testé : 3 états possibles
            // valeur = 'ok' -> présent (mais non testé en fonctionnement)
            // valeur = 'teste' -> présent ET testé en fonctionnement
            // valeur = '' ou undefined -> non vérifié
            if (!m.valeur || m.valeur === '') {
              defauts.push({
                chemin: path.join(' > '),
                nom: m.nom,
                present: false,
                details: 'Non vérifié'
              });
            } else if (m.valeur === 'ok') {
              // Présent mais non testé - on le signale comme info (pas un défaut critique)
              defauts.push({
                chemin: path.join(' > '),
                nom: m.nom,
                present: true,
                details: 'Présent — Non testé'
              });
            }
            // Si valeur === 'teste' -> tout est bon, pas de défaut
          } else if (m.type === 'niveau' && (m.valeur === 'Bas' || m.valeur === 'Vide' || !m.valeur)) {
            defauts.push({
              chemin: path.join(' > '),
              nom: m.nom,
              present: true,
              details: `Niveau: ${m.valeur || 'Non défini'}`
            });
          } else if ((m.type === 'etat' || m.type === 'statut-ternaire') && (m.valeur === 'Mauvais' || !m.valeur)) {
            defauts.push({
              chemin: path.join(' > '),
              nom: m.nom,
              present: true,
              details: `État: ${m.valeur || 'Non défini'}`
            });
          } else if (m.type === 'conformite' && (m.valeur === 'Non conforme' || !m.valeur)) {
            defauts.push({
              chemin: path.join(' > '),
              nom: m.nom,
              present: true,
              details: `Conformité: ${m.valeur || 'Non définie'}`
            });
          } else if (m.type === 'date' && !m.valeur) {
            defauts.push({
              chemin: path.join(' > '),
              nom: m.nom,
              present: false,
              details: 'Date non renseignée'
            });
          } else if (m.type === 'texte-libre' && (!m.valeur || m.valeur.trim() === '')) {
            defauts.push({
              chemin: path.join(' > '),
              nom: m.nom,
              present: false,
              details: 'Texte non renseigné'
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

const InventairePanel: React.FC<Props> = ({ vehicule, onInventaireComplete, onReturnHome }) => {
  const [etat, setEtat] = useState<Section[]>(vehicule.sections.map(s => JSON.parse(JSON.stringify(s))));
  const [agent, setAgent] = useState('');
  const [pin, setPin] = useState('');
  const [observation, setObservation] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false); // État pour suivre l'envoi
  // Navigation par grande section principale
  const [sectionIdx, setSectionIdx] = useState(0);
  const [showSummary, setShowSummary] = useState(false); // Nouvel état pour le panneau de résumé
  
  // États pour l'authentification
  const [authenticatedUser, setAuthenticatedUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Filtrer les utilisateurs selon la saisie
  const filteredUsers = useMemo(() => {
    const excluded = ['admin', 'test'];
    const visible = allUsers.filter(u => !excluded.includes(u.name.toLowerCase()));
    if (!agent.trim()) return visible;
    const search = agent.toLowerCase();
    return visible.filter(u => u.name.toLowerCase().includes(search));
  }, [agent, allUsers]);

  // Charger la liste des utilisateurs pour l'autocomplétion
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const { AuthService } = await import('../firebase/auth-service');
        const users = await AuthService.getAllUsers();
        setAllUsers(users);
      } catch (error) {
        console.error('❌ Erreur chargement utilisateurs:', error);
      }
    };
    loadUsers();
  }, []);

  // Fermer les suggestions au clic en dehors
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Protection contre la fermeture de page pendant l'envoi
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isSubmitting) {
        e.preventDefault();
        e.returnValue = '⚠️ Un inventaire est en cours d\'envoi. Êtes-vous sûr de vouloir quitter ?';
        return '⚠️ Un inventaire est en cours d\'envoi. Êtes-vous sûr de vouloir quitter ?';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isSubmitting]);
  
  const currentSection = etat[sectionIdx];
  // On aplatit tous les matériels de la section courante
  const materielsList = flattenMateriels(currentSection);
  const groupedMateriels = groupMaterielsBySousPartie(materielsList);

  // Charger les photos et défauts du dernier inventaire au démarrage
  useEffect(() => {
    const chargerDonneesAnciennes = async () => {
      try {
        console.log('🔍 Chargement des données pour véhicule:', vehicule.id);
        
        // Charger les photos
        const photosParMateriel = await InventaireService.getDernieresPhotos(vehicule.id);
        console.log('📸 Photos récupérées:', photosParMateriel);
        
        // Charger les défauts précédents
        const defautsParMateriel = await InventaireService.getDerniersDefauts(vehicule.id);
        console.log('⚠️ Défauts précédents récupérés:', defautsParMateriel);
        console.log('🔍 Clés des défauts:', Object.keys(defautsParMateriel));
        
        if (Object.keys(photosParMateriel).length > 0 || Object.keys(defautsParMateriel).length > 0) {
          console.log('✅ Données trouvées, mise à jour de l\'état');
          
          setEtat(prev => {
            const copy = JSON.parse(JSON.stringify(prev));
            
            // Fonction récursive pour mettre à jour les photos et défauts dans les sections
            const mettreAJourDonnees = (section: any) => {
              if (section.materiels) {
                section.materiels.forEach((materiel: any) => {
                  // Assigner les photos
                  if (photosParMateriel[materiel.id]) {
                    console.log(`📷 Assignation de ${photosParMateriel[materiel.id].length} photos à ${materiel.id}`);
                    materiel.photosAnciennes = photosParMateriel[materiel.id];
                  }
                  
                  // Marquer les défauts précédents et auto-sélectionner pour les radios
                  if (defautsParMateriel[materiel.id]) {
                    console.log(`⚠️ Marquage défaut précédent pour ${materiel.id}`);
                    materiel.defautPrecedent = true;
                    
                    // Récupérer l'observation précédente (extraire seulement le texte utilisateur)
                    const observationBrute = defautsParMateriel[materiel.id].observation;
                    if (observationBrute) {
                      // Si l'observation contient "Voyant(s) allumé(s) - ", extraire seulement la partie après
                      if (observationBrute.includes(' - ')) {
                        materiel.observationPrecedente = observationBrute.split(' - ').slice(1).join(' - ');
                      } else {
                        materiel.observationPrecedente = observationBrute;
                      }
                    }
                    
                    // Auto-sélectionner le défaut pour les matériels radio
                    if ((materiel as any).type === 'radio') {
                      materiel.valeur = true; // Sélectionner automatiquement le défaut
                      console.log(`🔘 Auto-sélection du défaut pour le matériel radio: ${materiel.id}`);
                    }
                  }
                });
              }
              
              if (section.sousSections) {
                section.sousSections.forEach((sousSection: any) => {
                  mettreAJourDonnees(sousSection);
                });
              }
            };

            copy.forEach(mettreAJourDonnees);
            return copy;
          });
        }
      } catch (error) {
        console.warn('⚠️ Erreur lors du chargement des données précédentes:', error);
      }
    };

    chargerDonneesAnciennes();
  }, [vehicule.id]); // Se déclenche quand on change de véhicule

  const updateSection = (path: string, materielIdx: number, field: 'estPresent' | 'fonctionne') => {
    setEtat(prev => {
      const pathArr = path.split('.').filter(Boolean);
      const copy = JSON.parse(JSON.stringify(prev));
      let section = findSectionByPath(copy, pathArr);
      if (section && section.materiels) {
        const materiel = section.materiels[materielIdx];
        materiel[field] = !materiel[field];
        // Si on décoche "OK" (estPresent), remettre fonctionne à false
        if (field === 'estPresent' && !materiel.estPresent && materiel.hasOwnProperty('fonctionne')) {
          materiel.fonctionne = false;
        }
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
        const materiel = section.materiels[materielIdx];
        materiel.valeur = valeur;
        // Pour compatibilité, on peut aussi mettre à jour estPresent/fonctionne si type checkbox
        if (typeof valeur === 'boolean') {
          materiel.estPresent = valeur;
        }
        // Pour type checkbox-ok, s'assurer que la valeur est bien booléenne
        if (materiel.type === 'checkbox-ok') {
          materiel.valeur = !!valeur; // Force la conversion en boolean
          materiel.estPresent = !!valeur; // Assurer la cohérence
        }
        // Pour type presence-teste, gérer les 3 états
        if (materiel.type === 'presence-teste') {
          materiel.valeur = valeur; // 'ok', 'teste' ou ''
          materiel.estPresent = valeur === 'ok' || valeur === 'teste';
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
        const materiel = { ...section.materiels[materielIdx], ...updates };
        
        // Gestion spéciale des statuts de réparation
        if (updates.repare === true) {
          // Si le matériel est marqué comme réparé, effacer le défaut actuel mais garder l'historique
          materiel.valeur = false; // Plus de défaut actuel
          materiel.defautPrecedent = true; // Garder trace qu'il y avait un défaut
          materiel.statutReparation = 'repare'; // Marquer comme réparé
        } else if (updates.pasDeChangement === true) {
          // Le défaut persiste sans changement
          materiel.valeur = true; // Garder le défaut
          materiel.statutReparation = 'aucun_changement';
        } else if (updates.nouveauDefaut === true) {
          // Nouveau défaut détecté
          materiel.valeur = true; // Défaut présent
          materiel.statutReparation = 'nouveau_defaut';
        }
        
        section.materiels[materielIdx] = materiel;
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

  // Fonction pour uploader toutes les photos et remplacer les base64 par des URLs
  const uploadPhotosAndGetSections = async (sections: Section[]): Promise<Section[]> => {
    const sectionsWithUrls = JSON.parse(JSON.stringify(sections)); // Deep copy
    
    const uploadPromises: Promise<void>[] = [];
    
    const processSection = (originalSection: Section, targetSection: Section, sectionPath: string[] = []) => {
      const currentPath = [...sectionPath, originalSection.nom];
      
      if (originalSection.materiels) {
        originalSection.materiels.forEach((materiel, materielIndex) => {
          if (materiel.photos && materiel.photos.length > 0) {
            // Créer une promesse d'upload pour ce matériel
            const uploadPromise = PhotoService.uploadMaterielPhotos(
              materiel,
              vehicule.id,
              `${currentPath.join('_')}_${materiel.nom}`
            ).then((photoUrls) => {
              // Remplacer les base64 par les URLs dans la section cible
              if (targetSection.materiels && targetSection.materiels[materielIndex]) {
                targetSection.materiels[materielIndex].photos = photoUrls;
              }
            }).catch(error => {
              console.error(`❌ Erreur upload photos pour ${materiel.nom}:`, error);
              // En cas d'erreur, on garde les photos en base64 (fallback)
            });
            
            uploadPromises.push(uploadPromise);
          }
        });
      }
      
      if (originalSection.sousSections && targetSection.sousSections) {
        originalSection.sousSections.forEach((sousSection, index) => {
          if (targetSection.sousSections && targetSection.sousSections[index]) {
            processSection(sousSection, targetSection.sousSections[index], currentPath);
          }
        });
      }
    };
    
    sections.forEach((originalSection, index) => {
      if (sectionsWithUrls[index]) {
        processSection(originalSection, sectionsWithUrls[index]);
      }
    });
    
    // Attendre que tous les uploads soient terminés

    await Promise.all(uploadPromises);

    
    return sectionsWithUrls;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Vérifier si l'utilisateur a fait au moins une vérification
    if (!hasUserMadeAnyVerification()) {
      setMessage('❌ Aucune vérification effectuée');
      alert('⚠️ ATTENTION !\n\nVous devez vérifier au moins un élément avant de valider l\'inventaire.\n\n🔍 Veuillez parcourir les sections et effectuer au moins une vérification.');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    // Si pas encore authentifié, faire l'authentification avec les valeurs du formulaire
    if (!authenticatedUser) {
      if (!agent || !pin) {
        setMessage('❌ Veuillez saisir votre nom et votre code PIN');
        setTimeout(() => setMessage(''), 3000);
        return;
      }

      setMessage('🔄 Vérification de l\'authentification...');

      try {
        // Importer le service d'authentification
        const { AuthService } = await import('../firebase/auth-service');

        // Tenter l'authentification
        const authenticatedUserResult = await AuthService.authenticateUser(agent, pin);

        if (authenticatedUserResult) {
          setAuthenticatedUser(authenticatedUserResult);
          setMessage('✅ Authentification réussie ! Envoi en cours...');

          // Procéder directement à la soumission avec l'utilisateur authentifié
          setTimeout(() => {
            performSubmission(authenticatedUserResult);
          }, 1000);
        } else {
          setMessage('❌ Nom d\'utilisateur ou code PIN incorrect');
          setTimeout(() => setMessage(''), 5000);
        }
      } catch (error) {
        console.error('❌ Erreur lors de l\'authentification:', error);
        setMessage('❌ Erreur lors de l\'authentification');
        setTimeout(() => setMessage(''), 5000);
      }

      return;
    }
    
    // Si déjà authentifié, procéder directement à la soumission

    await performSubmission();
  };

  // Fonction pour créer un état complet qui préserve les données des sections non modifiées
  const createCompleteState = async () => {
    // Créer une copie complète du véhicule original
    const completeState = JSON.parse(JSON.stringify(vehicule.sections));
    
    try {
      // Récupérer le dernier inventaire pour ce véhicule
      const dernierInventaire = await InventaireService.getDernierInventaire(vehicule.id);
      
      if (dernierInventaire?.sections) {
        // Pour chaque section du véhicule
        completeState.forEach((sectionComplete: Section, idx: number) => {
          const sectionModifiee = etat[idx];
          const sectionPrecedente = dernierInventaire.sections?.[idx];
          
          if (sectionModifiee && sectionPrecedente) {
            // Vérifier si la section a été réellement modifiée par l'utilisateur
            const sectionHasBeenModified = hasSectionBeenModified(sectionModifiee, vehicule.sections[idx]);
            
            if (!sectionHasBeenModified && sectionPrecedente) {
              // Si la section n'a pas été modifiée, utiliser les données précédentes
              mergeSectionFromPrevious(sectionComplete, sectionPrecedente);
            } else {
              // Si la section a été modifiée, fusionner intelligemment
              mergeModifiedSection(sectionComplete, sectionModifiee, sectionPrecedente);
            }
          } else if (sectionModifiee) {
            // Section modifiée sans données précédentes
            mergeModifiedSection(sectionComplete, sectionModifiee, null);
          }
        });
      } else {
        // Pas de données précédentes, utiliser seulement les modifications actuelles
        completeState.forEach((sectionComplete: Section, idx: number) => {
          if (etat[idx]) {
            mergeModifiedSection(sectionComplete, etat[idx], null);
          }
        });
      }
    } catch (error) {
      console.warn('Erreur lors de la récupération du dernier inventaire:', error);
      // En cas d'erreur, utiliser seulement les modifications actuelles
      completeState.forEach((sectionComplete: Section, idx: number) => {
        if (etat[idx]) {
          mergeModifiedSection(sectionComplete, etat[idx], null);
        }
      });
    }
    
    return completeState;
  };

  // Fonction pour vérifier si une section a été modifiée par l'utilisateur
  const hasSectionBeenModified = (sectionActuelle: Section, sectionOriginale: Section): boolean => {
    return hasMaterielsBeenModified(sectionActuelle.materiels || [], sectionOriginale.materiels || []) ||
           hasSousSecionsBeenModified(sectionActuelle.sousSections || [], sectionOriginale.sousSections || []);
  };

  const hasMaterielsBeenModified = (materielsCurrent: any[], materielsOriginal: any[]): boolean => {
    return materielsCurrent.some((materiel, idx) => {
      const original = materielsOriginal[idx];
      if (!original) return true;
      
      // Vérifier si des champs importants ont été modifiés
      return materiel.estPresent !== original.estPresent ||
             materiel.fonctionne !== original.fonctionne ||
             materiel.valeur !== original.valeur ||
             materiel.quantiteReelle !== original.quantiteReelle ||
             (materiel.estVerifie !== undefined && materiel.estVerifie !== original.estVerifie) ||
             materiel.bonEtat !== original.bonEtat ||
             materiel.repare !== original.repare ||
             materiel.pasDeChangement !== original.pasDeChangement ||
             (materiel.photos && materiel.photos.length > 0) ||
             (materiel.observation && materiel.observation !== original.observation);
    });
  };

  const hasSousSecionsBeenModified = (sousSecActuelles: Section[], sousSecOriginales: Section[]): boolean => {
    return sousSecActuelles.some((sousSection, idx) => {
      const original = sousSecOriginales[idx];
      if (!original) return true;
      return hasSectionBeenModified(sousSection, original);
    });
  };

  // Fonction pour fusionner une section avec les données précédentes (section non modifiée)
  const mergeSectionFromPrevious = (target: Section, previous: Section) => {
    if (previous.materiels && target.materiels) {
      target.materiels.forEach((materiel, idx) => {
        const previousMateriel = previous.materiels?.[idx];
        if (previousMateriel) {
          // Conserver toutes les données importantes du précédent inventaire
          if (previousMateriel.photos) materiel.photos = [...previousMateriel.photos];
          if (previousMateriel.photosAnciennes) materiel.photosAnciennes = [...previousMateriel.photosAnciennes];
          if (previousMateriel.bonEtat !== undefined) materiel.bonEtat = previousMateriel.bonEtat;
          if (previousMateriel.repare !== undefined) materiel.repare = previousMateriel.repare;
          if (previousMateriel.pasDeChangement !== undefined) materiel.pasDeChangement = previousMateriel.pasDeChangement;
          if (previousMateriel.observation) materiel.observation = previousMateriel.observation;
          if (previousMateriel.estPresent !== undefined) materiel.estPresent = previousMateriel.estPresent;
          if (previousMateriel.fonctionne !== undefined) materiel.fonctionne = previousMateriel.fonctionne;
          if (previousMateriel.valeur !== undefined) materiel.valeur = previousMateriel.valeur;
          if (previousMateriel.quantiteReelle !== undefined) materiel.quantiteReelle = previousMateriel.quantiteReelle;
          if ((previousMateriel as any).estVerifie !== undefined) (materiel as any).estVerifie = (previousMateriel as any).estVerifie;
        }
      });
    }

    if (previous.sousSections && target.sousSections) {
      target.sousSections.forEach((sousSection, idx) => {
        const previousSousSection = previous.sousSections?.[idx];
        if (previousSousSection) {
          mergeSectionFromPrevious(sousSection, previousSousSection);
        }
      });
    }
  };

  // Fonction pour fusionner une section modifiée avec préservation intelligente
  const mergeModifiedSection = (target: Section, modified: Section, previous: Section | null) => {
    if (modified.materiels && target.materiels) {
      target.materiels.forEach((materiel, idx) => {
        const modifiedMateriel = modified.materiels?.[idx];
        const previousMateriel = previous?.materiels?.[idx];
        
        if (modifiedMateriel) {
          // Appliquer les modifications
          Object.assign(materiel, modifiedMateriel);
          
          // Conserver les photos anciennes si elles existent
          if (previousMateriel?.photosAnciennes && !materiel.photosAnciennes) {
            materiel.photosAnciennes = [...previousMateriel.photosAnciennes];
          }
        }
      });
    }

    if (modified.sousSections && target.sousSections) {
      target.sousSections.forEach((sousSection, idx) => {
        const modifiedSousSection = modified.sousSections?.[idx];
        const previousSousSection = previous?.sousSections?.[idx];
        
        if (modifiedSousSection) {
          mergeModifiedSection(sousSection, modifiedSousSection, previousSousSection || null);
        }
      });
    }
  };

  const performSubmission = async (user?: User) => {
    const currentUser = user || authenticatedUser;
    if (!currentUser) {
      setMessage('Erreur: Authentification requise');
      return;
    }

    // Marquer le début de l'envoi
    setIsSubmitting(true);
    
    // Alerter l'utilisateur que l'envoi a commencé
    setMessage('🔄 Préparation de l\'inventaire...');
    alert('📋 Début de l\'envoi de l\'inventaire.\n\n⚠️ IMPORTANT: Ne fermez pas cette page pendant l\'envoi !');
    
    try {
      // Créer un état complet qui préserve les données des sections non visitées
      setMessage('🔄 Fusion des données avec l\'inventaire précédent...');
      const completeState = await createCompleteState();
      
      const defauts = getDefauts(completeState);
      
      // 1. Upload des photos vers Firebase Storage et récupération des URLs
      setMessage('📸 Envoi des photos en cours...');
      const sectionsWithPhotoUrls = await uploadPhotosAndGetSections(completeState);
      
      // 2. Sauvegarde dans Firestore avec informations d'authentification
      setMessage('💾 Sauvegarde de l\'inventaire...');
      const inventaireRecord: InventaireRecord = {
        vehiculeId: vehicule.id,
        vehiculeName: vehicule.nom,
        agent: currentUser.name, // Utiliser le nom de l'utilisateur authentifié
        agentId: currentUser.id,   // Ajouter l'ID pour traçabilité
        agentRole: currentUser.role, // Ajouter le rôle
        dateInventaire: new Date(),
        defauts: defauts,
        // Sauvegarder les sections AVEC les URLs des photos
        sections: sectionsWithPhotoUrls,
        observation: observation || '',
        materielValides: getCompletedMaterials(),
        totalMateriels: getTotalMaterials()
      };

      // 1. Sauvegarde Firebase
      try {
        await InventaireService.saveInventaire(inventaireRecord);

      } catch (firebaseError) {
        console.error('❌ Erreur Firebase:', firebaseError);
        throw new Error(`Erreur Firebase: ${firebaseError instanceof Error ? firebaseError.message : String(firebaseError)}`);
      }
      
      // 1b. Nettoyer les données manuelles SOG (défauts manuels, résolus, override observation)
      try {
        await SOGManualService.clearAfterInventaire(vehicule.id);
        console.log('🧹 Données manuelles SOG nettoyées');
      } catch (cleanError) {
        console.warn('⚠️ Nettoyage SOG échoué (non bloquant):', cleanError);
      }
      
      // 2. Envoi vers Google Sheets (existant)

      try {
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

      } catch (sheetsError) {
        console.error('❌ Erreur Google Sheets:', sheetsError);
        // Ne pas échouer pour Google Sheets, juste un warning
        console.warn('⚠️ Google Sheets échoué mais Firebase sauvegardé');
      }
      
      setMessage('✅ Inventaire sauvegardé et envoyé avec succès !');
      
      // Alerter l'utilisateur du succès
      alert('✅ SUCCÈS !\n\nVotre inventaire a été envoyé avec succès.\n📋 Toutes les données ont été sauvegardées.\n🔄 Redirection vers l\'accueil...');
      
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
      const errorMessage = `❌ Erreur lors de l'envoi: ${err instanceof Error ? err.message : String(err)}`;
      setMessage(errorMessage);
      
      // Alerter l'utilisateur de l'erreur
      alert(`❌ ERREUR !\n\n${errorMessage}\n\n🔄 Veuillez réessayer ou contacter le support technique.`);
    } finally {
      // Arrêter l'état d'envoi dans tous les cas
      setIsSubmitting(false);
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
        if (m.type === 'checkbox-ok') return m.valeur === true;
        if (m.type === 'presence-teste') return m.valeur === 'ok' || m.valeur === 'teste';
        if (m.type === 'niveau') return m.valeur && m.valeur !== 'Vide';
        if (m.type === 'etat' || m.type === 'statut-ternaire') return m.valeur && m.valeur !== 'Mauvais';
        if (m.type === 'conformite') return m.valeur === 'Conforme';
        if (m.type === 'date') return (m.valeur ?? '') !== '';
        if (m.type === 'texte-libre') return (m.valeur ?? '').trim() !== '';
        
        if (m.type === 'photo') {
          // Pour les photos : soit bon état, soit réparé, soit défaut persistant, soit photos présentes
          return m.bonEtat || m.repare || m.pasDeChangement || (m.photos && m.photos.length > 0);
        }
        
        // Pour les matériels radio - logique spéciale
        if ((m as any).type === 'radio') {
          // Compter comme "complété" seulement si RAS (false), pas si voyants allumés (true) 
          return m.valeur === false;
        }
        
        // Pour les matériels qui n'ont QUE "fonctionne" (comme Klaxon)
        if (m.hasOwnProperty('fonctionne') && !m.hasOwnProperty('estPresent')) {
          // Compter comme "complété" si vérifié, peu importe si ça fonctionne ou non
          return (m as any).estVerifie === true;
        }
        
        // Pour les matériels normaux : utiliser estPresent si disponible, sinon valeur
        if (m.hasOwnProperty('estPresent')) {
          return m.estPresent === true;
        }
        
        return m.valeur === true;
      }).length;
    }, 0);
  };

  // Fonction pour vérifier si l'utilisateur a fait au moins une vérification
  const hasUserMadeAnyVerification = (): boolean => {
    return etat.some(section => hasSectionBeenModifiedByUser(section));
  };

  const hasSectionBeenModifiedByUser = (section: Section): boolean => {
    const materielsList = flattenMateriels(section);
    return materielsList.some(item => {
      const m = item.materiel;
      const original = vehicule.sections.find(s => s.id === section.id);
      if (!original) return true;
      
      const originalMaterielsList = flattenMateriels(original);
      const originalMateriel = originalMaterielsList.find(orig => orig.materiel.id === m.id)?.materiel;
      if (!originalMateriel) return true;
      
      // Vérifier si quelque chose a été modifié par rapport à l'état original
      return m.estPresent !== originalMateriel.estPresent ||
             m.fonctionne !== originalMateriel.fonctionne ||
             m.valeur !== originalMateriel.valeur ||
             m.quantiteReelle !== originalMateriel.quantiteReelle ||
             ((m as any).estVerifie === true) ||
             m.bonEtat !== originalMateriel.bonEtat ||
             m.repare !== originalMateriel.repare ||
             m.pasDeChangement !== originalMateriel.pasDeChangement ||
             (m.photos && m.photos.length > 0) ||
             (m.observation && m.observation !== originalMateriel.observation);
    });
  };

  // Fonction pour vérifier si une section a des défauts
  const sectionHasDefauts = (section: Section): boolean => {
    const materielsList = flattenMateriels(section);
    return materielsList.some(item => {
      const m = item.materiel;
      // Logique spéciale pour voyant tableau de bord
      if ((m as any).type === 'radio') {
        return m.valeur === true;
      }
      // Pour les photos : défaut si ni bon état, ni réparé, ni pas de changement
      if (m.type === 'photo') {
        return !m.bonEtat && !m.repare && !m.pasDeChangement;
      }
      // Pour checkbox-fonction : défaut si absent OU ne fonctionne pas
      if (m.type === 'checkbox-fonction') {
        return !m.estPresent || !m.fonctionne;
      }
      // Pour presence-teste : défaut si non vérifié, "ok" compte comme info (non testé)
      if (m.type === 'presence-teste') {
        return !m.valeur || m.valeur === '' || m.valeur === 'ok';
      }
      // Pour les matériels qui n'ont QUE "fonctionne"
      if (m.hasOwnProperty('fonctionne') && !m.hasOwnProperty('estPresent')) {
        return m.fonctionne === false;
      }
      // Legacy : matériels avec estPresent ET fonctionne
      if (m.hasOwnProperty('fonctionne') && m.hasOwnProperty('estPresent') && !m.type) {
        return !m.estPresent || !m.fonctionne;
      }
      // Pour les matériels normaux
      if (m.hasOwnProperty('estPresent')) {
        return m.estPresent === false;
      }
      return m.valeur === false;
    });
  };

  // Fonction pour obtenir l'icône et la couleur selon l'état de la section
  const getSectionStatus = (section: Section, idx: number) => {
    if (idx > sectionIdx) return null; // Section non encore visitée
    
    const materielsList = flattenMateriels(section);
    
    const allItemsCompleted = materielsList.every(item => {
      const m = item.materiel;
      let completed = false;
      
      if (m.type === 'quantite') {
        const isVerified = m.estPresent ?? false;
        completed = isVerified;
      } else if (m.type === 'select') {
        completed = (m.valeur ?? '') !== '';
      } else if (m.type === 'checkbox-ok') {
        completed = typeof m.valeur === 'boolean';
      } else if (m.type === 'presence-teste') {
        completed = m.valeur === 'ok' || m.valeur === 'teste';
      } else if (m.type === 'niveau') {
        completed = (m.valeur ?? '') !== '';
      } else if (m.type === 'etat' || m.type === 'statut-ternaire') {
        completed = (m.valeur ?? '') !== '';
      } else if (m.type === 'conformite') {
        completed = (m.valeur ?? '') !== '';
      } else if (m.type === 'date') {
        completed = (m.valeur ?? '') !== '';
      } else if (m.type === 'texte-libre') {
        completed = (m.valeur ?? '').trim() !== '';
      } else if (m.type === 'photo') {
        completed = !!(m.bonEtat || m.repare || m.pasDeChangement || (m.photos && m.photos.length > 0));
      } else if ((m as any).type === 'radio') {
        // Pour les matériels radio : complété si une valeur a été sélectionnée
        completed = m.valeur === false || m.valeur === true;
      } else if (m.hasOwnProperty('fonctionne') && !m.hasOwnProperty('estPresent')) {
        // Pour les matériels qui n'ont QUE "fonctionne"
        completed = typeof m.fonctionne === 'boolean';
      } else if (m.hasOwnProperty('estPresent')) {
        // Pour les matériels normaux
        completed = typeof m.estPresent === 'boolean';
      } else {
        completed = typeof m.valeur === 'boolean';
      }
      
      return completed;
    });
    
    // Compter les éléments qui ont été traités (complétés ou non)
    const processedItems = materielsList.filter(item => {
      const m = item.materiel;
      if (m.type === 'quantite') {
        // Traité si estPresent a été explicitement défini à true
        return m.estPresent === true;
      } else if (m.type === 'select') {
        return (m.valeur ?? '') !== '';
      } else if (m.type === 'checkbox-ok') {
        return typeof m.valeur === 'boolean';
      } else if (m.type === 'presence-teste') {
        return m.valeur === 'ok' || m.valeur === 'teste';
      } else if (m.type === 'niveau') {
        return (m.valeur ?? '') !== '';
      } else if (m.type === 'etat' || m.type === 'statut-ternaire') {
        return (m.valeur ?? '') !== '';
      } else if (m.type === 'conformite') {
        return (m.valeur ?? '') !== '';
      } else if (m.type === 'date') {
        return (m.valeur ?? '') !== '';
      } else if (m.type === 'texte-libre') {
        return (m.valeur ?? '').trim() !== '';
      } else if (m.type === 'photo') {
        return !!(m.bonEtat || m.repare || m.pasDeChangement || (m.photos && m.photos.length > 0));
      } else if ((m as any).type === 'radio') {
        // Traité si une valeur a été explicitement sélectionnée (peu importe estPresent)
        return m.valeur === false || m.valeur === true;
      } else if (m.hasOwnProperty('fonctionne') && !m.hasOwnProperty('estPresent')) {
        // Traité si fonctionne a été explicitement défini à true
        return m.fonctionne === true;
      } else if (m.hasOwnProperty('estPresent')) {
        // Traité si estPresent a été explicitement défini à true
        return m.estPresent === true;
      } else {
        // Traité si valeur a été explicitement définie à true
        return m.valeur === true;
      }
    }).length;
    
    if (allItemsCompleted) {
      // Si tous les items sont complétés, vérifier s'il y a des défauts
      const hasDefauts = sectionHasDefauts(section);
      if (hasDefauts) {
        return { icon: '⚠', className: 'tab-check-danger' };
      } else {
        return { icon: '✓', className: 'tab-check-complete' };
      }
    } else if (processedItems > 0) {
      // Si au moins quelques éléments sont traités, vérifier s'il y a des défauts
      const hasDefauts = sectionHasDefauts(section);
      if (hasDefauts) {
        return { icon: '⚠', className: 'tab-check-danger' };
      } else {
        return { icon: '○', className: 'tab-check-empty' };
      }
    } else if (idx < sectionIdx) {
      return { icon: '○', className: 'tab-check-empty' };
    }
    return null;
  };

  // UseEffect pour scroll automatique lors des changements de section
  useEffect(() => {

    
    const scrollToTopElement = () => {
      // Chercher l'élément titre en haut de la page
      const titleElement = document.querySelector('h2');
      if (titleElement) {

        titleElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
        
        // Sécurité avec scroll manuel
        setTimeout(() => {
          window.scrollTo(0, 0);

        }, 300);
      } else {

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
        {/* Header avec titre et bouton accueil */}
        <div className="inventaire-header">
          <h2 style={{textAlign: 'center', color: '#1a237e', margin: '1.2rem 0 0.5rem 0'}}>{vehicule.nom}</h2>
          
          <div className="btn-accueil-container">
            <button 
              onClick={() => {
                if (window.confirm('⚠️ Êtes-vous sûr de vouloir retourner à l\'accueil ?\n\nLes modifications non sauvegardées seront perdues.')) {
                  if (onReturnHome) {
                    onReturnHome();
                  }
                }
              }} 
              className="btn-accueil-header"
              title="Retourner à l'accueil"
            >
              <span className="btn-icon">🏠</span>
              <span className="btn-text">Accueil</span>
            </button>
          </div>
        </div>
        
        <div className="inventaire-container">
          {/* Formulaire de résumé */}
          <form onSubmit={handleSubmit} className="final-form" autoComplete="off">
            <div className="form-summary">
              <h3>📋 Résumé de l'inventaire</h3>
              <div className="summary-stats">
                <div className="stat-item alert">
                  <span className="stat-label">⚠️ Défauts ou manquants:</span>
                  <span className="stat-value">{getDefauts(etat).length}</span>
                </div>
              </div>
              {getDefauts(etat).length > 0 && (
                <div className="summary-defauts-list">
                  {getDefauts(etat).map((defaut, idx) => (
                    <div key={idx} className="summary-defaut-item">
                      <div className="summary-defaut-icon">
                        {defaut.present === false ? '❌' : (defaut.fonctionne === false ? '🔧' : '⚠️')}
                      </div>
                      <div className="summary-defaut-info">
                        <span className="summary-defaut-nom">{defaut.nom}</span>
                        {defaut.details && (
                          <span className="summary-defaut-detail">{defaut.details}</span>
                        )}
                        <span className="summary-defaut-chemin">{defaut.chemin}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">
                <span className="label-text">👤 Nom de l'agent :</span>
                <div className="autocomplete-wrapper" ref={suggestionsRef}>
                  <input 
                    type="text" 
                    value={agent} 
                    onChange={(e) => {
                      setAgent(e.target.value);
                      setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    className="form-input"
                    placeholder="Votre nom"
                    required
                    autoComplete="off"
                    title="Veuillez saisir votre nom"
                    onInvalid={(e) => {
                      e.currentTarget.setCustomValidity('Veuillez saisir votre nom');
                    }}
                    onInput={(e) => {
                      e.currentTarget.setCustomValidity('');
                    }}
                  />
                  {showSuggestions && filteredUsers.length > 0 && (
                    <div className="autocomplete-dropdown">
                      {filteredUsers.map(user => (
                        <button
                          key={user.id}
                          type="button"
                          className={`autocomplete-item${agent === user.name ? ' selected' : ''}`}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setAgent(user.name);
                            setShowSuggestions(false);
                          }}
                        >
                          {user.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </label>
            </div>

            <div className="form-group">
              <label className="form-label">
                <span className="label-text">🔑 Code PIN :</span>
                <input
                  type="password"
                  value={authenticatedUser ? '****' : pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="form-input"
                  placeholder="Votre code PIN"
                  id="pin-field"
                  required={!authenticatedUser}
                  readOnly={!!authenticatedUser}
                  title="Veuillez saisir votre code PIN"
                  onInvalid={(e) => {
                    e.currentTarget.setCustomValidity('Veuillez saisir votre code PIN');
                  }}
                  onInput={(e) => {
                    e.currentTarget.setCustomValidity('');
                  }}
                />
              </label>
              {authenticatedUser && (
                <small className="form-help" style={{ color: 'green' }}>
                  ✅ Authentification validée
                </small>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">
                <span className="label-text"> Observations :</span>
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
      {/* Header avec titre et bouton accueil */}
      <div className="inventaire-header">
        <h2 style={{textAlign: 'center', color: '#1a237e', margin: '1.2rem 0 0.5rem 0'}}>{vehicule.nom}</h2>
        
        <div className="btn-accueil-container">
          <button 
            onClick={() => {
              if (window.confirm('⚠️ Êtes-vous sûr de vouloir retourner à l\'accueil ?\n\nLes modifications non sauvegardées seront perdues.')) {
                if (onReturnHome) {
                  onReturnHome();
                }
              }
            }} 
            className="btn-accueil-header"
            title="Retourner à l'accueil"
          >
            <span className="btn-icon">🏠</span>
            <span className="btn-text">Accueil</span>
          </button>
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
                      <span className={`materiel-name ${materiel.defautPrecedent ? 'with-previous-defect' : ''}`}>
                        {materiel.nom}
                        {/* Indicateur de statut de réparation */}
                        {materiel.statutReparation === 'repare' && (
                          <span className="status-repare" title="Défaut réparé">✅</span>
                        )}
                      </span>
                      <div className="controls-enhanced">
                        <div className="controls-main">
                        {/* Logique spéciale pour matériels avec boutons radio */}
                        {materiel.type === 'radio' && materiel.hasOwnProperty('estPresent') && (
                          <div className="radio-group">
                            <label className={`control-radio ${materiel.defautPrecedent ? 'disabled' : ''}`}>
                              <input 
                                type="radio" 
                                name={`voyant_${materiel.id}_${item.materielIdx}`}
                                checked={materiel.valeur === false} 
                                disabled={materiel.defautPrecedent}
                                onChange={() => path && !materiel.defautPrecedent && updateMaterielValeur(path, item.materielIdx, false)} 
                              />
                              <span className="radio-label">{materiel.options?.[0] || 'RAS'}</span>
                            </label>
                            <label className="control-radio">
                              <input 
                                type="radio" 
                                name={`voyant_${materiel.id}_${item.materielIdx}`}
                                checked={materiel.valeur === true} 
                                onChange={() => path && updateMaterielValeur(path, item.materielIdx, true)} 
                              />
                              <span className="radio-label">{materiel.options?.[1] || 'Défaut'}</span>
                            </label>
                          </div>
                        )}
                        
                        {/* Options de réparation pour défaut précédent des matériels radio */}
                        {materiel.type === 'radio' && materiel.defautPrecedent && (
                          <div className="defect-repair-options">
                            <span className="repair-label">Défaut précédent:</span>
                            {materiel.observationPrecedente && (
                              <div className="previous-observation">
                                <span className="observation-label">Observation précédente :</span>
                                <span className="observation-text">{materiel.observationPrecedente}</span>
                              </div>
                            )}
                            <div className="repair-radio-group">
                              <label className="control-radio">
                                <input 
                                  type="radio" 
                                  name={`repair_${materiel.id}_${item.materielIdx}`}
                                  checked={materiel.repare === true}
                                  onChange={() => path && updateMaterielPhotoFields(path, item.materielIdx, { repare: true, pasDeChangement: false, nouveauDefaut: false })}
                                />
                                <span className="radio-label">Réparé</span>
                              </label>
                              <label className="control-radio">
                                <input 
                                  type="radio" 
                                  name={`repair_${materiel.id}_${item.materielIdx}`}
                                  checked={materiel.pasDeChangement === true}
                                  onChange={() => path && updateMaterielPhotoFields(path, item.materielIdx, { pasDeChangement: true, repare: false, nouveauDefaut: false })}
                                />
                                <span className="radio-label">Pas de changement</span>
                              </label>
                              <label className="control-radio">
                                <input 
                                  type="radio" 
                                  name={`repair_${materiel.id}_${item.materielIdx}`}
                                  checked={materiel.nouveauDefaut === true}
                                  onChange={() => path && updateMaterielPhotoFields(path, item.materielIdx, { nouveauDefaut: true, repare: false, pasDeChangement: false })}
                                />
                                <span className="radio-label">Nouveau</span>
                              </label>
                            </div>
                            
                            {/* Champ observation pour nouveau défaut */}
                            {materiel.nouveauDefaut === true && (
                              <div className="observation-field">
                                <label className="observation-label">Nouvelle observation :</label>
                                <textarea
                                  value={materiel.observation || ''}
                                  onChange={(e) => path && updateMaterielPhotoFields(path, item.materielIdx, { observation: e.target.value })}
                                  className="observation-textarea"
                                  placeholder="Décrivez le nouveau défaut observé..."
                                  rows={2}
                                />
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Champ observation pour les matériels radio avec défaut MAIS sans défaut précédent */}
                        {materiel.type === 'radio' && materiel.valeur === true && !materiel.defautPrecedent && (
                          <div className="observation-field">
                            <label className="observation-label">Observation :</label>
                            <textarea
                              value={materiel.observation || ''}
                              onChange={(e) => path && updateMaterielPhotoFields(path, item.materielIdx, { observation: e.target.value })}
                              className="observation-textarea"
                              placeholder="Décrivez le défaut observé..."
                              rows={2}
                            />
                          </div>
                        )}
                        {/* Afficher "OK" pour les matériels avec checkbox */}
                        {(materiel.type === 'checkbox-presence' || materiel.type === 'checkbox-fonction' || materiel.type === 'checkbox' || (!materiel.type && materiel.hasOwnProperty('estPresent'))) && !(materiel.type as any === 'radio') && (
                          <label className="control-checkbox">
                            <input 
                              type="checkbox" 
                              checked={materiel.valeur ?? materiel.estPresent ?? false} 
                              onChange={() => path && updateMaterielValeur(path, item.materielIdx, !(materiel.valeur ?? materiel.estPresent ?? false))} 
                            />
                            <span className="checkbox-label">OK</span>
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
                        
                        {/* Case à cocher simple "OK" */}
                        {materiel.type === 'checkbox-ok' && (
                          <label className="control-checkbox">
                            <input 
                              type="checkbox" 
                              checked={!!materiel.valeur} 
                              onChange={() => path && updateMaterielValeur(path, item.materielIdx, !materiel.valeur)} 
                            />
                            <span className="checkbox-label">OK</span>
                          </label>
                        )}
                        
                        {/* Présence + Testé : 3 boutons OK / Testé */}
                        {materiel.type === 'presence-teste' && (
                          <div className="control-presence-teste">
                            <button
                              type="button"
                              className={`btn-presence-teste ${materiel.valeur === 'ok' ? 'active-ok' : ''}`}
                              onClick={() => path && updateMaterielValeur(path, item.materielIdx, materiel.valeur === 'ok' ? '' : 'ok')}
                              title="Présent (non testé en fonctionnement)"
                            >
                              ✓ OK
                            </button>
                            <button
                              type="button"
                              className={`btn-presence-teste ${materiel.valeur === 'teste' ? 'active-teste' : ''}`}
                              onClick={() => path && updateMaterielValeur(path, item.materielIdx, materiel.valeur === 'teste' ? '' : 'teste')}
                              title="Présent ET testé en fonctionnement"
                            >
                              ⚡ Testé
                            </button>
                          </div>
                        )}
                        
                        {/* Sélecteur pour niveau (Plein/Moyen/Bas/Vide) */}
                        {materiel.type === 'niveau' && (
                          <label className="control-select">
                            <span className="select-label">Niveau</span>
                            <select 
                              value={materiel.valeur || 'Plein'} 
                              onChange={e => path && updateMaterielValeur(path, item.materielIdx, e.target.value)} 
                              className="select-input"
                            >
                              {materiel.options?.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          </label>
                        )}
                        
                        {/* Sélecteur pour état (Bon/Moyen/Mauvais) */}
                        {materiel.type === 'etat' && (
                          <label className="control-select">
                            <span className="select-label">État</span>
                            <select 
                              value={materiel.valeur || 'Bon'} 
                              onChange={e => path && updateMaterielValeur(path, item.materielIdx, e.target.value)} 
                              className="select-input"
                            >
                              {materiel.options?.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          </label>
                        )}
                        
                        {/* Sélecteur pour statut ternaire (Bon/Moyen/Mauvais) */}
                        {materiel.type === 'statut-ternaire' && (
                          <label className="control-select">
                            <span className="select-label">Statut</span>
                            <select 
                              value={materiel.valeur || 'Bon'} 
                              onChange={e => path && updateMaterielValeur(path, item.materielIdx, e.target.value)} 
                              className="select-input"
                            >
                              {materiel.options?.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          </label>
                        )}
                        
                        {/* Sélecteur pour conformité (Conforme/Non conforme) */}
                        {materiel.type === 'conformite' && (
                          <label className="control-select">
                            <span className="select-label">Conformité</span>
                            <select 
                              value={materiel.valeur || 'Conforme'} 
                              onChange={e => path && updateMaterielValeur(path, item.materielIdx, e.target.value)} 
                              className="select-input"
                            >
                              {materiel.options?.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          </label>
                        )}
                        
                        {/* Sélecteur de date */}
                        {materiel.type === 'date' && (
                          <label className="control-date">
                            <span className="date-label">Date</span>
                            <input 
                              type="date" 
                              value={materiel.valeur || ''} 
                              onChange={e => path && updateMaterielValeur(path, item.materielIdx, e.target.value)} 
                              className="date-input"
                            />
                          </label>
                        )}
                        
                        {/* Champ texte libre */}
                        {materiel.type === 'texte-libre' && (
                          <label className="control-text">
                            <span className="text-label">Texte</span>
                            <input 
                              type="text" 
                              value={materiel.valeur || ''} 
                              placeholder="Saisir..."
                              onChange={e => path && updateMaterielValeur(path, item.materielIdx, e.target.value)} 
                              className="text-input"
                            />
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
                        {/* Afficher "Fonctionne" seulement pour checkbox-fonction et checkbox (legacy) */}
                        {(materiel.type === 'checkbox-fonction' || materiel.type === 'checkbox' || (!materiel.type && materiel.hasOwnProperty('fonctionne'))) && (
                          <label className="control-checkbox">
                            <input 
                              type="checkbox" 
                              checked={materiel.fonctionne ?? false} 
                              onChange={() => path && updateSection(path, item.materielIdx, 'fonctionne')} 
                            />
                            <span className="checkbox-label">Fonctionne</span>
                          </label>
                        )}
                        </div>
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
                            if (materiel.pasDeChangement) return 'status-ok'; // Défaut persistant = validé
                            if (materiel.photos && materiel.photos.length > 0) return 'status-warning'; // Problème documenté
                            if (materiel.photosAnciennes && materiel.photosAnciennes.length > 0) return 'status-pending'; // À vérifier
                            return 'status-empty';
                          } else {
                            // Logique spéciale pour matériels radio
                            if ((materiel as any).type === 'radio') {
                              // Validé seulement si l'utilisateur a fait un choix explicite
                              if (materiel.valeur !== undefined && materiel.valeur !== null) {
                                return materiel.valeur ? 'status-warning' : 'status-ok'; // Warning si voyants allumés, OK si RAS
                              }
                              return 'status-empty'; // Pas encore vérifié
                            }
                            
                            // Logique normale pour les autres matériels
                            if (materiel.hasOwnProperty('fonctionne') && !materiel.hasOwnProperty('estPresent')) {
                              // Matériels qui n'ont que "fonctionne" (comme Klaxon)
                              return materiel.fonctionne ? 'status-ok' : 'status-empty';
                            } else if (materiel.hasOwnProperty('estPresent')) {
                              const isPresent = materiel.estPresent ?? false;
                              const isFunctional = materiel.fonctionne ?? true;
                              if (isPresent && isFunctional) return 'status-ok';
                              if (isPresent && !isFunctional) return 'status-warning';
                              return 'status-empty';
                            } else {
                              const isPresent = materiel.valeur ?? false;
                              const isFunctional = materiel.fonctionne ?? true;
                              if (isPresent && isFunctional) return 'status-ok';
                              if (isPresent && !isFunctional) return 'status-warning';
                              return 'status-empty';
                            }
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
                              // Logique spéciale pour matériels radio  
                              if ((materiel as any).type === 'radio') {
                                // Affiché seulement si l'utilisateur a fait un choix explicite
                                if (materiel.valeur !== undefined && materiel.valeur !== null) {
                                  return materiel.valeur ? '⚠️' : '✓'; // Warning si voyants allumés, OK si RAS
                                }
                                return '○'; // Pas encore vérifié
                              }
                              
                              // Logique normale pour les autres matériels
                              if (materiel.hasOwnProperty('fonctionne') && !materiel.hasOwnProperty('estPresent')) {
                                // Matériels qui n'ont que "fonctionne" (comme Klaxon)
                                return materiel.fonctionne ? '✓' : '○';
                              } else if (materiel.hasOwnProperty('estPresent')) {
                                const isPresent = materiel.estPresent ?? false;
                                const isFunctional = materiel.fonctionne ?? true;
                                if (isPresent && isFunctional) return '✓';
                                if (isPresent && !isFunctional) return '⚠️';
                                return '○';
                              } else {
                                const isPresent = materiel.valeur ?? false;
                                const isFunctional = materiel.fonctionne ?? true;
                                if (isPresent && isFunctional) return '✓';
                                if (isPresent && !isFunctional) return '⚠️';
                                return '○';
                              }
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


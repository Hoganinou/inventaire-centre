import type { Vehicule } from '../inventaire';

const exemple: Vehicule = {
  id: 'EXEMPLE',
  nom: 'Véhicule Exemple',
  sections: [
    {
      id: 'cabine',
      nom: 'Cabine',
      materiels: [
        { id: 'radio', nom: 'Radio', estPresent: false },
        { id: 'ceintures', nom: 'Ceintures de sécurité', estPresent: false },
        { id: 'lampe', nom: 'Lampe torche', type: 'checkbox', estPresent: false, fonctionne: false },
        { id: 'extincteur', nom: 'Extincteur', type: 'select', options: ['OK', 'À remplacer'], valeur: '' },
        { id: 'gants', nom: 'Gants', type: 'quantite', valeur: 0 },
      ],
    },
    {
      id: 'coffre',
      nom: 'Coffre',
      sousSections: [
        {
          id: 'outils',
          nom: 'Outils',
          materiels: [
            { id: 'pelle', nom: 'Pelle', estPresent: false },
            { id: 'balai', nom: 'Balai', estPresent: false },
          ],
        },
        {
          id: 'secours',
          nom: 'Matériel de secours',
          materiels: [
            { id: 'trousse', nom: 'Trousse de secours', estPresent: false },
            { id: 'masques', nom: 'Masques', type: 'quantite', valeur: 0 },
          ],
        },
      ],
    },
  ],
};

export default exemple;

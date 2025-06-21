import type { Vehicule } from '../inventaire';

const vsav1: Vehicule = {
  id: 'VSAV1', // Correction ici pour correspondre à la clé
  nom: 'VSAV 1',
  sections: [
    {
      id: 'cabine',
      nom: 'Cabine',
      materiels: [
        { id: 'essence', nom: "Plein d'essence", type: 'select', options: ['Plein', ' Sup Moitié'], valeur: '', estPresent: undefined },
        { id: 'radio', nom: 'Radio', type: 'checkbox', fonctionne: false },
        { id: 'lampe', nom: 'Lampe torche', type: 'checkbox', estPresent: false, fonctionne: false },
        { id: 'extincteur', nom: 'Extincteur', estPresent: false },
        { id: 'gants', nom: 'Gants M', estPresent: false },
        { id: 'gants', nom: 'Gants L', estPresent: false },
        { id: 'gants', nom: 'Gants XL', estPresent: false },
        { id: 'GHV', nom: '4 GHV', estPresent: false },

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

export default vsav1;

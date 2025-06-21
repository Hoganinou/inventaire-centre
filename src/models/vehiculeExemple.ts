import type { Vehicule } from '../models/inventaire';

// Exemple de données pour un véhicule
const vehiculeExemple: Vehicule = {
  id: 'V1',
  nom: 'VSAV 1',
  sections: [
    {
      id: 'cabine',
      nom: 'Cabine',
      materiels: [
        { id: 'essence', nom: "Plein d'essence", type: 'select', options: ['Plein', 'Moitié'], valeur: '', estPresent: undefined },
        { id: 'radio', nom: 'Radio', estPresent: false },
        { id: 'ceintures', nom: 'Ceintures de sécurité', estPresent: false },
        { id: 'tableau', nom: 'Tableau de bord', estPresent: false },
        { id: 'clim', nom: 'Climatisation', estPresent: false },
        { id: 'gps', nom: 'GPS', estPresent: false },
        { id: 'lampe', nom: 'Lampe torche', estPresent: false },
        { id: 'trousse', nom: 'Trousse premiers secours', estPresent: false },
        { id: 'compresse', nom: 'Compresses', type: 'quantite', valeur: 0 },
      ],
    },
    {
      id: 'coffre-arriere-droit',
      nom: 'Coffre arrière droit',
      materiels: [
        { id: 'cones', nom: 'Cônes', estPresent: false },
        { id: 'haligan', nom: 'Haligan', estPresent: false },
        { id: 'extincteur', nom: 'Extincteur', estPresent: false },
        { id: 'pelle', nom: 'Pelle', estPresent: false },
        { id: 'balai', nom: 'Balai', estPresent: false },
        { id: 'seau', nom: 'Seau', estPresent: false },
        { id: 'corde', nom: 'Corde', estPresent: false },
        { id: 'gants', nom: 'Gants de protection', estPresent: false },
      ],
    },
    {
      id: 'coffre-avant-droit',
      nom: 'Coffre avant droit',
      sousSections: [
        {
          id: 'sac',
          nom: 'SAC',
          sousSections: [
            {
              id: 'partie-milieu',
              nom: 'Partie milieu',
              sousSections: [
                {
                  id: 'pochette-rouge',
                  nom: 'Pochette rouge',
                  materiels: [
                    { id: 'pansements', nom: '3 Pansement', estPresent: false },
                    { id: 'compresse', nom: 'Compresse', type: 'quantite', valeur: 0 },
                    { id: 'sparadrap', nom: 'Sparadrap', estPresent: false },
                    { id: 'bandage', nom: 'Bandage', estPresent: false },
                    { id: 'gants-nitri', nom: 'Gants nitrile', estPresent: false },
                  ],
                },
              ],
            },
            {
              id: 'partie-gauche',
              nom: 'Partie gauche',
              materiels: [
                { id: 'bouteille-oxygene', nom: 'Bouteille d’oxygène', estPresent: false },
                { id: 'masque', nom: 'Masque O2', estPresent: false },
                { id: 'tuyau', nom: 'Tuyau O2', estPresent: false },
                { id: 'valve', nom: 'Valve', estPresent: false },
              ],
            },
            {
              id: 'partie-droite',
              nom: 'Partie droite',
              materiels: [
                { id: 'ciseau', nom: 'Ciseau', estPresent: false },
                { id: 'pince', nom: 'Pince', estPresent: false },
                { id: 'seringue', nom: 'Seringue', estPresent: false },
                { id: 'garrot', nom: 'Garrot', estPresent: false },
              ],
            },
          ],
        },
      ],
    },
  ],
};

export default vehiculeExemple;

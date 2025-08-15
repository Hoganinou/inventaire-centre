import type { Vehicule } from '../inventaire';

const vsav1: Vehicule = {
  id: 'VSAV1',
  nom: 'VSAV 1',
  sections: [
    {
      id: 'cabine',
      nom: 'Cabine',
      sousSections: [
        {
          id: 'poste_conducteur',
          nom: 'Poste conducteur',
          materiels: [
            { id: 'essence', nom: 'Essence', type: 'select', options: ['Plein', 'Sup moitié'], valeur: '', estPresent: undefined },
            { id: 'adblue', nom: 'AD Blue', type: 'select', options: ['Plein', 'Sup moitié', 'Aucun'], valeur: '', estPresent: undefined },
            { id: 'radio', nom: 'Radio', type: 'checkbox', estPresent: false, fonctionne: false },
            { id: 'klaxon', nom: 'Klaxon', type: 'checkbox', estPresent: false, fonctionne: false },
            { id: 'phare', nom: 'Phare', type: 'checkbox', estPresent: false, fonctionne: false },
            { id: 'gyrophare', nom: 'Gyrophare', type: 'checkbox', estPresent: false, fonctionne: false },
            { id: 'pneu', nom: 'État pneu', type: 'select', options: ['Correct'], valeur: '', estPresent: undefined },
            { id: 'carrosserie', nom: 'État carrosserie', type: 'select', options: ['Correct'], valeur: '', estPresent: undefined },
            { id: 'extincteur', nom: 'Extincteur', type: 'checkbox', estPresent: false },
            { id: 'ofd', nom: 'OFD', type: 'checkbox', estPresent: false },
            { id: 'cric', nom: 'CRIC', type: 'checkbox', estPresent: false },
            { id: 'pochette_accident', nom: 'Pochette accident', type: 'checkbox', estPresent: false },
            { id: 'ghv', nom: 'GHV', type: 'quantite', valeur: 4, estPresent: false },
            { id: 'gants_m', nom: 'Gants Taille M', type: 'checkbox', estPresent: false },
            { id: 'gants_l', nom: 'Gants Taille L', type: 'checkbox', estPresent: false },
            { id: 'gants_xl', nom: 'Gants Taille XL', type: 'checkbox', estPresent: false },
            { id: 'sha', nom: 'SHA', type: 'checkbox', estPresent: false },
            { id: 'parcellaire', nom: 'Parcellaire', type: 'checkbox', estPresent: false },
          ],
        },
        {
          id: 'boite_a_gant',
          nom: 'Boîte à gant',
          materiels: [
            { id: 'ciseau', nom: 'Ciseau', type: 'checkbox', estPresent: false },
            { id: 'cle_autoroute', nom: 'Clé autoroute', type: 'checkbox', estPresent: false },
            { id: 'cle_m6_m8', nom: 'Clé M6 et M8', type: 'checkbox', estPresent: false },
          ],
        },
      ],
    },
    {
      id: 'coffre_avant_droit',
      nom: 'Coffre avant droit',
      sousSections: [
        {
          id: 'sac_premier_secours',
          nom: 'SAC Premier secours',
          sousSections: [
            {
              id: 'poche_central',
              nom: 'Poche central',
              materiels: [
                { id: 'bouteille_oxygene', nom: 'Bouteille d\'oxygène (supérieur à 50 B)', type: 'checkbox', estPresent: false },
                { id: 'aspirateur_manuel', nom: 'Aspirateur manuel', type: 'checkbox', estPresent: false },
              ],
            },
            {
              id: 'poche_gauche',
              nom: 'Poche Gauche',
              sousSections: [
                {
                  id: 'pochette_verte',
                  nom: 'Pochette verte',
                  materiels: [
                    { id: 'masque_hc_adulte', nom: 'Masque HC adulte', type: 'quantite', valeur: 2, estPresent: false },
                    { id: 'masque_hc_pedia', nom: 'Masque HC pédia', type: 'quantite', valeur: 1, estPresent: false },
                  ],
                },
                {
                  id: 'pochette_rouge',
                  nom: 'Pochette Rouge',
                  materiels: [
                    { id: 'compresse', nom: 'Compresse', type: 'quantite', valeur: 10, estPresent: false },
                    { id: 'ciseau_rouge', nom: 'Ciseau', type: 'checkbox', estPresent: false },
                    { id: 'garrot', nom: 'Garrot', type: 'checkbox', estPresent: false },
                    { id: 'bande_15cm', nom: 'Bande 15cm', type: 'quantite', valeur: 1, estPresent: false },
                    { id: 'bande_10cm', nom: 'Bande 10cm', type: 'quantite', valeur: 2, estPresent: false },
                    { id: 'bande_5cm', nom: 'Bande 5 cm', type: 'quantite', valeur: 2, estPresent: false },
                    { id: 'couverture_iso', nom: 'Couverture ISO', type: 'quantite', valeur: 2, estPresent: false },
                    { id: 'echarpes', nom: 'Écharpes', type: 'quantite', valeur: 2, estPresent: false },
                    { id: 'sparadra', nom: 'Sparadra', type: 'quantite', valeur: 2, estPresent: false },
                    { id: 'dakin', nom: 'Dakin', type: 'quantite', valeur: 1, estPresent: false },
                  ],
                },
              ],
            },
            {
              id: 'poche_droite',
              nom: 'Poche droite',
              sousSections: [
                {
                  id: 'pochette_bleu',
                  nom: 'Pochette Bleu',
                  materiels: [
                    { id: '4_brin', nom: '4 brin', type: 'checkbox', estPresent: false },
                    { id: '6_brin', nom: '6 brin', type: 'checkbox', estPresent: false },
                    { id: 'capteur_ecg', nom: 'Capteur ECG', type: 'quantite', valeur: 20, estPresent: false },
                    { id: 'thermometre', nom: 'Thermomètre', type: 'checkbox', estPresent: false, fonctionne: false },
                    { id: 'dextro', nom: 'Dextro (5 bandelettes - 5 autopiqueurs)', type: 'checkbox', estPresent: false, fonctionne: false },
                  ],
                },
                {
                  id: 'pochette_noir',
                  nom: 'Pochette noir',
                  materiels: [
                    { id: 'tensiomette_manuel', nom: 'Tensiomètre manuel', type: 'checkbox', estPresent: false },
                  ],
                },
              ],
            },
          ],
        },
        {
          id: 'materiel_transport',
          nom: 'Matériel de transport',
          materiels: [
            { id: 'mid', nom: 'MID (présent et drap)', type: 'checkbox', estPresent: false },
            { id: 'pompe', nom: 'Pompe', type: 'checkbox', estPresent: false },
            { id: 'brancard_cuillere', nom: 'Brancard cuillère', type: 'checkbox', estPresent: false },
            { id: 'chaise_portoir', nom: 'Chaise portoir', type: 'checkbox', estPresent: false },
            { id: 'portoir_souple', nom: 'Portoir souple', type: 'checkbox', estPresent: false },
          ],
        },
      ],
    },
  ],
};

export default vsav1;

import type { Vehicule } from '../inventaire';
import exemple from './exemple';
import vsav_1 from './vsav_1';
// import vsav2 from './vsav2';
// ...

export const vehicules: Record<string, Vehicule> = {
  EXEMPLE: exemple,
  VSAV1: vsav_1,
  // VSAV2: vsav2,
  // ...
};

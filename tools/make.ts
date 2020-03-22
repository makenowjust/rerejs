import { makeLegacy } from './make-legacy';
import { makeUnicode } from './make-unicode';

const make = async (): Promise<void> => {
  await Promise.all([makeLegacy(), makeUnicode()]);
};

make().catch((err) => console.error(err));

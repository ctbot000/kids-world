// A beast's model by its kind (shared/beasts.js).
import { HawkModel, MimicModel, RattleModel, StingerModel, WolfModel } from './beast-models.js';
import { CyclopsModel, HydraModel, OakModel, RexModel, WizardModel } from './beast-models-big.js';
import { GoldMimicModel } from './gold-mimic-model.js';

const MODELS = { rattle: RattleModel, stinger: StingerModel, wolf: WolfModel, hawk: HawkModel, mimic: MimicModel, goldmimic: GoldMimicModel, oak: OakModel, wizard: WizardModel, hydra: HydraModel, cyclops: CyclopsModel, rex: RexModel };

export const makeBeast = (kind, theme) => new MODELS[kind](theme);

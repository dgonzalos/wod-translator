import { ohsPullupBoxjump } from './ohs-pullup-boxjump.js';
import { thrustersTtbRun } from './thrusters-ttb-run.js';
import { wallBallPullupDoubleunder } from './wall-ball-pullup-doubleunder.js';
import type { ExampleWod } from './example-wod.schema.js';

export const EXAMPLE_WODS: ExampleWod[] = [
  thrustersTtbRun,
  wallBallPullupDoubleunder,
  ohsPullupBoxjump,
];

export { ExampleWodSchema } from './example-wod.schema.js';
export type { ExampleWod } from './example-wod.schema.js';

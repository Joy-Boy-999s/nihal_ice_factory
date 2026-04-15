import { nowHHMM, todayISO } from '../../../lib/date';
import { SaleForm } from '../model/types';

export const UNIT_OPTIONS = [
  { label: 'Unit 1', value: 'Unit 1' },
  { label: 'Unit 2', value: 'Unit 2' },
  { label: 'Unit 3', value: 'Unit 3' },
];

export const createInitialForm = (): SaleForm => ({
  date: todayISO(),
  time: nowHHMM(),
  unit: '',
  name: '',
  mobile: '',
  shop: '',
  cans: '0',
  blocks: '0',
  pieces: '0',
  discount: '0',
  soldBy: '',
});

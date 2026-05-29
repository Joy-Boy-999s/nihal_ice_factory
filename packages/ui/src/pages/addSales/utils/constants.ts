import { nowHHMM, todayISO } from '../../../lib/date';
import { SaleForm } from '../model/types';

export const createInitialForm = (): SaleForm => ({
  date:     todayISO(),
  time:     nowHHMM(),
  unit:     '',
  name:     '',
  mobile:   '',
  shop:     '',
  items:    [],
  discount: '0',
  soldBy:   '',
});

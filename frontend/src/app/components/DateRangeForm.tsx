import type React from 'react';
import type { DateRangeFormProps } from './DateRangeForm.types';
import { delayStyle } from '../utils';

export const DateRangeForm: React.FC<DateRangeFormProps> = ({
  from = '',
  to = '',
  animateDelay,
}) => {
  const style = animateDelay ? delayStyle(animateDelay) : undefined;

  return (
    <form
      className="range-form"
      method="get"
      data-animate={animateDelay ? true : undefined}
      style={style}
    >
      <label>
        From
        <input type="date" name="from" defaultValue={from} />
      </label>
      <label>
        To
        <input type="date" name="to" defaultValue={to} />
      </label>
      <button className="button" type="submit">
        Apply
      </button>
    </form>
  );
};

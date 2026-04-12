import React from 'react';

const DateTimePicker = React.forwardRef(({ children, ...props }: any, ref: any) =>
  React.createElement('div', { 'data-component': 'DateTimePicker', ref }, children),
);

export default DateTimePicker;

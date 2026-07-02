import { forwardRef, type ReactNode } from 'react';
import { TABLE_SCROLL_CLS } from '../layout/pageLayout';

type Props = {
  children: ReactNode;
  className?: string;
};

export const TableScrollContainer = forwardRef<HTMLDivElement, Props>(function TableScrollContainer(
  { children, className = TABLE_SCROLL_CLS },
  ref,
) {
  return (
    <div ref={ref} className={className} data-table-scroll>
      {children}
    </div>
  );
});

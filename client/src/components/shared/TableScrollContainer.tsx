import { forwardRef, type ReactNode, type UIEventHandler } from 'react';
import { TABLE_SCROLL_CLS } from '../layout/pageLayout';

type Props = {
  children: ReactNode;
  className?: string;
  onScroll?: UIEventHandler<HTMLDivElement>;
};

export const TableScrollContainer = forwardRef<HTMLDivElement, Props>(function TableScrollContainer(
  { children, className = TABLE_SCROLL_CLS, onScroll },
  ref,
) {
  return (
    <div ref={ref} className={className} data-table-scroll onScroll={onScroll}>
      {children}
    </div>
  );
});

import type { ReactNode } from 'react';
import { pageShellClass } from './pageLayout';

type Props = {
  children: ReactNode;
  embedded?: boolean;
  spacing?: 'tight' | 'default' | 'loose' | 'wide';
  className?: string;
};

export function PageContainer({ children, embedded = false, spacing = 'default', className = '' }: Props) {
  return (
    <div className={`${pageShellClass({ embedded, spacing })} ${className}`.trim()}>
      {children}
    </div>
  );
}

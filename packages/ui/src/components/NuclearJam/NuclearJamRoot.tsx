import { FC, ReactNode } from 'react';

import { cn } from '../../utils';

export type NuclearJamProps = {
  children: ReactNode;
  className?: string;
};

export const NuclearJamRoot: FC<NuclearJamProps> = ({
  children,
  className,
}) => (
  <div
    className={cn(
      'bg-background text-foreground flex h-dvh flex-col overflow-hidden pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]',
      className,
    )}
  >
    {children}
  </div>
);

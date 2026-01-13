import { createContext, useContext, useState, ReactNode } from 'react';

interface LayoutContextType {
  hideBottomNav: boolean;
  setHideBottomNav: (hide: boolean) => void;
  disableMainScroll: boolean;
  setDisableMainScroll: (disable: boolean) => void;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export const LayoutProvider = ({ children }: { children: ReactNode }) => {
  const [hideBottomNav, setHideBottomNav] = useState(false);
  const [disableMainScroll, setDisableMainScroll] = useState(false);

  return (
    <LayoutContext.Provider value={{ hideBottomNav, setHideBottomNav, disableMainScroll, setDisableMainScroll }}>
      {children}
    </LayoutContext.Provider>
  );
};

export const useLayout = () => {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error('useLayout must be used within a LayoutProvider');
  }
  return context;
};

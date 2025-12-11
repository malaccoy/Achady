import React from 'react';

interface MainContainerProps {
  children: React.ReactNode;
}

/**
 * MainContainer component that centralizes content with a max-width
 * and provides consistent padding for a premium SaaS look.
 */
export const MainContainer: React.FC<MainContainerProps> = ({ children }) => {
  return (
    <div className="main-container">
      {children}
    </div>
  );
};

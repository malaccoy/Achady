import React from 'react';

interface AccountSectionProps {
  userEmail: string;
  onLogout: () => void;
}

const DEFAULT_AVATAR_INITIAL = "A";

/**
 * Modern account pill component for the header
 * Shows user avatar (first letter), email, and logout button
 */
export const AccountSection: React.FC<AccountSectionProps> = ({ userEmail, onLogout }) => {
  const avatarInitial = userEmail ? userEmail.charAt(0).toUpperCase() : DEFAULT_AVATAR_INITIAL;
  
  return (
    <div className="account-pill">
      <div className="account-pill__avatar">
        {avatarInitial}
      </div>
      <div className="account-pill__info">
        <span className="account-pill__email">{userEmail}</span>
        <button
          type="button"
          className="account-pill__logout"
          onClick={onLogout}
        >
          Sair
        </button>
      </div>
    </div>
  );
};

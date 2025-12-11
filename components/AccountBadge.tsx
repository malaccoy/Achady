import React from 'react';
import { User, ChevronDown } from 'lucide-react';

interface AccountBadgeProps {
  email: string;
  onClick?: () => void;
}

/**
 * Modern account pill/badge component showing user email with icon
 * Designed with a light background, subtle border, and pill shape
 * Future-ready for dropdown menu support (multiple accounts)
 */
export const AccountBadge: React.FC<AccountBadgeProps> = ({ email, onClick }) => {
  return (
    <button
      onClick={onClick}
      className="account-badge"
      title={email}
    >
      <div className="account-badge__icon">
        <User />
      </div>
      <span className="account-badge__email">{email}</span>
      <ChevronDown className="account-badge__arrow" />
    </button>
  );
};

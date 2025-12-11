import React from 'react';

interface TagChipProps {
  label: string;
  onRemove: () => void;
}

export const TagChip: React.FC<TagChipProps> = ({ label, onRemove }) => {
  return (
    <span className="tag-chip">
      <span className="tag-chip__label">{label}</span>
      <button
        type="button"
        className="tag-chip__remove"
        onClick={onRemove}
        aria-label={`Remover ${label}`}
      >
        ×
      </button>
    </span>
  );
};

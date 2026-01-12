import React from 'react';
import { AlertTriangle, Home } from 'lucide-react';

interface FeatureDisabledProps {
  featureName?: string;
  onGoHome?: () => void;
}

export const FeatureDisabled: React.FC<FeatureDisabledProps> = ({
  featureName = 'This feature',
  onGoHome,
}) => {
  return (
    <main className="app-main">
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertTriangle className="w-16 h-16 text-amber-500 mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">
          {featureName} temporarily disabled
        </h2>
        <p className="text-slate-400 mb-6 max-w-md">
          {featureName} features are temporarily disabled. Please check back later.
        </p>
        {onGoHome && (
          <button
            onClick={onGoHome}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
          >
            <Home className="w-4 h-4" />
            Back to Status
          </button>
        )}
      </div>
    </main>
  );
};

import React, { useState, useEffect } from 'react';
import { Layout, MenuItemId } from './components/Layout';
import { StatusConnection } from './components/StatusConnection';
import { GroupManager } from './components/GroupManager';
import { AutomationControl } from './components/AutomationControl';
import { TemplateEditor } from './components/TemplateEditor';
import { LogsTable } from './components/LogsTable';
import { ShopeeApiConfig } from './components/ShopeeApiConfig';
import { Reports } from './components/Reports';
import { Auth } from './components/Auth';
import { getMe, logout } from './services/api';
import { LogOut, Loader2 } from 'lucide-react';

function App() {
  const [activeSection, setActiveSection] = useState<MenuItemId>("status");
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null); // null = loading
  const [user, setUser] = useState<{email: string} | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
      try {
          const u = await getMe();
          setUser(u);
          setIsAuthenticated(true);
      } catch (e) {
          setIsAuthenticated(false);
      }
  };

  const handleLogout = async () => {
      await logout();
      setIsAuthenticated(false);
      setUser(null);
  };

  const renderContent = () => {
    switch (activeSection) {
      case "status": return <StatusConnection />;
      case "groups": return <GroupManager />;
      case "automation": return <AutomationControl />;
      case "shopee": return <ShopeeApiConfig />;
      case "template": return <TemplateEditor />;
      case "logs": return <LogsTable />;
      case "reports": return <Reports />;
      default: return <StatusConnection />;
    }
  };

  if (isAuthenticated === null) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-[#0f172a] text-white">
              <Loader2 className="w-10 h-10 animate-spin text-orange-500" />
          </div>
      );
  }

  if (!isAuthenticated) {
      return <Auth onLogin={checkAuth} />;
  }

  return (
    <Layout activeSection={activeSection} onChangeSection={setActiveSection}>
        <div className="mb-4 flex justify-end">
            <button 
                onClick={handleLogout}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1 px-3 py-1 rounded bg-slate-900/50 border border-slate-800"
            >
                {user?.email} <LogOut className="w-3 h-3 ml-1" />
            </button>
        </div>
      {renderContent()}
    </Layout>
  );
}

export default App;
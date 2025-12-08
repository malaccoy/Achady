import React, { useState } from 'react';
import { Layout, MenuItemId } from './components/Layout';
import { StatusConnection } from './components/StatusConnection';
import { GroupManager } from './components/GroupManager';
import { AutomationControl } from './components/AutomationControl';
import { TemplateEditor } from './components/TemplateEditor';
import { LogsTable } from './components/LogsTable';
import { ShopeeApiConfig } from './components/ShopeeApiConfig';

function App() {
  const [activeSection, setActiveSection] = useState<MenuItemId>("status");

  const renderContent = () => {
    switch (activeSection) {
      case "status":
        return <StatusConnection />;
      case "groups":
        return <GroupManager />;
      case "automation":
        return <AutomationControl />;
      case "shopee":
        return <ShopeeApiConfig />;
      case "template":
        return <TemplateEditor />;
      case "logs":
        return <LogsTable />;
      default:
        return <StatusConnection />;
    }
  };

  return (
    <Layout activeSection={activeSection} onChangeSection={setActiveSection}>
      {renderContent()}
    </Layout>
  );
}

export default App;
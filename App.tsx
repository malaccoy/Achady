import React, { useState } from 'react';
import { Layout } from './components/Layout';
import { StatusConnection } from './components/StatusConnection';
import { GroupManager } from './components/GroupManager';
import { AutomationControl } from './components/AutomationControl';
import { TemplateEditor } from './components/TemplateEditor';
import { LogsTable } from './components/LogsTable';
import { Tab } from './types';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.STATUS);

  const renderContent = () => {
    switch (activeTab) {
      case Tab.STATUS:
        return <StatusConnection />;
      case Tab.GROUPS:
        return <GroupManager />;
      case Tab.AUTOMATION:
        return <AutomationControl />;
      case Tab.TEMPLATE:
        return <TemplateEditor />;
      case Tab.LOGS:
        return <LogsTable />;
      default:
        return <StatusConnection />;
    }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {renderContent()}
    </Layout>
  );
}

export default App;
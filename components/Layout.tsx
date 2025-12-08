import React from 'react';
import { Tab } from '../types';
import { LayoutDashboard, Users, Zap, MessageSquare, List, Menu, X } from 'lucide-react';

interface LayoutProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ activeTab, setActiveTab, children }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const menuItems = [
    { id: Tab.STATUS, label: 'Status & Conexão', icon: LayoutDashboard },
    { id: Tab.GROUPS, label: 'Grupos WhatsApp', icon: Users },
    { id: Tab.AUTOMATION, label: 'Automação', icon: Zap },
    { id: Tab.TEMPLATE, label: 'Modelo de Mensagem', icon: MessageSquare },
    { id: Tab.LOGS, label: 'Logs de Envio', icon: List },
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row font-sans text-slate-900">
      
      {/* Mobile Header */}
      <div className="md:hidden bg-white border-b border-slate-200 p-4 flex justify-between items-center sticky top-0 z-20">
        <h1 className="text-xl font-bold text-primary tracking-tight">ACHADY</h1>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-slate-600">
          {mobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-10 w-64 bg-slate-900 text-white transform transition-transform duration-200 ease-in-out
        md:relative md:translate-x-0
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 border-b border-slate-800">
            <h1 className="text-2xl font-black text-primary tracking-tighter">ACHADY</h1>
            <p className="text-xs text-slate-400 mt-1">Bot Automation Manager</p>
        </div>
        <nav className="p-4 space-y-1">
            {menuItems.map(item => (
                <button
                    key={item.id}
                    onClick={() => { setActiveTab(item.id); setMobileMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-md transition-all duration-200 ${activeTab === item.id ? 'bg-primary text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                >
                    <item.icon className="w-5 h-5" />
                    <span className="font-medium text-sm">{item.label}</span>
                </button>
            ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto h-[calc(100vh-65px)] md:h-screen">
        <div className="max-w-5xl mx-auto">
            <header className="mb-8">
                <h2 className="text-2xl font-bold text-slate-800">
                    {menuItems.find(i => i.id === activeTab)?.label}
                </h2>
                <p className="text-slate-500 text-sm mt-1">Gerencie seu sistema de ofertas da Shopee.</p>
            </header>
            {children}
        </div>
      </main>

      {/* Overlay for mobile */}
      {mobileMenuOpen && (
        <div 
            className="fixed inset-0 bg-black/50 z-0 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
        ></div>
      )}
    </div>
  );
};
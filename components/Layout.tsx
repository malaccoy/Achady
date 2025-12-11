import React, { useState } from "react";
import { Menu } from "lucide-react";
import { MainContainer } from "./MainContainer";
import { AccountSection } from "./AccountSection";

export type MenuItemId =
  | "status"
  | "groups"
  | "automation"
  | "shopee"
  | "template"
  | "logs";

interface LayoutProps {
  activeSection: MenuItemId;
  onChangeSection: (id: MenuItemId) => void;
  children: React.ReactNode;
  userEmail?: string;
  onLogout?: () => void;
}

const MENU_ITEMS: { id: MenuItemId; label: string }[] = [
  { id: "status", label: "Status & Conexão" },
  { id: "groups", label: "Grupos WhatsApp" },
  { id: "automation", label: "Automação" },
  { id: "shopee", label: "Config API Shopee" },
  { id: "template", label: "Modelo de Mensagem" },
  { id: "logs", label: "Logs de Envio" },
];

export const Layout: React.FC<LayoutProps> = ({
  activeSection,
  onChangeSection,
  children,
  userEmail,
  onLogout,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="achady-shell">
      <aside className={`achady-sidebar ${isMobileMenuOpen ? 'open' : ''}`}>
        <div className="achady-logo-block">
            <div className="achady-logo-circle">A</div>
            <div>
                <div className="achady-logo-title">ACHADY</div>
                <div className="achady-logo-sub">Bot Automation</div>
            </div>
        </div>

        <div className="achady-sidebar-badge mt-4 md:mt-0">Shopee Deals • Beta</div>

        <nav className="achady-nav">
          {MENU_ITEMS.map((item) => (
            <button
              key={item.id}
              className={
                "achady-nav-item" +
                (activeSection === item.id ? " achady-nav-item--active" : "")
              }
              onClick={() => {
                  onChangeSection(item.id);
                  setIsMobileMenuOpen(false);
              }}
            >
              <span className="achady-nav-dot" />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="achady-sidebar-footer">
          <span className="achady-status-pill">
            <span className="achady-status-indicator" />
            Online
          </span>
          <span className="achady-version">v0.1 • VPS</span>
        </div>
      </aside>

      <main className="achady-main">
        <MainContainer>
          <header className="achady-main-header">
            <div className="flex items-center gap-3">
               <button className="mobile-menu-btn md:hidden" onClick={() => setIsMobileMenuOpen(true)}>
                  <Menu className="w-6 h-6 text-slate-300" />
               </button>
               <div>
                  <h1 className="achady-main-title">
                      {MENU_ITEMS.find(i => i.id === activeSection)?.label || 'Dashboard'}
                  </h1>
                  <p className="achady-main-subtitle hidden md:block">
                  Controle a automação de ofertas da Shopee para seus grupos.
                  </p>
               </div>
            </div>
            <div className="achady-main-header-actions">
              {userEmail && onLogout && (
                <AccountSection userEmail={userEmail} onLogout={onLogout} />
              )}
            </div>
          </header>

          <section className="achady-main-content">{children}</section>
        </MainContainer>
      </main>
      
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setIsMobileMenuOpen(false)} />
      )}
    </div>
  );
};
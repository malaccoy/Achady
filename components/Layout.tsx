import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, FileText, LogOut, Menu, X } from 'lucide-react';
import { db } from '../services/db';
import { AchadyLogo } from './UI';

export const Layout: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    db.logout();
    navigate('/login');
  };

  const NavItem = ({ to, icon: Icon, label }: { to: string, icon: any, label: string }) => (
    <NavLink
      to={to}
      onClick={() => setIsMobileMenuOpen(false)}
      className={({ isActive }) => `
        flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
        ${isActive 
          ? 'bg-brand-50 text-achady-purple' 
          : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}
      `}
    >
      <Icon className="w-4 h-4" />
      {label}
    </NavLink>
  );

  return (
    <div className="min-h-screen bg-[#F5F6FA] font-sans flex flex-col">
      {/* Top Navbar */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            
            {/* Logo */}
            <AchadyLogo />

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-2">
              <NavItem to="/" icon={LayoutDashboard} label="Painel Achady" />
              <NavItem to="/logs" icon={FileText} label="Logs de Envio" />
            </nav>

            {/* User & Mobile Toggle */}
            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-3 pl-4 border-l border-slate-200">
                <div className="flex flex-col items-end">
                  <span className="text-xs font-semibold text-slate-700">Minha Conta</span>
                  <button onClick={handleLogout} className="text-[10px] text-achady-error hover:underline uppercase tracking-wide">Sair</button>
                </div>
                <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500">
                   <span className="font-bold text-xs">US</span>
                </div>
              </div>

              {/* Mobile Menu Button */}
              <button 
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
              >
                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-slate-100 bg-white">
            <div className="px-4 py-3 space-y-1">
              <NavItem to="/" icon={LayoutDashboard} label="Painel Achady" />
              <NavItem to="/logs" icon={FileText} label="Logs" />
              <div className="border-t border-slate-100 my-2 pt-2">
                <button 
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-4 py-2 w-full text-left text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <LogOut className="w-4 h-4" />
                  Sair do Sistema
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-grow w-full">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 opacity-80 scale-90">
             <AchadyLogo size="sm" showText={true} />
          </div>
          <div className="text-sm text-slate-500">
            &copy; {new Date().getFullYear()} ACHADY. Automação inteligente para afiliados.
          </div>
          <div className="flex gap-4 text-sm font-medium text-slate-400">
            <a href="#" className="hover:text-achady-purple transition-colors">Termos</a>
            <a href="#" className="hover:text-achady-purple transition-colors">Privacidade</a>
            <a href="#" className="hover:text-achady-purple transition-colors">Suporte</a>
          </div>
        </div>
      </footer>
    </div>
  );
};
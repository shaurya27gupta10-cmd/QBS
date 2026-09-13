import { useState, type ReactNode } from 'react';
import { Shield, KeyRound, Radio, HelpCircle, Menu, X, Lock } from 'lucide-react';
import { ActiveTab } from '../types';
import { QbsLogo } from './QbsLogo';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
}

export function Header({ activeTab, setActiveTab }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: { id: ActiveTab; label: string; icon: ReactNode }[] = [
    { id: 'home', label: 'Home', icon: <Shield className="w-4 h-4" /> },
    { id: 'encode', label: 'Encode', icon: <Lock className="w-4 h-4" /> },
    { id: 'decode', label: 'Decode', icon: <KeyRound className="w-4 h-4" /> },
    { id: 'how-it-works', label: 'How It Works', icon: <Radio className="w-4 h-4" /> },
    { id: 'security', label: 'Security', icon: <HelpCircle className="w-4 h-4" /> },
  ];

  const handleNavClick = (tab: ActiveTab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Official Brand Logo & Subtitle */}
          <button
            id="brand-logo-btn"
            onClick={() => handleNavClick('home')}
            className="flex items-center text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-lg py-1 px-1.5 -ml-1.5 transition-transform hover:scale-[1.01]"
            aria-label="QBS Secure Sound Home"
          >
            <QbsLogo variant="horizontal" size="sm" />
          </button>

          {/* Desktop Navigation & PWA Shortcut Button */}
          <div className="hidden md:flex items-center gap-2">
            <nav className="flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    id={`nav-${item.id}`}
                    onClick={() => handleNavClick(item.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="h-5 w-px bg-slate-200 mx-1" />

            {/* In-App Add Shortcut / Install Button */}
            <PWAInstallButton variant="header" />
          </div>

          {/* Mobile Right Controls: Install + Menu Toggle */}
          <div className="md:hidden flex items-center gap-2">
            <PWAInstallButton variant="compact" />
            <button
              id="mobile-menu-toggle-btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-200 bg-white px-4 pt-2 pb-4 space-y-1 shadow-md">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`mobile-nav-${item.id}`}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
          <div className="pt-2">
            <PWAInstallButton variant="hero" className="w-full justify-center" />
          </div>
        </div>
      )}
    </header>
  );
}

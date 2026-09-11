/**
 * QBS Secure Sound - Main Application
 * "Turn your private message into a secure sound."
 */

import { useState } from 'react';
import { ActiveTab } from './types';
import { Header } from './components/Header';
import { HomeView } from './components/HomeView';
import { EncodeView } from './components/EncodeView';
import { DecodeView } from './components/DecodeView';
import { HowItWorksView } from './components/HowItWorksView';
import { SecurityView } from './components/SecurityView';
import { Footer } from './components/Footer';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [testDecodeFile, setTestDecodeFile] = useState<{
    blob: Blob;
    filename: string;
    payload?: Uint8Array;
    password?: string;
  } | null>(null);

  // Handle Test Decode callback from EncodeView
  const handleTestDecode = (blob: Blob, filename: string, payload: Uint8Array, password?: string) => {
    setTestDecodeFile({ blob, filename, payload, password });
    setActiveTab('decode');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans text-slate-900 antialiased selection:bg-blue-100 selection:text-blue-900">
      {/* Top Navigation */}
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content Area */}
      <main className="flex-1">
        {activeTab === 'home' && <HomeView setActiveTab={setActiveTab} />}
        {activeTab === 'encode' && <EncodeView onTestDecode={handleTestDecode} />}
        {activeTab === 'decode' && <DecodeView initialFile={testDecodeFile} />}
        {activeTab === 'how-it-works' && <HowItWorksView setActiveTab={setActiveTab} />}
        {activeTab === 'security' && <SecurityView />}
      </main>

      {/* Footer */}
      <Footer setActiveTab={setActiveTab} />
    </div>
  );
}

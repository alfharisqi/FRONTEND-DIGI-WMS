import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Truck, Boxes, ScanLine, Package, Radio } from 'lucide-react';
import { createEmqxWebSocketClient } from './services/mqttClient';
import DashboardOverviewPage from './modules/orang4-dashboard/DashboardOverviewPage';
import InboundTaggingPage from './modules/orang1-inbound/InboundTaggingPage';
import InventoryLedgerPage from './modules/orang2-inventory/InventoryLedgerPage';
import HandheldOpnamePage from './modules/orang3-opname/HandheldOpnamePage';

export default function App() {
  const [activeTab, setActiveTab] = useState('orang4');
  const [mqttConnected, setMqttConnected] = useState(false);
  const [lastMqttEvent, setLastMqttEvent] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  const showNotification = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    const client = createEmqxWebSocketClient(
      (topic, payload) => {
        setLastMqttEvent({ topic, payload });
        showNotification(`Live EMQX [${topic}] diterima!`);
      },
      (status) => setMqttConnected(status)
    );

    return () => {
      if (client) client.end();
    };
  }, []);

  const navItems = [
    { id: 'orang4', label: '1. Dashboard & Server (Orang 4)', icon: LayoutDashboard, badge: 'Pondasi' },
    { id: 'orang1', label: '2. Inbound & Tagging (Orang 1)', icon: Truck, badge: 'GRN/EPC' },
    { id: 'orang2', label: '3. Rak & Ledger Stok (Orang 2)', icon: Boxes, badge: 'Putaway' },
    { id: 'orang3', label: '4. Opname Handheld (Orang 3)', icon: ScanLine, badge: 'Audit' },
  ];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-100">
      {/* Sidebar Navigasi 4 Modul Tim */}
      <aside className="w-72 bg-slate-900 text-slate-300 flex flex-col shrink-0 shadow-xl">
        <div className="h-16 flex items-center px-6 bg-slate-950/60 border-b border-slate-800 space-x-3">
          <div className="bg-blue-600 p-2 rounded-xl text-white">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-base text-white tracking-wide">DIGI WMS</span>
            <span className="block text-[10px] text-blue-400 font-medium">
              Fase 1 MVP Inti — 4 Modul Tim
            </span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
            Pembagian Modul Tim (React.js)
          </p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span className="flex items-center space-x-2.5">
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full ${
                    isActive ? 'bg-blue-800 text-blue-100' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {item.badge}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 bg-slate-950/50 border-t border-slate-800 text-xs text-slate-400">
          <div className="flex items-center justify-between">
            <span>EMQX Broker (WS 8083):</span>
            <span
              className={`font-bold flex items-center gap-1 ${
                mqttConnected ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              {mqttConnected ? 'Online' : 'Standby'}
            </span>
          </div>
        </div>
      </aside>

      {/* Area Konten Utama */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0">
          <h1 className="font-bold text-slate-800 text-sm sm:text-base">
            Workspace Kolaborasi Tim 4 Orang — DIGI WMS (React.js + Fastify + PostgreSQL + EMQX)
          </h1>
          <span className="text-xs bg-slate-100 text-slate-700 px-3 py-1.5 rounded-xl font-medium">
            UHF RFID 920–923 MHz
          </span>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'orang4' && (
            <DashboardOverviewPage
              mqttConnected={mqttConnected}
              lastMqttEvent={lastMqttEvent}
              onNotify={showNotification}
            />
          )}
          {activeTab === 'orang1' && <InboundTaggingPage onNotify={showNotification} />}
          {activeTab === 'orang2' && (
            <InventoryLedgerPage lastMqttEvent={lastMqttEvent} onNotify={showNotification} />
          )}
          {activeTab === 'orang3' && <HandheldOpnamePage onNotify={showNotification} />}
        </div>
      </main>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-slate-700 text-xs font-semibold flex items-center space-x-2">
          <Radio className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

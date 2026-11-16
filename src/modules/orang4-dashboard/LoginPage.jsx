import React, { useState } from 'react';
import { API_BASE_URL } from '../../config/api';

export default function LoginPage({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const json = await res.json();
      if (res.ok && (json.data?.user || json.user)) {
        const loggedUser = json.data?.user || json.user;
        const token = json.data?.token || json.token;
        localStorage.setItem('digiwms_user', JSON.stringify(loggedUser));
        localStorage.setItem('digiwms_token', token || '');
        onLoginSuccess(loggedUser);
      } else {
        setErrorMsg(json.message || 'Username atau password tidak valid!');
      }
    } catch {
      setErrorMsg('Gagal menghubungi server autentikasi DIGI WMS (Port 5000).');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 flex flex-col lg:flex-row font-sans text-slate-800">
      {/* Panel Kiri: Branding & Informasi Infrastruktur RFID */}
      <div className="lg:w-1/2 bg-gradient-to-br from-blue-900 via-slate-900 to-slate-950 p-8 sm:p-12 flex flex-col justify-between text-white relative overflow-hidden border-b lg:border-b-0 lg:border-r border-slate-800">
        <div className="absolute -right-20 -bottom-20 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex items-center space-x-3">
          <div className="bg-blue-600 p-2.5 rounded-xl text-white shadow-lg shadow-blue-500/30">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
          </div>
          <div>
            <span className="font-extrabold text-xl tracking-wide text-white">DIGI WMS</span>
            <span className="block text-xs text-blue-400 font-medium">
              RFID Warehouse, Inventory & Gate Security System
            </span>
          </div>
        </div>

        <div className="relative z-10 my-10 max-w-lg">
          <span className="bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
            Enterprise RBAC Security Portal
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold mt-4 leading-tight">
            Kendali Gudang & Keamanan RFID Terpadu
          </h1>
          <p className="text-slate-300 text-sm mt-3 leading-relaxed">
            Sistem manajemen pergudangan berbasis <b>Immutable Stock Ledger</b> dan broker{' '}
            <b>EMQX MQTT Real-Time</b> pada frekuensi UHF 920–923 MHz.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-8">
            <div className="bg-slate-900/70 border border-slate-800 p-3.5 rounded-2xl">
              <span className="text-lg">📡</span>
              <p className="text-xs font-bold text-white mt-1">UHF RFID Live</p>
              <p className="text-[11px] text-slate-400">Encoding & Opname Nirkabel</p>
            </div>
            <div className="bg-slate-900/70 border border-slate-800 p-3.5 rounded-2xl">
              <span className="text-lg">📜</span>
              <p className="text-xs font-bold text-white mt-1">Append-Only Ledger</p>
              <p className="text-[11px] text-slate-400">Anti-Manipulasi Stok</p>
            </div>
            <div className="bg-slate-900/70 border border-slate-800 p-3.5 rounded-2xl">
              <span className="text-lg">🛡️</span>
              <p className="text-xs font-bold text-white mt-1">RBAC & Audit Trail</p>
              <p className="text-[11px] text-slate-400">Otorisasi Berlapis</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-xs text-slate-500 flex items-center justify-between">
          <span>© 2026 DIGI WMS — Modul Infrastruktur & Auth (Orang 4)</span>
          <span className="text-emerald-400 font-mono">● Server Ready</span>
        </div>
      </div>

      {/* Panel Kanan: Form Login Pengguna */}
      <div className="lg:w-1/2 flex items-center justify-center p-6 sm:p-12 bg-slate-100">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-200 p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-extrabold text-slate-900">Login Personel Gudang</h2>
            <p className="text-xs text-slate-500 mt-1">
              Masukkan kredensial akun Anda untuk mengakses dashboard sesuai Role (RBAC).
            </p>
          </div>

          {errorMsg && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-semibold flex items-center space-x-2">
              <span>🚨</span>
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Username
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Contoh: admin.wms atau sarah.jenkins"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password akun..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition pr-16"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 px-3.5 text-xs font-semibold text-slate-500 hover:text-slate-800"
                >
                  {showPassword ? 'Sembunyi' : 'Lihat'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-3 rounded-xl text-sm shadow-lg shadow-blue-600/25 transition-all"
            >
              {loading ? 'Memverifikasi Kredensial...' : 'Masuk ke Sistem DIGI WMS →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

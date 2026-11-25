import React, { useState } from 'react';
import {
  Command,
  Eye,
  EyeOff,
  Loader2,
  Radio,
  FileText,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import { API_BASE_URL } from '../../config/api';
import { tokenStorageKey, userStorageKey } from '../../config/authSession';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ThemeSwitch } from '@/components/layout/ThemeSwitch';

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
        localStorage.setItem(userStorageKey, JSON.stringify(loggedUser));
        localStorage.setItem(tokenStorageKey, token || '');
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

  const quickAccounts = [
    { u: 'admin.wms', label: 'Admin (Budi)', role: 'ADMIN' },
    { u: 'sarah.jenkins', label: 'Supervisor (Sarah)', role: 'SUPERVISOR' },
    { u: 'operator.inbound', label: 'Operator (Andi)', role: 'STAFF' },
    { u: 'security.gate', label: 'Security (Hendra)', role: 'SECURITY' },
  ];

  return (
    <div className="relative grid min-h-screen w-full lg:grid-cols-2 bg-background text-foreground">
      {/* Top-right Theme Switch */}
      <div className="absolute right-4 top-4 z-20">
        <ThemeSwitch />
      </div>

      {/* Left Panel (Shadcn Admin Auth Split Showcase) */}
      <div className="relative hidden flex-col justify-between bg-muted/40 p-10 border-r lg:flex dark:bg-card">
        <div className="flex items-center gap-2.5 text-lg font-semibold">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Command className="h-4 w-4" />
          </div>
          <span>DIGI WMS</span>
          <Badge variant="secondary" className="ml-1 font-mono text-[10px]">
            RFID + POS
          </Badge>
        </div>

        <div className="my-auto max-w-md space-y-6">
          <Badge variant="outline" className="px-2.5 py-0.5 text-xs">
            Enterprise RBAC Security Portal
          </Badge>

          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">
              Kendali Gudang & Keamanan RFID Terpadu
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Sistem manajemen pergudangan berbasis{' '}
              <span className="font-medium text-foreground">
                Immutable Stock Ledger
              </span>{' '}
              dan broker{' '}
              <span className="font-medium text-foreground">
                EMQX MQTT Real-Time
              </span>{' '}
              pada frekuensi UHF 920–923 MHz.
            </p>
          </div>

          <div className="grid gap-3 pt-2">
            <div className="flex items-start gap-3 rounded-lg border bg-card p-3.5 shadow-sm">
              <div className="rounded-md bg-secondary p-2 text-foreground">
                <Radio className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium">UHF RFID Live</p>
                <p className="text-xs text-muted-foreground">
                  Encoding tag, opname handheld, dan deteksi gerbang real-time.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg border bg-card p-3.5 shadow-sm">
              <div className="rounded-md bg-secondary p-2 text-foreground">
                <FileText className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium">Append-Only Stock Ledger</p>
                <p className="text-xs text-muted-foreground">
                  Pencatatan mutasi stok transparan dan anti-manipulasi.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg border bg-card p-3.5 shadow-sm">
              <div className="rounded-md bg-secondary p-2 text-foreground">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium">RBAC & Audit Trail</p>
                <p className="text-xs text-muted-foreground">
                  Otorisasi berlapis untuk Admin, Supervisor, Operator, dan Security.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>© 2026 DIGI WMS — Modul Infrastruktur & Auth</span>
          <span className="inline-flex items-center gap-1.5 font-mono text-emerald-600 dark:text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Server Ready
          </span>
        </div>
      </div>

      {/* Right Panel: Shadcn Admin Sign-In Card */}
      <div className="flex flex-col items-center justify-center p-6 sm:p-10">
        <div className="mb-6 flex items-center gap-2 lg:hidden">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Command className="h-4 w-4" />
          </div>
          <span className="text-lg font-bold tracking-tight">DIGI WMS</span>
        </div>

        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl tracking-tight">
              Masuk ke DIGI WMS
            </CardTitle>
            <CardDescription>
              Masukkan kredensial personel gudang untuk mengakses sistem sesuai
              hak akses (RBAC).
            </CardDescription>
          </CardHeader>

          <CardContent>
            {errorMsg && (
              <div className="mb-4 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-xs font-medium text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="login-username">Username</Label>
                <Input
                  id="login-username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin.wms atau sarah.jenkins"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="login-password">Password</Label>
                <div className="relative">
                  <Input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                    title={showPassword ? 'Sembunyikan' : 'Tampilkan'}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Memverifikasi...
                  </>
                ) : (
                  <>
                    Masuk ke Sistem
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="flex flex-col items-stretch border-t pt-4">
            <p className="mb-2.5 text-[11px] font-medium text-muted-foreground">
              Akun Demo Cepat (Password:{' '}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground">
                123456
              </code>
              )
            </p>
            <div className="grid grid-cols-2 gap-2">
              {quickAccounts.map((acc) => (
                <button
                  key={acc.u}
                  type="button"
                  onClick={() => {
                    setUsername(acc.u);
                    setPassword('123456');
                    setErrorMsg('');
                  }}
                  className="flex flex-col rounded-md border bg-muted/30 px-3 py-2 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <span className="text-xs font-medium">{acc.label}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    @{acc.u}
                  </span>
                </button>
              ))}
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

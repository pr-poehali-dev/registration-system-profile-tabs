import { useState, useEffect, FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';

const AUTH_URL = 'https://functions.poehali.dev/6f210e2d-3a66-4246-959d-1025896f3549';
const PASSES_URL = 'https://functions.poehali.dev/494dbb30-6b3b-4487-b0d3-179a72afa0d5';

interface User {
  id: number;
  username: string;
  email?: string;
  full_name: string;
  department?: string;
  phone?: string;
}

interface Pass {
  id: number;
  visitor_name: string;
  purpose: string;
  visit_date: string;
  status: string;
  created_at: string;
}

const statusMap: Record<string, { label: string; color: string }> = {
  pending: { label: 'На рассмотрении', color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
  approved: { label: 'Одобрен', color: 'bg-primary/15 text-primary border-primary/30' },
  rejected: { label: 'Отклонён', color: 'bg-destructive/15 text-destructive border-destructive/30' },
};

export default function Index() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'passes' | 'profile'>('passes');

  useEffect(() => {
    const saved = localStorage.getItem('pass_token');
    if (saved) {
      fetch(AUTH_URL, { headers: { 'X-Auth-Token': saved } })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d) => {
          setUser(d.user);
          setToken(saved);
        })
        .catch(() => localStorage.removeItem('pass_token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('pass_token');
    setUser(null);
    setToken(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <Icon name="LoaderCircle" size={36} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !token) {
    return <AuthScreen onAuth={(u, t) => { setUser(u); setToken(t); localStorage.setItem('pass_token', t); }} />;
  }

  return (
    <div className="min-h-screen bg-background grid-bg">
      <header className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="container flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary grid place-items-center glow-lime">
              <Icon name="ScanLine" size={22} className="text-primary-foreground" />
            </div>
            <div>
              <p className="font-display font-bold text-lg leading-none">PASSPORT</p>
              <p className="text-xs text-muted-foreground">система пропусков</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-2">
            <Icon name="LogOut" size={16} /> Выйти
          </Button>
        </div>
      </header>

      <div className="container py-8 max-w-3xl">
        <div className="flex gap-2 p-1 bg-secondary rounded-2xl mb-8 w-fit">
          {([['passes', 'Пропуски', 'Ticket'], ['profile', 'Профиль', 'User']] as const).map(([key, label, icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                tab === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon name={icon} size={16} /> {label}
            </button>
          ))}
        </div>

        {tab === 'passes' ? <PassesTab token={token} /> : <ProfileTab user={user} />}
      </div>
    </div>
  );
}

function AuthScreen({ onAuth }: { onAuth: (u: User, t: string) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [form, setForm] = useState({ username: '', password: '', full_name: '', department: '', phone: '' });
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch(AUTH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: mode, ...form }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка');
      onAuth(data.user, data.token);
      toast.success(mode === 'login' ? 'С возвращением!' : 'Аккаунт создан');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Что-то пошло не так');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="hidden lg:flex flex-col justify-between p-12 grid-bg relative overflow-hidden">
        <div className="absolute -right-20 -top-20 w-96 h-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="flex items-center gap-3 relative">
          <div className="w-10 h-10 rounded-xl bg-primary grid place-items-center glow-lime">
            <Icon name="ScanLine" size={22} className="text-primary-foreground" />
          </div>
          <span className="font-display font-bold text-xl">PASSPORT</span>
        </div>
        <div className="relative">
          <h1 className="font-display font-black text-5xl leading-tight mb-4">
            Контроль<br />доступа<br /><span className="text-primary">без бумаги.</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-sm">
            Оформляйте пропуска для гостей за пару секунд и следите за их статусом в реальном времени.
          </p>
        </div>
        <div className="flex gap-6 text-sm text-muted-foreground relative">
          <span className="flex items-center gap-2"><Icon name="Shield" size={16} className="text-primary" /> Безопасно</span>
          <span className="flex items-center gap-2"><Icon name="Zap" size={16} className="text-primary" /> Быстро</span>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm animate-fade-up">
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 rounded-xl bg-primary grid place-items-center glow-lime">
              <Icon name="ScanLine" size={22} className="text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-xl">PASSPORT</span>
          </div>
          <h2 className="font-display font-bold text-2xl mb-1">
            {mode === 'login' ? 'Вход' : 'Регистрация'}
          </h2>
          <p className="text-muted-foreground text-sm mb-6">
            {mode === 'login' ? 'Войдите в свой аккаунт' : 'Создайте новый аккаунт'}
          </p>

          <form onSubmit={submit} className="space-y-4">
            {mode === 'register' && (
              <div className="space-y-2">
                <Label>Имя и фамилия</Label>
                <Input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Иван Петров" />
              </div>
            )}
            <div className="space-y-2">
              <Label>Имя пользователя</Label>
              <Input required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="ivan_petrov" />
            </div>
            <div className="space-y-2">
              <Label>Пароль</Label>
              <Input required type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
            </div>
            {mode === 'register' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Отдел</Label>
                  <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="IT" />
                </div>
                <div className="space-y-2">
                  <Label>Телефон</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+7..." />
                </div>
              </div>
            )}
            <Button type="submit" className="w-full gap-2 font-semibold" disabled={busy}>
              {busy && <Icon name="LoaderCircle" size={16} className="animate-spin" />}
              {mode === 'login' ? 'Войти' : 'Создать аккаунт'}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            {mode === 'login' ? 'Нет аккаунта?' : 'Уже есть аккаунт?'}{' '}
            <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')} className="text-primary font-medium hover:underline">
              {mode === 'login' ? 'Зарегистрироваться' : 'Войти'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

function PassesTab({ token }: { token: string }) {
  const [passes, setPasses] = useState<Pass[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ visitor_name: '', purpose: '', visit_date: '' });
  const [busy, setBusy] = useState(false);

  const load = () => {
    fetch(PASSES_URL, { headers: { 'X-Auth-Token': token } })
      .then((r) => r.json())
      .then((d) => setPasses(d.passes || []))
      .finally(() => setLoading(false));
  };

  useEffect(load, [token]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch(PASSES_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Auth-Token': token },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPasses([data.pass, ...passes]);
      setForm({ visitor_name: '', purpose: '', visit_date: '' });
      setShowForm(false);
      toast.success('Пропуск создан');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="animate-fade-up">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-display font-bold text-2xl">Мои пропуска</h2>
          <p className="text-muted-foreground text-sm">{passes.length} заявок</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="gap-2 font-semibold">
          <Icon name={showForm ? 'X' : 'Plus'} size={18} /> {showForm ? 'Отмена' : 'Новый'}
        </Button>
      </div>

      {showForm && (
        <Card className="p-6 mb-6 animate-fade-up border-primary/20">
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label>Имя посетителя</Label>
              <Input required value={form.visitor_name} onChange={(e) => setForm({ ...form, visitor_name: e.target.value })} placeholder="Иван Петров" />
            </div>
            <div className="space-y-2">
              <Label>Цель визита</Label>
              <Input value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} placeholder="Встреча, доставка..." />
            </div>
            <div className="space-y-2">
              <Label>Дата визита</Label>
              <Input required type="date" value={form.visit_date} onChange={(e) => setForm({ ...form, visit_date: e.target.value })} />
            </div>
            <Button type="submit" className="w-full gap-2 font-semibold" disabled={busy}>
              {busy && <Icon name="LoaderCircle" size={16} className="animate-spin" />} Создать пропуск
            </Button>
          </form>
        </Card>
      )}

      {loading ? (
        <div className="grid place-items-center py-20">
          <Icon name="LoaderCircle" size={32} className="animate-spin text-primary" />
        </div>
      ) : passes.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <Icon name="Ticket" size={40} className="mx-auto text-muted-foreground mb-3" />
          <p className="font-medium">Пропусков пока нет</p>
          <p className="text-muted-foreground text-sm">Создайте первый пропуск для гостя</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {passes.map((p) => {
            const st = statusMap[p.status] || statusMap.pending;
            return (
              <Card key={p.id} className="p-5 flex items-center justify-between hover:border-primary/30 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-secondary grid place-items-center">
                    <Icon name="UserRound" size={22} className="text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">{p.visitor_name}</p>
                    <p className="text-sm text-muted-foreground">{p.purpose || 'Без описания'}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <Icon name="Calendar" size={12} /> {p.visit_date}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className={st.color}>{st.label}</Badge>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProfileTab({ user }: { user: User }) {
  const rows = [
    { icon: 'AtSign', label: 'Имя пользователя', value: user.username },
    { icon: 'Building2', label: 'Отдел', value: user.department || '—' },
    { icon: 'Phone', label: 'Телефон', value: user.phone || '—' },
  ];
  return (
    <div className="animate-fade-up">
      <Card className="p-8 mb-6 relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-primary/10 blur-2xl" />
        <div className="flex items-center gap-5 relative">
          <div className="w-20 h-20 rounded-2xl bg-primary grid place-items-center glow-lime">
            <span className="font-display font-black text-3xl text-primary-foreground">
              {user.full_name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <h2 className="font-display font-bold text-2xl">{user.full_name}</h2>
            <p className="text-muted-foreground">{user.department || 'Сотрудник'}</p>
          </div>
        </div>
      </Card>

      <Card className="divide-y divide-border">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-4 p-5">
            <div className="w-10 h-10 rounded-xl bg-secondary grid place-items-center">
              <Icon name={r.icon} size={18} className="text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{r.label}</p>
              <p className="font-medium">{r.value}</p>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
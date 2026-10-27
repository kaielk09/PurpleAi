import { useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Link, Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import { ArrowLeft, ArrowUp, AudioLines, CircleHelp, FileText, KeyRound, LockKeyhole, LogOut, Menu, MessageSquare, Plus, Search, Send, Settings2, ShieldCheck, Sparkles, UserRound, X, Zap } from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();
function cx(...parts: Array<string | false | null | undefined>) { return parts.filter(Boolean).join(' '); }

function Brand() {
  return <div className="flex items-center gap-3" data-testid="brand-purple-ai">
    <div className="grid h-9 w-9 place-items-center rounded-[12px] border border-[#314879] bg-[linear-gradient(145deg,#3478F6,#765BFA)] shadow-[0_6px_24px_rgba(52,120,246,.2)]"><Sparkles size={18} strokeWidth={1.8} className="text-white" /></div>
    <span className="text-[15px] font-semibold tracking-[-.035em] text-[#F4F7FF]">Purple AI</span>
  </div>;
}
function IconButton({ children, label, onClick, className = '' }: { children: ReactNode; label: string; onClick?: () => void; className?: string }) {
  return <button aria-label={label} title={label} data-testid={`button-${label.toLowerCase().replaceAll(' ', '-')}`} onClick={onClick} className={cx('grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[#98a8c2] transition hover:bg-white/[.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3478F6]', className)}>{children}</button>;
}
function Field({ label, placeholder, type = 'text', hint, disabled = false, autoComplete }: { label: string; placeholder: string; type?: string; hint?: string; disabled?: boolean; autoComplete?: string }) {
  return <label className="block space-y-2"><span className="text-[12px] font-medium text-[#bac6da]">{label}</span><input data-testid={`input-${label.toLowerCase().replaceAll(' ', '-')}`} name={label.toLowerCase().replaceAll(' ', '-')} type={type} placeholder={placeholder} disabled={disabled} required={!disabled} autoComplete={autoComplete ?? (type === 'email' ? 'email' : type === 'password' ? 'new-password' : undefined)} className="h-[46px] w-full rounded-xl border border-[#202C43] bg-[#0B1020] px-3.5 text-[14px] text-[#F4F7FF] outline-none transition placeholder:text-[#62708a] focus:border-[#3478F6] focus:ring-2 focus:ring-[#3478F6]/15 disabled:cursor-not-allowed disabled:opacity-50" />{hint && <span className="block text-[11px] text-[#71819b]">{hint}</span>}</label>;
}
function ActionButton({ children, disabled = false, className = '', ...props }: { children: ReactNode; disabled?: boolean; className?: string; type?: 'button' | 'submit'; onClick?: () => void }) {
  return <button {...props} disabled={disabled} className={cx('inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#3478F6] px-4 text-[13px] font-semibold text-white shadow-[0_7px_20px_rgba(35,99,224,.17)] transition hover:bg-[#4385ff] active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#86b1ff]', className)}>{children}</button>;
}
function Notice({ children, warn = false }: { children: ReactNode; warn?: boolean }) {
  return <div role="status" data-testid="status-phase-notice" className={cx('rounded-xl border px-3.5 py-3 text-[12px] leading-5', warn ? 'border-[#62512c] bg-[#292414] text-[#e5ca91]' : 'border-[#293d67] bg-[#111d34] text-[#b9ccf5]')}>{children}</div>;
}
function AuthFrame({ eyebrow, title, subtitle, children, footer }: { eyebrow: string; title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden px-5 py-12">
    <div className="pointer-events-none absolute left-1/2 top-[4%] h-[440px] w-[640px] -translate-x-1/2 rounded-full bg-[#3478F6]/[.07] blur-[120px]" />
    <div className="animate-rise relative w-full max-w-[430px]">
      <Link href="/login" className="mb-10 inline-flex"><Brand /></Link>
      <section className="rounded-[22px] border border-[#202C43] bg-[#0B1020]/90 p-7 shadow-[0_25px_80px_rgba(0,0,0,.25)] sm:p-9">
        <div className="mb-7"><div className="mb-3 text-[10px] font-semibold uppercase tracking-[.2em] text-[#8b9bb7]">{eyebrow}</div><h1 className="text-[27px] font-semibold tracking-[-.055em] text-[#F4F7FF]">{title}</h1><p className="mt-2 text-[13px] leading-6 text-[#93a2bb]">{subtitle}</p></div>
        <Notice warn>To jest podgląd interfejsu. Logowanie i operacje na koncie zostaną podłączone w kolejnej fazie.</Notice>
        {children}
      </section>
      <div className="mt-6 text-center text-[12px] text-[#8291a9]">{footer}</div>
      <div className="mt-8 flex items-center justify-center gap-2 text-[10px] text-[#596981]"><LockKeyhole size={12} /> Prywatność od podstaw <span className="mx-1 text-[#36445b]">·</span> Twoje rozmowy należą do Ciebie</div>
    </div>
  </main>;
}
function LoginPage() {
  const [notice, setNotice] = useState('');
  function submit(e: FormEvent) { e.preventDefault(); setNotice('Logowanie będzie dostępne po podłączeniu API konta.'); }
  return <AuthFrame eyebrow="Twoja prywatna przestrzeń do myślenia" title="Dobrze Cię widzieć." subtitle="Zaloguj się, aby wrócić do swoich rozmów." footer={<>Nie masz jeszcze konta? <Link href="/register" className="ml-1 font-semibold text-[#88adff] hover:text-white">Utwórz konto</Link></>}>
    <form className="mt-5 space-y-4" onSubmit={submit}><Field label="Adres e-mail" placeholder="ty@przyklad.pl" type="email" /><Field label="Hasło" placeholder="Wpisz hasło" type="password" autoComplete="current-password" /><div className="flex justify-end"><Link href="/forgot-password" className="text-[12px] text-[#8daeff] hover:text-white">Nie pamiętasz hasła?</Link></div><ActionButton type="submit" className="w-full">Zaloguj się <ArrowUp size={15} className="rotate-45" /></ActionButton></form>
    {notice && <div className="mt-4"><Notice>{notice}</Notice></div>}
  </AuthFrame>;
}
function RegisterPage() {
  const [notice, setNotice] = useState('');
  function submit(e: FormEvent) { e.preventDefault(); setNotice('Tworzenie konta będzie dostępne po podłączeniu API konta.'); }
  return <AuthFrame eyebrow="Spokojniejsze podejście do AI" title="Zrób miejsce na myślenie." subtitle="Stwórz prywatną przestrzeń na rozmowy, do których możesz wracać." footer={<>Masz już konto? <Link href="/login" className="ml-1 font-semibold text-[#88adff] hover:text-white">Zaloguj się</Link></>}>
    <form className="mt-5 space-y-4" onSubmit={submit}><Field label="Nazwa użytkownika" placeholder="Wybierz nazwę użytkownika" hint="3–32 znaki. Litery, cyfry i podkreślenia." autoComplete="username" /><Field label="Adres e-mail" placeholder="ty@przyklad.pl" type="email" /><Field label="Hasło" placeholder="Co najmniej 12 znaków" type="password" hint="Użyj długiego, unikalnego hasła." autoComplete="new-password" /><Field label="Potwierdź hasło" placeholder="Wpisz hasło ponownie" type="password" autoComplete="new-password" /><ActionButton type="submit" className="mt-1 w-full">Utwórz konto <ArrowUp size={15} className="rotate-45" /></ActionButton></form>
    {notice && <div className="mt-4"><Notice>{notice}</Notice></div>}
  </AuthFrame>;
}
function ForgotPasswordPage() {
  const [notice, setNotice] = useState('');
  function submit(e: FormEvent) { e.preventDefault(); setNotice('Wysyłka e-mail nie jest jeszcze skonfigurowana. Odzyskiwanie hasła będzie dostępne po podłączeniu API i dostawcy poczty.'); }
  return <AuthFrame eyebrow="Odzyskiwanie konta" title="Wróć do swoich rozmów." subtitle="Wyślemy jednorazowy link na adres e-mail przypisany do konta." footer={<Link href="/login" className="inline-flex items-center gap-2 font-semibold text-[#88adff] hover:text-white"><ArrowLeft size={14} /> Wróć do logowania</Link>}>
    <form className="mt-5 space-y-4" onSubmit={submit}><Field label="Adres e-mail" placeholder="ty@przyklad.pl" type="email" /><ActionButton type="submit" className="w-full">Wyślij link odzyskiwania <ArrowUp size={15} className="rotate-45" /></ActionButton></form>
    {notice && <div className="mt-4"><Notice warn>{notice}</Notice></div>}
  </AuthFrame>;
}
function ResetPasswordPage() {
  const [notice, setNotice] = useState('');
  const tokenPresent = new URLSearchParams(window.location.search).has('token');
  function submit(e: FormEvent) { e.preventDefault(); setNotice('Zmiana hasła będzie dostępna po podłączeniu API konta.'); }
  return <AuthFrame eyebrow="Ustaw nowe hasło" title="Zacznij od nowa." subtitle="Wybierz mocne hasło, którego wcześniej nie używałeś." footer={<Link href="/login" className="inline-flex items-center gap-2 font-semibold text-[#88adff] hover:text-white"><ArrowLeft size={14} /> Wróć do logowania</Link>}>
    {!tokenPresent && <div className="mb-4"><Notice warn>Link odzyskiwania nie zawiera tokenu. Użyj wiadomości odzyskiwania, aby przejść dalej.</Notice></div>}
    <form className="space-y-4" onSubmit={submit}><Field label="Nowe hasło" placeholder="Co najmniej 12 znaków" type="password" /><Field label="Potwierdź nowe hasło" placeholder="Wpisz hasło ponownie" type="password" /><ActionButton type="submit" disabled={!tokenPresent} className="w-full">Zmień hasło <ArrowUp size={15} className="rotate-45" /></ActionButton></form>
    {notice && <div className="mt-4"><Notice>{notice}</Notice></div>}
  </AuthFrame>;
}

function Sidebar({ children, onNewConversation }: { children?: ReactNode; onNewConversation?: () => void }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [, setLocation] = useLocation();
  const panel = <aside className="flex h-full w-[266px] flex-col border-r border-[#202C43] bg-[#0B1020]">
    <div className="flex h-[68px] items-center justify-between border-b border-[#202C43] px-5"><Link href="/app" className="flex items-center gap-3"><Brand /></Link><IconButton label="Zamknij menu" className="md:hidden" onClick={() => setMobileOpen(false)}><X size={17} /></IconButton></div>
    <div className="px-3 pt-4"><button data-testid="button-new-conversation" onClick={() => { onNewConversation?.(); setMobileOpen(false); setLocation('/app'); }} className="flex h-10 w-full items-center gap-2.5 rounded-xl border border-[#263a5a] bg-[#101a2d] px-3 text-[12px] font-semibold text-[#dce6fa] transition hover:border-[#3478F6]/70 hover:bg-[#15223a]"><Plus size={16} className="text-[#8eabff]" /> Nowa rozmowa</button></div>
    <div className="px-3 pb-2 pt-5"><div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#61718b]" /><input value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Szukaj rozmów" placeholder="Znajdź rozmowę" data-testid="input-search-conversations" className="h-9 w-full rounded-lg border border-[#202C43] bg-[#080e1b] pl-9 pr-3 text-[11px] text-[#dce6fa] outline-none placeholder:text-[#65748b] focus:border-[#3478F6]" /></div></div>
    <div className="flex items-center justify-between px-5 pb-2 pt-3"><span className="text-[9px] font-semibold uppercase tracking-[.17em] text-[#65748b]">Twoja przestrzeń</span><span className="font-mono text-[9px] text-[#596981]">0</span></div>
    <div className="px-3 py-5 text-[11px] leading-5 text-[#6e7d94]">{search ? 'Brak rozmów pasujących do wyszukiwania.' : 'Historia rozmów pojawi się po podłączeniu API.'}</div>
    <div className="mt-auto border-t border-[#202C43] p-3"><Link href="/settings" onClick={() => setMobileOpen(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[11px] text-[#93a2bb] transition hover:bg-white/[.045] hover:text-white"><Settings2 size={15} /> Ustawienia</Link><div className="mt-2 flex items-center gap-2.5 rounded-xl bg-[#111a2a] px-2.5 py-2"><div className="grid h-7 w-7 place-items-center rounded-full border border-[#42558b] bg-[#182744] text-[10px] font-semibold text-[#b9caff]">P</div><div className="min-w-0 flex-1"><div className="truncate text-[11px] font-medium text-[#e4e9f3]">Podgląd</div><div className="truncate text-[9px] text-[#75849b]">Tryb demonstracyjny</div></div><IconButton label="Wyloguj się" onClick={() => setLocation('/login')} className="h-8 w-8"><LogOut size={14} /></IconButton></div></div>
  </aside>;
  return <div className="flex h-[100dvh] min-h-[550px] overflow-hidden bg-[#070A12]">
    <div className="hidden md:block">{panel}</div>
    {mobileOpen && <div className="fixed inset-0 z-40 md:hidden"><button aria-label="Zamknij nawigację" className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} /><div className="relative h-full w-[min(86vw,300px)]">{panel}</div></div>}
    <div className="flex min-w-0 flex-1 flex-col"><header className="flex h-[62px] shrink-0 items-center justify-between border-b border-[#202C43] bg-[#070A12]/80 px-4 md:px-7"><div className="flex items-center gap-2"><IconButton label="Otwórz menu" className="md:hidden" onClick={() => setMobileOpen(true)}><Menu size={17} /></IconButton><div className="flex items-center gap-2 text-[11px] text-[#6f7f98]"><span className="hidden sm:inline">Purple AI</span><span className="hidden text-[#34435a] sm:inline">/</span><span className="text-[#b5c2d9]">{window.location.pathname === '/settings' ? 'Ustawienia' : 'Prywatna przestrzeń'}</span></div></div><div className="flex items-center gap-2 text-[10px] text-[#6f8098]"><span className="hidden items-center gap-1.5 sm:inline-flex"><span className="h-1.5 w-1.5 rounded-full bg-[#d4aa59]" /> Tryb podglądu</span><IconButton label="Pomoc" onClick={() => window.alert('To jest podgląd interfejsu. Funkcje konta i rozmów pojawią się po podłączeniu API.')}><CircleHelp size={16} /></IconButton></div></header>{children}</div>
  </div>;
}
function ChatPage() {
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState('');
  function send(e?: FormEvent) { e?.preventDefault(); setNotice('Wysyłanie wiadomości i zapisywanie rozmów będzie dostępne po podłączeniu API.'); }
  return <Sidebar onNewConversation={() => { setDraft(''); setNotice('Nowa rozmowa pojawi się po podłączeniu API.'); }}><section className="relative flex min-h-0 flex-1 flex-col">
    <div className="scrollbar-thin animate-rise mx-auto flex min-h-0 w-full max-w-[720px] flex-1 flex-col justify-start overflow-y-auto px-5 pb-5 pt-7 md:justify-center md:pb-16 md:pt-10">
      <div className="mb-7 flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] border border-[#314879] bg-[linear-gradient(145deg,rgba(52,120,246,.2),rgba(118,91,250,.17))] text-[#a8c2ff]"><Sparkles size={21} /></div>
      <div className="font-mono text-[9px] uppercase tracking-[.22em] text-[#788bac]">Przestrzeń na jasne myślenie</div>
      <h1 className="mt-4 max-w-[540px] text-[clamp(34px,5vw,52px)] font-medium leading-[1.08] tracking-[-.065em] text-[#F4F7FF]">Co chodzi Ci<br /><span className="text-[#91aaf0]">dziś po głowie?</span></h1>
      <p className="mt-5 max-w-[460px] text-[13px] leading-6 text-[#8292ac]">Zacznij od pytania, niedokończonej myśli albo szkicu. Wspólnie nadamy im kształt.</p>
      <Notice warn>Rozmowy i odpowiedzi AI zostaną włączone po podłączeniu API. To obecnie podgląd przestrzeni czatu.</Notice>
      <div className="mt-5 grid gap-2.5 sm:grid-cols-3">{['Pomóż mi uporządkować trudną decyzję', 'Zamień luźne notatki w jasny plan', 'Wyjaśnij złożony temat prostym językiem'].map((prompt, i) => <button key={prompt} data-testid={`button-prompt-${i}`} onClick={() => setDraft(prompt)} className="group min-h-[76px] rounded-xl border border-[#202C43] bg-[#0B1020]/70 p-3.5 text-left text-[11px] leading-[1.55] text-[#a8b6cb] transition hover:-translate-y-0.5 hover:border-[#3c5480] hover:bg-[#10182A]"><span className="mb-2 block text-[#7698e7]">{i === 0 ? <Zap size={14} /> : i === 1 ? <FileText size={14} /> : <AudioLines size={14} />}</span>{prompt}</button>)}</div>
      <div className="mt-7 flex items-center gap-2 text-[9px] text-[#5f6e85]"><ShieldCheck size={12} className="text-[#6c82b6]" /> Prywatna przestrzeń · zapisywanie rozmów w kolejnej fazie</div>
    </div>
    <div className="shrink-0 px-4 pb-3 pt-2 sm:px-7 sm:pb-6"><div className="mx-auto max-w-[770px]"><div className="rounded-[18px] border border-[#293a57] bg-[#0D1423] shadow-[0_14px_38px_rgba(0,0,0,.22)]"><form onSubmit={send}><textarea data-testid="input-message-composer" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Zadaj pytanie, zapisz myśl albo zacznij od szkicu…" rows={2} className="scrollbar-thin max-h-48 min-h-[68px] w-full resize-y bg-transparent px-4 pt-4 text-[13px] leading-6 text-[#e5ebf5] outline-none placeholder:text-[#65748b]" /><div className="flex items-center justify-between px-3 pb-3"><span className="pl-1 text-[9px] text-[#65758f]">Enter wysyła · Shift + Enter dodaje nowy wiersz</span><button data-testid="button-send-message" type="submit" className="inline-flex h-8 items-center gap-2 rounded-lg bg-[#3478F6] px-3.5 text-[10px] font-semibold text-white transition hover:bg-[#4a89ff]">Wyślij <Send size={13} /></button></div></form></div>{notice && <div className="mt-3"><Notice>{notice}</Notice></div>}<div className="mt-2 text-center text-[9px] text-[#53627a]">Interfejs demonstracyjny Purple AI</div></div></div>
  </section></Sidebar>;
}
function SettingsPage() {
  const [section, setSection] = useState('account');
  const [enter, setEnter] = useState(true), [timestamps, setTimestamps] = useState(false);
  const [notice, setNotice] = useState('');
  const menu = [{ id: 'account', label: 'Konto', icon: UserRound }, { id: 'preferences', label: 'Preferencje', icon: Settings2 }, { id: 'security', label: 'Bezpieczeństwo', icon: KeyRound }, { id: 'history', label: 'Historia rozmów', icon: MessageSquare }];
  const toggle = (checked: boolean, setChecked: (value: boolean) => void, label: string, detail: string) => <button type="button" role="switch" aria-checked={checked} onClick={() => { setChecked(!checked); setNotice('Ustawienia są widoczne lokalnie. Zapisywanie zmian będzie dostępne po podłączeniu API.'); }} className="flex w-full items-center justify-between gap-4 border-b border-[#202C43] py-4 text-left last:border-0"><span><span className="block text-[13px] font-medium text-[#e6ebf6]">{label}</span><span className="mt-1 block text-[11px] text-[#8493aa]">{detail}</span></span><span className={cx('relative h-[22px] w-10 shrink-0 rounded-full border transition', checked ? 'border-[#3478F6] bg-[#3478F6]' : 'border-[#35445e] bg-[#182236]')}><span className={cx('absolute top-[2px] h-4 w-4 rounded-full bg-[#f4f7ff] shadow transition-transform', checked ? 'translate-x-[19px]' : 'translate-x-[2px]')} /></span></button>;
  return <Sidebar><div className="scrollbar-thin flex-1 overflow-y-auto"><div className="mx-auto max-w-[960px] px-5 py-8 sm:px-8 sm:py-10">
    <div className="mb-8 animate-rise"><div className="font-mono text-[9px] uppercase tracking-[.19em] text-[#7890bd]">Twoja przestrzeń</div><h1 className="mt-2 text-[31px] font-semibold tracking-[-.055em]">Ustawienia</h1><p className="mt-2 text-[12px] text-[#8796ad]">Zarządzaj kontem, preferencjami i rozmowami.</p></div>
    <div className="grid gap-7 md:grid-cols-[190px_minmax(0,1fr)]">
      <nav className="flex gap-1 overflow-x-auto md:block md:space-y-1" aria-label="Sekcje ustawień">{menu.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => { setSection(item.id); setNotice(''); }} data-testid={`button-settings-${item.id}`} className={cx('flex h-10 shrink-0 items-center gap-2.5 rounded-lg px-3 text-[11px] transition md:w-full', section === item.id ? 'bg-[#172641] text-[#dfe9ff]' : 'text-[#8595ad] hover:bg-white/[.04] hover:text-white')}><Icon size={15} />{item.label}</button>; })}</nav>
      <div className="min-w-0 space-y-5"><Notice warn>Panel ustawień jest podglądem. Zmiany konta i zapis preferencji zostaną podłączone w kolejnej fazie.</Notice>{notice && <Notice>{notice}</Notice>}
        {section === 'account' && <div className="animate-rise space-y-4"><section className="rounded-2xl border border-[#202C43] bg-[#0B1020] p-5 sm:p-6"><div className="mb-5 flex items-start justify-between"><div><h2 className="text-[14px] font-semibold">Dane konta</h2><p className="mt-1 text-[11px] text-[#8190a8]">Informacje Twojej prywatnej przestrzeni.</p></div><div className="grid h-9 w-9 place-items-center rounded-full border border-[#42558b] bg-[#182744] text-[12px] font-semibold text-[#b9caff]">P</div></div><div className="space-y-4"><Field label="Nazwa użytkownika" placeholder="Dostępne po podłączeniu konta" disabled /><Field label="Adres e-mail" placeholder="Dostępne po podłączeniu konta" disabled /><button onClick={() => setNotice('Zmiana nazwy użytkownika będzie dostępna po podłączeniu API konta.')} className="h-10 rounded-xl border border-[#2c4165] px-4 text-[11px] font-semibold text-[#a9c3ff] hover:bg-white/[.04]">Zapisz nazwę</button></div></section><section className="rounded-2xl border border-[#202C43] bg-[#0B1020] p-5 sm:p-6"><div className="flex items-start gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl border border-[#263a5a] bg-[#111b2d] text-[#90adf2]"><ShieldCheck size={17} /></div><div><h2 className="text-[13px] font-semibold">Prywatność to podstawa</h2><p className="mt-1 text-[11px] leading-5 text-[#8493aa]">Zarządzanie prywatnością i danymi konta będzie dostępne po podłączeniu API.</p></div></div></section></div>}
        {section === 'preferences' && <section className="animate-rise rounded-2xl border border-[#202C43] bg-[#0B1020] p-5 sm:p-6"><div className="mb-3"><h2 className="text-[14px] font-semibold">Preferencje rozmów</h2><p className="mt-1 text-[11px] text-[#8190a8]">Podgląd lokalnych ustawień interfejsu.</p></div>{toggle(enter, setEnter, 'Enter wysyła wiadomość', 'Wyślij wiadomość klawiszem Enter. Shift + Enter dodaje nowy wiersz.')}{toggle(timestamps, setTimestamps, 'Pokazuj znaczniki czasu', 'Wyświetlaj godzinę wysłania każdej wiadomości.')}</section>}
        {section === 'security' && <div className="animate-rise space-y-4"><section className="rounded-2xl border border-[#202C43] bg-[#0B1020] p-5 sm:p-6"><div className="mb-5"><h2 className="text-[14px] font-semibold">Zmień hasło</h2><p className="mt-1 text-[11px] text-[#8190a8]">Ustaw długie, unikalne hasło do konta.</p></div><div className="space-y-4"><Field label="Obecne hasło" placeholder="Dostępne po podłączeniu konta" type="password" disabled /><Field label="Nowe hasło" placeholder="Co najmniej 12 znaków" type="password" disabled /><Field label="Potwierdź nowe hasło" placeholder="Wpisz hasło ponownie" type="password" disabled /><button onClick={() => setNotice('Zmiana hasła będzie dostępna po podłączeniu API konta.')} className="h-10 rounded-xl border border-[#2c4165] px-4 text-[11px] font-semibold text-[#a9c3ff] hover:bg-white/[.04]">Zmień hasło</button></div></section><section className="rounded-2xl border border-[#78404b]/70 bg-[#21161e] p-5 sm:p-6"><div className="mb-2 flex items-center gap-2 text-[#f1a2ae]"><LockKeyhole size={15} /><h2 className="text-[13px] font-semibold">Usuń konto</h2></div><p className="text-[11px] leading-5 text-[#b98f98]">Trwałe usunięcie konta będzie dostępne po podłączeniu API.</p><button onClick={() => setNotice('Usuwanie konta zostanie podłączone w kolejnej fazie.')} className="mt-4 h-9 rounded-lg border border-[#874351] px-3 text-[11px] font-semibold text-[#ffb4c0] hover:bg-[#612431]/30">Usuń konto</button></section></div>}
        {section === 'history' && <div className="animate-rise space-y-4"><section className="rounded-2xl border border-[#202C43] bg-[#0B1020] p-5 sm:p-6"><div className="mb-5 flex items-start justify-between gap-3"><div><h2 className="text-[14px] font-semibold">Historia rozmów</h2><p className="mt-1 text-[11px] text-[#8190a8]">Rozmowy zapisane na Twoim koncie.</p></div><span className="rounded-full border border-[#293a57] bg-[#111b2d] px-2.5 py-1 font-mono text-[9px] text-[#9dafcf]">—</span></div><div className="rounded-xl border border-dashed border-[#2b3b55] px-4 py-8 text-center"><MessageSquare size={18} className="mx-auto text-[#687a97]" /><p className="mt-3 text-[11px] text-[#8291a9]">Historia rozmów pojawi się po podłączeniu API.</p></div></section><section className="rounded-2xl border border-[#78404b]/60 bg-[#21161e] p-5 sm:p-6"><h2 className="text-[13px] font-semibold text-[#f1c3ca]">Wyczyść całą historię</h2><p className="mt-1 text-[11px] leading-5 text-[#b98f98]">Usuwanie zapisanych rozmów zostanie podłączone w kolejnej fazie.</p><button onClick={() => setNotice('Czyszczenie historii będzie dostępne po podłączeniu API.')} className="mt-4 h-9 rounded-lg border border-[#874351] px-3 text-[11px] font-semibold text-[#ffb4c0] hover:bg-[#612431]/30">Usuń wszystkie rozmowy</button></section></div>}
      </div>
    </div>
    <div className="mt-10 border-t border-[#202C43] pt-5 text-[9px] text-[#5f6e85]">Purple AI · Prywatna przestrzeń dla Twoich myśli</div>
  </div></div></Sidebar>;
}
function RedirectHome() { const [, setLocation] = useLocation(); return <main className="grid min-h-[100dvh] place-items-center"><div className="animate-rise text-center"><Brand /><p className="mt-5 text-xs text-[#8291a9]">Otwórz podgląd swojego miejsca do myślenia.</p><Link href="/login" onClick={() => setLocation('/login')} className="mt-5 inline-flex text-xs font-semibold text-[#9eb9ff]">Przejdź do logowania</Link></div></main>; }
function Router() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><Switch>
    <Route path="/" component={RedirectHome} />
    <Route path="/login" component={LoginPage} />
    <Route path="/register" component={RegisterPage} />
    <Route path="/forgot-password" component={ForgotPasswordPage} />
    <Route path="/reset-password" component={ResetPasswordPage} />
    <Route path="/app" component={ChatPage} />
    <Route path="/settings" component={SettingsPage} />
    <Route component={NotFound} />
  </Switch></ErrorBoundary>;
}
function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}
export default App;

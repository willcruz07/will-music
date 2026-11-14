import { MusicianLocationFields } from './MusicianLocationFields.tsx';
import { Check, MapPin, Music2, Save, Users } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { db } from '../lib/db.ts';
import { emptyMusicianProfile, MUSICAL_INSTRUMENTS, MUSICAL_LEVELS, MUSICAL_STYLES, type MusicianDetails, type MusicianProfile } from '../lib/musicianProfile.ts';
import { getCachedMusician, loadMusicianProfile, MUSICIAN_PROFILE_CHANGED, musicianProfileError, saveMusicianProfile, type CachedMusician } from '../lib/musicianProfileStore.ts';
import { useOnline } from '../lib/online.ts';
import { Button } from '../ui/Button.tsx';

const fieldClass = 'mt-2 min-h-11 w-full min-w-0 rounded-xl border border-border bg-background px-3 py-2 text-base';
const Group = ({ title, description, children }: { title: string; description: string; children: ReactNode }) => <section className="min-w-0 rounded-2xl border border-border bg-surface p-4 sm:p-5"><h3 className="font-semibold">{title}</h3><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p><div className="mt-4">{children}</div></section>;
const Chips = ({ label, choices, selected, onChange }: { label: string; choices: string[]; selected: string[]; onChange: (value: string[]) => void }) => <fieldset><legend className="mb-2 text-sm font-semibold">{label}</legend><div className="flex flex-wrap gap-2">{choices.map(value => <button key={value} type="button" aria-pressed={selected.includes(value)} onClick={() => onChange(selected.includes(value) ? selected.filter(item => item !== value) : [...selected, value])} className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 py-2 text-sm transition-colors ${selected.includes(value) ? 'border-primary bg-primary/10 font-semibold text-chord' : 'border-border hover:bg-muted'}`}>{selected.includes(value) && <Check aria-hidden className="size-3.5" />}{value}</button>)}</div></fieldset>;
const labels: Record<keyof MusicianProfile['socials'], string> = { instagram: 'Instagram', youtube: 'YouTube', tiktok: 'TikTok', facebook: 'Facebook', website: 'Site ou portfólio' };

export const MusicianProfileEditor = ({ uid, initialName }: { uid: string; initialName: string }) => {
  const online = useOnline();
  const [draft, setDraft] = useState<MusicianDetails>({ name: initialName, musicianProfile: emptyMusicianProfile() });
  const [record, setRecord] = useState<CachedMusician | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [readBlocked, setReadBlocked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const edited = useRef(false); const saveLock = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [counts, setCounts] = useState({ charts: 0, setlists: 0 });
  useEffect(() => {
    let active = true; let hadLocal = false;
    const show = (value: CachedMusician) => {
      if (!active) return;
      setRecord(value); setLoaded(true); setReadBlocked(false);
      if (!edited.current) setDraft({ name: value.account.name, musicianProfile: value.account.musicianProfile });
    };
    void (async () => {
      setError(null);
      const local = await getCachedMusician(uid);
      hadLocal = !!local;
      if (local) show(local);
      show(await loadMusicianProfile(uid));
    })().catch(() => { if (active) { setLoaded(true); setReadBlocked(!hadLocal && navigator.onLine); setError(hadLocal ? 'Não foi possível atualizar o perfil do servidor. Seu rascunho neste aparelho foi mantido.' : 'Não foi possível carregar o perfil. Tente novamente antes de editar, para preservar os dados que você já salvou.'); } });
    const changed = () => { void getCachedMusician(uid).then(value => { if (active && value) setRecord(value); }).catch(() => {}); };
    window.addEventListener(MUSICIAN_PROFILE_CHANGED, changed);
    void Promise.all([db.charts.toArray(), db.audio.toCollection().primaryKeys(), db.setlists.count()]).then(([charts, audioIds, setlists]) => {
      if (active) { const audio = new Set(audioIds); setCounts({ charts: new Set(charts.filter(chart => chart.chordPro.trim() && !audio.has(chart.songId)).map(chart => chart.songId)).size, setlists }); }
    }).catch(() => {});
    return () => { active = false; window.removeEventListener(MUSICIAN_PROFILE_CHANGED, changed); };
  }, [uid, retry]);
  const change = (next: MusicianDetails) => { edited.current = true; setDirty(true); setNotice(null); setDraft(next); };
  const profile = draft.musicianProfile;
  const patch = (value: Partial<MusicianProfile>) => change({ ...draft, musicianProfile: { ...profile, ...value } });
  const save = async () => {
    if (saveLock.current) return;
    saveLock.current = true; setSaving(true); setError(null); setNotice(null);
    try {
      await saveMusicianProfile(uid, draft);
      const latest = await getCachedMusician(uid);
      if (latest) { setRecord(latest); setDraft({ name: latest.account.name, musicianProfile: latest.account.musicianProfile }); }
      edited.current = false; setDirty(false);
      setNotice(latest?.pending ? 'Perfil salvo neste aparelho. Será enviado quando a conexão voltar.' : 'Seu perfil musical foi atualizado.');
    } catch (error) { setError(musicianProfileError(error)); }
    finally { saveLock.current = false; setSaving(false); }
  };
  if (!loaded) return <div role="status" aria-label="Carregando perfil musical" className="mt-6 space-y-3 animate-pulse"><div className="h-20 rounded-2xl bg-muted" /><div className="h-64 rounded-2xl bg-muted" /></div>;
  if (readBlocked) return <section className="mt-6 rounded-2xl border border-border p-4"><h2 className="text-xl font-semibold">Seu perfil musical</h2><p role="alert" className="mt-3 text-sm text-muted-foreground">{error || 'Carregando seus dados…'}</p><Button variant="outline" className="mt-3" onClick={() => setRetry(value => value + 1)}>Tentar carregar perfil</Button></section>;
  return <section className="mt-6 min-w-0" aria-labelledby="musician-profile-title">
    <div className="flex items-center gap-2"><Music2 className="size-5 text-chord" /><h2 id="musician-profile-title" className="text-xl font-semibold">Seu perfil musical</h2></div>
    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Conte um pouco sobre sua relação com a música. Você escolhe abaixo se deseja publicar seu perfil para outros músicos. Até ativar e salvar essa opção, seus dados continuam privados.</p>
    <dl className="mt-4 grid grid-cols-3 gap-2">{[[counts.charts, 'Cifras salvas'], [counts.setlists, 'Suas setlists'], [record?.account.contributions ?? '—', 'Contribuições']].map(([value, label]) => <div key={label} className="min-w-0 rounded-xl border border-border bg-surface px-2 py-3 text-center"><dd className="text-2xl font-bold tabular-nums text-chord">{value}</dd><dt className="mt-1 break-words text-xs text-muted-foreground">{label}</dt></div>)}</dl>
    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Cifras e setlists refletem sua biblioteca neste aparelho. Contribuições são registros confirmados pelo sistema; {record?.account.contributions === null || record === null ? 'ainda não há contagem registrada para esta conta.' : 'essa contagem não pode ser editada pelo perfil.'}</p>
    <form className="mt-5 space-y-4" onSubmit={event => { event.preventDefault(); void save(); }}>
      <fieldset disabled={saving} className="min-w-0 space-y-4 disabled:opacity-70">
        <Group title="Como você se apresenta" description="Seu nome aparece no aplicativo e nos próximos convites que você enviar.">
          <div className="grid min-w-0 gap-4 sm:grid-cols-2"><label className="min-w-0 text-sm font-semibold">Nome<input required autoComplete="name" maxLength={90} value={draft.name} onChange={event => change({ ...draft, name: event.target.value })} className={fieldClass} /></label><label className="min-w-0 text-sm font-semibold">Apelido ou nome artístico<input autoComplete="nickname" maxLength={40} value={profile.nickname} onChange={event => patch({ nickname: event.target.value })} className={fieldClass} placeholder="Como gostam de chamar você" /></label></div>
          <label className="mt-4 block text-sm font-semibold">Sobre você<textarea maxLength={600} rows={4} value={profile.bio} onChange={event => patch({ bio: event.target.value })} className={`${fieldClass} resize-y`} placeholder="O que você toca, como começou e o que gosta de criar ou estudar…" /></label><p className="mt-1 text-right text-xs tabular-nums text-muted-foreground">{profile.bio.length}/600</p>
        </Group>
        <Group title="De onde você é" description="Informe apenas sua cidade e região. Não precisamos do seu endereço.">
          <MusicianLocationFields value={profile.location} onChange={location => patch({ location })} />
          {profile.location.city && <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="size-3.5" />{[profile.location.city, profile.location.region, profile.location.country].filter(Boolean).join(' · ')}</p>}
        </Group>
        <Group title="Sua música" description="Selecione quantas opções fizerem sentido. Você pode mudar tudo isso depois.">
          <Chips label="Instrumentos e voz" choices={MUSICAL_INSTRUMENTS} selected={profile.instruments} onChange={instruments => patch({ instruments })} />
          <div className="mt-5"><Chips label="Estilos que você toca ou canta" choices={MUSICAL_STYLES} selected={profile.styles} onChange={styles => patch({ styles })} /></div>
          <fieldset className="mt-5"><legend className="mb-2 text-sm font-semibold">Sua experiência hoje</legend><div className="grid grid-cols-2 gap-2">{Object.entries(MUSICAL_LEVELS).map(([value, label]) => <button key={value} type="button" aria-pressed={profile.experience === value} onClick={() => patch({ experience: profile.experience === value ? '' : value as MusicianProfile['experience'] })} className={`min-h-11 min-w-0 break-words rounded-xl border px-3 py-2 text-left text-sm ${profile.experience === value ? 'border-primary bg-primary/10 font-semibold text-chord' : 'border-border hover:bg-muted'}`}>{label}</button>)}</div></fieldset>
        </Group>
        <Group title="Conexões e convites" description="Escolha como outras pessoas podem se conectar com você.">
          <label className="mb-3 flex cursor-pointer items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3"><input type="checkbox" checked={profile.discoverable} onChange={event => patch({ discoverable: event.target.checked })} className="mt-1 size-5 shrink-0 accent-[var(--primary)]" /><span><span className="block text-sm font-semibold">Permitir que outros músicos encontrem meu perfil</span><span className="mt-1 block text-xs leading-relaxed text-muted-foreground">Ao salvar, publica seu nome artístico (ou nome), foto, apresentação, cidade/região, instrumentos, estilos, experiência, redes sociais e disponibilidade para convites. Seu e-mail permanece privado. Desativar retira o perfil da busca após sincronizar.</span></span></label>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-background p-3"><input type="checkbox" checked={profile.acceptsInvites} onChange={event => patch({ acceptsInvites: event.target.checked })} className="mt-1 size-5 shrink-0 accent-[var(--primary)]" /><span className="min-w-0"><span className="flex items-center gap-2 text-sm font-semibold"><Users className="size-4 shrink-0 text-chord" />Receber novos convites de setlists</span><span className="mt-1 block text-xs leading-relaxed text-muted-foreground">Ao desativar, novos convites são bloqueados após sincronizar. Convites existentes e repertórios já aceitos continuam disponíveis.</span></span></label>
          <div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2">{(Object.keys(labels) as (keyof MusicianProfile['socials'])[]).map(key => <label key={key} className="min-w-0 text-sm font-semibold">{labels[key]}<input type="text" autoCapitalize="none" autoCorrect="off" spellCheck={false} inputMode={key === 'instagram' || key === 'tiktok' ? 'text' : 'url'} maxLength={300} value={profile.socials[key]} onChange={event => patch({ socials: { ...profile.socials, [key]: event.target.value } })} className={fieldClass} placeholder={key === 'instagram' || key === 'tiktok' ? '@seuusuario ou link completo' : 'https://…'} /></label>)}</div>
        </Group>
      </fieldset>
      {record?.pending && <p role="status" className="rounded-xl border border-border bg-surface p-3 text-sm text-muted-foreground">{online ? 'Há alterações guardadas neste aparelho aguardando envio.' : 'Seu perfil está salvo neste aparelho. A sincronização continua quando a conexão voltar.'}</p>}
      {error && <div role="alert" className="rounded-xl border border-danger/30 p-3"><p className="text-sm text-danger">{error}</p><Button variant="ghost" className="mt-2" disabled={saving} onClick={() => setRetry(value => value + 1)}>Atualizar dados do servidor</Button></div>}
      {notice && <p role="status" className="text-sm text-chord">{notice}</p>}
      <Button type="submit" disabled={saving || (!dirty && !record?.pending)} className="min-h-12 w-full"><Save className="size-4" />{saving ? 'Salvando perfil…' : !online ? 'Salvar perfil neste aparelho' : record?.pending && !dirty ? 'Tentar sincronizar perfil' : 'Salvar perfil musical'}</Button>
      <p className="text-xs leading-relaxed text-muted-foreground">Sua foto e seu e-mail continuam vinculados à conta Google. Alterar o nome aqui não modifica sua conta Google.</p>
    </form>
  </section>;
};

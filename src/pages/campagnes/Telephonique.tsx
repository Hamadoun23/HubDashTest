import { useEffect, useState } from 'react';
import { Download, Pencil, Phone, Trash2 } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { EtatChargement, EtatErreur } from '../../components/ui/EtatRequete';
import { useAction, useApi } from '../../lib/hooks/useApi';
import {
  enregistrerRapportTelephonique,
  listerTelephonique,
  optionsTelephonique,
  supprimerRapportTelephonique,
} from '../../lib/api/campagnes';
import { BASE } from '../../lib/api/campagnesClient';

const classeChamp =
  'w-full rounded-xl border border-border bg-surface2 px-3 py-2 text-sm text-white placeholder:text-muted focus:border-accent focus:outline-none disabled:opacity-50';

function ajd() {
  return new Date().toISOString().slice(0, 10);
}

function Champ({ label, requis, children }: { label: string; requis?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-muted">
        {label}
        {requis ? <span className="text-accent2"> *</span> : null}
      </label>
      {children}
    </div>
  );
}

function ChampCalcule({ label, valeur, note }: { label: string; valeur: string | number; note: string }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-muted/60">{label}</label>
      <div className="flex h-9 items-center rounded-xl border border-border bg-surface2/60 px-3 text-sm text-muted">{valeur}</div>
      <p className="mt-1 text-[11px] text-muted/60">{note}</p>
    </div>
  );
}

function SectionTitre({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-3 border-b border-border pb-2 text-xs font-semibold uppercase tracking-wide text-muted">{children}</h3>;
}

const NJ_CHAMPS: [string, string][] = [
  ['nj_repondeur', 'Répondeur'],
  ['nj_numero_errone', 'N° erroné'],
  ['nj_hors_reseau', 'Hors réseau'],
  ['nj_autres_nombre', 'Autres (nb)'],
];

export default function Telephonique() {
  const [date, setDate] = useState(ajd());
  const options = useApi(() => optionsTelephonique(date), [date]);
  const historique = useApi(() => listerTelephonique(), []);
  const enregistrement = useAction(enregistrerRapportTelephonique);
  const suppression = useAction(supprimerRapportTelephonique);

  const [champs, setChamps] = useState<Record<string, string>>({
    appels_emis: '0',
    appels_joignables: '0',
    clients_interesses_nombre: '0',
    clients_deja_servis_nombre: '0',
    nj_repondeur: '0',
    nj_numero_errone: '0',
    nj_hors_reseau: '0',
    nj_autres_nombre: '0',
    nj_autres_precision: '',
  });
  const [propose, setPropose] = useState<Record<string, string>>({});
  const [erreurValidation, setErreurValidation] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  // Une fiche par jour : à chaque changement de date, on retombe sur la fiche
  // déjà saisie pour ce jour (ou des champs vierges si le jour est libre).
  useEffect(() => {
    if (!options.donnees) return;
    const r = options.donnees.rapport;
    setChamps({
      appels_emis: String(r?.appels_emis ?? 0),
      appels_joignables: String(r?.appels_joignables ?? 0),
      clients_interesses_nombre: String(r?.clients_interesses_nombre ?? 0),
      clients_deja_servis_nombre: String(r?.clients_deja_servis_nombre ?? 0),
      nj_repondeur: String(r?.nj_repondeur ?? 0),
      nj_numero_errone: String(r?.nj_numero_errone ?? 0),
      nj_hors_reseau: String(r?.nj_hors_reseau ?? 0),
      nj_autres_nombre: String(r?.nj_autres_nombre ?? 0),
      nj_autres_precision: r?.nj_autres_precision ?? '',
    });
    setPropose(Object.fromEntries(options.donnees.typesCampagne.map((t) => [String(t.id), String(r?.propose?.[String(t.id)] ?? 0)])));
  }, [options.donnees]);

  function set(cle: string, valeur: string) {
    setChamps((c) => ({ ...c, [cle]: valeur }));
  }

  function num(cle: string) {
    return parseInt(champs[cle], 10) || 0;
  }

  if (historique.erreur) return <EtatErreur message={historique.erreur} recharger={historique.recharger} />;
  if (options.erreur) return <EtatErreur message={options.erreur} recharger={options.recharger} />;
  if (options.chargement || !options.donnees) return <EtatChargement texte="Chargement de la fiche…" />;

  const o = options.donnees;
  const verrouille = o.rapportVerrouille;

  const emis = num('appels_emis');
  const joignables = Math.min(num('appels_joignables'), emis);
  const nonJoignables = Math.max(0, emis - joignables);
  const taux = emis > 0 ? `${((joignables / emis) * 100).toFixed(2).replace('.', ',')} %` : '—';
  const njSum = ['nj_repondeur', 'nj_numero_errone', 'nj_hors_reseau', 'nj_autres_nombre'].reduce((s, c) => s + num(c), 0);
  const njOver = njSum > nonJoignables;

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    if (verrouille) return;
    setErreurValidation(null);
    setConfirmation(null);

    if (num('appels_joignables') > num('appels_emis')) {
      setErreurValidation('Le nombre de joignables ne peut pas dépasser les appels émis.');
      return;
    }
    if (njOver) {
      setErreurValidation(
        `Total section 5 : ${njSum} — maximum autorisé (non joignables) : ${nonJoignables}. Ajustez les quantités.`,
      );
      return;
    }
    if (num('nj_autres_nombre') > 0 && !champs.nj_autres_precision.trim()) {
      setErreurValidation('Précisez le motif « autres » lorsque le nombre est supérieur à 0.');
      return;
    }

    const props = await enregistrement.executer({
      date_rapport: date,
      appels_emis: num('appels_emis'),
      appels_joignables: num('appels_joignables'),
      clients_interesses_nombre: num('clients_interesses_nombre'),
      clients_deja_servis_nombre: num('clients_deja_servis_nombre'),
      propose: Object.fromEntries(Object.entries(propose).map(([id, v]) => [id, parseInt(v, 10) || 0])),
      nj_repondeur: num('nj_repondeur'),
      nj_numero_errone: num('nj_numero_errone'),
      nj_hors_reseau: num('nj_hors_reseau'),
      nj_autres_nombre: num('nj_autres_nombre'),
      nj_autres_precision: champs.nj_autres_precision || undefined,
    });

    if (props.errors && Object.keys(props.errors).length > 0) {
      setErreurValidation(Object.values(props.errors)[0]);
      return;
    }
    setConfirmation('Fiche enregistrée.');
    options.recharger();
    historique.recharger();
  }

  async function supprimer(id: number) {
    if (!confirm('Supprimer définitivement cette fiche ?')) return;
    await suppression.executer(id);
    historique.recharger();
  }

  const totaux = historique.donnees?.totauxListe;

  return (
    <div>
      <PageHeader icon={Phone} titre="Reporting téléphonique" sousTitre={historique.donnees?.libelleStatsCampagne} />

      <p className="mb-3 text-sm text-muted">
        Une fiche par jour. Les chiffres sont enregistrés pour la date indiquée (modifiable si vous devez compléter une journée passée).
      </p>

      {o.campagneActiveNom ? (
        <p className="mb-3 text-sm text-white/85">
          <span className="text-muted">Campagne active :</span> <strong>{o.campagneActiveNom}</strong> — les types de cartes ci-dessous
          correspondent à cette campagne.
        </p>
      ) : (
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-400">
          Aucune campagne active pour votre périmètre : la section « types de cartes » est vide. Contactez l'administrateur.
        </div>
      )}

      {verrouille && (
        <div className="mb-4 rounded-lg border border-border bg-surface2 px-4 py-2.5 text-sm text-muted">
          Cette fiche a été enregistrée il y a plus de 48 h : consultation seule. Pour saisir une autre journée, modifiez la date ci-dessous.
        </div>
      )}
      {confirmation && (
        <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-sm text-emerald-400">{confirmation}</div>
      )}
      {erreurValidation && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-400">{erreurValidation}</div>
      )}
      {enregistrement.erreur && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-400">{enregistrement.erreur}</div>
      )}

      <Card className="mb-6">
        <form onSubmit={envoyer} className="flex flex-col gap-6">
          <div>
            <SectionTitre>1. Identification</SectionTitre>
            <Champ label="Date du reporting" requis>
              <input type="date" className={classeChamp} value={date} onChange={(e) => setDate(e.target.value)} required />
            </Champ>
          </div>

          <div>
            <SectionTitre>2. Activité journalière</SectionTitre>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Champ label="Appels émis" requis>
                <input type="number" min={0} disabled={verrouille} className={classeChamp} value={champs.appels_emis} onChange={(e) => set('appels_emis', e.target.value)} required />
              </Champ>
              <Champ label="Joignables" requis>
                <input type="number" min={0} disabled={verrouille} className={classeChamp} value={champs.appels_joignables} onChange={(e) => set('appels_joignables', e.target.value)} required />
              </Champ>
              <ChampCalcule label="Non joignables" valeur={nonJoignables} note="Calculé : émis − joignables" />
              <ChampCalcule label="Taux de joignabilité" valeur={taux} note="Calculé automatiquement" />
            </div>
          </div>

          <div>
            <SectionTitre>3. Résultats des appels</SectionTitre>
            <div className="grid grid-cols-2 gap-3">
              <Champ label="Clients intéressés (nombre)" requis>
                <input type="number" min={0} disabled={verrouille} className={classeChamp} value={champs.clients_interesses_nombre} onChange={(e) => set('clients_interesses_nombre', e.target.value)} required />
              </Champ>
              <Champ label="Clients déjà servis — cartes récupérées" requis>
                <input type="number" min={0} disabled={verrouille} className={classeChamp} value={champs.clients_deja_servis_nombre} onChange={(e) => set('clients_deja_servis_nombre', e.target.value)} required />
              </Champ>
            </div>
          </div>

          <div>
            <SectionTitre>4. Type de carte proposée (nombre par type, campagne en cours)</SectionTitre>
            {o.typesCampagne.length === 0 ? (
              <p className="text-sm text-muted">Aucun type de carte disponible pour cette campagne — complétez les autres sections puis enregistrez.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {o.typesCampagne.map((t) => (
                  <Champ key={t.id} label={t.code} requis>
                    <input
                      type="number"
                      min={0}
                      disabled={verrouille}
                      className={classeChamp}
                      value={propose[String(t.id)] ?? '0'}
                      onChange={(e) => setPropose((p) => ({ ...p, [String(t.id)]: e.target.value }))}
                      required
                    />
                  </Champ>
                ))}
              </div>
            )}
          </div>

          <div>
            <SectionTitre>5. Appels non joignables — analyse</SectionTitre>
            <p className="mb-2 text-sm text-muted">
              Le total des quatre cases ci-dessous ne doit pas dépasser le <strong className="text-white">non joignable</strong> de la section 2
              (émis − joignables).
            </p>
            {njOver && !verrouille && (
              <div className="mb-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-sm text-amber-400">
                Total section 5 : {njSum} — maximum autorisé (non joignables) : {nonJoignables}. Ajustez les quantités.
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {NJ_CHAMPS.map(([cle, label]) => (
                <Champ key={cle} label={label} requis>
                  <input type="number" min={0} disabled={verrouille} className={classeChamp} value={champs[cle]} onChange={(e) => set(cle, e.target.value)} required />
                </Champ>
              ))}
              <div className="col-span-2 sm:col-span-4">
                <Champ label={`Autres (précision)${!verrouille && num('nj_autres_nombre') > 0 ? ' — obligatoire si « Autres (nb) » > 0' : ''}`}>
                  <input maxLength={500} disabled={verrouille} className={classeChamp} value={champs.nj_autres_precision} onChange={(e) => set('nj_autres_precision', e.target.value)} />
                </Champ>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 border-t border-border pt-4">
            {verrouille ? (
              <>
                <button type="button" disabled className="rounded-xl bg-accent px-4 py-2.5 text-xs font-bold text-black opacity-50">
                  Enregistrer la fiche
                </button>
                <span className="text-sm text-muted">Fiche verrouillée (48 h)</span>
              </>
            ) : (
              <button type="submit" disabled={enregistrement.enCours} className="rounded-xl bg-accent px-4 py-2.5 text-xs font-bold text-black disabled:opacity-60">
                {enregistrement.enCours ? 'Enregistrement…' : 'Enregistrer la fiche'}
              </button>
            )}
          </div>
        </form>
      </Card>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold text-white">Mes fiches de reporting</h2>
        <a href={`${BASE}/reporting-telephonique/export-excel`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs font-semibold text-accent2">
          <Download size={14} /> Exporter
        </a>
      </div>

      <Card className="overflow-hidden !p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 text-right font-medium">Appels émis</th>
                <th className="px-4 py-3 text-right font-medium">Joignables</th>
                <th className="px-4 py-3 text-right font-medium">Non joignables</th>
                <th className="px-4 py-3 text-right font-medium">Taux joign.</th>
                <th className="px-4 py-3 text-right font-medium">Intéressés</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(historique.donnees?.rapports.data ?? []).map((r) => (
                <tr key={r.id} className="border-b border-border/60 last:border-0 hover:bg-surface2/60">
                  <td className="px-4 py-3">
                    <button onClick={() => setDate(r.date_iso)} className="text-white hover:text-accent2">
                      {r.date}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right text-white">{r.appels_emis}</td>
                  <td className="px-4 py-3 text-right text-white">{r.appels_joignables}</td>
                  <td className="px-4 py-3 text-right text-white">{r.appels_non_joignables}</td>
                  <td className="px-4 py-3 text-right text-white">{r.taux_joignabilite ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-white">{r.clients_interesses_nombre}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      {r.peut_modifier ? (
                        <>
                          <button title="Modifier" onClick={() => setDate(r.date_iso)} className="rounded-md p-1.5 text-muted hover:bg-surface2 hover:text-white">
                            <Pencil size={15} />
                          </button>
                          <button title="Supprimer" onClick={() => supprimer(r.id)} className="rounded-md p-1.5 text-red-400 hover:bg-red-500/10">
                            <Trash2 size={15} />
                          </button>
                        </>
                      ) : (
                        <span className="p-1.5 text-muted/40" title="Modification impossible après 48 h">
                          <Pencil size={15} />
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {(historique.donnees?.rapports.data ?? []).length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted">
                    Aucune fiche enregistrée.
                  </td>
                </tr>
              )}
            </tbody>
            {totaux && totaux.nb_fiches > 0 && (
              <tfoot className="border-t border-border bg-surface2/60 text-sm font-semibold text-white">
                <tr>
                  <td className="px-4 py-2.5 text-right">Total ({totaux.nb_fiches})</td>
                  <td className="px-4 py-2.5 text-right">{totaux.appels_emis}</td>
                  <td className="px-4 py-2.5 text-right">{totaux.appels_joignables}</td>
                  <td className="px-4 py-2.5 text-right">{totaux.appels_non_joignables}</td>
                  <td></td>
                  <td className="px-4 py-2.5 text-right">{totaux.clients_interesses}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>
    </div>
  );
}

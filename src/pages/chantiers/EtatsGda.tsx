/** États de chargement / d'erreur aux couleurs du thème Chantiers (carte sombre, texte crème). */
export function EtatChargement({ texte = 'Chargement…' }: { texte?: string }) {
  return (
    <div className="card gda-legacy" style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--blanc-texte)', fontSize: 14 }}>
      <span className="etat-spinner" aria-hidden="true" />
      {texte}
    </div>
  );
}

export function EtatErreur({ message, recharger }: { message: string; recharger?: () => void }) {
  return (
    <div className="card gda-legacy" style={{ textAlign: 'center', padding: '32px 20px' }}>
      <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--blanc)', marginBottom: 6 }}>Impossible de charger ces données</div>
      <div style={{ fontSize: 13, color: 'var(--blanc-discret)', maxWidth: 420, margin: '0 auto' }}>{message}</div>
      {recharger && (
        <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 14 }} onClick={recharger}>
          Réessayer
        </button>
      )}
    </div>
  );
}

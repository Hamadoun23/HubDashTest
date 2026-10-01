import { useEffect, useRef } from 'react';
import Chart, { type Plugin } from 'chart.js/auto';
import type { Dashboard } from '../../lib/api/chantiers';

export const TOUTES = '__all__';

// Palette de daily.gdamali.net (mêmes teintes que le thème : vert, orange, bleu, rouge)
// — les graphiques sont dans des cartes sombres, l'orange y reste lisible.
const COULEURS = {
  termine: '#1a7a42',
  en_cours: '#c8521a',
  non_demarre: '#9a9285',
  annule: '#c01a1a',
};
const TEXTE = 'rgba(251,241,228,0.8)';
const ETIQUETTE = '#fbf1e4';
const GRILLE = 'rgba(251,241,228,0.10)';
const POLICE = "'Manrope', system-ui, sans-serif";

/** Teinte d'une barre selon l'avancement : vert = terminé, orange = en cours, gris = pas démarré. */
const couleurAvancement = (p: number) => (p >= 100 ? COULEURS.termine : p > 0 ? COULEURS.en_cours : COULEURS.non_demarre);

const INFOBULLE = {
  backgroundColor: 'rgba(20,12,7,0.96)',
  borderColor: 'rgba(240,207,160,0.4)',
  borderWidth: 1,
  padding: 12,
  cornerRadius: 10,
  titleColor: '#f0cfa0',
  bodyColor: '#fbf1e4',
  titleFont: { weight: 700 as const, size: 12 },
  bodyFont: { size: 12 },
  displayColors: false,
};

/** Écrit la valeur au bout de chaque barre horizontale (lisible sans survol). */
const valeursBarres = {
  id: 'valeursBarres',
  afterDatasetsDraw(chart: Chart) {
    const { ctx } = chart;
    ctx.save();
    ctx.font = `700 11px ${POLICE}`;
    ctx.fillStyle = '#fbf1e4';
    ctx.textBaseline = 'middle';
    chart.getDatasetMeta(0).data.forEach((barre, i) => {
      const valeur = Number(chart.data.datasets[0].data[i]);
      const { x, y } = barre.tooltipPosition(false);
      ctx.fillText(`${valeur}%`, Math.min(x + 8, chart.chartArea.right - 30), y);
    });
    ctx.restore();
  },
};

/** Écrit le total au centre du donut. */
const totalCentre: Plugin<'doughnut'> = {
  id: 'totalCentre',
  afterDraw(chart) {
    const total = (chart.data.datasets[0].data as number[]).reduce((a, b) => a + Number(b), 0);
    const { left, right, top, bottom } = chart.chartArea;
    const { ctx } = chart;
    const cx = (left + right) / 2;
    const cy = (top + bottom) / 2;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fbf1e4';
    ctx.font = `800 30px 'Outfit', ${POLICE}`;
    ctx.fillText(String(total), cx, cy - 6);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = `600 10px ${POLICE}`;
    ctx.fillText('ACTIVITÉS', cx, cy + 16);
    ctx.restore();
  },
};

/** Port de `renderGdaCharts()` (gda-app.js) — mêmes séries, palette adaptée au thème sombre. */
export function useGraphiques(tableau: Dashboard | null, filtrePhase: string) {
  const pie = useRef<HTMLCanvasElement>(null);
  const phase = useRef<HTMLCanvasElement>(null);
  const sub = useRef<HTMLCanvasElement>(null);
  const act = useRef<HTMLCanvasElement>(null);
  const actWrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!tableau) return;
    const instances: { destroy(): void }[] = [];
    Chart.defaults.font.family = POLICE;
    Chart.defaults.color = TEXTE;
    const ch = tableau.charts;

    const sc = ch.status_counts ?? {};
    const pieDef: [keyof typeof COULEURS, string][] = [
      ['termine', 'Terminées'],
      ['en_cours', 'En cours'],
      ['non_demarre', 'Non démarrées'],
      ['annule', 'Annulées'],
    ];
    const pieActifs = pieDef.filter(([cle]) => Number(sc[cle] ?? 0) > 0);
    if (pie.current && pieActifs.length) {
      instances.push(
        new Chart<'doughnut'>(pie.current, {
          type: 'doughnut',
          data: {
            labels: pieActifs.map(([, l]) => l),
            datasets: [
              {
                data: pieActifs.map(([cle]) => Number(sc[cle])),
                backgroundColor: pieActifs.map(([cle]) => COULEURS[cle]),
                borderWidth: 3,
                borderColor: 'rgba(30,18,11,0.95)',
                hoverOffset: 8,
                spacing: 2,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '66%',
            layout: { padding: 6 },
            plugins: {
              legend: {
                position: 'bottom',
                labels: { boxWidth: 10, boxHeight: 10, padding: 16, color: '#fbf1e4', font: { size: 12, weight: 600 }, usePointStyle: true, pointStyle: 'circle' },
              },
              tooltip: { ...INFOBULLE, callbacks: { label: (c) => ` ${c.label} : ${c.raw} activité(s)` } },
            },
          },
          plugins: [totalCentre],
        }),
      );
    }

    const phases = tableau.progress_by_phase;
    if (phase.current && phases.length) {
      instances.push(
        new Chart(phase.current, {
          type: 'bar',
          data: {
            labels: phases.map((p) => p.phase),
            datasets: [
              {
                label: 'Avancement par phase (%)',
                data: phases.map((p) => p.progress),
                backgroundColor: phases.map((p) => couleurAvancement(p.progress)),
                borderRadius: 8,
                borderSkipped: false,
                maxBarThickness: 46,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              y: { beginAtZero: true, max: 100, grid: { color: GRILLE }, border: { display: false }, ticks: { callback: (v) => `${v}%`, font: { size: 10 }, color: TEXTE } },
              x: {
                grid: { display: false },
                border: { display: false },
                ticks: { maxRotation: 40, minRotation: 0, autoSkip: true, maxTicksLimit: 14, font: { size: 11, weight: 600 }, color: ETIQUETTE },
              },
            },
            plugins: {
              legend: { display: false },
              tooltip: { ...INFOBULLE, callbacks: { label: (c) => ` ${phases[c.dataIndex].progress}% · ${phases[c.dataIndex].task_count} activité(s)` } },
            },
          },
        }),
      );
    }

    const subs = ch.subphases;
    if (sub.current && subs.length) {
      instances.push(
        new Chart(sub.current, {
          type: 'bar',
          data: {
            labels: subs.map((s) => (s.subphase.length > 44 ? `${s.subphase.slice(0, 42)}…` : s.subphase)),
            datasets: [
              {
                label: 'Sous-phases — progression moyenne',
                data: subs.map((s) => s.avg_progress),
                backgroundColor: subs.map((s) => couleurAvancement(s.avg_progress)),
                borderRadius: 8,
                borderSkipped: false,
                barThickness: 16,
              },
            ],
          },
          options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { right: 34 } },
            scales: {
              x: { beginAtZero: true, max: 100, grid: { color: GRILLE }, border: { display: false }, ticks: { callback: (v) => `${v}%`, font: { size: 10 }, color: TEXTE } },
              y: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 12, weight: 600 }, color: ETIQUETTE } },
            },
            plugins: {
              legend: { display: false },
              tooltip: {
                ...INFOBULLE,
                callbacks: {
                  title: (items) => `${subs[items[0].dataIndex].phase} — ${subs[items[0].dataIndex].subphase}`,
                  label: (item) => ` ${item.raw}% · ${subs[item.dataIndex].task_count} activité(s)`,
                },
              },
            },
          },
          plugins: [valeursBarres],
        }),
      );
    }

    const acts = filtrePhase === TOUTES ? ch.activities : ch.activities.filter((a) => a.phase === filtrePhase);
    if (actWrap.current) actWrap.current.style.height = `${Math.min(780, Math.max(200, 24 * acts.length + 72))}px`;
    if (act.current && acts.length) {
      const couleur = (a: (typeof acts)[number]) => {
        if (a.status === 'annule') return COULEURS.annule;
        if (a.progress >= 100 || a.status === 'termine') return COULEURS.termine;
        if (a.progress > 0 || a.status === 'en_cours') return COULEURS.en_cours;
        return COULEURS.non_demarre;
      };
      instances.push(
        new Chart(act.current, {
          type: 'bar',
          data: {
            labels: acts.map((a) => {
              const s = `${a.subphase} — ${a.activity}${a.partner_hidden ? ' [Masqué]' : ''}`;
              return s.length > 48 ? `${s.slice(0, 46)}…` : s;
            }),
            datasets: [
              { label: 'Activités — progression', data: acts.map((a) => a.progress), backgroundColor: acts.map(couleur), borderRadius: 7, borderSkipped: false, barThickness: 14 },
            ],
          },
          options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { right: 34 } },
            scales: {
              x: { beginAtZero: true, max: 100, grid: { color: GRILLE }, border: { display: false }, ticks: { callback: (v) => `${v}%`, color: TEXTE } },
              y: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 11, weight: 600 }, color: ETIQUETTE } },
            },
            plugins: {
              legend: { display: false },
              tooltip: {
                ...INFOBULLE,
                callbacks: {
                  title: (items) => {
                    const a = acts[items[0].dataIndex];
                    return `${a.phase} — ${a.subphase} — ${a.activity}`;
                  },
                  label: (item) => ` ${item.raw}%${acts[item.dataIndex].status === 'annule' ? ' · annulée' : ''}`,
                },
              },
            },
          },
          plugins: [valeursBarres],
        }),
      );
    }

    return () => instances.forEach((c) => c.destroy());
  }, [tableau, filtrePhase]);

  return { pie, phase, sub, act, actWrap };
}

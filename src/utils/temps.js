/** Utilitaires de temps — le moteur travaille sur une horloge « naïve » (heure locale du compte). */

const JOUR = 86_400_000;

export const pad = (n) => String(n).padStart(2, '0');

/** 1005 → "16:45" ; 1440 → "00:00". */
export function minutesVersHHMM(minutes) {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

/** "16:45" → 1005. */
export function hhmmVersMinutes(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** "2026-10-21" + 1005 → "2026-10-21T16:45:00" (sans fuseau, volontairement). */
export function isoNaif(date, minutes) {
  return `${date}T${minutesVersHHMM(minutes)}:00`;
}

/** Ajoute (ou retire) des jours à une date YYYY-MM-DD, sans dérive de fuseau. */
export function ajouterJours(date, jours) {
  const [a, m, j] = String(date).split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1, j));
  d.setUTCDate(d.getUTCDate() + jours);
  return d.toISOString().slice(0, 10);
}

/** 0 = dimanche … 6 = samedi. */
export function jourSemaine(date) {
  const [a, m, j] = String(date).split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, j)).getUTCDay();
}

const NOMS_JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

export function nomJour(date) {
  return NOMS_JOURS[jourSemaine(date)];
}

/** Date du jour dans un fuseau donné (YYYY-MM-DD). */
export function dateDansFuseau(fuseau, date = new Date()) {
  try {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: fuseau,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return fmt.format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/** Heure courante (HH:MM) dans un fuseau donné. */
export function heureDansFuseau(fuseau, date = new Date()) {
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      timeZone: fuseau,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  } catch {
    return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
  }
}

export function formatDateFr(date, options = {}) {
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      ...options,
    }).format(new Date(`${date}T12:00:00Z`));
  } catch {
    return date;
  }
}

export function formatDateHeureFr(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso.length <= 19 ? `${iso}Z` : iso);
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return iso;
  }
}

export function secondesVersTexte(sec) {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h} h ${pad(m)}`;
  return `${m} min`;
}

export function minutesEntre(a, b) {
  return Math.abs(hhmmVersMinutes(a) - hhmmVersMinutes(b));
}

export function dureeCycleMs(jours) {
  return jours * JOUR;
}

export { JOUR };

/** Alias sémantique : date + minute → horodatage local « 2026-10-21T17:20:00 ». */
export const DATE_HEURE = isoNaif;

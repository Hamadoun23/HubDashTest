/**
 * Réduit une photo avant envoi : une photo de téléphone fait souvent 5 à
 * 12 Mo, quand un avatar n'a besoin que de quelques centaines de pixels.
 * Le résultat est un JPEG carré-ou-pas d'au plus `cote` pixels de côté.
 */
export async function reduirePhoto(fichier: File, cote = 800, qualite = 0.85): Promise<File> {
  if (!fichier.type.startsWith('image/') || fichier.type === 'image/gif') return fichier;
  const url = URL.createObjectURL(fichier);
  try {
    const image = await new Promise<HTMLImageElement>((resoudre, rejeter) => {
      const img = new Image();
      img.onload = () => resoudre(img);
      img.onerror = () => rejeter(new Error("Cette image n'a pas pu être lue. Essayez une photo JPEG ou PNG."));
      img.src = url;
    });
    const echelle = Math.min(1, cote / Math.max(image.naturalWidth, image.naturalHeight));
    const largeur = Math.round(image.naturalWidth * echelle);
    const hauteur = Math.round(image.naturalHeight * echelle);
    const toile = document.createElement('canvas');
    toile.width = largeur;
    toile.height = hauteur;
    toile.getContext('2d')?.drawImage(image, 0, 0, largeur, hauteur);
    const blob = await new Promise<Blob | null>((resoudre) => toile.toBlob(resoudre, 'image/jpeg', qualite));
    if (!blob) return fichier;
    return new File([blob], fichier.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } finally {
    URL.revokeObjectURL(url);
  }
}

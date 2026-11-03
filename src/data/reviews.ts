export interface ReviewItem {
  id: string;
  author: string;
  initials: string;
  rating: number;
  date: string;
  text: string;
  service: string;
  badge?: string;
}

export const reviewsData: ReviewItem[] = [
  {
    id: 'rev-1',
    author: 'Felipe VA',
    initials: 'FV',
    rating: 5,
    date: 'Hace 5 meses',
    text: 'Profesionales de primer nivel. 100% recomendable. Llegué con mi pierna adolorida y salí sin dolor después de atenderme.',
    service: 'Alivio del Dolor & Movilidad',
    badge: 'Local Guide · Google Maps',
  },
  {
    id: 'rev-2',
    author: 'Javier Dentista',
    initials: 'JD',
    rating: 5,
    date: 'Hace 3 semanas',
    text: 'Excelente experiencia con Eduardo (acupuntura) y Felipe (Quiropraxia) 🙌🏾',
    service: 'Acupuntura & Quiropraxia',
    badge: 'Opinión Verificada',
  },
  {
    id: 'rev-3',
    author: 'Elayne Daer',
    initials: 'ED',
    rating: 5,
    date: 'Hace 1 mes',
    text: 'Excelente profesional, extremadamente responsable y honesto... estoy en tratamiento con él y siento cuánto me está haciendo bien.',
    service: 'Tratamiento Continuo',
    badge: 'Opinión Verificada',
  },
  {
    id: 'rev-4',
    author: 'Eloy',
    initials: 'EG',
    rating: 5,
    date: 'Hace 11 meses',
    text: 'Muy buena atención, los profesionales son super atentos y mi dolor de espalda desapareció con una sola atención, de verdad me salvaron.',
    service: 'Columna & Espalda',
    badge: 'Local Guide · Google Maps',
  },
  {
    id: 'rev-5',
    author: 'Javier Ñanculef Alegría',
    initials: 'JN',
    rating: 5,
    date: 'Hace 1 mes',
    text: 'He asistido a una sesión con Eduardo y dos sesiones con Felipe. Increíble la diferencia que pueden hacer en una sesión. Recomendado para deportistas 👍🏾🙌🏾',
    service: 'Kinesiología Deportiva',
    badge: 'Opinión Verificada',
  },
];

export interface Professional {
  id: 'felipe' | 'eduardo';
  name: string;
  discipline: 'quiropraxia' | 'acupuntura';
  title: string;
  credential: string;
  registrationNumber?: string;
  phone: string;
  phoneFormatted: string;
  whatsappMessage: string;
  photoUrl: string;
  accentColor: string;
  lightColor: string;
  borderColor: string;
  themeClass: string;
  badgeLabel: string;
  bio: string;
  specialties: string[];
}

export const professionals: Record<'felipe' | 'eduardo', Professional> = {
  felipe: {
    id: 'felipe',
    name: 'Felipe Méndez',
    discipline: 'quiropraxia',
    title: 'Quiropráctico & Kinesiólogo',
    credential: 'Certificado Minsal · Especialista en Columna y Biomecánica',
    registrationNumber: 'Reg. SIS N° 458921',
    phone: '+56973700616',
    phoneFormatted: '+569 7370 0616',
    whatsappMessage: 'Hola Felipe, quisiera consultar por una evaluación quiropráctica / kinesiológica en Centro Vida Sana Austral.',
    photoUrl: '/pix/felipe-kinesiologo-400.webp',
    accentColor: '#134E5E',
    lightColor: '#EBF4F6',
    borderColor: '#C9DFE6',
    themeClass: 'petrol',
    badgeLabel: 'Quiropraxia & Kinesiología',
    bio: 'Especialista en evaluación biomecánica, ajustes vertebrales de alta precisión y rehabilitación integral. Enfoque clínico orientado a eliminar la causa raíz del dolor lumbar, cervical y disfunciones articulares.',
    specialties: [
      'Ajustes vertebrales específicos',
      'Descompresión y dolor lumbar/ciática',
      'Rehabilitación deportiva y traumatológica',
      'Kinesiología respiratoria y motora a domicilio',
    ],
  },
  eduardo: {
    id: 'eduardo',
    name: 'Eduardo Lagos',
    discipline: 'acupuntura',
    title: 'Acupunturista Clínico Minsal',
    credential: 'Acreditado Minsal · Docente de Medicina Tradicional China',
    registrationNumber: 'Reg. SIS N° 381042',
    phone: '+56973888910',
    phoneFormatted: '+569 7388 8910',
    whatsappMessage: 'Hola Eduardo, quisiera consultar por una sesión de acupuntura / medicina tradicional china en Centro Vida Sana Austral.',
    photoUrl: '/pix/eduardo-acupuntura-400.webp',
    accentColor: '#2E4D38',
    lightColor: '#EFF5F0',
    borderColor: '#D3E3D6',
    themeClass: 'sage',
    badgeLabel: 'Acupuntura & Med. China',
    bio: 'Experto en Medicina Tradicional China con amplia trayectoria en Temuco. Aplica técnicas milenarias combinadas con neuroacupuntura moderna para el alivio de dolores crónicos, migrañas, estrés y equilibrio orgánico.',
    specialties: [
      'Acupuntura sistémica y neuroacupuntura',
      'Electroacupuntura para dolor crónico',
      'Terapia con ventosas fijas y dinámicas (Cupping)',
      'Moxibustión y fitoterapia complementaria',
    ],
  },
};

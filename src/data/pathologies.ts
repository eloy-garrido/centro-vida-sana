export interface TreatmentTag {
  label: string;
  type: 'kine' | 'quiro' | 'acu';
}

export interface PathologyItem {
  id: string;
  name: string;
  description: string;
  treatments: TreatmentTag[];
  whatsappMessage: string;
  phone: string;
}

export const pathologiesData: PathologyItem[] = [
  {
    id: 'dolor-lumbar-cervical',
    name: 'Dolor Lumbar y Cervical',
    description: 'Hernias discales, lumbalgias crónicas y cervicalgias que limitan tu movilidad y calidad de vida diaria.',
    treatments: [
      { label: 'Kinesiología', type: 'kine' },
      { label: 'Quiropraxia', type: 'quiro' },
      { label: 'Acupuntura', type: 'acu' },
    ],
    whatsappMessage: 'Hola, quisiera consultar por tratamiento para Dolor Lumbar y Cervical en Centro Vida Sana Austral.',
    phone: '+56973700616', // Felipe (Kine/Quiro) & recepción
  },
  {
    id: 'lesiones-deportivas',
    name: 'Lesiones Deportivas',
    description: 'Esguinces, tendinitis y contracturas musculares para una recuperación rápida y efectiva que te devuelva al deporte.',
    treatments: [
      { label: 'Kinesiología', type: 'kine' },
      { label: 'Quiropraxia', type: 'quiro' },
    ],
    whatsappMessage: 'Hola, quisiera consultar por rehabilitación de una Lesión Deportiva / Tendinitis en Centro Vida Sana Austral.',
    phone: '+56973700616', // Felipe
  },
  {
    id: 'problemas-posturales',
    name: 'Problemas Posturales',
    description: 'Escoliosis, cifosis y lordosis que generan dolor crónico y alteran tu postura, equilibrio y bienestar general.',
    treatments: [
      { label: 'Kinesiología', type: 'kine' },
      { label: 'Quiropraxia', type: 'quiro' },
    ],
    whatsappMessage: 'Hola, quisiera consultar por evaluación postural y tratamiento quiropráctico.',
    phone: '+56973700616', // Felipe
  },
  {
    id: 'cefaleas-migranas',
    name: 'Cefaleas y Migrañas',
    description: 'Dolores de cabeza crónicos de origen cervical o tensional que afectan tu concentración y calidad de vida.',
    treatments: [
      { label: 'Acupuntura', type: 'acu' },
      { label: 'Quiropraxia', type: 'quiro' },
    ],
    whatsappMessage: 'Hola, quisiera consultar por tratamiento para Cefaleas y Migrañas en Centro Vida Sana Austral.',
    phone: '+56973888910', // Eduardo (Acupuntura)
  },
  {
    id: 'tunel-carpiano',
    name: 'Síndrome del Túnel Carpiano',
    description: 'Compresión nerviosa en la muñeca que produce dolor, hormigueo y debilidad en la mano y el brazo.',
    treatments: [
      { label: 'Acupuntura', type: 'acu' },
      { label: 'Kinesiología', type: 'kine' },
    ],
    whatsappMessage: 'Hola, quisiera consultar por tratamiento para el Síndrome del Túnel Carpiano.',
    phone: '+56973888910', // Eduardo
  },
  {
    id: 'artrosis-artritis',
    name: 'Artrosis y Artritis',
    description: 'Desgaste articular e inflamación que limita el movimiento en rodillas, cadera, manos y otras articulaciones.',
    treatments: [
      { label: 'Acupuntura', type: 'acu' },
      { label: 'Kinesiología', type: 'kine' },
    ],
    whatsappMessage: 'Hola, quisiera consultar por tratamiento para Artrosis y dolor articular.',
    phone: '+56973888910', // Eduardo
  },
  {
    id: 'ciatica',
    name: 'Ciática',
    description: 'Dolor irradiado desde la zona lumbar hacia la pierna por compresión del nervio ciático y radiculopatías.',
    treatments: [
      { label: 'Kinesiología', type: 'kine' },
      { label: 'Quiropraxia', type: 'quiro' },
      { label: 'Acupuntura', type: 'acu' },
    ],
    whatsappMessage: 'Hola, tengo dolor de ciática y quisiera consultar por evaluación y tratamiento en Centro Vida Sana.',
    phone: '+56973700616', // Felipe & Eduardo
  },
  {
    id: 'fibromialgia',
    name: 'Fibromialgia',
    description: 'Dolor muscular difuso y crónico acompañado de fatiga, insomnio y sensibilidad generalizada en todo el cuerpo.',
    treatments: [
      { label: 'Acupuntura', type: 'acu' },
      { label: 'Kinesiología', type: 'kine' },
    ],
    whatsappMessage: 'Hola, quisiera consultar por tratamiento de Acupuntura y Kinesiología para Fibromialgia.',
    phone: '+56973888910', // Eduardo
  },
];

export interface PathologyItem {
  id: string;
  name: string;
  subtitle: string;
  discipline: 'quiropraxia' | 'acupuntura' | 'dual';
  recommendedProfessional: 'felipe' | 'eduardo' | 'ambos';
  badgeLabel: string;
  description: string;
  whatsappMessage: string;
}

export const pathologiesData: PathologyItem[] = [
  {
    id: 'lumbago-hernias',
    name: 'Dolor Lumbar y Hernias Discales',
    subtitle: 'Lumbago agudo, discopatías y rigidez baja',
    discipline: 'quiropraxia',
    recommendedProfessional: 'felipe',
    badgeLabel: 'Quiropraxia & Kine',
    description: 'Alineación de pelvis y columna lumbar, descompresión radicular y fortalecimiento estabilizador para eliminar el dolor al agacharse o levantarse.',
    whatsappMessage: 'Hola, quisiera consultar por tratamiento para dolor lumbar / lumbago en Centro Vida Sana Austral.',
  },
  {
    id: 'cervicalgia-torticolis',
    name: 'Dolor Cervical y Tortícolis',
    subtitle: 'Sobrecarga de cuello, trapecios y mareos cervicales',
    discipline: 'quiropraxia',
    recommendedProfessional: 'felipe',
    badgeLabel: 'Quiropraxia',
    description: 'Ajuste suave de vértebras cervicales y liberación de la musculatura suboccipital para devolver el rango de giro sin dolor ni mareo.',
    whatsappMessage: 'Hola, quisiera consultar por tratamiento para dolor cervical / tortícolis.',
  },
  {
    id: 'ciatica-aguda',
    name: 'Ciática y Pinzamiento del Nervio',
    subtitle: 'Dolor punzante que baja hacia glúteo y pierna',
    discipline: 'dual',
    recommendedProfessional: 'ambos',
    badgeLabel: 'Terapia Combinada Dual',
    description: 'El tratamiento más solicitado del centro: Quiropraxia para liberar la compresión articular + Acupuntura y Electroterapia para desinflamar el nervio ciático velozmente.',
    whatsappMessage: 'Hola, tengo dolor de ciática y quisiera consultar por el tratamiento combinado de Quiropraxia y Acupuntura.',
  },
  {
    id: 'cefaleas-migranas',
    name: 'Cefaleas y Migrañas Crónicas',
    subtitle: 'Dolor de cabeza tensional y pulsátil',
    discipline: 'acupuntura',
    recommendedProfessional: 'eduardo',
    badgeLabel: 'Acupuntura Clínica',
    description: 'Regulación del sistema nervioso autónomo y liberación de sustancias analgésicas endógenas para disminuir la intensidad y frecuencia de los episodios.',
    whatsappMessage: 'Hola, quisiera consultar por tratamiento de acupuntura para cefaleas / migrañas.',
  },
  {
    id: 'estres-ansiedad-insomnio',
    name: 'Estrés, Ansiedad y Trastornos del Sueño',
    subtitle: 'Sobrecarga emocional, insomnio y bruxismo',
    discipline: 'acupuntura',
    recommendedProfessional: 'eduardo',
    badgeLabel: 'Medicina Tradicional China',
    description: 'Sedación del Shen (mente) mediante puntos acupunturales y auriculoterapia para inducir un estado de relajación profunda y restaurar el descanso reparador.',
    whatsappMessage: 'Hola, quisiera consultar por acupuntura para el manejo de estrés / insomnio.',
  },
  {
    id: 'lesiones-deportivas',
    name: 'Tendinitis y Lesiones Deportivas',
    subtitle: 'Hombro doloroso, codo de tenista, esguinces y desgarros',
    discipline: 'quiropraxia',
    recommendedProfessional: 'felipe',
    badgeLabel: 'Kinesiología Deportiva',
    description: 'Fisioterapia para cicatrización óptima, liberación miofascial y reacondicionamiento funcional para regresar a tu actividad deportiva sin dolor.',
    whatsappMessage: 'Hola, quisiera consultar por rehabilitación para una lesión deportiva / tendinitis.',
  },
  {
    id: 'fibromialgia-dolor-cronico',
    name: 'Fibromialgia y Dolor Generalizado',
    subtitle: 'Puntos sensibles, fatiga constante y rigidez matutina',
    discipline: 'dual',
    recommendedProfessional: 'ambos',
    badgeLabel: 'Terapia Combinada Dual',
    description: 'Abordaje integral no invasivo: Acupuntura para calmar la hipersensibilidad del sistema nervioso central + Kinesiología suave para recuperar movilidad sin gatillar crisis.',
    whatsappMessage: 'Hola, quisiera consultar por tratamiento integral para fibromialgia.',
  },
  {
    id: 'artrosis-artritis',
    name: 'Artrosis y Desgaste Articular',
    subtitle: 'Rodillas, caderas, manos y columna vertebral',
    discipline: 'dual',
    recommendedProfessional: 'ambos',
    badgeLabel: 'Terapia Combinada Dual',
    description: 'Moxibustión con calor terapéutico para dispersar la rigidez matutina y ejercicio guiado de bajo impacto para nutrir el cartílago articular.',
    whatsappMessage: 'Hola, quisiera consultar por tratamiento para artrosis / dolor articular.',
  },
];

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  category: 'general' | 'quiropraxia' | 'acupuntura';
  badge: string;
}

export const faqsData: FaqItem[] = [
  {
    id: 'valores-sesion',
    question: '¿Cuánto cuesta una sesión y cómo se paga?',
    answer: 'Los aranceles oscilan entre $20.000 y $35.000 CLP según la terapia específica (Quiropraxia, Acupuntura, Kinesiología o Atención a Domicilio). No exigimos planes ni paquetes forzados: pagas sesión a sesión evaluando tu evolución real. Puedes consultar aranceles vigentes y disponibilidad vía WhatsApp.',
    category: 'general',
    badge: 'Valores',
  },
  {
    id: 'dolor-procedimientos',
    question: '¿Los tratamientos (agujas o ajuste de columna) causan dolor?',
    answer: 'No. En acupuntura usamos agujas de grado médico ultrafinas (0.16 a 0.25 mm, como un cabello) que generan una sensación placentera de relajación o calor ("De Qi"). En quiropraxia, los ajustes articulares son maniobras suaves y rápidas para descomprimir la zona; el característico sonido es solo liberación inofensiva de gas articular, nunca roce de huesos.',
    category: 'general',
    badge: 'Procedimiento',
  },
  {
    id: 'orden-medica',
    question: '¿Necesito orden médica o exámenes previos para atenderme?',
    answer: 'No es obligatoria ninguna derivación médica para agendar tu consulta. En la primera sesión realizamos una evaluación clínica integral. Si cuentas con radiografías, resonancias magnéticas (RMN) o exámenes previos, te recomendamos traerlos para complementar tu diagnóstico.',
    category: 'general',
    badge: 'Requisitos',
  },
  {
    id: 'cuantas-sesiones',
    question: '¿Cuántas sesiones necesitaré para sentir alivio?',
    answer: 'En cuadros agudos (como un lumbago reciente o tortícolis), la gran mayoría experimenta un alivio notable entre la 1ª y 2ª sesión. En afecciones crónicas o de larga data (discopatías, fibromialgia o artrosis), estructuramos planes de 4 a 6 sesiones con pautas preventivas para evitar recaídas.',
    category: 'general',
    badge: 'Tratamiento',
  },
  {
    id: 'diferencia-quiro-kine',
    question: '¿Cuál es la diferencia entre Quiropraxia y Kinesiología?',
    answer: 'La Quiropraxia se especializa en la alineación articular de la columna y la liberación de interferencias nerviosas. La Kinesiología se enfoca en la rehabilitación muscular, control motor y fortalecimiento de tejidos. En nuestro centro, Felipe Méndez integra ambas en una misma sesión para un tratamiento completo y duradero.',
    category: 'quiropraxia',
    badge: 'Especialidades',
  },
  {
    id: 'ubicacion-agenda',
    question: '¿Dónde están ubicados y cómo puedo agendar una hora?',
    answer: 'Estamos en Los Armiños 1620, Temuco, en un barrio residencial tranquilo, seguro y con estacionamiento directo frente al recinto. Puedes agendar tu consulta enviando un WhatsApp o llamando a Felipe Méndez (+569 7370 0616) o Eduardo Lagos (+569 7388 8910).',
    category: 'general',
    badge: 'Contacto',
  },
];

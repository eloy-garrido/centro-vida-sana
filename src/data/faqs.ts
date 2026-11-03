export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  category: 'general' | 'quiropraxia' | 'acupuntura';
}

export const faqsData: FaqItem[] = [
  {
    id: 'valores-sesion',
    question: '¿Cuánto cuesta una sesión de atención?',
    answer: 'Los valores oscilan entre $20.000 y $35.000 CLP según la terapia específica (Quiropraxia, Acupuntura, Kinesiología o Atención a Domicilio). Emitimos boleta electrónica para que puedas solicitar reembolso con tu Isapre o seguro de salud complementario si cuentas con cobertura.',
    category: 'general',
  },
  {
    id: 'dolor-acupuntura',
    question: '¿Es dolorosa la acupuntura?',
    answer: 'No. Empleamos agujas estériles y desechables de grado médico con diámetros ultrafinos (0.16 a 0.25 mm, casi el grosor de un cabello). La mayoría de los pacientes siente apenas un hormigueo sutil o calor placentero (sensación "De Qi"). Es muy común que los pacientes se queden dormidos durante la sesión por la relajación generada.',
    category: 'acupuntura',
  },
  {
    id: 'diferencia-quiro-kine',
    question: '¿Cuál es la diferencia entre Quiropraxia y Kinesiología?',
    answer: 'La Quiropraxia se enfoca en el diagnóstico y corrección manual precisa de bloqueos articulares y desalineaciones de la columna para liberar interferencias nerviosas. La Kinesiología, por su parte, rehabilita los tejidos musculares y ligamentos mediante agentes físicos y ejercicio terapéutico. En nuestro centro, Felipe Méndez integra ambas disciplinas en un solo plan de tratamiento.',
    category: 'quiropraxia',
  },
  {
    id: 'orden-medica',
    question: '¿Necesito orden médica o derivación para atenderme?',
    answer: 'No es obligatoria. Puedes agendar tu consulta directamente con nosotros para ser evaluado. Si cuentas con radiografías, resonancias magnéticas (RMN) o exámenes previos, te recomendamos traerlos para complementar tu evaluación clínica.',
    category: 'general',
  },
  {
    id: 'cuantas-sesiones',
    question: '¿Cuántas sesiones necesitaré para sentir alivio?',
    answer: 'En cuadros agudos (como un lumbago reciente o tortícolis), suele experimentarse un alivio notable desde la 1ª o 2ª sesión. En afecciones crónicas o de larga data (como discopatías o fibromialgia), estructuramos planes de 4 a 8 sesiones con reevaluaciones periódicas.',
    category: 'general',
  },
  {
    id: 'atencion-domicilio',
    question: '¿Ofrecen atención kinesiológica a domicilio en Temuco?',
    answer: 'Sí. Felipe Méndez realiza atención kinesiológica a domicilio en Temuco y sectores cercanos, ideal para personas con movilidad reducida, postrados, post-quirúrgicos inmediatos o adultos mayores. Coordinamos los traslados con previa reserva.',
    category: 'quiropraxia',
  },
  {
    id: 'certificacion-minsal',
    question: '¿Los profesionales están acreditados por el Ministerio de Salud?',
    answer: 'Sí, 100%. Eduardo Lagos cuenta con certificación oficial del Minsal como Acupunturista en el Registro Nacional de Prestadores de Salud. Felipe Méndez es Kinesiólogo titulado y Quiropráctico con formación de postgrado y registro en la Superintendencia de Salud.',
    category: 'general',
  },
  {
    id: 'tratamiento-ciatica',
    question: '¿Cómo tratan el dolor de ciática?',
    answer: 'La ciática es nuestra consulta más habitual. Combinamos el ajuste quiropráctico para descomprimir la raíz nerviosa en la columna lumbosacra con electroacupuntura y calor local para desinflamar el trayecto del nervio ciático en glúteo y pierna con rapidez.',
    category: 'general',
  },
  {
    id: 'ubicacion-estacionamiento',
    question: '¿Dónde están ubicados y cuentan con estacionamiento?',
    answer: 'Estamos ubicados en Los Armiños 1620, Temuco, en un sector residencial tranquilo, seguro y de fácil acceso, con disponibilidad de estacionamiento directo y expedito frente al recinto.',
    category: 'general',
  },
  {
    id: 'como-agendar',
    question: '¿Cómo puedo agendar una hora de atención?',
    answer: 'Puedes contactar directamente al profesional de tu preferencia vía WhatsApp o llamada telefónica: Felipe Méndez (+569 7370 0616) o Eduardo Lagos (+569 7388 8910). También dispones de los botones directos distribuidos en este sitio web.',
    category: 'general',
  },
];

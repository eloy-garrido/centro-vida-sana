export interface AcademicDegree {
  title: string;
  institution: string;
  period: string;
}

export interface Postgraduate {
  title: string;
  institution: string;
  detail?: string;
  year?: string;
}

export interface Certification {
  name: string;
  institution: string;
  detail?: string;
}

export interface ClinicalPillar {
  title: string;
  desc: string;
  badge?: string;
}

export interface ClinicalExperience {
  role: string;
  center: string;
  period: string;
  desc: string;
}

export interface ConsultationStep {
  step: string;
  title: string;
  desc: string;
}

export interface Professional {
  id: 'felipe' | 'eduardo';
  slug: string;
  name: string;
  fullName: string;
  discipline: 'quiropraxia' | 'acupuntura';
  title: string;
  credential: string;
  registrationNumber?: string;
  phone: string;
  phoneFormatted: string;
  email: string;
  whatsappMessage: string;
  photoUrl: string;
  photoHdUrl?: string;
  accentColor: string;
  lightColor: string;
  borderColor: string;
  themeClass: string;
  badgeLabel: string;
  bio: string;
  specialties: string[];
  
  // Perfil clínico y modelo terapéutico
  approachTitle: string;
  approachSubtitle: string;
  approachQuote: string;
  clinicalPillars: ClinicalPillar[];
  
  // Formación académica y trayectoria profesional
  academicDegrees: AcademicDegree[];
  postgraduates: Postgraduate[];
  certifications: Certification[];
  clinicalExperience: ClinicalExperience[];
  
  // Metodología de consulta paso a paso
  consultationSteps: ConsultationStep[];
}

export const professionals: Record<'felipe' | 'eduardo', Professional> = {
  felipe: {
    id: 'felipe',
    slug: 'felipe-mendez',
    name: 'Felipe Méndez',
    fullName: 'Felipe Andrés Méndez Salgado',
    discipline: 'quiropraxia',
    title: 'Quiropráctico & Kinesiólogo',
    credential: 'Certificado Minsal · Especialista en Columna y Biomecánica',
    registrationNumber: 'Reg. Colegio / Certificado Minsal',
    phone: '+56973700616',
    phoneFormatted: '+569 7370 0616',
    email: 'quirofelme@gmail.com',
    whatsappMessage: 'Hola Felipe, quisiera consultar por una evaluación quiropráctica / kinesiológica en Centro Vida Sana Austral.',
    photoUrl: '/pix/felipe-kinesiologo-400.webp',
    photoHdUrl: '/pix/felipe-kinesiologo-hd.webp',
    accentColor: '#134E5E',
    lightColor: '#EBF4F6',
    borderColor: '#C9DFE6',
    themeClass: 'petrol',
    badgeLabel: 'Quiropraxia & Kinesiología',
    bio: 'Especialista en evaluación biomecánica, ajustes vertebrales de alta precisión y rehabilitación integral. Enfoque clínico orientado a eliminar la causa raíz del dolor lumbar, cervical y disfunciones articulares.',
    specialties: [
      'Ajustes vertebrales específicos de alta precisión',
      'Descompresión articular y manejo de hernias/ciática',
      'Modulación del sistema nervioso autónomo (VFC/HRV)',
      'Rehabilitación funcional deportiva y traumatológica',
      'Kinesiología respiratoria y atención a domicilio',
    ],
    approachTitle: 'Modelo Clínico Basado en Neurociencias y Modulación Neurofuncional',
    approachSubtitle: 'Integración de evaluación autonómica (VFC/HRV), neurofacilitación, ajuste quiropráctico y ejercicio terapéutico',
    approachQuote: 'Licenciado en Kinesiología y Quiropráctico, especializado en rehabilitación neuromusculoesquelética, neurológica y respiratoria. Aplico un modelo basado en neurociencias que integra la evaluación del sistema nervioso autónomo (VFC/HRV) con técnicas de estimulación neurofuncional y modulación de receptores, utilizándolas como puente neurofacilitador para potenciar los efectos del ajuste quiropráctico, la terapia manual y el ejercicio terapéutico. Experiencia en el manejo del estrés fisiológico, dolor persistente y recuperación funcional, con trayectoria en atención clínica directa y gestión de centros de salud en el ámbito privado y público.',
    clinicalPillars: [
      {
        title: 'Evaluación Autonómica (VFC / HRV)',
        desc: 'Monitoreo de la Variabilidad de la Frecuencia Cardíaca para analizar la adaptación fisiológica al estrés, el tono vagal y la capacidad de autorregulación del paciente.',
        badge: 'Neurociencias',
      },
      {
        title: 'Puente Neurofacilitador & Modulación',
        desc: 'Estimulación neurofuncional y modulación de mecanorreceptores que prepara el sistema nervioso antes de la intervención mecánica para maximizar la eficacia.',
        badge: 'Neuromodulación',
      },
      {
        title: 'Ajuste Quiropráctico de Alta Precisión',
        desc: 'Maniobras articulares dirigidas y descompresión foraminal para corregir restricciones mecánicas, liberar raíces nerviosas y aliviar el dolor sin dolor añadido.',
        badge: 'Biomecánica Espinal',
      },
      {
        title: 'Readaptación Activa y Ejercicio',
        desc: 'Pautas de fortalecimiento muscular profundo, higiene postural y control motor para consolidar el alineamiento y prevenir recaídas a largo plazo.',
        badge: 'Recuperación Duradera',
      },
    ],
    academicDegrees: [
      {
        title: 'Licenciatura en Kinesiología',
        institution: 'Universidad Mayor · Temuco',
        period: '2011 – 2016',
      },
      {
        title: 'Licenciatura en Quiropráctica',
        institution: 'Universidad Central de Chile · Santiago',
        period: '2020 – 2023',
      },
    ],
    postgraduates: [
      {
        title: 'Diplomado en Neurorrehabilitación',
        institution: 'Capacitanet',
        detail: '720 horas pedagógicas',
        year: '2025',
      },
      {
        title: 'Diplomado en Masoterapia Clínica',
        institution: 'Capacitanet',
        detail: '720 horas pedagógicas',
        year: '2025',
      },
      {
        title: 'Diplomado en Salud Familiar y Comunitaria',
        institution: 'AST',
        detail: '300 horas pedagógicas',
        year: '2020',
      },
      {
        title: 'Diplomado en Enfermedades Respiratorias Adulto e Infantil',
        institution: 'RespiraChile',
        detail: '150 horas pedagógicas',
        year: '2019',
      },
    ],
    certifications: [
      {
        name: 'Especialización en Neurociencias aplicadas a la Readaptación y Rendimiento',
        institution: 'Neuro Motion + (18 hrs)',
        detail: 'Readaptación neuromotora y rendimiento deportivo',
      },
      {
        name: 'Punción Seca Metamérica y Electropunción',
        institution: 'KineticXer',
        detail: 'Modulación neurofuncional y dolor miofascial',
      },
      {
        name: 'Procedimientos de Espirometría y Función Pulmonar',
        institution: 'AARC / Capacitación especializada (120 hrs)',
        detail: 'Evaluación y tecnología en función respiratoria',
      },
      {
        name: 'Capacitación en Traumatología Deportiva en Niños y Adolescentes',
        institution: 'Clínica Alemana Temuco',
        detail: 'Manejo clínico infanto-juvenil',
      },
    ],
    clinicalExperience: [
      {
        role: 'Kinesiólogo y Quiropráctico en Rehabilitación Integral',
        center: 'Centro Salud Vida Sana Austral · Temuco',
        period: '2025 – Presente',
        desc: 'Atención personalizada de pacientes con afecciones neuromusculoesqueléticas, respiratorias y dolor persistente con enfoque interdisciplinario holístico.',
      },
      {
        role: 'Kinesiólogo en Equipo Interdisciplinario',
        center: 'INTERDIS MEDICAL · Temuco',
        period: '2026 – Presente',
        desc: 'Abordaje de disfunciones musculoesqueléticas, vestibulares y sistema nervioso autónomo mediante enfoque terapéutico mixto.',
      },
      {
        role: 'Kinesiólogo y Quiropráctico Independiente',
        center: 'Consulta Privada y Rehabilitación Domiciliaria',
        period: '2017 – Presente',
        desc: 'Dirección clínica, evaluación biomecánica y desarrollo de programas de rehabilitación y seguimiento personalizado en Temuco.',
      },
    ],
    consultationSteps: [
      {
        step: '01',
        title: 'Evaluación Integral & Análisis Autonómico',
        desc: 'Anamnesis completa, valoración biomecánica de la columna y examen del estado del sistema nervioso autónomo para mapear con precisión el origen de la sobrecarga o dolor.',
      },
      {
        step: '02',
        title: 'Modulación de Receptores (Neurofacilitación)',
        desc: 'Técnicas de preparación tisular y neuromodulación suave que facilitan la receptividad neuromuscular, disminuyen el espasmo reflejo y aseguran un ajuste indoloro.',
      },
      {
        step: '03',
        title: 'Ajuste Quiropráctico Dirigido',
        desc: 'Maniobras vertebrales de alta velocidad y baja amplitud que descomprimen las carillas articulares, alivian raíces nerviosas comprometidas y devuelven la biomecánica fisiológica.',
      },
      {
        step: '04',
        title: 'Pauta de Movimiento & Ejercicio Activo',
        desc: 'Indicación de ejercicios correctivos de estabilidad neuromuscular, ergonomía y pautas preventivas adaptadas a tu vida laboral y deportiva.',
      },
    ],
  },
  eduardo: {
    id: 'eduardo',
    slug: 'eduardo-lagos',
    name: 'Eduardo Lagos',
    fullName: 'Eduardo Lagos',
    discipline: 'acupuntura',
    title: 'Acupunturista Clínico Minsal',
    credential: 'Acreditado Minsal · Docente de Medicina Tradicional China',
    registrationNumber: 'Reg. SIS Nº 381042 · Superintendencia de Salud',
    phone: '+56973888910',
    phoneFormatted: '+569 7388 8910',
    email: 'centrovidasanaaustral@gmail.com',
    whatsappMessage: 'Hola Eduardo, quisiera consultar por una sesión de acupuntura / medicina tradicional china en Centro Vida Sana Austral.',
    photoUrl: '/pix/eduardo-acupuntura-400.webp',
    photoHdUrl: '/pix/eduardo-acupuntura-hd.webp',
    accentColor: '#2E4D38',
    lightColor: '#EFF5F0',
    borderColor: '#D3E3D6',
    themeClass: 'sage',
    badgeLabel: 'Acupuntura & Med. China',
    bio: 'Experto en Medicina Tradicional China con amplia trayectoria en Temuco. Aplica técnicas milenarias combinadas con neuroacupuntura moderna para el alivio de dolores crónicos, migrañas, estrés y equilibrio orgánico.',
    specialties: [
      'Acupuntura sistémica y neuroacupuntura basada en evidencia',
      'Electroacupuntura analgésica para dolor crónico y ciática',
      'Ventosaterapia clínica fija y dinámica (Cupping)',
      'Moxibustión térmica y modulación energética de meridianos',
      'Regulación del estrés, trastornos del sueño y bienestar integral',
    ],
    approachTitle: 'Modelo Integrativo de Medicina Tradicional China y Neuroacupuntura',
    approachSubtitle: 'Semiología milenaria oriental, modulación neuroquímica y restablecimiento del equilibrio funcional',
    approachQuote: 'Acupunturista clínico acreditado por el Ministerio de Salud (Minsal) con registro oficial en la Superintendencia de Salud. Especialista en la articulación de la Medicina Tradicional China con los hallazgos de la neurofisiología contemporánea. Mi enfoque busca activar los mecanismos intrínsecos de regulación homeostática del organismo para tratar de raíz dolencias crónicas, contracturas profundas, cefaleas, cuadros de estrés y desarmonías funcionales sin recurrir a tratamientos farmacológicos agresivos.',
    clinicalPillars: [
      {
        title: 'Diagnóstico Tradicional Completo (Pulso y Lengua)',
        desc: 'Lectura semiológica oriental precisa que identifica la raíz del síndrome (Zang-Fu) más allá del síntoma superficial para un abordaje terapéutico individualizado.',
        badge: 'Semiología MTC',
      },
      {
        title: 'Neuroacupuntura & Liberación de Endorfinas',
        desc: 'Estimulación refleja de puntos de baja resistencia eléctrica que modula las vías espinales del dolor e induce una respuesta analgésica y antiinflamatoria profunda.',
        badge: 'Neurobiología',
      },
      {
        title: 'Electroacupuntura en Cuadros Resistentes',
        desc: 'Microestímulos controlados aplicados en pares de agujas para desensibilizar contracturas complejas, parestesias periféricas y ciática severa.',
        badge: 'Electroanalgesia',
      },
      {
        title: 'Ventosaterapia & Moxibustión Térmica',
        desc: 'Técnicas milenarias para movilizar adherencias fasciales, disipar factores patógenos como frío y humedad, y revitalizar la microcirculación sanguínea local.',
        badge: 'Terapia Térmica',
      },
    ],
    academicDegrees: [
      {
        title: 'Acupunturista Clínico Certificado Minsal',
        institution: 'Ministerio de Salud de Chile',
        period: 'Acreditación Oficial de Salud',
      },
      {
        title: 'Especialista en Medicina Tradicional China',
        institution: 'Escuela Superior de MTC',
        period: 'Formación Superior Integral',
      },
    ],
    postgraduates: [
      {
        title: 'Especialización en Neuroacupuntura y Manejo del Dolor Crónico',
        institution: 'Formación Continua MTC',
        detail: 'Enfoque neuromuscular y dolor neuropático',
        year: 'Formación Superior',
      },
      {
        title: 'Docente e Instructor de Medicina Tradicional China',
        institution: 'Academia Vida Sana / Zhen LMS',
        detail: 'Formación teórica y clínica a profesionales y terapeutas',
        year: '2022 – Presente',
      },
    ],
    certifications: [
      {
        name: 'Registro Nacional de Prestadores Individuales de Salud',
        institution: 'Superintendencia de Salud (SIS Nº 381042)',
        detail: 'Registro oficial como prestador de salud en Chile',
      },
      {
        name: 'Técnicas Avanzadas de Ventosaterapia y Liberación Fascial',
        institution: 'Capacitación MTC Clínica',
        detail: 'Manejo de adherencias miofasciales y contracturas',
      },
      {
        name: 'Moxibustión Térmica Tradicional y Regulación Energética',
        institution: 'Formación Clínica Oriental',
        detail: 'Terapia de calor focalizado con artemisa',
      },
      {
        name: 'Bioseguridad y Normas de Inserción Estéril Monouso',
        institution: 'Protocolos Sanitarios Minsal',
        detail: 'Garantía de esterilidad 100% y atención segura',
      },
    ],
    clinicalExperience: [
      {
        role: 'Acupunturista Titular y Cofundador',
        center: 'Centro Salud Vida Sana Austral · Temuco',
        period: 'Atención Continua',
        desc: 'Atención clínica personalizada en box privado para pacientes con dolores crónicos, migrañas y trastornos del estrés en trabajo interdisciplinario.',
      },
      {
        role: 'Docente Formador en Medicina Tradicional China',
        center: 'Academia Centro Vida Sana',
        period: '2022 – Presente',
        desc: 'Cursos formativos, talleres clínicos y docencia teórica orientada a difundir las bases científicas y terapéuticas de la MTC en Temuco.',
      },
    ],
    consultationSteps: [
      {
        step: '01',
        title: 'Diagnóstico Tradicional (Anamnesis, Pulso y Lengua)',
        desc: 'Evaluación integral del estado de salud observando la lengua, palpando los pulsos radiales y examinando los patrones fisiológicos y emocionales del paciente.',
      },
      {
        step: '02',
        title: 'Selección Personalizada de Puntos y Canales',
        desc: 'Diseño a medida del protocolo de acupuntura combinando puntos locales para el dolor con puntos distales para regular el eje neuroendocrino y energético.',
      },
      {
        step: '03',
        title: 'Inserción Indolora de Agujas Filiformes',
        desc: 'Aplicación suave de agujas ultrafinas de uso único estéril, con opción de electroacupuntura, calor suave con moxibustión o ventosas según el cuadro clínico.',
      },
      {
        step: '04',
        title: 'Reposo Terapéutico y Orientación de Estilo de Vida',
        desc: '25 a 30 minutos de relajación profunda en camilla climatizada en box privado, cerrando con pautas de nutrición energética y prevención.',
      },
    ],
  },
};

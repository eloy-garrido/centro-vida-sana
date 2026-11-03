export interface ServiceItem {
  id: string;
  name: string;
  discipline: 'quiropraxia' | 'acupuntura';
  professionalId: 'felipe' | 'eduardo';
  summary: string;
  indication: string;
  duration: string;
  priceRef: string;
  imageUrl: string;
  tags: string[];
}

export const servicesData: ServiceItem[] = [
  // Quiropraxia & Kinesiología
  {
    id: 'ajuste-vertebral',
    name: 'Ajuste Quiropráctico de Columna',
    discipline: 'quiropraxia',
    professionalId: 'felipe',
    summary: 'Maniobras manuales precisas sobre vértebras bloqueadas para restablecer la movilidad espinal, aliviar compresión nerviosa y corregir desalineaciones posturales.',
    indication: 'Lumbago, cervicalgia, dolor dorsal, pinzamientos y tortícolis.',
    duration: '45 min',
    priceRef: '$30.000',
    imageUrl: '/pix/kine/400-quiro.webp',
    tags: ['Columna', 'Articulaciones', 'Alivio Rápido'],
  },
  {
    id: 'fisioterapia-kine',
    name: 'Fisioterapia y Rehabilitación',
    discipline: 'quiropraxia',
    professionalId: 'felipe',
    summary: 'Agentes físicos de vanguardia (TENS, ultrasonido terapéutico, termoterapia y crioterapia) para desinflamar tejidos, calmar el dolor y acelerar la cicatrización.',
    indication: 'Tendinitis, desgarros musculares, esguinces y post-cirugías.',
    duration: '50 min',
    priceRef: '$25.000',
    imageUrl: '/pix/kine/400-fisio.webp',
    tags: ['Desinflamación', 'Tejidos Blandos', 'Recuperación'],
  },
  {
    id: 'ejercicio-terapeutico',
    name: 'Ejercicio Terapéutico y Readaptación',
    discipline: 'quiropraxia',
    professionalId: 'felipe',
    summary: 'Pautas personalizadas de fortalecimiento del core, movilidad articular y estabilización neuromuscular para prevenir recaídas y corregir patrones motores.',
    indication: 'Debilidad muscular, hernias de disco estables y artrosis.',
    duration: '50 min',
    priceRef: '$25.000',
    imageUrl: '/pix/kine/400-ejercicio.webp',
    tags: ['Fuerza', 'Movilidad', 'Prevención'],
  },
  {
    id: 'kine-domicilio',
    name: 'Kinesiología Integral a Domicilio',
    discipline: 'quiropraxia',
    professionalId: 'felipe',
    summary: 'Atención kinesiológica completa en la comodidad de tu hogar en Temuco y alrededores para pacientes con movilidad reducida o adultos mayores.',
    indication: 'Postrados, post-operatorios recientes, adultos mayores y rehabilitación motora.',
    duration: '60 min',
    priceRef: '$35.000',
    imageUrl: '/pix/kine/400-domicilio.webp',
    tags: ['A Domicilio', 'Adulto Mayor', 'Temuco'],
  },
  {
    id: 'masoterapia-clinica',
    name: 'Masoterapia Clínica Descontracturante',
    discipline: 'quiropraxia',
    professionalId: 'felipe',
    summary: 'Técnicas manuales profundas enfocadas en liberar puntos gatillo miofasciales, contracturas crónicas y tensión muscular acumulada por estrés o sobrecarga.',
    indication: 'Contracturas trapecio/cuello, sobrecarga deportiva y rigidez lumbar.',
    duration: '45 min',
    priceRef: '$25.000',
    imageUrl: '/pix/kine/400-maso.webp',
    tags: ['Descontracturante', 'Miofascial', 'Relax Muscular'],
  },

  // Acupuntura & Medicina China
  {
    id: 'acupuntura-clinica',
    name: 'Acupuntura Clínica Sistémica',
    discipline: 'acupuntura',
    professionalId: 'eduardo',
    summary: 'Inserción suave de agujas estériles ultrafinas en puntos y meridianos específicos para modular el sistema nervioso, liberar endorfinas y regular el flujo de Qi.',
    indication: 'Dolor crónico, ciática, cefaleas, colon irritable, ansiedad y alteraciones del sueño.',
    duration: '50 min',
    priceRef: '$30.000',
    imageUrl: '/pix/mtc/400-acupuntura.webp',
    tags: ['Neuroacupuntura', 'Sin Dolor', 'Integral'],
  },
  {
    id: 'electroacupuntura',
    name: 'Electroacupuntura para Dolor Crónico',
    discipline: 'acupuntura',
    professionalId: 'eduardo',
    summary: 'Microcorrientes terapéuticas controladas aplicadas a través de las agujas para potenciar el efecto analgésico y desinflamatorio profundo en nervios y músculos.',
    indication: 'Parálisis facial, neuralgia del trigémino, neuropatías y dolor articular resistente.',
    duration: '50 min',
    priceRef: '$30.000',
    imageUrl: '/pix/mtc/400-electro.webp',
    tags: ['Dolor Severo', 'Neuropatías', 'Analgesia'],
  },
  {
    id: 'ventosaterapia',
    name: 'Terapia con Ventosas (Cupping)',
    discipline: 'acupuntura',
    professionalId: 'eduardo',
    summary: 'Aplicación de succión mediante copas de vidrio o acrílico para aumentar la microcirculación local, eliminar estancamiento sanguíneo y soltar fascias rígidas.',
    indication: 'Dolor dorsal, contracturas dorsolumbares persistentes y fatiga muscular.',
    duration: '40 min',
    priceRef: '$25.000',
    imageUrl: '/pix/mtc/400-ventosa.webp',
    tags: ['Microcirculación', 'Fascia', 'Detox Muscular'],
  },
  {
    id: 'moxibustion',
    name: 'Moxibustión Térmica Terapéutica',
    discipline: 'acupuntura',
    professionalId: 'eduardo',
    summary: 'Aplicación de calor profundo mediante conos o puros de artemisa sobre puntos de acupuntura para dispersar frío interno, estimular la inmunidad y revitalizar tejidos.',
    indication: 'Dolores artríticos agravados por frío/humedad, fatiga crónica y déficit inmunológico.',
    duration: '40 min',
    priceRef: '$25.000',
    imageUrl: '/pix/mtc/400-moxi.webp',
    tags: ['Calor Terapéutico', 'Artrosis', 'Inmunidad'],
  },
  {
    id: 'auriculoterapia',
    name: 'Auriculoterapia Clínica',
    discipline: 'acupuntura',
    professionalId: 'eduardo',
    summary: 'Estimulación de puntos reflejos en el pabellón auricular mediante microesferas de semillas o balines magnéticos para prolongar el efecto terapéutico en el tiempo.',
    indication: 'Manejo de ansiedad, apoyo en control de peso, adicciones y estrés agudo.',
    duration: '30 min',
    priceRef: '$20.000',
    imageUrl: '/pix/mtc/400-auriculo.webp',
    tags: ['Puntos Reflejos', 'Ansiedad', 'Efecto Continuo'],
  },
];

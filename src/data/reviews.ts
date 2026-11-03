export interface ReviewItem {
  id: string;
  author: string;
  rating: number;
  date: string;
  text: string;
  service: string;
}

export const reviewsData: ReviewItem[] = [
  {
    id: 'rev-1',
    author: 'Carolina Morales',
    rating: 5,
    date: 'Hace 3 semanas',
    text: 'Llegué con un lumbago invalidante que casi no me dejaba caminar. La combinación del ajuste de Felipe con la acupuntura de Eduardo me devolvió la movilidad en solo 2 sesiones. Profesionales con una vocación tremenda.',
    service: 'Quiropraxia y Acupuntura',
  },
  {
    id: 'rev-2',
    author: 'Gonzalo Riquelme',
    rating: 5,
    date: 'Hace 1 mes',
    text: 'Excelente atención. Tenía dolores de cabeza tensionales día por medio por el trabajo. Con Eduardo y sus sesiones de acupuntura disminuyeron un 90%. El lugar es sumamente grato y acogedor.',
    service: 'Acupuntura Clínica',
  },
  {
    id: 'rev-3',
    author: 'Marcela Fuentes',
    rating: 5,
    date: 'Hace 2 meses',
    text: 'Felipe atendió a mi madre a domicilio tras una fractura de cadera. Su paciencia, técnica y calidez humana fueron clave para que volviera a dar pasos con confianza. 100% recomendado en Temuco.',
    service: 'Kinesiología a Domicilio',
  },
  {
    id: 'rev-4',
    author: 'Patricio Soto',
    rating: 5,
    date: 'Hace 3 meses',
    text: 'El dolor ciático que arrastraba por meses desapareció. Muy acertado el diagnóstico y el tratamiento. Se nota el conocimiento profundo y el respeto por el paciente.',
    service: 'Quiropraxia',
  },
];

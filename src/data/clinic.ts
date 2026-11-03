export interface ClinicInfo {
  name: string;
  shortName: string;
  tagline: string;
  address: {
    street: string;
    city: string;
    region: string;
    postalCode: string;
    country: string;
    full: string;
    mapsUrl: string;
  };
  coordinates: {
    latitude: number;
    longitude: number;
  };
  hours: {
    days: string;
    time: string;
  };
  social: {
    instagram: string;
    googleReviews: string;
  };
}

export const clinicInfo: ClinicInfo = {
  name: 'Centro Vida Sana Austral',
  shortName: 'Vida Sana Austral',
  tagline: 'Quiropraxia, Acupuntura y Kinesiología Clínica en Temuco',
  address: {
    street: 'Los Armiños 1620',
    city: 'Temuco',
    region: 'La Araucanía',
    postalCode: '4810000',
    country: 'Chile',
    full: 'Los Armiños 1620, Temuco, Región de La Araucanía',
    mapsUrl: 'https://maps.google.com/?q=Los+Armi%C3%B1os+1620,+Temuco,+Chile',
  },
  coordinates: {
    latitude: -38.7381,
    longitude: -72.5898,
  },
  hours: {
    days: 'Lunes a Viernes',
    time: '10:00 - 21:00 hrs',
  },
  social: {
    instagram: 'https://www.instagram.com/vidasanaaustral/',
    googleReviews: 'https://search.google.com/local/writereview?placeid=ChIJM0LHMS_VFJYRdPlffqEIVW8',
  },
};

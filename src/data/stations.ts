export interface Station {
  id: string;
  kodLokasi: string;
  name: string;
  region: 'North' | 'East' | 'West' | 'Central' | 'South';
  lat: number;
  lng: number;
}

export const stations: Station[] = [
  {
    id: '1',
    kodLokasi: 'SBPT.26.64E',
    name: 'Cawangan Stor, Putatan',
    region: 'West',
    lat: 5.889789,
    lng: 116.043106
  },
  {
    id: '2',
    kodLokasi: 'SBBF.168.186W',
    name: 'Jurutera Daerah Beaufort',
    region: 'West',
    lat: 5.361980,
    lng: 115.732020
  },
  {
    id: '3',
    kodLokasi: 'SBBE.41.185X',
    name: 'Jurutera Daerah Beluran',
    region: 'East',
    lat: 5.880317,
    lng: 117.555151
  },
  {
    id: '4',
    kodLokasi: 'SBKG.121.101',
    name: 'Jurutera Daerah Keningau',
    region: 'Central',
    lat: 5.350621,
    lng: 116.168781
  },
  {
    id: '5',
    kodLokasi: 'SBKT.77.30W',
    name: 'Jurutera Daerah Kinabatangan',
    region: 'East',
    lat: 5.590094,
    lng: 117.840545
  },
  {
    id: '6',
    kodLokasi: 'SBKM.163.297W',
    name: 'Jurutera Daerah Kota Marudu',
    region: 'North',
    lat: 6.523137,
    lng: 116.754931
  },
  {
    id: '7',
    kodLokasi: 'SBKD.46.212W',
    name: 'Jurutera Daerah Kudat',
    region: 'North',
    lat: 6.900608,
    lng: 116.849254
  },
  {
    id: '8',
    kodLokasi: 'SBLD.380.251W',
    name: 'Jurutera Daerah Lahad Datu',
    region: 'East',
    lat: 5.046093,
    lng: 118.297428
  },
  {
    id: '9',
    kodLokasi: 'SBNA.64.50',
    name: 'Jurutera Daerah Nabawan',
    region: 'Central',
    lat: 5.046272,
    lng: 116.439712
  },
  {
    id: '10',
    kodLokasi: 'SBPA.194.71E',
    name: 'Jurutera Daerah Papar',
    region: 'West',
    lat: 5.727045,
    lng: 115.949592
  },
  {
    id: '11',
    kodLokasi: 'SBPS.22.29',
    name: 'Jurutera Daerah Pitas',
    region: 'North',
    lat: 6.712221,
    lng: 117.033768
  },
  {
    id: '12',
    kodLokasi: 'SBRN.21.46',
    name: 'Jurutera Daerah Ranau',
    region: 'Central',
    lat: 5.955105,
    lng: 116.664830
  },
  {
    id: '13',
    kodLokasi: 'SBSD.279.284W',
    name: 'Jurutera Daerah Sandakan',
    region: 'East',
    lat: 5.865394,
    lng: 118.091894
  },
  {
    id: '14',
    kodLokasi: 'SBSE.134.111X',
    name: 'Jurutera Daerah Semporna',
    region: 'South',
    lat: 4.465902,
    lng: 118.596208
  },
  {
    id: '15',
    kodLokasi: 'SBTB.174.212X',
    name: 'Jurutera Daerah Tambunan',
    region: 'Central',
    lat: 5.648919,
    lng: 116.346647
  },
  {
    id: '16',
    kodLokasi: 'SBTW.492.54',
    name: 'Jurutera Daerah Tawau',
    region: 'South',
    lat: 4.249586,
    lng: 117.935587
  },
  {
    id: '17',
    kodLokasi: 'SBTL.12.3E',
    name: 'Jurutera Daerah Telupid',
    region: 'Central',
    lat: 5.629520,
    lng: 117.130068
  },
  {
    id: '18',
    kodLokasi: 'SBTE.73.35',
    name: 'Jurutera Daerah Tenom',
    region: 'Central',
    lat: 5.122954,
    lng: 115.946088
  },
  {
    id: '19',
    kodLokasi: 'SBTU.183.351X',
    name: 'Jurutera Daerah Tuaran',
    region: 'West',
    lat: 6.145023,
    lng: 116.215583
  }
];

export const regionColors: Record<string, string> = {
  North: '#ef4444', // red-500
  East: '#3b82f6',  // blue-500
  West: '#22c55e',  // green-500
  Central: '#f59e0b', // amber-500
  South: '#8b5cf6'  // violet-500
};

export const regionNames: Record<string, string> = {
  North: 'Northern Zone',
  East: 'Eastern Zone',
  West: 'Western Zone',
  Central: 'Central Zone',
  South: 'Southern Zone'
};

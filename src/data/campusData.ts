import type {
  CameraPreset,
  CampusBuildingMeta,
  OsmDataset,
  OsmPolygon,
} from '../types/campus';

/**
 * Geographic origin of the TSULBP (ДДҲБСТ) campus in Khujand, 17th Microdistrict
 */
export const CAMPUS_ORIGIN = {
  lat: 40.3125,
  lng: 69.6225,
} as const;

const METERS_PER_DEG_LAT = 111320;
const METERS_PER_DEG_LNG =
  111320 * Math.cos((CAMPUS_ORIGIN.lat * Math.PI) / 180); // ~84,884 m/deg at 40.3125° N

/**
 * Convert WGS84 lat/lng to local Three.js meters:
 * +X = East, -X = West
 * -Z = North (toward Mogoltau mountains), +Z = South (toward Tashkent Ave)
 */
export function latLonToLocal(lat: number, lng: number): [number, number] {
  const x = (lng - CAMPUS_ORIGIN.lng) * METERS_PER_DEG_LNG;
  const z = -(lat - CAMPUS_ORIGIN.lat) * METERS_PER_DEG_LAT;
  return [x, z];
}

export function localToLatLon(x: number, z: number): { lat: number; lng: number } {
  const lat = CAMPUS_ORIGIN.lat - z / METERS_PER_DEG_LAT;
  const lng = CAMPUS_ORIGIN.lng + x / METERS_PER_DEG_LNG;
  return { lat, lng };
}

/** Campus rotation alignment matching satellite imagery & Tashkent Ave (~8.5 deg CCW) */
export const CAMPUS_TILT_RAD = 0.145;

export const CAMPUS_BUILDINGS: CampusBuildingMeta[] = [
  {
    id: 'rectorate',
    code: 'B1',
    nameTj: 'Бинои асосӣ (Ректорат)',
    nameRu: 'Главный корпус (Ректорат)',
    nameEn: 'Main Rectorate Building',
    category: 'Administration & Faculties',
    stories: 6,
    departmentsTj: [
      'Раёсати донишгоҳ (Ректорат)',
      'Факултети ҳуқуқшиносӣ',
      'Факултети бизнес ва идоракунӣ',
      'Китобхонаи илмӣ',
    ],
    departmentsRu: [
      'Ректорат и администрация',
      'Юридический факультет',
      'Факультет бизнеса и управления',
      'Научная библиотека (>350 тыс. книг)',
    ],
    descriptionEn:
      'Six-story ochre-yellow flagship administrative and academic block along Tashkent Avenue, crowned with the red Tajik university signboard, waving national flag, and blue upper-right facade banner.',
    localPos: [-82, 62],
    ...localToLatLon(-82, 62),
    cameraView: {
      position: [-35, 42, 138],
      target: [-76, 10, 68],
    },
    searchQuery:
      'Tajik State University of Law, Business and Politics main rectorate building 17th microdistrict Khujand Law faculty Business Management',
    accentColor: '#E4BD6B',
  },
  {
    id: 'main_gate',
    code: 'G1',
    nameTj: 'Дарвозаи марказӣ ва фаввора',
    nameRu: 'Главные ворота и фонтан',
    nameEn: 'Monumental Triple-Arched Gate & Fountain',
    category: 'Ceremonial Entrance',
    stories: 1,
    departmentsTj: [
      'Даромадгоҳи марказӣ аз хиёбони Тошканд',
      'Майдони фаввора ва зинапояи тантанавӣ',
      'Нишони давлатии Ҷумҳурии Тоҷикистон',
    ],
    departmentsRu: [
      'Центральный парадный вход с просп. Ташкентский',
      'Голубой мозаичный фонтан и парадная лестница',
      'Трёхарочный портал с таджикским орнаментом',
    ],
    descriptionEn:
      'Triple-arched orange-ochre portal on Tashkent Avenue adorned with white Tajik geometric ornament, state emblem, wrought-iron gates, zebra crosswalk, and a rectangular blue-tiled fountain plaza.',
    localPos: [-60, 96],
    ...localToLatLon(-60, 96),
    cameraView: {
      position: [-26, 26, 148],
      target: [-62, 6, 86],
    },
    searchQuery:
      'Tajik State University of Law, Business and Politics Khujand Tashkent Avenue main entrance campus',
    accentColor: '#D9822B',
  },
  {
    id: 'stadium',
    code: 'ST',
    nameTj: 'Варзишгоҳи ДДҲБСТ',
    nameRu: 'Стадион ТГУ',
    nameEn: 'TSULBP University Stadium',
    category: 'Athletics & Recreation',
    stories: 1,
    departmentsTj: [
      'Кафедраи тарбияи ҷисмонӣ',
      'Майдони футболи стандартӣ',
      'Роҳрави дави варзишӣ',
    ],
    departmentsRu: [
      'Кафедра физического воспитания',
      'Футбольное поле с разметкой',
      'Беговая дорожка с терракотовым покрытием',
    ],
    descriptionEn:
      'Central north-south football pitch with regulation markings and multi-lane terracotta running track, bridging the southern avenue square and northern academic sectors.',
    localPos: [-8, 12],
    ...localToLatLon(-8, 12),
    cameraView: {
      position: [-6, 72, 92],
      target: [-8, 2, 12],
    },
    searchQuery:
      'TSULBP stadium Khujand Стадион ТГУ Худжанд sports facilities',
    accentColor: '#2F7D44',
  },
  {
    id: 'green_square',
    code: 'SQ',
    nameTj: 'Боғи донишгоҳ ва дарвозаи дуюм',
    nameRu: 'Университетский сквер и малая арка',
    nameEn: 'University Square & Secondary Arch',
    category: 'Landscape & Promenade',
    stories: 1,
    departmentsTj: [
      'Боғи сабзи марказӣ',
      'Гулгашти санавбарҳо',
      'Дарвозаи дуюми хиёбони Тошканд',
    ],
    departmentsRu: [
      'Центральный зелёный сквер',
      'Аллея хвойных деревьев',
      'Вторая входная арка к стадиону',
    ],
    descriptionEn:
      'Symmetrical landscaped square south of the stadium featuring four cypress-lined green quadrants, stone staircases, and a secondary archway connecting Tashkent Avenue to the stadium.',
    localPos: [0, 68],
    ...localToLatLon(0, 68),
    cameraView: {
      position: [18, 34, 125],
      target: [0, 3, 62],
    },
    searchQuery:
      'Tajik State University of Law, Business and Politics Khujand campus park Tashkent Avenue',
    accentColor: '#4B8F52',
  },
  {
    id: 'east_rotunda_hall',
    code: 'B3',
    nameTj: 'Бинои шарқии варзишгоҳ',
    nameRu: 'Восточный учебный корпус у стадиона',
    nameEn: 'East Stadium Hall (Semicircular Bay)',
    category: 'Academic Wing',
    stories: 2,
    departmentsTj: [
      'Синфхонаҳои лексионӣ',
      'Маркази забономӯзӣ ва методӣ',
    ],
    departmentsRu: [
      'Лекционные аудитории',
      'Лингвистический и методический центр',
    ],
    descriptionEn:
      'Elongated two-story academic hall east of the stadium featuring a pitched terracotta-red roof, signature semicircular southern bay, and dense cypress grove.',
    localPos: [44, 14],
    ...localToLatLon(44, 14),
    cameraView: {
      position: [84, 34, 58],
      target: [44, 5, 16],
    },
    searchQuery:
      'TSULBP Khujand academic buildings faculties departments',
    accentColor: '#A93226',
  },
  {
    id: 'south_stadium_pavilion',
    code: 'B4',
    nameTj: 'Бинои ҷанубии варзишгоҳ',
    nameRu: 'Южный корпус у стадиона',
    nameEn: 'South Stadium Academic Building',
    category: 'Academic & Services',
    stories: 2,
    departmentsTj: [
      'Шӯъбаи омодагӣ ва курсҳои кӯтоҳмуддат',
      'Маркази фарҳангии донишҷӯён',
    ],
    departmentsRu: [
      'Подготовительное отделение',
      'Студенческий культурный центр',
    ],
    descriptionEn:
      'Compact two-story yellow-stucco and red-roofed building positioned between the stadium embankment and the southeastern university garden.',
    localPos: [26, 44],
    ...localToLatLon(26, 44),
    cameraView: {
      position: [56, 26, 84],
      target: [26, 5, 44],
    },
    searchQuery:
      'Tajik State University of Law, Business and Politics student center Khujand',
    accentColor: '#C0392B',
  },
  {
    id: 'west_campus_annexes',
    code: 'W1',
    nameTj: 'Биноҳои таълимӣ ва хизматрасонии ғарбӣ',
    nameRu: 'Западные учебно-бытовые корпуса',
    nameEn: 'West Campus Red-Roof Annexes',
    category: 'Academic & Support',
    stories: 2,
    departmentsTj: [
      'Лабораторияҳои таълимӣ',
      'Ошхона ва маркази хизматрасонӣ',
    ],
    departmentsRu: [
      'Учебные лаборатории',
      'Студенческая столовая и хозблок',
    ],
    descriptionEn:
      'Cluster of pitched red-roof buildings flanking the western edge of the stadium and north of the Main Rectorate courtyard.',
    localPos: [-64, 24],
    ...localToLatLon(-64, 24),
    cameraView: {
      position: [-34, 34, 68],
      target: [-64, 5, 26],
    },
    searchQuery:
      'TSULBP Khujand campus facilities computer labs',
    accentColor: '#9E2A22',
  },
  {
    id: 'northeast_main_hall',
    code: 'B2',
    nameTj: 'Бинои таълимии шимолу шарқӣ',
    nameRu: 'Северо-восточный учебный корпус',
    nameEn: 'Northeast Multi-Story Academic Hall',
    category: 'Faculties & Lecture Halls',
    stories: 5,
    departmentsTj: [
      'Факултети молия',
      'Факултети баҳисобгирӣ ва андоз',
      'Факултети сиёсатшиносӣ ва муносибатҳои байналхалқӣ',
    ],
    departmentsRu: [
      'Финансовый факультет',
      'Факультет учёта и налогообложения',
      'Факультет политологии и международных отношений',
    ],
    descriptionEn:
      'Expansive five-story horizontal academic building in the northeast sector with twin right-hand wings, semicircular eastern entrance bay, and lush courtyard pine plantations.',
    localPos: [54, -46],
    ...localToLatLon(54, -46),
    cameraView: {
      position: [86, 46, 22],
      target: [54, 10, -44],
    },
    searchQuery:
      'Tajik State University of Law, Business and Politics Faculty of Finance Accounting Tax Politics International Relations',
    accentColor: '#D6AE5A',
  },
  {
    id: 'building_5_new',
    code: 'K5',
    nameTj: 'Бинои нави 5-ум',
    nameRu: 'ТГУ 5 корпус (новый)',
    nameEn: 'New 5th Academic Building',
    category: 'Flagship Modern Building',
    stories: 3,
    departmentsTj: [
      'Факултети инноватсия ва телекоммуникатсия',
      'Маркази технологияҳои рақамӣ ва имтиҳонӣ',
      'Толори маҷлисгоҳ (ротондаи шарқӣ)',
    ],
    departmentsRu: [
      'Факультет инноваций и телекоммуникаций',
      'Центр цифровых технологий и тестирования',
      'Полукруглая стеклянная ротонда с колоннами',
    ],
    descriptionEn:
      'Three-story yellow academic palace with terracotta plinth and pitched roof, twin dormer bays, central stained-glass portal, two-story western annex bridge, and iconic semicircular columned glass rotunda on its eastern end.',
    localPos: [64, -88],
    ...localToLatLon(64, -88),
    cameraView: {
      position: [112, 34, -42],
      target: [64, 9, -86],
    },
    searchQuery:
      'TSULBP 5th building Khujand ТГУ 5 корпус новый Худжанд Faculty of Innovation and Telecommunications',
    accentColor: '#E8C56C',
  },
  {
    id: 'innovation_pavilion',
    code: 'IP',
    nameTj: 'Маркази инноватсия ва технологияҳо',
    nameRu: 'Инновационный павильон',
    nameEn: 'L-Shaped Innovation Glass Pavilion',
    category: 'Research & Labs',
    stories: 1,
    departmentsTj: [
      'Парки технологии донишгоҳ',
      'Синфхонаҳои компютерӣ',
    ],
    departmentsRu: [
      'Университетский технопарк',
      'Компьютерные и мультимедийные классы',
    ],
    descriptionEn:
      'Modern L-shaped terracotta pavilion featuring floor-to-ceiling cyan glass bays and twin manicured tree avenues in front.',
    localPos: [-28, -42],
    ...localToLatLon(-28, -42),
    cameraView: {
      position: [-10, 28, -6],
      target: [-28, 4, -42],
    },
    searchQuery:
      'Tajik State University of Law, Business and Politics technopark innovation center Khujand',
    accentColor: '#8E5A3C',
  },
];

export const CAMERA_PRESETS: CameraPreset[] = [
  {
    id: 'overview',
    label: 'Overview (Satellite Alignment)',
    shortLabel: 'Overview',
    position: [-25, 165, 198],
    target: [6, 4, -6],
  },
  {
    id: 'rectorate',
    label: 'Main Gate & Rectorate',
    shortLabel: 'Main Gate',
    position: [-36, 42, 146],
    target: [-70, 9, 72],
  },
  {
    id: 'building5',
    label: 'New 5th Building',
    shortLabel: '5th Bldg',
    position: [116, 36, -38],
    target: [62, 9, -86],
  },
  {
    id: 'stadium',
    label: 'TSULBP Stadium',
    shortLabel: 'Stadium',
    position: [-14, 72, 96],
    target: [-6, 2, 12],
  },
  {
    id: 'topdown',
    label: 'Top-Down Plan',
    shortLabel: 'Plan',
    position: [0, 295, 24],
    target: [0, 0, -6],
  },
];

/**
 * Fallback local OSM context (Tashkent Avenue, eastern roundabout, 17th Microdistrict
 * perimeter streets, and surrounding residential/institutional blocks) so the scene
 * renders accurately even offline or if Overpass API times out.
 */
export function getFallbackOsmDataset(): OsmDataset {
  const roads: OsmPolygon[] = [
    // Tashkent Avenue (просп. Ташкентский) along the south edge + curve toward roundabout
    {
      id: 'fallback-tashkent-ave-main',
      kind: 'road',
      name: 'просп. Ташкентский',
      width: 18,
      points: [
        [-260, 134],
        [-140, 118],
        [-30, 104],
        [75, 92],
        [124, 82],
        [146, 66],
      ],
    },
    // Tashkent Avenue Eastern Roundabout loop
    {
      id: 'fallback-tashkent-roundabout',
      kind: 'road',
      name: 'Круг Ташкентский',
      width: 12,
      points: [
        [142, 82],
        [156, 98],
        [178, 102],
        [196, 90],
        [198, 68],
        [184, 52],
        [162, 50],
        [144, 62],
        [142, 82],
      ],
    },
    // Eastern avenue north of roundabout
    {
      id: 'fallback-east-street',
      kind: 'road',
      name: '17-мкр Восточная ул.',
      width: 11,
      points: [
        [164, 52],
        [154, -20],
        [140, -110],
        [128, -170],
      ],
    },
    // Western neighborhood road
    {
      id: 'fallback-west-street',
      kind: 'road',
      name: '17-мкр Западная ул.',
      width: 11,
      points: [
        [-144, 122],
        [-162, 48],
        [-152, -25],
        [-138, -115],
      ],
    },
    // Northern perimeter street toward Mogoltau foothills
    {
      id: 'fallback-north-street',
      kind: 'road',
      name: '17-мкр Северная ул.',
      width: 10,
      points: [
        [-138, -115],
        [-30, -132],
        [70, -142],
        [136, -134],
      ],
    },
  ];

  // Surrounding 17th Microdistrict residential/commercial blocks outside campus perimeter
  const buildings: OsmPolygon[] = [
    {
      id: 'fallback-ctx-imon-sw',
      kind: 'building',
      name: 'ЗАО МДО "Имон Интернешнл"',
      height: 15,
      points: [
        [-205, 78],
        [-175, 74],
        [-170, 102],
        [-200, 106],
      ],
    },
    {
      id: 'fallback-ctx-west-school-1',
      kind: 'building',
      name: '17-мкр корпус',
      height: 12,
      points: [
        [-228, -42],
        [-188, -46],
        [-185, -24],
        [-225, -20],
      ],
    },
    {
      id: 'fallback-ctx-west-school-2',
      kind: 'building',
      name: '17-мкр жилой блок',
      height: 14,
      points: [
        [-225, -16],
        [-185, -20],
        [-182, 4],
        [-222, 8],
      ],
    },
    {
      id: 'fallback-ctx-east-block',
      kind: 'building',
      name: '17-мкр коммерческий центр',
      height: 18,
      points: [
        [102, 22],
        [138, 18],
        [142, 62],
        [106, 66],
      ],
    },
    {
      id: 'fallback-ctx-north-res-1',
      kind: 'building',
      height: 11,
      points: [
        [-80, -152],
        [-35, -158],
        [-32, -140],
        [-77, -134],
      ],
    },
    {
      id: 'fallback-ctx-north-res-2',
      kind: 'building',
      height: 11,
      points: [
        [-12, -162],
        [36, -168],
        [39, -148],
        [-9, -142],
      ],
    },
    {
      id: 'fallback-ctx-north-res-3',
      kind: 'building',
      height: 12,
      points: [
        [54, -168],
        [104, -172],
        [106, -150],
        [56, -146],
      ],
    },
    {
      id: 'fallback-ctx-south-ave-1',
      kind: 'building',
      height: 16,
      points: [
        [-112, 146],
        [-58, 138],
        [-54, 160],
        [-108, 168],
      ],
    },
    {
      id: 'fallback-ctx-south-ave-2',
      kind: 'building',
      height: 16,
      points: [
        [-32, 136],
        [24, 128],
        [28, 150],
        [-28, 158],
      ],
    },
    {
      id: 'fallback-ctx-south-ave-3',
      kind: 'building',
      height: 18,
      points: [
        [52, 126],
        [108, 118],
        [112, 142],
        [56, 150],
      ],
    },
  ];

  return {
    source: 'fallback',
    buildings,
    roads,
    fetchedAt: Date.now(),
  };
}

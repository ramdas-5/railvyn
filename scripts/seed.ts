/**
 * Deterministic demonstration seed for RAILVYN.
 *
 * WARNING: this resets every application table (including auth users) in the
 * configured NEON_DATABASE_URL. Never run it against production data.
 */
import { randomUUID } from "node:crypto";
import { config as loadEnv } from "dotenv";
import { hashPassword } from "better-auth/crypto";
import { eq, sql } from "drizzle-orm";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

import { getDb } from "../src/db";
import {
  account,
  appSettings,
  auditLogs,
  bookingPassengers,
  bookingSeats,
  bookings,
  coachTemplates,
  disruptions,
  fares,
  holdSeats,
  operatorScopes,
  paymentsDemo,
  roleAssignments,
  routeStops,
  routes,
  runCoaches,
  runSeats,
  seatHolds,
  seatSegmentClaims,
  stations,
  templateSeats,
  trainRuns,
  trains,
  user,
  waitlistEntries,
  type BerthType,
  type TravelClass,
} from "../src/db/schema";
import {
  kolkataToUtc,
  addDaysToIsoDate,
  todayInAppZone,
} from "../src/lib/datetime";

const DEMO_PASSWORD = "RailvynDemo#2026";

/* -------------------------------------------------------------------------- */
/* Network                                                                     */
/* -------------------------------------------------------------------------- */

type StationSeed = {
  code: string;
  name: string;
  city: string;
  state: string;
};

const STATIONS: StationSeed[] = [
  { code: "NDLS", name: "New Delhi", city: "New Delhi", state: "Delhi" },
  { code: "GZB", name: "Ghaziabad Junction", city: "Ghaziabad", state: "Uttar Pradesh" },
  { code: "ALJN", name: "Aligarh Junction", city: "Aligarh", state: "Uttar Pradesh" },
  { code: "CNB", name: "Kanpur Central", city: "Kanpur", state: "Uttar Pradesh" },
  { code: "PRYJ", name: "Prayagraj Junction", city: "Prayagraj", state: "Uttar Pradesh" },
  { code: "DDU", name: "Pt. Deen Dayal Upadhyaya", city: "Mughalsarai", state: "Uttar Pradesh" },
  { code: "BSB", name: "Varanasi Junction", city: "Varanasi", state: "Uttar Pradesh" },
  { code: "HWH", name: "Howrah Junction", city: "Kolkata", state: "West Bengal" },
  { code: "CSMT", name: "Chhatrapati Shivaji Maharaj Terminus", city: "Mumbai", state: "Maharashtra" },
  { code: "PUNE", name: "Pune Junction", city: "Pune", state: "Maharashtra" },
  { code: "SUR", name: "Solapur", city: "Solapur", state: "Maharashtra" },
  { code: "KJM", name: "Krishnarajapuram", city: "Bengaluru", state: "Karnataka" },
  { code: "MAS", name: "MGR Chennai Central", city: "Chennai", state: "Tamil Nadu" },
  { code: "AGC", name: "Agra Cantt", city: "Agra", state: "Uttar Pradesh" },
  { code: "GWL", name: "Gwalior Junction", city: "Gwalior", state: "Madhya Pradesh" },
  { code: "JHS", name: "Jhansi Junction", city: "Jhansi", state: "Uttar Pradesh" },
  { code: "BPL", name: "Bhopal Junction", city: "Bhopal", state: "Madhya Pradesh" },
  { code: "NGP", name: "Nagpur Junction", city: "Nagpur", state: "Maharashtra" },
  { code: "SC", name: "Secunderabad Junction", city: "Hyderabad", state: "Telangana" },
  { code: "HYB", name: "Hyderabad Deccan", city: "Hyderabad", state: "Telangana" },
  { code: "BZA", name: "Vijayawada Junction", city: "Vijayawada", state: "Andhra Pradesh" },
  { code: "VSKP", name: "Visakhapatnam", city: "Visakhapatnam", state: "Andhra Pradesh" },
  { code: "BBS", name: "Bhubaneswar", city: "Bhubaneswar", state: "Odisha" },
  { code: "PURI", name: "Puri", city: "Puri", state: "Odisha" },
  { code: "ASN", name: "Asansol Junction", city: "Asansol", state: "West Bengal" },
  { code: "DHN", name: "Dhanbad Junction", city: "Dhanbad", state: "Jharkhand" },
  { code: "GAYA", name: "Gaya Junction", city: "Gaya", state: "Bihar" },
  { code: "PNBE", name: "Patna Junction", city: "Patna", state: "Bihar" },
  { code: "UMB", name: "Ambala Cantt", city: "Ambala", state: "Haryana" },
  { code: "LDH", name: "Ludhiana Junction", city: "Ludhiana", state: "Punjab" },
  { code: "JUC", name: "Jalandhar City", city: "Jalandhar", state: "Punjab" },
  { code: "ASR", name: "Amritsar Junction", city: "Amritsar", state: "Punjab" },
  { code: "JAT", name: "Jammu Tawi", city: "Jammu", state: "Jammu and Kashmir" },
  { code: "JP", name: "Jaipur Junction", city: "Jaipur", state: "Rajasthan" },
  { code: "AII", name: "Ajmer Junction", city: "Ajmer", state: "Rajasthan" },
  { code: "UDR", name: "Udaipur City", city: "Udaipur", state: "Rajasthan" },
  { code: "KOTA", name: "Kota Junction", city: "Kota", state: "Rajasthan" },
  { code: "RTM", name: "Ratlam Junction", city: "Ratlam", state: "Madhya Pradesh" },
  { code: "BRC", name: "Vadodara Junction", city: "Vadodara", state: "Gujarat" },
  { code: "ADI", name: "Ahmedabad Junction", city: "Ahmedabad", state: "Gujarat" },
  { code: "MMCT", name: "Mumbai Central", city: "Mumbai", state: "Maharashtra" },
  { code: "PNVL", name: "Panvel Junction", city: "Navi Mumbai", state: "Maharashtra" },
  { code: "RN", name: "Ratnagiri", city: "Ratnagiri", state: "Maharashtra" },
  { code: "MAO", name: "Madgaon Junction", city: "Margao", state: "Goa" },
  { code: "MAQ", name: "Mangaluru Central", city: "Mangaluru", state: "Karnataka" },
  { code: "ERS", name: "Ernakulam Junction", city: "Kochi", state: "Kerala" },
  { code: "TVC", name: "Thiruvananthapuram Central", city: "Thiruvananthapuram", state: "Kerala" },
  { code: "SBC", name: "KSR Bengaluru City", city: "Bengaluru", state: "Karnataka" },
  { code: "MYS", name: "Mysuru Junction", city: "Mysuru", state: "Karnataka" },
  { code: "CBE", name: "Coimbatore Junction", city: "Coimbatore", state: "Tamil Nadu" },
  { code: "SA", name: "Salem Junction", city: "Salem", state: "Tamil Nadu" },
  { code: "MDU", name: "Madurai Junction", city: "Madurai", state: "Tamil Nadu" },
  { code: "TPJ", name: "Tiruchirappalli Junction", city: "Tiruchirappalli", state: "Tamil Nadu" },
  { code: "ST", name: "Surat", city: "Surat", state: "Gujarat" },
  { code: "LKO", name: "Lucknow Charbagh", city: "Lucknow", state: "Uttar Pradesh" },
  { code: "AYC", name: "Ayodhya Cantt", city: "Ayodhya", state: "Uttar Pradesh" },
  { code: "GKP", name: "Gorakhpur Junction", city: "Gorakhpur", state: "Uttar Pradesh" },
  { code: "NJP", name: "New Jalpaiguri", city: "Siliguri", state: "West Bengal" },
  { code: "GHY", name: "Guwahati", city: "Guwahati", state: "Assam" },
  { code: "INDB", name: "Indore Junction", city: "Indore", state: "Madhya Pradesh" },
  { code: "JBP", name: "Jabalpur Junction", city: "Jabalpur", state: "Madhya Pradesh" },
  { code: "ET", name: "Itarsi Junction", city: "Itarsi", state: "Madhya Pradesh" },
  { code: "BSL", name: "Bhusaval Junction", city: "Bhusaval", state: "Maharashtra" },
];

type RouteStopSeed = { code: string; km: number; offset: number };

type RouteSeed = {
  code: string;
  name: string;
  description: string;
  classes: TravelClass[];
  stops: RouteStopSeed[];
};

const ROUTES: RouteSeed[] = [
  {
    code: "NR-CORRIDOR",
    name: "Northern Corridor",
    description:
      "New Delhi to Howrah across the Ganga plain, with eight ordered demonstration stops.",
    classes: ["sleeper", "ac3", "ac2"],
    stops: [
      { code: "NDLS", km: 0, offset: 0 },
      { code: "GZB", km: 24, offset: 35 },
      { code: "ALJN", km: 132, offset: 95 },
      { code: "CNB", km: 440, offset: 320 },
      { code: "PRYJ", km: 634, offset: 455 },
      { code: "DDU", km: 776, offset: 560 },
      { code: "BSB", km: 796, offset: 590 },
      { code: "HWH", km: 1447, offset: 1020 },
    ],
  },
  {
    code: "DECCAN-LINK",
    name: "Deccan Link",
    description: "Mumbai to Chennai via Pune, Solapur and Bengaluru.",
    classes: ["chair", "ac3", "sleeper"],
    stops: [
      { code: "CSMT", km: 0, offset: 0 },
      { code: "PUNE", km: 192, offset: 190 },
      { code: "SUR", km: 455, offset: 420 },
      { code: "KJM", km: 1013, offset: 940 },
      { code: "MAS", km: 1280, offset: 1140 },
    ],
  },
  {
    code: "WESTERN-GOLD",
    name: "Western Gold Corridor",
    description: "Mumbai Central to New Delhi through Surat, Vadodara, Ratlam, Kota and Jaipur.",
    classes: ["sleeper", "ac3", "ac2"],
    stops: [
      { code: "MMCT", km: 0, offset: 0 },
      { code: "ST", km: 263, offset: 180 },
      { code: "BRC", km: 392, offset: 300 },
      { code: "RTM", km: 653, offset: 480 },
      { code: "KOTA", km: 923, offset: 700 },
      { code: "JP", km: 1163, offset: 880 },
      { code: "NDLS", km: 1465, offset: 1180 },
    ],
  },
  {
    code: "SOUTHERN-GATE",
    name: "Southern Gate",
    description: "Chennai to Mysuru through Salem, Coimbatore and Bengaluru.",
    classes: ["chair", "ac3", "sleeper"],
    stops: [
      { code: "MAS", km: 0, offset: 0 },
      { code: "SA", km: 334, offset: 300 },
      { code: "CBE", km: 495, offset: 420 },
      { code: "SBC", km: 660, offset: 570 },
      { code: "MYS", km: 805, offset: 700 },
    ],
  },
  {
    code: "EAST-COAST",
    name: "East Coast Corridor",
    description: "Howrah to Chennai along the Bay of Bengal through Bhubaneswar, Visakhapatnam and Vijayawada.",
    classes: ["sleeper", "ac3", "ac2"],
    stops: [
      { code: "HWH", km: 0, offset: 0 },
      { code: "BBS", km: 437, offset: 400 },
      { code: "VSKP", km: 880, offset: 780 },
      { code: "BZA", km: 1180, offset: 1050 },
      { code: "MAS", km: 1660, offset: 1500 },
    ],
  },
  {
    code: "CENTRAL-SPINE",
    name: "Central Spine",
    description: "New Delhi to Secunderabad via Agra, Gwalior, Jhansi, Bhopal and Nagpur.",
    classes: ["sleeper", "ac3", "ac2"],
    stops: [
      { code: "NDLS", km: 0, offset: 0 },
      { code: "AGC", km: 195, offset: 130 },
      { code: "GWL", km: 315, offset: 230 },
      { code: "JHS", km: 415, offset: 330 },
      { code: "BPL", km: 700, offset: 650 },
      { code: "NGP", km: 1080, offset: 1020 },
      { code: "SC", km: 1500, offset: 1400 },
    ],
  },
  {
    code: "PUNJAB-LINK",
    name: "Punjab Link",
    description: "New Delhi to Jammu Tawi through Ambala, Ludhiana, Jalandhar and Amritsar.",
    classes: ["chair", "ac3", "sleeper"],
    stops: [
      { code: "NDLS", km: 0, offset: 0 },
      { code: "UMB", km: 190, offset: 150 },
      { code: "LDH", km: 320, offset: 260 },
      { code: "JUC", km: 390, offset: 330 },
      { code: "ASR", km: 445, offset: 400 },
      { code: "JAT", km: 700, offset: 620 },
    ],
  },
  {
    code: "BENGAL-BIHAR",
    name: "Bengal Bihar Link",
    description: "Howrah to Patna through Asansol, Dhanbad and Gaya.",
    classes: ["chair", "ac3", "sleeper"],
    stops: [
      { code: "HWH", km: 0, offset: 0 },
      { code: "ASN", km: 200, offset: 180 },
      { code: "DHN", km: 260, offset: 240 },
      { code: "GAYA", km: 450, offset: 420 },
      { code: "PNBE", km: 530, offset: 520 },
    ],
  },
  {
    code: "KONKAN-COAST",
    name: "Konkan Coast",
    description: "Mumbai to Thiruvananthapuram along the Konkan coast through Goa, Mangaluru and Ernakulam.",
    classes: ["sleeper", "ac3", "ac2"],
    stops: [
      { code: "CSMT", km: 0, offset: 0 },
      { code: "PNVL", km: 45, offset: 45 },
      { code: "RN", km: 330, offset: 320 },
      { code: "MAO", km: 590, offset: 560 },
      { code: "MAQ", km: 950, offset: 900 },
      { code: "ERS", km: 1450, offset: 1350 },
      { code: "TVC", km: 1600, offset: 1500 },
    ],
  },
  {
    code: "RAJASTHAN-LINK",
    name: "Rajasthan Link",
    description: "Jaipur to Mumbai through Ajmer, Udaipur, Ahmedabad, Vadodara and Surat.",
    classes: ["chair", "ac3", "sleeper"],
    stops: [
      { code: "JP", km: 0, offset: 0 },
      { code: "AII", km: 130, offset: 120 },
      { code: "UDR", km: 400, offset: 360 },
      { code: "ADI", km: 620, offset: 560 },
      { code: "BRC", km: 720, offset: 650 },
      { code: "ST", km: 850, offset: 780 },
      { code: "MMCT", km: 1050, offset: 1050 },
    ],
  },
  {
    code: "NORTH-EAST",
    name: "North East Link",
    description: "New Delhi to Guwahati through Lucknow, Ayodhya, Gorakhpur and New Jalpaiguri.",
    classes: ["sleeper", "ac3", "ac2"],
    stops: [
      { code: "NDLS", km: 0, offset: 0 },
      { code: "LKO", km: 500, offset: 420 },
      { code: "AYC", km: 680, offset: 540 },
      { code: "GKP", km: 780, offset: 640 },
      { code: "NJP", km: 1200, offset: 1000 },
      { code: "GHY", km: 1550, offset: 1280 },
    ],
  },
  {
    code: "MALWA-DECCAN",
    name: "Malwa Deccan Link",
    description: "Indore to Jhansi through Itarsi and Jabalpur.",
    classes: ["chair", "ac3", "sleeper"],
    stops: [
      { code: "INDB", km: 0, offset: 0 },
      { code: "ET", km: 90, offset: 90 },
      { code: "JBP", km: 250, offset: 250 },
      { code: "JHS", km: 500, offset: 500 },
    ],
  },
  {
    code: "TAMIL-LINK",
    name: "Tamil Link",
    description: "Chennai to Madurai through Tiruchirappalli.",
    classes: ["chair", "ac3"],
    stops: [
      { code: "MAS", km: 0, offset: 0 },
      { code: "TPJ", km: 330, offset: 300 },
      { code: "MDU", km: 460, offset: 420 },
    ],
  },
  {
    code: "COTTON-BELT",
    name: "Cotton Belt Corridor",
    description: "Mumbai to New Delhi through Bhusaval, Bhopal and Jhansi.",
    classes: ["sleeper", "ac3", "ac2"],
    stops: [
      { code: "CSMT", km: 0, offset: 0 },
      { code: "BSL", km: 445, offset: 380 },
      { code: "BPL", km: 780, offset: 650 },
      { code: "JHS", km: 1180, offset: 900 },
      { code: "NDLS", km: 1545, offset: 1200 },
    ],
  },
  {
    code: "COASTAL-ODISHA",
    name: "Coastal Odisha Link",
    description: "Howrah to Puri through Bhubaneswar, along the Bay of Bengal.",
    classes: ["chair", "ac3", "sleeper"],
    stops: [
      { code: "HWH", km: 0, offset: 0 },
      { code: "BBS", km: 437, offset: 400 },
      { code: "PURI", km: 500, offset: 470 },
    ],
  },
  {
    code: "GODAVARI-GATE",
    name: "Godavari Gate",
    description: "Hyderabad to Visakhapatnam through Secunderabad and Vijayawada.",
    classes: ["sleeper", "ac3", "ac2"],
    stops: [
      { code: "HYB", km: 0, offset: 0 },
      { code: "SC", km: 10, offset: 20 },
      { code: "BZA", km: 390, offset: 340 },
      { code: "VSKP", km: 740, offset: 640 },
    ],
  },
];

/* -------------------------------------------------------------------------- */
/* Rolling stock                                                               */
/* -------------------------------------------------------------------------- */

type TemplateSpec = {
  code: string;
  name: string;
  travelClass: TravelClass;
  layoutStyle: string;
  bays: number;
  berthsPerBay: number;
  pattern: BerthType[];
  accessibleNumbers: number[];
};

const TEMPLATE_SPECS: TemplateSpec[] = [
  {
    code: "SL72",
    name: "Sleeper 72",
    travelClass: "sleeper",
    layoutStyle: "8-berth bays",
    bays: 9,
    berthsPerBay: 8,
    pattern: ["lower", "middle", "upper", "lower", "middle", "upper", "side_lower", "side_upper"],
    accessibleNumbers: [1, 2],
  },
  {
    code: "3A64",
    name: "AC 3 Tier 64",
    travelClass: "ac3",
    layoutStyle: "8-berth AC bays",
    bays: 8,
    berthsPerBay: 8,
    pattern: ["lower", "middle", "upper", "lower", "middle", "upper", "side_lower", "side_upper"],
    accessibleNumbers: [1, 2],
  },
  {
    code: "2A48",
    name: "AC 2 Tier 48",
    travelClass: "ac2",
    layoutStyle: "6-berth AC bays",
    bays: 8,
    berthsPerBay: 6,
    pattern: ["lower", "upper", "lower", "upper", "side_lower", "side_upper"],
    accessibleNumbers: [1],
  },
  {
    code: "CC78",
    name: "Chair Car 78",
    travelClass: "chair",
    layoutStyle: "3 + 3 rows",
    bays: 13,
    berthsPerBay: 6,
    pattern: ["seat", "seat", "seat", "seat", "seat", "seat"],
    accessibleNumbers: [1, 7],
  },
];

type CoachSeed = {
  code: string;
  templateCode: string;
  className: TravelClass;
};

const COACH_SETS = {
  long: [
    { code: "S1", templateCode: "SL72", className: "sleeper" },
    { code: "B1", templateCode: "3A64", className: "ac3" },
    { code: "A1", templateCode: "2A48", className: "ac2" },
  ],
  mixed: [
    { code: "S1", templateCode: "SL72", className: "sleeper" },
    { code: "B1", templateCode: "3A64", className: "ac3" },
    { code: "C1", templateCode: "CC78", className: "chair" },
  ],
  intercity: [
    { code: "C1", templateCode: "CC78", className: "chair" },
    { code: "C2", templateCode: "CC78", className: "chair" },
    { code: "B1", templateCode: "3A64", className: "ac3" },
  ],
} satisfies Record<string, CoachSeed[]>;

type TrainSeed = {
  code: string;
  name: string;
  routeCode: string;
  departureOffset: number;
  coaches: CoachSeed[];
};

const TRAINS: TrainSeed[] = [
  { code: "12451", name: "Yamuna Express", routeCode: "NR-CORRIDOR", departureOffset: 370, coaches: COACH_SETS.long },
  { code: "12301", name: "Eastern Superfast", routeCode: "NR-CORRIDOR", departureOffset: 1080, coaches: COACH_SETS.long },
  { code: "22119", name: "Deccan Intercity", routeCode: "DECCAN-LINK", departureOffset: 1005, coaches: COACH_SETS.mixed },
  { code: "12027", name: "Deccan Queen", routeCode: "DECCAN-LINK", departureOffset: 450, coaches: COACH_SETS.intercity },
  { code: "12951", name: "Mumbai Rajdhani", routeCode: "WESTERN-GOLD", departureOffset: 1010, coaches: COACH_SETS.long },
  { code: "12952", name: "Western Express", routeCode: "WESTERN-GOLD", departureOffset: 380, coaches: COACH_SETS.long },
  { code: "12007", name: "Mysuru Shatabdi", routeCode: "SOUTHERN-GATE", departureOffset: 360, coaches: COACH_SETS.intercity },
  { code: "12695", name: "Southern Express", routeCode: "SOUTHERN-GATE", departureOffset: 900, coaches: COACH_SETS.mixed },
  { code: "12841", name: "Coromandel Express", routeCode: "EAST-COAST", departureOffset: 720, coaches: COACH_SETS.long },
  { code: "12842", name: "East Coast Express", routeCode: "EAST-COAST", departureOffset: 390, coaches: COACH_SETS.long },
  { code: "12723", name: "Telangana Express", routeCode: "CENTRAL-SPINE", departureOffset: 400, coaches: COACH_SETS.long },
  { code: "12724", name: "Dakshin Express", routeCode: "CENTRAL-SPINE", departureOffset: 950, coaches: COACH_SETS.long },
  { code: "12013", name: "Amritsar Shatabdi", routeCode: "PUNJAB-LINK", departureOffset: 380, coaches: COACH_SETS.intercity },
  { code: "12497", name: "Punjab Mail", routeCode: "PUNJAB-LINK", departureOffset: 1010, coaches: COACH_SETS.mixed },
  { code: "12333", name: "Vibhuti Express", routeCode: "BENGAL-BIHAR", departureOffset: 420, coaches: COACH_SETS.mixed },
  { code: "12334", name: "Patna Express", routeCode: "BENGAL-BIHAR", departureOffset: 960, coaches: COACH_SETS.mixed },
  { code: "12201", name: "Konkan Kanya", routeCode: "KONKAN-COAST", departureOffset: 350, coaches: COACH_SETS.long },
  { code: "12202", name: "Kochuveli Express", routeCode: "KONKAN-COAST", departureOffset: 950, coaches: COACH_SETS.long },
  { code: "12955", name: "Rajasthan Express", routeCode: "RAJASTHAN-LINK", departureOffset: 430, coaches: COACH_SETS.mixed },
  { code: "12956", name: "Aravali Express", routeCode: "RAJASTHAN-LINK", departureOffset: 980, coaches: COACH_SETS.mixed },
  { code: "18233", name: "Narmada Express", routeCode: "MALWA-DECCAN", departureOffset: 420, coaches: COACH_SETS.mixed },
  { code: "12637", name: "Pandian Express", routeCode: "TAMIL-LINK", departureOffset: 500, coaches: COACH_SETS.intercity },
  { code: "12505", name: "North East Express", routeCode: "NORTH-EAST", departureOffset: 600, coaches: COACH_SETS.long },
  { code: "15909", name: "Avadh Assam", routeCode: "NORTH-EAST", departureOffset: 300, coaches: COACH_SETS.long },
  { code: "12137", name: "Cotton Belt Express", routeCode: "COTTON-BELT", departureOffset: 430, coaches: COACH_SETS.long },
  { code: "12138", name: "Bhusaval Mail", routeCode: "COTTON-BELT", departureOffset: 990, coaches: COACH_SETS.long },
  { code: "12895", name: "Odisha Coastal Express", routeCode: "COASTAL-ODISHA", departureOffset: 460, coaches: COACH_SETS.intercity },
  { code: "12896", name: "Puri Jagannath Express", routeCode: "COASTAL-ODISHA", departureOffset: 900, coaches: COACH_SETS.mixed },
  { code: "17015", name: "Godavari Express", routeCode: "GODAVARI-GATE", departureOffset: 400, coaches: COACH_SETS.long },
  { code: "17016", name: "Coastal Andhra Express", routeCode: "GODAVARI-GATE", departureOffset: 850, coaches: COACH_SETS.long },
];

// A run may only carry coaches whose class has segment fares on its route.
for (const train of TRAINS) {
  const route = ROUTES.find((entry) => entry.code === train.routeCode);
  if (!route) throw new Error(`Train ${train.code} references unknown route ${train.routeCode}`);
  for (const coach of train.coaches) {
    if (!route.classes.includes(coach.className)) {
      throw new Error(
        `Train ${train.code} coach ${coach.code} offers ${coach.className}, but route ${route.code} has no ${coach.className} fares`,
      );
    }
  }
}

const FARE_MATRIX: Record<TravelClass, { basePaise: number; perKmPaise: number }> = {
  sleeper: { basePaise: 15_000, perKmPaise: 35 },
  ac3: { basePaise: 55_000, perKmPaise: 90 },
  ac2: { basePaise: 95_000, perKmPaise: 140 },
  chair: { basePaise: 30_000, perKmPaise: 55 },
};

function roundFare(paise: number): number {
  return Math.max(5_000, Math.round(paise / 500) * 500);
}

/* -------------------------------------------------------------------------- */
/* Deterministic helpers                                                       */
/* -------------------------------------------------------------------------- */

const REFERENCE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const referenceSet = new Set<string>();

function generatedReference(seed: number): string {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    let value = seed + 1 + attempt * 97;
    let out = "";
    for (let index = 0; index < 8; index += 1) {
      out += REFERENCE_ALPHABET[value % REFERENCE_ALPHABET.length];
      value = Math.floor(value / REFERENCE_ALPHABET.length) + 29;
    }
    const reference = `RVN-${out}`;
    if (!referenceSet.has(reference)) {
      referenceSet.add(reference);
      return reference;
    }
  }
  throw new Error("Could not generate a unique booking reference");
}

const PASSENGER_NAMES = [
  "Aarav Sharma",
  "Priya Nair",
  "Kabir Rao",
  "Isha Sharma",
  "Nisha Verma",
  "Arjun Menon",
  "Sara Khan",
  "Vikram Singh",
  "Ananya Bose",
  "Farhan Ahmed",
  "Aditi Kulkarni",
  "Rahul Yadav",
  "Sana Sheikh",
  "Karan Gupta",
  "Neha Joshi",
  "Imran Ali",
  "Pooja Reddy",
  "Manish Tiwari",
  "Divya Pillai",
  "Sanjay Patil",
  "Ritika Jain",
  "Amit Chauhan",
  "Meera Iyer",
  "Rohan Das",
];

const CITIES = ["Delhi", "Mumbai", "Bengaluru", "Chennai", "Kolkata", "Pune", "Jaipur", "Lucknow"];

/* -------------------------------------------------------------------------- */
/* Seed                                                                        */
/* -------------------------------------------------------------------------- */

async function main() {
  const db = getDb();
  console.log("[railvyn] resetting demonstration data…");
  await db.execute(sql`
    truncate table
      audit_logs, disruptions, payments_demo, waitlist_entries,
      seat_segment_claims, hold_seats, seat_holds, booking_seats,
      booking_passengers, bookings, fares, run_seats, run_coaches,
      template_seats, coach_templates, train_runs, operator_scopes, trains,
      role_assignments, route_stops, routes, stations, app_settings,
      verification, account, session, "user"
    restart identity cascade
  `);

  /* Stations ------------------------------------------------------------- */
  const stationIds = new Map<string, string>();
  for (const station of STATIONS) {
    const [row] = await db
      .insert(stations)
      .values(station)
      .returning({ id: stations.id });
    stationIds.set(station.code, row.id);
  }

  /* Routes and ordered stops --------------------------------------------- */
  const routeIds = new Map<string, string>();
  for (const route of ROUTES) {
    const [row] = await db
      .insert(routes)
      .values({
        code: route.code,
        name: route.name,
        description: route.description,
      })
      .returning({ id: routes.id });
    routeIds.set(route.code, row.id);
  }

  for (const route of ROUTES) {
    const routeId = routeIds.get(route.code)!;
    await db.insert(routeStops).values(
      route.stops.map((stop, index) => ({
        routeId,
        stationId: stationIds.get(stop.code)!,
        stopIndex: index,
        distanceKm: stop.km,
        scheduledOffsetMinutes: stop.offset,
      })),
    );
  }

  /* Fares for every ordered stop pair and offered class ------------------ */
  const fareRows: Array<typeof fares.$inferInsert> = [];
  for (const route of ROUTES) {
    const routeId = routeIds.get(route.code)!;
    for (let i = 0; i < route.stops.length; i += 1) {
      for (let j = i + 1; j < route.stops.length; j += 1) {
        const distance = route.stops[j]!.km - route.stops[i]!.km;
        for (const travelClass of route.classes) {
          const matrix = FARE_MATRIX[travelClass];
          fareRows.push({
            routeId,
            travelClass,
            fromStopIndex: i,
            toStopIndex: j,
            amountPaise: roundFare(matrix.basePaise + matrix.perKmPaise * distance),
          });
        }
      }
    }
  }
  for (let i = 0; i < fareRows.length; i += 100) {
    await db.insert(fares).values(fareRows.slice(i, i + 100));
  }

  /* Coach templates ------------------------------------------------------ */
  const templateIds = new Map<string, { id: string; className: TravelClass }>();
  for (const spec of TEMPLATE_SPECS) {
    const totalSeats = spec.bays * spec.berthsPerBay;
    const [template] = await db
      .insert(coachTemplates)
      .values({
        code: spec.code,
        name: spec.name,
        travelClass: spec.travelClass,
        layoutStyle: spec.layoutStyle,
        totalSeats,
      })
      .returning({ id: coachTemplates.id });
    const seatValues = Array.from({ length: totalSeats }, (_, index) => {
      const seatNumber = index + 1;
      const rowIndex = Math.floor(index / spec.berthsPerBay) + 1;
      const positionInRow = (index % spec.berthsPerBay) + 1;
      return {
        templateId: template!.id,
        seatNumber,
        berthType: spec.pattern[index % spec.pattern.length]!,
        deck: "lower",
        rowIndex,
        positionInRow,
        isAccessible: spec.accessibleNumbers.includes(seatNumber),
      };
    });
    await db.insert(templateSeats).values(seatValues);
    templateIds.set(spec.code, { id: template!.id, className: spec.travelClass });
  }

  // One read per template, reused for every run (48k+ seat rows in total).
  const templateSeatCache = new Map<
    string,
    Array<typeof templateSeats.$inferSelect>
  >();
  for (const [code, template] of templateIds) {
    templateSeatCache.set(
      code,
      await db
        .select()
        .from(templateSeats)
        .where(eq(templateSeats.templateId, template.id))
        .orderBy(templateSeats.seatNumber),
    );
  }

  /* Trains --------------------------------------------------------------- */
  const trainRows = new Map<
    string,
    {
      id: string;
      routeCode: string;
      departureOffset: number;
      coaches: CoachSeed[];
    }
  >();
  for (const train of TRAINS) {
    const routeId = routeIds.get(train.routeCode)!;
    const [row] = await db
      .insert(trains)
      .values({ code: train.code, name: train.name, routeId })
      .returning({ id: trains.id });
    trainRows.set(train.code, {
      id: row.id,
      routeCode: train.routeCode,
      departureOffset: train.departureOffset,
      coaches: train.coaches,
    });
  }

  /* Dated runs and physical seats ---------------------------------------- */
  const today = todayInAppZone();
  const dayOffsets = [-2, -1, 0, 1, 2, 3, 4, 5, 6, 7];
  const disruptedKeys = new Set([
    "12451:5",
    "12951:3",
    "12842:5",
    "12201:4",
    "12505:5",
  ]);
  const cancelledKeys = new Set(["12334:7", "12202:6"]);

  type SeededRun = {
    id: string;
    trainId: string;
    trainCode: string;
    serviceDate: string;
    status: "scheduled" | "disrupted" | "cancelled" | "completed";
  };

  const runIds: SeededRun[] = [];
  let runSeatCount = 0;

  for (const train of TRAINS) {
    const runtime = trainRows.get(train.code)!;
    const route = ROUTES.find((entry) => entry.code === train.routeCode)!;
    const duration = route.stops[route.stops.length - 1]!.offset;

    for (const dayOffset of dayOffsets) {
      const serviceDate = addDaysToIsoDate(today, dayOffset);
      const key = `${train.code}:${dayOffset}`;
      const past = dayOffset < 0;
      const status: SeededRun["status"] = past
        ? "completed"
        : cancelledKeys.has(key)
          ? "cancelled"
          : disruptedKeys.has(key)
            ? "disrupted"
            : "scheduled";
      const departureAt = kolkataToUtc(serviceDate, train.departureOffset);
      const arrivalAt = new Date(departureAt.getTime() + duration * 60_000);

      const [run] = await db
        .insert(trainRuns)
        .values({
          trainId: runtime.id,
          serviceDate,
          departureAt,
          arrivalAt,
          status,
          notes:
            status === "disrupted"
              ? "Demonstration incident. Operations has been notified; no seats were released."
              : status === "cancelled"
                ? "Demonstration cancellation for operations testing."
                : null,
        })
        .returning({ id: trainRuns.id });

      for (const [index, coach] of runtime.coaches.entries()) {
        const template = templateIds.get(coach.templateCode)!;
        const [runCoach] = await db
          .insert(runCoaches)
          .values({
            runId: run!.id,
            templateId: template.id,
            coachCode: coach.code,
            position: index + 1,
            travelClass: coach.className,
          })
          .returning({ id: runCoaches.id });

        const seats = templateSeatCache.get(coach.templateCode)!;
        await db.insert(runSeats).values(
          seats.map((seat) => ({
            runCoachId: runCoach!.id,
            seatNumber: seat.seatNumber,
            berthType: seat.berthType,
            deck: seat.deck,
            rowIndex: seat.rowIndex,
            positionInRow: seat.positionInRow,
            isAccessible: seat.isAccessible,
          })),
        );
        runSeatCount += seats.length;
      }

      runIds.push({
        id: run!.id,
        trainId: runtime.id,
        trainCode: train.code,
        serviceDate,
        status,
      });
    }
  }

  /* Accounts ------------------------------------------------------------- */
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const demoUsers = [
    { email: "passenger@railvyn.demo", name: "Aarav Sharma" },
    { email: "priya@railvyn.demo", name: "Priya Nair" },
    { email: "kabir@railvyn.demo", name: "Kabir Rao" },
    { email: "nisha@railvyn.demo", name: "Nisha Verma" },
    { email: "arjun@railvyn.demo", name: "Arjun Menon" },
    { email: "sara@railvyn.demo", name: "Sara Khan" },
    { email: "vikram@railvyn.demo", name: "Vikram Singh" },
    { email: "ananya@railvyn.demo", name: "Ananya Bose" },
    { email: "farhan@railvyn.demo", name: "Farhan Ahmed" },
    { email: "operator@railvyn.demo", name: "Meera Iyer" },
    { email: "operator2@railvyn.demo", name: "Rohan Das" },
    { email: "admin@railvyn.demo", name: "Dev Malhotra" },
  ];
  const userIds = new Map<string, string>();
  for (const demo of demoUsers) {
    const id = randomUUID();
    await db.insert(user).values({
      id,
      name: demo.name,
      email: demo.email,
      emailVerified: true,
    });
    await db.insert(account).values({
      id: randomUUID(),
      accountId: id,
      providerId: "credential",
      userId: id,
      password: passwordHash,
      updatedAt: new Date(),
    });
    userIds.set(demo.email, id);
    await db.insert(roleAssignments).values({ userId: id, role: "passenger" });
  }

  await db.insert(roleAssignments).values([
    { userId: userIds.get("operator@railvyn.demo")!, role: "operator" },
    { userId: userIds.get("operator2@railvyn.demo")!, role: "operator" },
    { userId: userIds.get("admin@railvyn.demo")!, role: "admin" },
  ]);
  await db.insert(operatorScopes).values([
    { userId: userIds.get("operator@railvyn.demo")!, trainId: trainRows.get("12451")!.id },
    { userId: userIds.get("operator@railvyn.demo")!, trainId: trainRows.get("12951")!.id },
    { userId: userIds.get("operator@railvyn.demo")!, trainId: trainRows.get("12505")!.id },
    { userId: userIds.get("operator2@railvyn.demo")!, trainId: trainRows.get("22119")!.id },
    { userId: userIds.get("operator2@railvyn.demo")!, trainId: trainRows.get("12201")!.id },
    { userId: userIds.get("operator2@railvyn.demo")!, trainId: trainRows.get("12637")!.id },
  ]);

  /* Reservations --------------------------------------------------------- */
  const findRun = (trainCode: string, dayOffset: number) => {
    const targetDate = addDaysToIsoDate(today, dayOffset);
    const run = runIds.find(
      (entry) =>
        entry.trainCode === trainCode && entry.serviceDate === targetDate,
    );
    if (!run) throw new Error(`Seed run ${trainCode} on day ${dayOffset} missing`);
    return run;
  };

  const seatsFor = async (runId: string, coachCode: string) =>
    db
      .select({
        id: runSeats.id,
        seatNumber: runSeats.seatNumber,
        coachCode: runCoaches.coachCode,
        travelClass: runCoaches.travelClass,
        berthType: runSeats.berthType,
        isAccessible: runSeats.isAccessible,
      })
      .from(runSeats)
      .innerJoin(runCoaches, eq(runSeats.runCoachId, runCoaches.id))
      .where(
        sql`${runCoaches.runId} = ${runId} and ${runCoaches.coachCode} = ${coachCode}`,
      )
      .orderBy(runSeats.seatNumber);

  const usedSeatKeys = new Set<string>();
  const seatKey = (runId: string, seatId: string) => `${runId}:${seatId}`;

  async function pickSeatNumbers(
    runId: string,
    coachCode: string,
    count: number,
    salt: number,
  ): Promise<number[] | null> {
    const rows = await seatsFor(runId, coachCode);
    const free = rows.filter((seat) => !usedSeatKeys.has(seatKey(runId, seat.id)));
    if (free.length < count) return null;
    const window = free.length - count;
    const start = window > 0 ? (salt * 11) % window : 0;
    return free.slice(start, start + count).map((seat) => seat.seatNumber);
  }

  const now = Date.now();
  const hoursAgo = (hours: number) => new Date(now - hours * 3_600_000);

  const bookingIds: string[] = [];
  let bookingCounter = 0;

  async function seedBooking(opts: {
    reference: string;
    userId: string;
    runId: string;
    coachCode: string;
    seatNumbers: number[];
    fromStopIndex: number;
    toStopIndex: number;
    travelClass: TravelClass;
    passengers: Array<{ name: string; age: number; gender: string }>;
    status: "confirmed" | "cancelled";
    createdAt: Date;
    reason?: string;
  }) {
    bookingCounter += 1;
    referenceSet.add(opts.reference);
    const run = runIds.find((entry) => entry.id === opts.runId)!;
    const [fareRow] = await db
      .select({ amountPaise: fares.amountPaise })
      .from(fares)
      .where(
        sql`${fares.travelClass} = ${opts.travelClass}
            and ${fares.fromStopIndex} = ${opts.fromStopIndex}
            and ${fares.toStopIndex} = ${opts.toStopIndex}
            and ${fares.routeId} = (select route_id from trains where id = ${run.trainId})`,
      )
      .limit(1);
    const farePaise = fareRow?.amountPaise ?? 50_000;
    const seatRows = await seatsFor(opts.runId, opts.coachCode);
    const selected = opts.seatNumbers.map((number) => {
      const seat = seatRows.find((entry) => entry.seatNumber === number);
      if (!seat) throw new Error(`Seed seat ${opts.coachCode}-${number} not found`);
      return seat;
    });

    const [booking] = await db
      .insert(bookings)
      .values({
        reference: opts.reference,
        userId: opts.userId,
        runId: opts.runId,
        fromStopIndex: opts.fromStopIndex,
        toStopIndex: opts.toStopIndex,
        travelClass: opts.travelClass,
        passengerCount: opts.passengers.length,
        totalFarePaise: farePaise * opts.passengers.length,
        status: opts.status,
        contactEmail: demoUsers.find((entry) => userIds.get(entry.email) === opts.userId)!.email,
        contactPhone: "+91 90000 00000",
        idempotencyKey: `seed_booking_${bookingCounter}`,
        createdAt: opts.createdAt,
        cancelledAt: opts.status === "cancelled" ? opts.createdAt : null,
        cancellationReason: opts.reason ?? null,
      })
      .returning({ id: bookings.id });

    const passengerRows = await db
      .insert(bookingPassengers)
      .values(
        opts.passengers.map((passenger, index) => ({
          bookingId: booking!.id,
          fullName: passenger.name,
          age: passenger.age,
          gender: passenger.gender,
          position: index,
        })),
      )
      .returning({ id: bookingPassengers.id });

    await db.insert(bookingSeats).values(
      selected.map((seat, index) => ({
        bookingId: booking!.id,
        runSeatId: seat.id,
        passengerId: passengerRows[index]!.id,
        farePaise,
      })),
    );

    if (opts.status === "confirmed") {
      await db.insert(seatSegmentClaims).values(
        selected.flatMap((seat) =>
          Array.from(
            { length: opts.toStopIndex - opts.fromStopIndex },
            (_, index) => ({
              runSeatId: seat.id,
              segmentIndex: opts.fromStopIndex + index,
              bookingId: booking!.id,
            }),
          ),
        ),
      );
      for (const seat of selected) usedSeatKeys.add(seatKey(opts.runId, seat.id));
    }

    await db.insert(paymentsDemo).values({
      bookingId: booking!.id,
      amountPaise: farePaise * opts.passengers.length,
      status: opts.status === "confirmed" ? "succeeded" : "refunded",
      method: "demo_card",
      idempotencyKey: `seed_payment_${bookingCounter}`,
      createdAt: opts.createdAt,
    });

    bookingIds.push(booking!.id);
    return booking!.id;
  }

  const passenger = userIds.get("passenger@railvyn.demo")!;
  const priya = userIds.get("priya@railvyn.demo")!;
  const kabir = userIds.get("kabir@railvyn.demo")!;
  const passengerIds = demoUsers
    .filter((entry) => !entry.email.startsWith("operator") && !entry.email.startsWith("admin"))
    .map((entry) => userIds.get(entry.email)!);

  const futureA = findRun("12451", 2);
  const futureAAlt = findRun("12451", 3);
  const futureB = findRun("22119", 1);
  const pastA = findRun("12451", -2);
  const disruptedA = findRun("12451", 5);

  // Canonical bookings documented in the README and SQL export.
  await seedBooking({
    reference: "RVN-A7K2M9PQ",
    userId: passenger,
    runId: futureA.id,
    coachCode: "S1",
    seatNumbers: [42],
    fromStopIndex: 0,
    toStopIndex: 3,
    travelClass: "sleeper",
    passengers: [{ name: "Aarav Sharma", age: 34, gender: "male" }],
    status: "confirmed",
    createdAt: hoursAgo(50),
  });

  // Same physical seat, later leg — legal journey-aware reuse.
  await seedBooking({
    reference: "RVN-B3N8R5TX",
    userId: priya,
    runId: futureA.id,
    coachCode: "S1",
    seatNumbers: [42],
    fromStopIndex: 3,
    toStopIndex: 7,
    travelClass: "sleeper",
    passengers: [{ name: "Priya Nair", age: 29, gender: "female" }],
    status: "confirmed",
    createdAt: hoursAgo(42),
  });

  await seedBooking({
    reference: "RVN-C9P4W6YZ",
    userId: passenger,
    runId: futureA.id,
    coachCode: "B1",
    seatNumbers: [18, 19],
    fromStopIndex: 0,
    toStopIndex: 4,
    travelClass: "ac3",
    passengers: [
      { name: "Aarav Sharma", age: 34, gender: "male" },
      { name: "Isha Sharma", age: 31, gender: "female" },
    ],
    status: "confirmed",
    createdAt: hoursAgo(30),
  });

  await seedBooking({
    reference: "RVN-D4H7J2LM",
    userId: priya,
    runId: futureA.id,
    coachCode: "S1",
    seatNumbers: [44],
    fromStopIndex: 0,
    toStopIndex: 7,
    travelClass: "sleeper",
    passengers: [{ name: "Priya Nair", age: 29, gender: "female" }],
    status: "confirmed",
    createdAt: hoursAgo(26),
  });

  await seedBooking({
    reference: "RVN-E6Q2T8KN",
    userId: passenger,
    runId: pastA.id,
    coachCode: "S1",
    seatNumbers: [30],
    fromStopIndex: 0,
    toStopIndex: 7,
    travelClass: "sleeper",
    passengers: [{ name: "Aarav Sharma", age: 34, gender: "male" }],
    status: "confirmed",
    createdAt: new Date(now - 8 * 86_400_000),
  });

  await seedBooking({
    reference: "RVN-F8R3V5WQ",
    userId: passenger,
    runId: disruptedA.id,
    coachCode: "A1",
    seatNumbers: [5],
    fromStopIndex: 0,
    toStopIndex: 3,
    travelClass: "ac2",
    passengers: [{ name: "Aarav Sharma", age: 34, gender: "male" }],
    status: "cancelled",
    createdAt: hoursAgo(20),
    reason: "Change of travel plan",
  });

  await seedBooking({
    reference: "RVN-G2X7Z4AC",
    userId: priya,
    runId: futureB.id,
    coachCode: "C1",
    seatNumbers: [12],
    fromStopIndex: 0,
    toStopIndex: 1,
    travelClass: "chair",
    passengers: [{ name: "Priya Nair", age: 29, gender: "female" }],
    status: "confirmed",
    createdAt: hoursAgo(12),
  });

  await seedBooking({
    reference: "RVN-H5M9P3DE",
    userId: kabir,
    runId: futureAAlt.id,
    coachCode: "S1",
    seatNumbers: [7],
    fromStopIndex: 0,
    toStopIndex: 3,
    travelClass: "sleeper",
    passengers: [{ name: "Kabir Rao", age: 41, gender: "male" }],
    status: "confirmed",
    createdAt: hoursAgo(8),
  });

  /* Generated booking history ------------------------------------------- */
  const bookableRuns = runIds.filter((run) => run.status !== "cancelled");
  const popularRuns = runIds
    .filter((run) => run.status === "scheduled" && run.serviceDate >= today)
    .slice(0, 10);

  for (let i = 0; i < 92; i += 1) {
    const run =
      i % 4 === 0
        ? popularRuns[(i * 3 + 1) % popularRuns.length]!
        : bookableRuns[(i * 7 + 3) % bookableRuns.length]!;
    const train = trainRows.get(run.trainCode)!;
    const route = ROUTES.find((entry) => entry.code === train.routeCode)!;
    const coach = train.coaches[i % train.coaches.length]!;
    const stopCount = route.stops.length;
    const maxSpan = Math.min(4, stopCount - 1);
    const fromStopIndex = (i * 3) % (stopCount - maxSpan);
    const toStopIndex = fromStopIndex + 1 + ((i * 5) % maxSpan);
    const passengerCount = 1 + (i % 3);
    const seatNumbers = await pickSeatNumbers(
      run.id,
      coach.code,
      passengerCount,
      i + 5,
    );
    if (!seatNumbers) continue;

    const ownerId = passengerIds[(i * 5 + 2) % passengerIds.length]!;
    const status = i % 9 === 0 ? "cancelled" : "confirmed";
    const passengers = Array.from({ length: passengerCount }, (_, index) => ({
      name: PASSENGER_NAMES[(i * 2 + index) % PASSENGER_NAMES.length]!,
      age: 18 + ((i * 7 + index * 13) % 55),
      gender: (i + index) % 2 === 0 ? "male" : "female",
    }));

    await seedBooking({
      reference: generatedReference(i),
      userId: ownerId,
      runId: run.id,
      coachCode: coach.code,
      seatNumbers,
      fromStopIndex,
      toStopIndex,
      travelClass: coach.className,
      passengers,
      status,
      createdAt: hoursAgo(3 + i * 2),
      reason: status === "cancelled" ? "Demonstration cancellation" : undefined,
    });
  }

  /* Live holds ----------------------------------------------------------- */
  const futureRuns = runIds.filter(
    (run) => run.status === "scheduled" && run.serviceDate >= today,
  );
  type HoldRecord = {
    id: string;
    userId: string;
    runId: string;
    fromStopIndex: number;
    toStopIndex: number;
    travelClass: TravelClass;
  };
  const holdRecords: HoldRecord[] = [];

  for (let i = 0; i < 10; i += 1) {
    const run = futureRuns[(i * 13 + 2) % futureRuns.length]!;
    const train = trainRows.get(run.trainCode)!;
    const route = ROUTES.find((entry) => entry.code === train.routeCode)!;
    const coach = train.coaches[i % train.coaches.length]!;
    const stopCount = route.stops.length;
    const maxSpan = Math.min(3, stopCount - 1);
    const fromStopIndex = (i * 2) % (stopCount - maxSpan);
    const toStopIndex = fromStopIndex + 1 + (i % maxSpan);
    const passengerCount = 1 + (i % 2);
    const seatNumbers = await pickSeatNumbers(
      run.id,
      coach.code,
      passengerCount,
      i + 40,
    );
    if (!seatNumbers) continue;

    const ownerId = passengerIds[(i * 3 + 1) % passengerIds.length]!;
    const [hold] = await db
      .insert(seatHolds)
      .values({
        userId: ownerId,
        runId: run.id,
        fromStopIndex,
        toStopIndex,
        travelClass: coach.className,
        passengerCount,
        status: "active",
        expiresAt: new Date(now + (4 + i) * 60_000),
        idempotencyKey: `seed_hold_${i + 1}`,
        passengerDraft: {
          passengers: Array.from({ length: passengerCount }, (_, index) => ({
            fullName: PASSENGER_NAMES[(i + index) % PASSENGER_NAMES.length]!,
            age: 20 + ((i * 5 + index) % 45),
            gender: (i + index) % 2 === 0 ? "male" : "female",
          })),
          contactEmail: demoUsers.find((entry) => userIds.get(entry.email) === ownerId)!
            .email,
          contactPhone: "+91 90000 00000",
        },
        createdAt: hoursAgo(0.2),
      })
      .returning({ id: seatHolds.id });

    const rows = await seatsFor(run.id, coach.code);
    const selected = seatNumbers.map((number) => {
      const seat = rows.find((entry) => entry.seatNumber === number);
      if (!seat) throw new Error(`Seed hold seat ${coach.code}-${number} not found`);
      return seat;
    });

    await db.insert(holdSeats).values(
      selected.map((seat) => ({ holdId: hold!.id, runSeatId: seat.id })),
    );
    await db.insert(seatSegmentClaims).values(
      selected.flatMap((seat) =>
        Array.from(
          { length: toStopIndex - fromStopIndex },
          (_, index) => ({
            runSeatId: seat.id,
            segmentIndex: fromStopIndex + index,
            holdId: hold!.id,
          }),
        ),
      ),
    );
    for (const seat of selected) usedSeatKeys.add(seatKey(run.id, seat.id));

    holdRecords.push({
      id: hold!.id,
      userId: ownerId,
      runId: run.id,
      fromStopIndex,
      toStopIndex,
      travelClass: coach.className,
    });
  }

  /* Waitlist ------------------------------------------------------------- */
  const waitlistRows: Array<typeof waitlistEntries.$inferInsert> = [];

  for (let i = 0; i < Math.min(3, holdRecords.length); i += 1) {
    const hold = holdRecords[i]!;
    waitlistRows.push({
      userId: hold.userId,
      runId: hold.runId,
      fromStopIndex: hold.fromStopIndex,
      toStopIndex: hold.toStopIndex,
      travelClass: hold.travelClass,
      passengerCount: 1,
      priority: i,
      status: "offered",
      offeredHoldId: hold.id,
      createdAt: hoursAgo(2 + i),
      updatedAt: hoursAgo(0.5),
    });
  }

  for (let i = 0; i < 12; i += 1) {
    const run = futureRuns[(i * 17 + 5) % futureRuns.length]!;
    const train = trainRows.get(run.trainCode)!;
    const route = ROUTES.find((entry) => entry.code === train.routeCode)!;
    const coach = train.coaches[i % train.coaches.length]!;
    const stopCount = route.stops.length;
    const maxSpan = Math.min(3, stopCount - 1);
    const fromStopIndex = (i * 3) % (stopCount - maxSpan);
    const toStopIndex = fromStopIndex + 1 + (i % maxSpan);

    waitlistRows.push({
      userId: passengerIds[(i * 4 + 3) % passengerIds.length]!,
      runId: run.id,
      fromStopIndex,
      toStopIndex,
      travelClass: coach.className,
      passengerCount: 1 + (i % 2),
      priority: i % 3,
      status: "waiting",
      createdAt: hoursAgo(3 + i * 2),
      updatedAt: hoursAgo(3 + i * 2),
    });
  }

  for (let i = 0; i < 3; i += 1) {
    const run = bookableRuns[(i * 11 + 7) % bookableRuns.length]!;
    const train = trainRows.get(run.trainCode)!;
    const coach = train.coaches[i % train.coaches.length]!;
    waitlistRows.push({
      userId: passengerIds[(i * 2 + 1) % passengerIds.length]!,
      runId: run.id,
      fromStopIndex: 0,
      toStopIndex: Math.min(2, ROUTES.find((entry) => entry.code === train.routeCode)!.stops.length - 1),
      travelClass: coach.className,
      passengerCount: 1,
      priority: 0,
      status: "expired",
      createdAt: hoursAgo(48 + i * 6),
      updatedAt: hoursAgo(24 + i * 6),
    });
  }

  await db.insert(waitlistEntries).values(waitlistRows);

  /* Disruptions ---------------------------------------------------------- */
  const disruptedRuns = runIds.filter((run) => run.status === "disrupted");
  const resolvedRuns = runIds
    .filter((run) => run.status === "scheduled")
    .slice(0, 3);
  const disruptionRows: Array<typeof disruptions.$inferInsert> = [];

  disruptedRuns.forEach((run, index) => {
    const train = trainRows.get(run.trainCode)!;
    const route = ROUTES.find((entry) => entry.code === train.routeCode)!;
    const stop = route.stops[Math.min(index + 1, route.stops.length - 1)]!;
    disruptionRows.push({
      runId: run.id,
      title:
        index % 2 === 0
          ? `Signal maintenance near ${stop.code}`
          : `Platform congestion at ${stop.code}`,
      description:
        index % 2 === 0
          ? `Demonstration incident: a ${15 + index * 5} minute delay is expected. Operations has been notified; no seats were released.`
          : `Demonstration incident: platform changes at ${stop.code}. Passengers are advised to check displays.`,
      severity: index % 3 === 0 ? "critical" : "warning",
      createdBy: userIds.get(index % 2 === 0 ? "operator@railvyn.demo" : "operator2@railvyn.demo")!,
      createdAt: hoursAgo(2 + index * 3),
    });
  });

  resolvedRuns.forEach((run, index) => {
    disruptionRows.push({
      runId: run.id,
      title: `Late running cleared at ${run.trainCode}`,
      description:
        "Demonstration incident: an earlier delay was resolved and the run returned to the scheduled plan.",
      severity: "info",
      createdBy: userIds.get("operator@railvyn.demo")!,
      createdAt: hoursAgo(30 + index * 8),
      resolvedAt: hoursAgo(20 + index * 8),
    });
  });

  await db.insert(disruptions).values(disruptionRows);

  /* Policy and audit ----------------------------------------------------- */
  await db.insert(appSettings).values([
    { key: "holdTtlSeconds", value: 300 },
    { key: "waitlistOfferTtlSeconds", value: 600 },
    { key: "maxSeatsPerBooking", value: 6 },
    { key: "allowWaitlist", value: true },
    { key: "demoNotice", value: "Demonstration data, not official railway inventory." },
  ]);

  const auditRows: Array<typeof auditLogs.$inferInsert> = [
    {
      actorUserId: userIds.get("admin@railvyn.demo")!,
      actorRole: "admin",
      action: "seed.completed",
      entityType: "system",
      entityId: null,
      metadata: {
        stations: STATIONS.length,
        routes: ROUTES.length,
        trains: TRAINS.length,
        runs: runIds.length,
        bookings: bookingIds.length,
      },
      createdAt: new Date(),
    },
    {
      actorUserId: userIds.get("admin@railvyn.demo")!,
      actorRole: "admin",
      action: "fare.upserted",
      entityType: "route",
      entityId: routeIds.get("NR-CORRIDOR")!,
      metadata: { travelClass: "ac3", note: "Seed pricing refresh" },
      createdAt: hoursAgo(12),
    },
    {
      actorUserId: userIds.get("admin@railvyn.demo")!,
      actorRole: "admin",
      action: "role.granted",
      entityType: "user",
      entityId: userIds.get("operator2@railvyn.demo")!,
      metadata: { role: "operator" },
      createdAt: hoursAgo(48),
    },
    {
      actorUserId: userIds.get("admin@railvyn.demo")!,
      actorRole: "admin",
      action: "operator_scope.granted",
      entityType: "user",
      entityId: userIds.get("operator2@railvyn.demo")!,
      metadata: { trainCode: "22119" },
      createdAt: hoursAgo(47),
    },
    {
      actorUserId: userIds.get("operator@railvyn.demo")!,
      actorRole: "operator",
      action: "disruption.created",
      entityType: "disruption",
      entityId: disruptedRuns[0]?.id ?? null,
      metadata: { severity: "warning", runId: disruptedRuns[0]?.id ?? null },
      createdAt: hoursAgo(6),
    },
  ];

  bookingIds.slice(0, 8).forEach((bookingId, index) => {
    auditRows.push({
      actorUserId: passengerIds[index % passengerIds.length]!,
      actorRole: "passenger",
      action: index % 3 === 0 ? "booking.cancelled" : "booking.confirmed",
      entityType: "booking",
      entityId: bookingId,
      metadata: { source: "seed" },
      createdAt: hoursAgo(10 + index * 4),
    });
  });

  holdRecords.slice(0, 4).forEach((hold, index) => {
    auditRows.push({
      actorUserId: hold.userId,
      actorRole: "passenger",
      action: "hold.created",
      entityType: "seat_hold",
      entityId: hold.id,
      metadata: { runId: hold.runId, travelClass: hold.travelClass },
      createdAt: hoursAgo(1 + index),
    });
  });

  resolvedRuns.forEach((run, index) => {
    auditRows.push({
      actorUserId: userIds.get("operator@railvyn.demo")!,
      actorRole: "operator",
      action: "disruption.resolved",
      entityType: "train_run",
      entityId: run.id,
      metadata: { note: "Seed incident cleared" },
      createdAt: hoursAgo(20 + index * 8),
    });
  });

  await db.insert(auditLogs).values(auditRows);

  console.log("[railvyn] seed complete.");
  console.log(
    `  Stations: ${STATIONS.length} - routes: ${ROUTES.length} - trains: ${TRAINS.length} - runs: ${runIds.length} - seats: ${runSeatCount}`,
  );
  console.log(
    `  Bookings: ${bookingIds.length} - live holds: ${holdRecords.length} - waitlist: ${waitlistRows.length} - disruptions: ${disruptionRows.length} - audit: ${auditRows.length}`,
  );
  console.log(`  Demo password for every account: ${DEMO_PASSWORD}`);
  for (const demo of demoUsers) console.log(`  - ${demo.email} (${demo.name})`);
  process.exit(0);
}

main().catch((error) => {
  console.error("[railvyn] seed failed", error);
  process.exit(1);
});

export interface Shooter {
  id: string;
  firstName: string;
  lastName: string;
  category: ShooterCategory;
  phone: string;
  email: string;
  isReserved?: boolean; // Tesserato/Socio/Riservato
}

export type ShooterCategory = 'Master' | 'Veterani' | 'Senior' | 'Men' | 'Lady' | 'Junior' | '3^ Categoria' | 'Altro';

export interface TournamentPrize {
  id: string;
  label: string; // e.g. "1° Assoluto", "1° Lady"
  category: ShooterCategory | 'Assoluto';
  position: number;
  value: number;
  info?: string; // e.g. "Targa", "Coppa"
  enabled: boolean;
}

export interface CompetitionSettings {
  name: string;
  startDate: string;
  startTime: string;
  date: string;
  eventDate?: string;
  location?: string;
  seriesCount: number;
  targetsPerSeries: number;
  seriesTargets: number[];
  totalTargets: number;
  baseEntryFee: number; // Legacy or default
  categoryFees: Record<ShooterCategory, { standard?: number; reserved?: number }>;
  combinedEntryFee: boolean;
  combinedFeeValue?: number;
  discountedFees: Record<ShooterCategory, number>; // Legacy, kept for compatibility if needed
  reintegroEnabled?: boolean;
  totalPrizePool: number;
  combinedPrizePool?: number;
  targetUnitCost: number;
  fieldServiceCost: number;
  combinedProovesNeeded?: number;
  drawResolution: 'd_ufficio' | 'spareggio';
  managedType: 'proprietaria' | 'delegata';
  rankingMode: 'hits' | 'manual';
  prizes: TournamentPrize[];
  tournamentId?: string;
  isOneShot: boolean;
}

export interface Tournament {
  id: string;
  name: string;
  majorityThreshold: number;
  totalRaces: number;
  majorityPrizes: TournamentPrize[]; // Old way
  advancedPrizes?: TournamentPrize[]; // New structured way
  subscriptionDiscount: {
    type: 'fixed' | 'percentage';
    value: number;
  };
  active?: boolean;
  createdAt: string;
}

export interface Registration {
  id: string;
  shooterId: string;
  paid: boolean;
  hasDiscount: boolean; // Old flag
  isReserved: boolean; // New flag based on shooter status at registration time
  actualFee: number;
  needsReintegro: boolean;
  reintegroAmount?: number;
  spareggioCost: number;
  shootingOrder: number;
  manualRank?: number;
  extraDiscount?: {
    type: 'fixed' | 'percentage';
    value: number;
    reintegro?: boolean;
  };
}

export interface Score {
  shooterId: string;
  seriesScores: (number | null)[]; // Array of targets hit per series
  spareggioScore: number | null;
  manualTotal: number | null;
}

export interface Barrage {
  id: string;
  name: string;
  type: 'elimination' | 'series';
  seriesCount: number;
  targetsPerSeries: number;
  participants: string[]; // shooterIds
  scores: Record<string, number[]>; // shooterId -> array of hits (one index per series or one index for elimination total)
}

export type SessionStatus = 'active' | 'waiting' | 'completed';

export interface Session {
  id: string;
  settings: CompetitionSettings;
  registrations: Registration[];
  scores: Score[];
  barrages?: Barrage[];
  manualPrizes?: { prizeId: string; winners: string[] }[];
  reintegroOverrides?: Record<string, boolean>; // shooterId -> isReintegroEnabled
  status: SessionStatus;
  createdAt: string;
}

export const CATEGORIES: ShooterCategory[] = [
  'Master',
  'Veterani',
  'Senior',
  'Men',
  'Lady',
  'Junior',
  '3^ Categoria',
  'Altro'
];

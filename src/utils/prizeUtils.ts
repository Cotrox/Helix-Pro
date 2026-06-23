import { Shooter, Registration, Score, CompetitionSettings, Tournament, TournamentPrize } from '../types';

export interface AssignedWinner {
  prize: TournamentPrize | { category: string, position: number, value: number, label: string, info?: string };
  prizeValue: number;
  winner: Shooter;
  points: number;
  isShared: boolean;
  sharedWith: number;
  label: string;
  reintegro: number;
  final: number;
}

export const calculatePrizeAssignments = (
  shooters: Shooter[],
  registrations: Registration[],
  scores: Score[],
  settings: CompetitionSettings,
  tournaments: Tournament[],
  reintegroOverrides: Record<string, boolean> = {}
): AssignedWinner[] => {
  const currentTournament = tournaments.find(t => t.id === settings.tournamentId);
  const isManual = settings.rankingMode === 'manual';

  // 1. Rank data
  const list = (registrations || []).filter(Boolean).map(reg => {
    const shooter = shooters.find(s => s.id === reg.shooterId);
    if (!shooter) return null;
    const score = (scores || []).find(sc => sc && sc.shooterId === reg.shooterId);
    const seriesTotal = score?.seriesScores.reduce((a: number, b) => (a ?? 0) + (b ?? 0), 0) ?? 0;
    const total = score ? (score.manualTotal !== null ? score.manualTotal : seriesTotal) : 0;
    const spareggio = score?.spareggioScore || 0;
    return { shooter, total, spareggio, registration: reg };
  }).filter((d): d is { shooter: Shooter; total: number; spareggio: number; registration: Registration } => d !== null);

  const rankedData = isManual
    ? [...list].sort((a, b) => (a.registration.manualRank ?? 99999) - (b.registration.manualRank ?? 99999))
    : [...list].sort((a, b) => {
        const tA = a.total ?? 0;
        const tB = b.total ?? 0;
        if (tB !== tA) return tB - tA;
        return (b.spareggio || 0) - (a.spareggio || 0);
      });

  // 2. Prepare Prizes
  const prizes = (currentTournament?.advancedPrizes && currentTournament.active)
    ? currentTournament.advancedPrizes.filter(p => p.enabled)
    : (settings.prizes || []).map((p, idx) => ({ ...p, label: `Premio ${idx + 1}`, info: '' }));

  const isDivision = settings.drawResolution === 'd_ufficio';
  const results: any[] = [];

  const getAssignments = (prizeList: any[], shooterList: any[], forceDivision: boolean = false) => {
    const localResults: any[] = [];
    const useDivision = isDivision || forceDivision;
    if (useDivision) {
      // Group by score to handle ties together
      const scoreGroups: Map<number, any[]> = new Map();
      shooterList.forEach(item => {
        const scoreVal = item.total ?? 0;
        const group = scoreGroups.get(scoreVal) || [];
        group.push(item);
        scoreGroups.set(scoreVal, group);
      });

      const sortedScores = Array.from(scoreGroups.keys()).sort((a, b) => b - a);
      let currentRank = 1;

      sortedScores.forEach(score => {
        const tiedGroup = scoreGroups.get(score)!;
        const rankStart = currentRank;
        const rankEnd = currentRank + tiedGroup.length - 1;
        
        // Find all prizes whose position falls within the ranks occupied by this tied group
        const groupPrizes = prizeList.filter(p => p.position >= rankStart && p.position <= rankEnd);

        if (groupPrizes.length > 0) {
          const totalVal = groupPrizes.reduce((sum, p) => sum + (p.value || 0), 0);
          const sharedVal = totalVal / tiedGroup.length;
          
          tiedGroup.forEach(item => {
            localResults.push({
              prize: groupPrizes[0],
              prizeValue: sharedVal,
              winner: item.shooter,
              points: item.total,
              isShared: tiedGroup.length > 1,
              sharedWith: tiedGroup.length,
              label: groupPrizes.length > 1 
                ? `${groupPrizes[0].position}°-${groupPrizes[groupPrizes.length - 1].position}°`
                : `${groupPrizes[0].position}°`
            });
          });
        }
        // Advance the rank by the number of shooters, even if they didn't all get a prize
        currentRank += tiedGroup.length;
      });
    } else {
      prizeList.forEach(prize => {
        const winner = shooterList[prize.position - 1];
        if (winner) {
          localResults.push({
            prize,
            prizeValue: prize.value || 0,
            winner: winner.shooter,
            points: winner.total,
            isShared: false,
            label: `${prize.position}°`
          });
        }
      });
    }
    return localResults;
  };

  // 3. Assign General/Assoluto
  const genPrizes = prizes
    .filter(p => (p.category as string) === 'Assoluto' || (p.category as string) === 'Generale')
    .sort((a, b) => a.position - b.position);
  
  const absoluteAssignments = getAssignments(genPrizes, rankedData);
  results.push(...absoluteAssignments);

  const absoluteWinnersMap = new Map<string, number>();
  absoluteAssignments.forEach(a => {
    const current = absoluteWinnersMap.get(a.winner.id) || 0;
    absoluteWinnersMap.set(a.winner.id, current + (a.prizeValue || 0));
  });

  // 4. Assign Category specific
  const categories = Array.from(new Set(prizes.map(p => p.category)))
      .filter(c => (c as string) !== 'Assoluto' && (c as string) !== 'Generale');

  categories.forEach(cat => {
      const catPrizes = prizes.filter(p => p.category === cat).sort((a, b) => a.position - b.position);
      if (catPrizes.length === 0) return;

      const catEligible = rankedData.filter(item => item.shooter.category === cat);
      const r1 = catPrizes[0]?.value || 0;

      // Filter out shooters who won an absolute prize >= r1 (first category prize value)
      const eligibleGroup = catEligible.filter(item => {
        const pProg = absoluteWinnersMap.get(item.shooter.id) || 0;
        return pProg < r1;
      });

      // Group consecutive tied shooters (same score)
      const tiedGroups: (typeof eligibleGroup)[] = [];
      let currentGroup: typeof eligibleGroup = [];

      for (const item of eligibleGroup) {
          if (currentGroup.length === 0) {
              currentGroup.push(item);
          } else {
              const prev = currentGroup[currentGroup.length - 1];
              const isTied = isManual
                  ? (prev.registration.manualRank ?? 99999) === (item.registration.manualRank ?? 99999)
                  : (prev.total ?? 0) === (item.total ?? 0);

              if (isTied) {
                  currentGroup.push(item);
              } else {
                  tiedGroups.push(currentGroup);
                  currentGroup = [item];
              }
          }
      }
      if (currentGroup.length > 0) {
          tiedGroups.push(currentGroup);
      }

      // Pool of remaining category prizes
      let remainingPrizes = catPrizes.map((p, idx) => ({
        ...p,
        currentValue: p.value || 0,
        originalIndex: idx
      }));

      // Helper function to draw a specific amount from the remaining prizes pool
      const drawFromPool = (amount: number): number => {
        let accumulated = 0;
        let lastDrawnIdx = -1;

        for (let i = 0; i < remainingPrizes.length; i++) {
          const needed = amount - accumulated;
          if (needed <= 0) break;

          const p = remainingPrizes[i];
          const toDraw = Math.min(p.currentValue, needed);
          p.currentValue -= toDraw;
          accumulated += toDraw;
          lastDrawnIdx = i;
        }

        // Update remainingPrizes: remove fully consumed ones, carry over remainder of the last drawn one
        let newRemainingPrizes: typeof remainingPrizes = [];
        for (let i = 0; i < remainingPrizes.length; i++) {
          const p = remainingPrizes[i];
          if (i <= lastDrawnIdx) {
            if (i === lastDrawnIdx && p.currentValue > 0) {
              if (i + 1 < remainingPrizes.length) {
                remainingPrizes[i + 1].currentValue += p.currentValue;
              }
            }
          } else {
            newRemainingPrizes.push(p);
          }
        }
        remainingPrizes = newRemainingPrizes;
        return accumulated;
      };

      tiedGroups.forEach(group => {
        if (remainingPrizes.length === 0) return;

        const N = group.length;

        // The group claims the next N category prizes
        const prizesToTake = remainingPrizes.slice(0, N);
        const V_claimed = prizesToTake.reduce((sum, p) => sum + p.currentValue, 0);

        if (V_claimed === 0 && remainingPrizes.length === 0) return;

        const S_nom = N > 0 ? V_claimed / N : 0;
        
        // Calculate the desired prize value for each shooter in the group
        const desiredPrizes = group.map(item => {
          const pProg = absoluteWinnersMap.get(item.shooter.id) || 0;
          if (pProg > 0) {
            // Integrated shooter: needs r1 - pProg
            return { item, desired: Math.max(0, r1 - pProg), isIntegrated: true };
          } else {
            // Normal shooter: gets nominal share
            return { item, desired: S_nom, isIntegrated: false };
          }
        });

        const W_total = desiredPrizes.reduce((sum, d) => sum + d.desired, 0);

        if (W_total > 0) {
          // Draw the total desired amount from the pool
          const accumulated = drawFromPool(W_total);
          const ratio = accumulated / W_total;

          // Label reflects the positions of the prizes claimed
          const displayLabel = prizesToTake.length > 1
            ? `${prizesToTake[0].position}°-${prizesToTake[prizesToTake.length - 1].position}°`
            : prizesToTake[0] ? `${prizesToTake[0].position}°` : `1°`;

          desiredPrizes.forEach(dp => {
            const finalPrizeVal = dp.desired * ratio;
            results.push({
              prize: prizesToTake[0] || remainingPrizes[0] || catPrizes[0],
              prizeValue: finalPrizeVal,
              winner: dp.item.shooter,
              points: dp.item.total,
              isShared: N > 1,
              sharedWith: N,
              label: displayLabel
            });
          });
        } else {
          // If all desired prizes are 0, assign 0 to keep them in standings
          desiredPrizes.forEach(dp => {
            results.push({
              prize: prizesToTake[0] || remainingPrizes[0] || catPrizes[0],
              prizeValue: 0,
              winner: dp.item.shooter,
              points: dp.item.total,
              isShared: N > 1,
              sharedWith: N,
              label: prizesToTake[0] ? `${prizesToTake[0].position}°` : `1°`
            });
          });
        }
      });
  });

  // 5. Finalize with Reintegro calcs
  // Track remaining reintegro for each shooter to correctly distribute it across multiple prizes won
  const remainingReintegroMap = new Map<string, number>();
  
  // Initialize remainingReintegroMap for all registered shooters
  registrations.forEach(reg => {
    const isReintegroManuallyDisabled = reintegroOverrides[reg.shooterId] === false;
    const totalPossibleReintegro = reg.reintegroAmount ?? 0;
    if (!isReintegroManuallyDisabled && totalPossibleReintegro > 0) {
      remainingReintegroMap.set(reg.shooterId, totalPossibleReintegro);
    }
  });

  return results.map(res => {
    let reintegroAmount = 0;
    const remainingReintegro = remainingReintegroMap.get(res.winner.id) || 0;
    const prizeValue = res.prizeValue !== undefined ? res.prizeValue : res.prize.value;

    if (remainingReintegro > 0) {
      reintegroAmount = Math.min(prizeValue, remainingReintegro);
      remainingReintegroMap.set(res.winner.id, remainingReintegro - reintegroAmount);
    }
    
    const finalAmount = prizeValue - reintegroAmount;

    return {
      ...res,
      reintegro: reintegroAmount,
      final: finalAmount > 0 ? finalAmount : 0
    } as AssignedWinner;
  }).sort((a, b) => {
    // Sort by points desc, then by absolute prize first
    if ((b.points || 0) !== (a.points || 0)) return (b.points || 0) - (a.points || 0);
    const isAbsA = a.prize.category === 'Assoluto' || a.prize.category === 'Generale' ? 1 : 0;
    const isAbsB = b.prize.category === 'Assoluto' || b.prize.category === 'Generale' ? 1 : 0;
    return isAbsB - isAbsA;
  });
};

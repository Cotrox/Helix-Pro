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

  const getAssignments = (prizeList: any[], shooterList: any[]) => {
    const localResults: any[] = [];
    if (isDivision) {
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
        const catEligible = rankedData.filter(item => item.shooter.category === cat);

        // Group consecutive tied shooters (same score and spareggio)
        // catEligible is already sorted, so we can group consecutive items.
        const tiedGroups: (typeof catEligible)[] = [];
        let currentGroup: typeof catEligible = [];

        for (const item of catEligible) {
            if (currentGroup.length === 0) {
                currentGroup.push(item);
            } else {
                const prev = currentGroup[currentGroup.length - 1];
                const isTied = isManual
                    ? (prev.registration.manualRank ?? 99999) === (item.registration.manualRank ?? 99999)
                    : (prev.total ?? 0) === (item.total ?? 0) && (prev.spareggio || 0) === (item.spareggio || 0);

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

        // Group-based Scorrimento Simulation
        // We evaluate tied groups together to decide who stays in the category pool or slides out.
        let currentPoolForEvaluation = [...catEligible];
        const finalStayList: typeof catEligible = [];

        for (const group of tiedGroups) {
            // Calculate theoretical assignments for the current evaluation pool
            const tentativeResults = getAssignments(catPrizes, currentPoolForEvaluation);

            const shootersToKeep: typeof catEligible = [];
            const shootersToSlideOut: typeof catEligible = [];

            for (const item of group) {
                const myAssignment = tentativeResults.find(r => r.winner.id === item.shooter.id);
                const qeReservedTheoretical = myAssignment ? myAssignment.prizeValue : 0;
                const qeAbsolute = absoluteWinnersMap.get(item.shooter.id) || 0;

                // Rule: Stay if they win nothing in program, or if category prize is better than program prize
                const shouldStay = qeAbsolute === 0 || qeAbsolute < qeReservedTheoretical;

                if (shouldStay) {
                    shootersToKeep.push(item);
                } else {
                    shootersToSlideOut.push(item);
                }
            }

            finalStayList.push(...shootersToKeep);

            // Remove any slid-out shooters from the evaluation pool for subsequent groups
            if (shootersToSlideOut.length > 0) {
                const slideOutIds = new Set(shootersToSlideOut.map(s => s.shooter.id));
                currentPoolForEvaluation = currentPoolForEvaluation.filter(
                    s => !slideOutIds.has(s.shooter.id)
                );
            }
        }

        const realCatAssignments = getAssignments(catPrizes, finalStayList);
        results.push(...realCatAssignments);
    });

  // Art. 4 - Integrazione del Premio di Programma
  // Calcoliamo la somma dei premi assoluti/programma vinti da ciascun tiratore
  const winnersAbsoluteVals = new Map<string, number>();
  results.forEach(res => {
    const isAbsolute = res.prize.category === 'Assoluto' || res.prize.category === 'Generale';
    if (isAbsolute) {
      winnersAbsoluteVals.set(res.winner.id, (winnersAbsoluteVals.get(res.winner.id) || 0) + (res.prizeValue || 0));
    }
  });

  // Se un tiratore ha vinto sia un premio assoluto che uno di categoria, applichiamo l'integrazione
  results.forEach(res => {
    const isAbsolute = res.prize.category === 'Assoluto' || res.prize.category === 'Generale';
    if (!isAbsolute) {
      const valAbsolute = winnersAbsoluteVals.get(res.winner.id) || 0;
      if (valAbsolute > 0) {
        const valCategory = res.prizeValue || 0;
        // L'integrazione è il valore necessario per raggiungere il premio di categoria
        const integration = Math.max(0, valCategory - valAbsolute);
        res.prizeValue = integration;
      }
    }
  });

  // 5. Finalize with Reintegro calcs
  const processedReintegro = new Set<string>();

  return results.map(res => {
    const reg = registrations.find(r => r.shooterId === res.winner.id);
    const isAbsolute = res.prize.category === 'Assoluto' || res.prize.category === 'Generale';
    
    // Logic for reintegro amount from Registration
    // We trust reg.reintegroAmount as the source of truth calculated during registration
    const totalPossibleReintegro = reg?.reintegroAmount ?? 0;
    // 1. Only once per shooter (processedReintegro)
    // 2. Only if NOT manually disabled via reintegroOverrides (default is usually ENABLED if override not present)
    // 3. Prefer applying it to Absolute prize if they win both
    
    let reintegroAmount = 0;
    // By default, if there is a potential reintegro, it's ENABLED unless specifically set to false in overrides
    const isReintegroManuallyDisabled = reintegroOverrides[res.winner.id] === false;

    // We process the list sequentially. results already has absoluteAssignments first.
    if (!isReintegroManuallyDisabled && totalPossibleReintegro > 0 && !processedReintegro.has(res.winner.id)) {
       // If this is a category prize but they ALSO have an absolute prize, we should skip it here 
       // and wait for the absolute one. But wait, absolute ones are ALREADY at the beginning of the list.
       // So if we are here and it's NOT absolute, it means either:
       // a) They don't win absolute prize -> Apply here.
       // b) They win both -> This category assignment would be LATER in the list, so it will already be in processedReintegro.
       
       // EXCEPT if we want to honor "ONLY on program prize" even if it doesn't cover the whole thing.
       // If they win both, we apply it to Absolute.
       // If they only win Category, we apply it to Category.
       
       const winsAbsolute = absoluteWinnersMap.has(res.winner.id);
       
       if (isAbsolute || !winsAbsolute) {
         reintegroAmount = totalPossibleReintegro;
         processedReintegro.add(res.winner.id);
       }
    }
    
    const prizeValue = res.prizeValue !== undefined ? res.prizeValue : res.prize.value;
    
    // If it's the absolute prize and they have both, we cover as much as possible BUT "solo sul premio di programma"
    // might mean if it exceeds, we don't take from the other.
    // My mapping below ensures reintegro is subtracted from THIS specific prize.
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

export const api = {
  fetchShooters: async () => {
    if (!window.desktopAPI) throw new Error('Desktop API non disponibile');
    return window.desktopAPI.readCollection('shooters');
  },
  saveShooters: async (shooters: any[]) => {
    if (!window.desktopAPI) throw new Error('Desktop API non disponibile');
    return window.desktopAPI.writeCollection('shooters', shooters);
  },
  fetchSessions: async () => {
    if (!window.desktopAPI) throw new Error('Desktop API non disponibile');
    return window.desktopAPI.readCollection('sessions');
  },
  saveSessions: async (sessions: any[]) => {
    if (!window.desktopAPI) throw new Error('Desktop API non disponibile');
    return window.desktopAPI.writeCollection('sessions', sessions);
  },
  fetchTournaments: async () => {
    if (!window.desktopAPI) throw new Error('Desktop API non disponibile');
    return window.desktopAPI.readCollection('tournaments');
  },
  saveTournaments: async (tournaments: any[]) => {
    if (!window.desktopAPI) throw new Error('Desktop API non disponibile');
    return window.desktopAPI.writeCollection('tournaments', tournaments);
  },
  fetchFeedbacks: async () => {
    if (!window.desktopAPI) throw new Error('Desktop API non disponibile');
    return window.desktopAPI.readCollection('feedbacks');
  },
  saveFeedbacks: async (feedbacks: any[]) => {
    if (!window.desktopAPI) throw new Error('Desktop API non disponibile');
    return window.desktopAPI.writeCollection('feedbacks', feedbacks);
  },
  openExternal: async (url: string) => {
    if (window.desktopAPI && window.desktopAPI.openExternal) {
      return window.desktopAPI.openExternal(url);
    }
    window.open(url, '_blank');
  }
};

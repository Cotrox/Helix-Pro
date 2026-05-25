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
  }
};

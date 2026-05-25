

export const convertToCSV = (data: any[]): string => {
  if (data.length === 0) return '';
  const headers = Object.keys(data[0]);
  const rows = data.map(obj => 
    headers.map(header => {
      const val = obj[header];
      if (typeof val === 'object') return JSON.stringify(JSON.stringify(val));
      return JSON.stringify(val ?? '');
    }).join(',')
  );
  return [headers.join(','), ...rows].join('\n');
};

export const downloadFile = (content: string, fileName: string, contentType: string) => {
  const blob = new Blob([content], { type: contentType });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  window.URL.revokeObjectURL(url);
};

export const STORAGE_KEYS = {
  SHOOTERS: 'helix_shooters',
  SESSIONS: 'helix_sessions',
  CURRENT: 'helix_current_session',
  TOURNAMENTS: 'helix_tournaments'
};

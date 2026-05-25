# HeliX Pro - Management System per Competizioni di Tiro

HeliX Pro è un'applicazione desktop professionale, robusta e ad alte prestazioni progettata per la gestione completa di competizioni di tiro a volo (Fossa Olimpica, Trap, Skeet, Compak Sporting, ecc.). Il sistema copre l'intero ciclo di vita di una gara: dall'iscrizione degli atleti all'elaborazione automatica delle classifiche generali, di categoria e di sbarramento (barrage), fino al calcolo automatizzato del montepremi ed alla rendicontazione fiscale con "Reintegro Atleti".

---

## 🚀 Stack Tecnologico di Grado Premium

L'applicazione è strutturata su un'architettura moderna a basso consumo di risorse, per operare in mobilità ed offline direttamente sui campi di tiro:

- **Frontend (Renderer):** React (v19) & TypeScript. Interfaccia utente altamente reattiva con design system basato su **Tailwind CSS** (v4) in modalità "Technical Dark Mode".
- **Shell Desktop:** Electron (v35). Fornisce l'accesso sicuro a risorse hardware e sistema di file locale.
- **Preload & IPC Bridge:** Comunicazione sicura, isolata e bidirezionale tra il contesto del browser (React) e il processo di sistema Node.js.
- **Database Engine:** Node.js native **`node:sqlite`** (`DatabaseSync`). Utilizza il database relazionale SQLite3 in modalità sincrona e transazionale per garantire l'integrità totale dei dati ad ogni scrittura, senza lag o dipendenze esterne.
- **Animazioni & Micro-interazioni:** Framer Motion (`motion/react`) per feedback visivi fluidi ed eleganti.
- **Engine di Reportistica:** jsPDF & jsPDF-AutoTable per l'esportazione dinamica di fogli di tiro, classifiche e report integrali pronti per la stampa fisica.

---

## 📊 Aree Funzionali Chiave

### 1. Centrale di Controllo (Pannello / Dashboard)
- Monitoraggio globale in tempo reale di tutte le competizioni registrate (attive, in attesa, concluse).
- Contatori statistici per iscritti attivi, montepremi erogato e gare completate.
- Accesso rapido alle utility di sistema: Backup totale, Ripristino cronologico e Storico Snapshots.

### 2. Anagrafica Centralizzata Atleti
- Database locale indicizzato di tutti i tiratori con categoria di appartenenza, qualifica e stato del tesseramento.
- Ricerca istantanea multicriterio e filtri avanzati.
- Funzione di importazione/esportazione diretta per il travaso rapido dei database tiratori.

### 3. Gestione Gare Integrata
- **Iscrizioni & Cassa:** Registrazione immediata dall'anagrafica centralizzata, calcolo automatico dei costi di iscrizione per categoria/servizio campo, tracciamento pagamenti e generazione dell'ordine di tiro ad estrazione o manuale.
- **Matrice dei Punteggi (Scoring Grid):** Tabellone elettronico ottimizzato ad alta densità per l'inserimento immediato dei piattelli colpiti (hit) serie per serie. Calcolo istantaneo delle classifiche in tempo reale durante la digitazione.
- **Classifiche & Barrage:** Generazione immediata di graduatorie Generali e per Categoria (Eccellenza, Prima, Seconda, Terza, Veterani, ecc.). Gestione dinamica degli spareggi (barrage) ad eliminazione diretta o d'ufficio per la risoluzione dei pari merito.
- **Ripartizione Montepremi:** Calcolatore intelligente dei premi da erogare in base alle tabelle federali, comprensivo del calcolo del "Reintegro" (trattenuta automatica dei gettoni campo e quota d'iscrizione dai premi vinti).

---

## 🛠️ Comandi Utili da Terminale (Funzionanti)

Tutti i comandi sottostanti devono essere eseguiti all'interno della cartella radice del progetto.

### 💻 Sviluppo Locale
Avvia l'ambiente di sviluppo locale. Lancia contemporaneamente il server di sviluppo Vite per il frontend (React) e l'istanza Electron per il processo principale, collegando i DevTools per il debug in tempo reale:
```bash
npm run dev
```

### 📦 Generazione dei Pacchetti di Distribuzione (Build & Packaging)
Compila i file sorgenti del frontend ed esegue il pacchettizzatore **electron-builder** per generare le versioni distribuibili dell'app per Windows:
```bash
npm run dist
```
*I file generati verranno depositati all'interno della cartella `./release/` e includeranno:*
1. **L'Installatore Windows (`Helix Pro Setup [Versione].exe`):** Installa l'app nel sistema, crea collegamenti nel menu Start e sul Desktop. Consigliato per l'utente finale.
2. **La Versione Portable (`Helix Pro-[Versione]-portable.exe`):** Eseguibile autonomo che non richiede installazione o diritti di amministratore. Gira perfettamente anche da penne USB.

### 🧹 Pulizia della Cartella di Build
Rimuove completamente la cartella temporanea `dist` generata durante la compilazione del frontend React:
```bash
npm run clean
```

### 🔍 Verifica Tipi (TypeScript Compiler check)
Esegue il controllo statico dei tipi sull'intera codebase TypeScript per verificare l'assenza di errori di compilazione senza emettere codice:
```bash
npm run lint
```

---

## 📂 Archiviazione Dati & Sicurezza
I dati dell'app (tiratori, gare, tornei) sono archiviati all'interno della directory dei dati utente standard del sistema operativo (`userData`), specificamente in:
- **Percorso Windows:** `%APPDATA%/Helix Pro/helix-pro.sqlite3`

L'applicazione esegue automaticamente uno snapshot di backup ad ogni primo avvio quotidiano, permettendo in qualsiasi momento di ripristinare il sistema a uno stato precedente direttamente dall'interfaccia utente (sezione "Storico Sistema"). Inoltre, l'utente può scaricare in qualsiasi momento un backup manuale compresso in formato `.json` cliccando sui pulsanti di **BACKUP / IMPORT** nella barra laterale sinistra.

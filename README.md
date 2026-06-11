<p align="center">
  <img src="build/icon.png" width="128" alt="HeliX Pro Logo" />
</p>

# HeliX Pro - Management System per Competizioni di Tiro

**HeliX Pro** è un'applicazione desktop di livello professionale e ad alte prestazioni progettata per la gestione completa di competizioni di tiro a volo (Fossa Olimpica, Trap, Skeet, Compak Sporting, ecc.). 

Il sistema copre l'intero ciclo di vita di una gara: dall'iscrizione degli atleti all'elaborazione automatica delle classifiche in tempo reale, dalla gestione degli spareggi (*barrage*) fino al calcolo automatizzato del montepremi ed alla rendicontazione fiscale con "Reintegro Atleti".

---

## ✨ Funzionalità Principali

*   **📊 Centrale di Controllo (Dashboard):** Monitoraggio globale in tempo reale di tutte le competizioni registrate (attive, in attesa, concluse), statistiche rapide su iscritti e montepremi erogato.
*   **👥 Anagrafica Centralizzata Atleti:** Database indicizzato con ricerca istantanea e filtri avanzati per gestire tiratori, categorie, qualifiche e stato del tesseramento.
*   **🎯 Tabellone Punteggi in Tempo Reale (Scoring Grid):** Matrice elettronica ad alta densità per l'inserimento immediato dei piattelli serie per serie, con ricalcolo immediato della classifica.
*   **🏆 Classifiche & Barrage Automatici:** Generazione di graduatorie Generali e per Categoria (Eccellenza, 1ª, 2ª, 3ª, ecc.) e gestione dinamica degli spareggi per i pari merito.
*   **💰 Calcolo Montepremi & Reintegro:** Calcolatore intelligente dei premi basato sulle tabelle federali, integrato con la trattenuta automatica di gettoni campo e quote d'iscrizione.
*   **📄 Reportistica Professionale:** Generazione ed esportazione di fogli di tiro, classifiche e rendiconti in PDF e fogli di calcolo pronti per la stampa fisica.
*   **🔒 Backup & Sicurezza:** Snapshot di backup automatici ad ogni primo avvio quotidiano, backup manuale JSON ed utility di ripristino direttamente dall'interfaccia.

---

## 🛠️ Stack Tecnologico

L'applicazione adotta un'architettura moderna per operare offline sul campo con la massima stabilità ed efficienza:

*   **Frontend:** [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Tailwind CSS v4](https://tailwindcss.com/) per una UI reattiva ed un design in "Technical Dark Mode".
*   **Desktop Shell:** [Electron 35](https://www.electronjs.org/) per l'integrazione con il sistema operativo.
*   **Database:** Modulo nativo Node.js **`node:sqlite`** (`DatabaseSync`) per transazioni sicure su file SQLite3 locali, senza dipendenze pesanti o latenze di rete.
*   **Animazioni:** Framer Motion (`motion/react`) per micro-interazioni fluide.
*   **Reportistica:** jsPDF & jsPDF-AutoTable per l'esportazione PDF.

---

## 📂 Archiviazione Dati

I dati dell'app (tiratori, gare, tornei) sono salvati localmente per garantire il pieno funzionamento offline:
*   **Windows:** `%APPDATA%/Helix Pro/helix-pro.sqlite3`

---

## 💻 Installazione e Sviluppo

Se sei un utente finale, scarica l'ultimo installer disponibile nella sezione **[Releases](../../releases)** di questa repository:
*   **Installer Setup (`.exe`):** Installa l'app nel sistema creandone le scorciatoie nel menu Start e sul Desktop.
*   **Versione Portable (`.exe`):** Eseguibile autonomo pronto all'uso, ideale per essere avviato da una chiavetta USB senza installazione.

---

## ☕ Supporta il Progetto

HeliX Pro è un software gratuito sviluppato con passione. Se trovi utile questo strumento e vuoi supportare il suo sviluppo continuo, puoi effettuare una donazione libera tramite i seguenti canali:

*   [**Sostienici su Ko-fi**](https://ko-fi.com/cotrox)
*   [**Fai una donazione su PayPal**](https://www.paypal.com/paypalme/peppecotro)

---

*Sviluppato con passione per lo sport del Tiro a Volo.*

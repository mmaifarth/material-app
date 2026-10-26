import React, { useState, useEffect } from 'react';
import { FileText, Printer, AlertCircle, Eye, EyeOff, RotateCcw } from 'lucide-react';

// --- HILFSFUNKTIONEN ---

const assetUrl = (filename) => {
  const base = import.meta.env.BASE_URL || '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return `${normalizedBase}${encodeURI(filename)}`;
};

// Entspricht exakt slugify(text) aus generate_material.py
const slugify = (text) => {
  if (!text) return 'item';
  const normalized = String(text)
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return normalized || 'item';
};

// Robuster RFC-4180 CSV-Parser (analog zu read_csv_robust: Priorität Semikolon, Fallback Komma, inkl. Zeilenumbrüche in Quotes)
const parseCSV = (rawText) => {
  const csvText = (rawText || '').replace(/^\uFEFF/, '');
  if (!csvText.trim()) return [];

  let inQ = false;
  let semicolons = 0;
  let commas = 0;
  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i];
    if (ch === '"') inQ = !inQ;
    else if (!inQ && ch === ';') semicolons++;
    else if (!inQ && ch === ',') commas++;
    else if (!inQ && (ch === '\n' || ch === '\r')) break;
  }
  const separator = semicolons >= commas ? ';' : ',';

  const rows = [];
  let currentRow = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const next = csvText[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === separator) {
      currentRow.push(cell.trim());
      cell = '';
    } else if (char === '\r' || char === '\n') {
      if (char === '\r' && next === '\n') i++;
      currentRow.push(cell.trim());
      cell = '';
      if (currentRow.some((val) => val !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      cell += char;
    }
  }

  currentRow.push(cell.trim());
  if (currentRow.some((val) => val !== '')) {
    rows.push(currentRow);
  }
  if (rows.length < 2) return [];

  const headers = rows[0].map((h) => h.replace(/^\uFEFF/, '').trim());
  return rows.slice(1).map((values) => {
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] !== undefined ? values[index] : '';
    });
    return row;
  });
};

const isNaOrEmpty = (val) => {
  return val === null || val === undefined || String(val).trim() === '';
};

const formatHtmlContent = (raw) => {
  if (isNaOrEmpty(raw)) return '';
  const str = String(raw);
  // Falls bereits HTML-Tags enthalten sind (wie in OpenSlides-Exporten), unverändert rendern wie in Jinja2
  if (/<[a-z][\s\S]*>/i.test(str)) {
    return str;
  }
  return str.replace(/\r?\n/g, '<br/>');
};

// --- STATISCHE DATEN (Exakt wie in generate_material.py) ---

const GESTEN = [
  { img: 'GO-Antrag.png', alt: 'GO-Antrag', label: 'GO-Antrag:', text: 'Hat Vorrang (z. B. Schluss der Redeliste)' },
  { img: 'Redebeitrag.png', alt: 'Redebeitrag', label: 'Redebeitrag:', text: 'Bis Nummer auf Redeliste steht' },
  { img: 'Falsche-Fakten.png', alt: 'Falsche Fakten', label: 'Falsche Fakten:', text: 'Reine Richtigstellung' },
  { img: 'Redezeit.png', alt: 'Redezeitbegrenzung', label: 'Redezeitbegrenzung', text: '' },
  { img: 'Schneller.png', alt: 'Komm zum Punkt', label: 'Komm zum Punkt / Wiederholung', text: '' },
  { img: 'Pause.png', alt: 'Pause', label: 'Pause:', text: 'Zur Klärung von Verständnisfragen' },
  { img: 'Lauter-Sprechen.png', alt: 'Lauter Sprechen', label: 'Lauter Sprechen', text: '' },
  { img: 'Diskussion-Rahmen.png', alt: 'Diskussion fällt aus dem Rahmen', label: 'Diskussion fällt aus dem Rahmen', text: '' },
  { img: 'Ruhe.png', alt: 'Ruhe', label: 'Ruhe', text: '' },
  { img: 'Zustimmung.png', alt: 'Zustimmung', label: 'Zustimmung', text: '' },
  { img: 'Ablehnung.png', alt: 'Ablehnung', label: 'Ablehnung', text: '' }
];

const ABKUERZUNGEN = [
  { k: 'AK', v: 'Arbeitskreis' },
  { k: 'ASL', v: 'Ausschuss für Studium und Lehre' },
  { k: 'BayHIG', v: 'Bayerisches Hochschulinnovationsgesetz' },
  { k: 'BayStuRa', v: 'Bayerischer Landesstudierendenrat' },
  { k: 'EHL', v: 'Erweiterte Hochschulleitung' },
  { k: 'FS', v: 'Fachschaft' },
  { k: 'FSV', v: 'Fachschaftsvertretung' },
  { k: 'GeFü', v: 'Geschäftsführung' },
  { k: 'GeVo', v: 'Geschäftsführung + Vorstand' },
  { k: 'GO (KF)', v: 'Geschäftsordnung des Konvents der Fachschaften' },
  { k: 'GrundO', v: 'Grundordnung der LMU' },
  { k: 'HR', v: 'Hochschulrat' },
  { k: 'HSG', v: 'Hochschulgruppe' },
  { k: 'MZL', v: 'Münchner Zentrum für Lehrerbildung' },
  { k: 'StMWK', v: 'Bayerisches Staatsministerium für Wissenschaft und Kunst' },
  { k: 'StuVe', v: 'Studierendenvertretung' },
  { k: 'TOP', v: 'Tagesordnungspunkt' },
  { k: 'ZSK', v: 'Zentrale Studienzuschusskommission' }
];

const DEFAULT_META = {
  datum: new Date().toISOString().split('T')[0],
  beginn: '18:15 Uhr',
  raum: 'A120',
  standort: 'Geschwister-Scholl-Platz 1',
  redeleitung: '',
  protokoll: '',
  anhang: ''
};

// --- HAUPTKOMPONENTE ---

export default function App() {
  const [meta, setMeta] = useState(() => {
    try {
      const saved = localStorage.getItem('stuve_material_meta');
      return saved ? { ...DEFAULT_META, ...JSON.parse(saved) } : DEFAULT_META;
    } catch {
      return DEFAULT_META;
    }
  });

  const [tagesordnung, setTagesordnung] = useState([]);
  const [antraegeRaw, setAntraegeRaw] = useState([]);
  const [mergedData, setMergedData] = useState([]);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [fileNames, setFileNames] = useState({ tagesordnung: '', antraege: '' });

  useEffect(() => {
    try {
      localStorage.setItem('stuve_material_meta', JSON.stringify(meta));
    } catch {
      // ignore storage errors
    }
  }, [meta]);

  // Handler für Datei-Upload (analog zu Schritt 4 in generate_material.py)
  const handleFileUpload = (event, type) => {
    const file = event.target.files[0];
    if (!file) return;

    setFileNames((prev) => ({ ...prev, [type]: file.name }));

    // Falls Dateiname dem Schema Tagesordnung_YYMMDD.csv oder Anträge_YYMMDD.csv entspricht, Datum automatisch erkennen
    const dateMatch = file.name.match(/(\d{2})(\d{2})(\d{2})\.csv$/i);
    if (dateMatch) {
      const [, yy, mm, dd] = dateMatch;
      const isoDate = `20${yy}-${mm}-${dd}`;
      if (!isNaN(Date.parse(isoDate))) {
        setMeta((prev) => ({ ...prev, datum: isoDate }));
      }
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const data = parseCSV(e.target.result);
      if (type === 'tagesordnung') {
        // Exakte Filterung wie in generate_material.py: agenda_type != "internal"
        const filteredData = data.filter((row) => {
          if ('agenda_type' in row) {
            return String(row.agenda_type || '').trim().toLowerCase() !== 'internal';
          }
          return true;
        });

        const enrichedData = filteredData.map((row) => {
          const title = String(row.title || '').trim();
          const itemNumber = String(row.item_number || '').replace(/\.0$/, '').trim();
          return {
            ...row,
            item_number: itemNumber,
            title,
            slug: slugify(title),
            text: row.text || row.Text || ''
          };
        });
        setTagesordnung(enrichedData);
      } else {
        setAntraegeRaw(data);
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  // Relationales Mapping: Anträge zu Tagesordnungspunkten zuordnen (exakt wie antraege[antraege['Titel'] == row['title']])
  useEffect(() => {
    if (tagesordnung.length > 0) {
      const combined = tagesordnung.map((top) => {
        const matchingAntraege = antraegeRaw
          .filter((a) => String(a.Titel || '').trim() === top.title)
          .map((a) => ({
            Bezeichner: a.Bezeichner || '',
            Antragsteller: a['Antragsteller*in'] || a.Antragsteller || '',
            Status: a.Status || '',
            Text: a.Text || '',
            Begruendung: a['Begründung'] || a.Begruendung || ''
          }));

        return { ...top, antraege: matchingAntraege };
      });
      setMergedData(combined);
    } else {
      setMergedData([]);
    }
  }, [tagesordnung, antraegeRaw]);

  const handleReset = () => {
    setMeta(DEFAULT_META);
    setTagesordnung([]);
    setAntraegeRaw([]);
    setMergedData([]);
    setFileNames({ tagesordnung: '', antraege: '' });
  };

  // Datumsformatierung exakt wie in generate_material.py:
  // print_date = "%d.%m.%y" (für Header und Deckblatt)
  // meta_date  = "%d.%m.%Y" (für die Meta-Tabelle)
  const getPrintDateShort = () => {
    if (!meta.datum) return '';
    const parts = meta.datum.split('-');
    if (parts.length === 3) {
      return `${parts[2]}.${parts[1]}.${parts[0].slice(-2)}`;
    }
    return meta.datum;
  };

  const getMetaDateLong = () => {
    if (!meta.datum) return '';
    const parts = meta.datum.split('-');
    if (parts.length === 3) {
      return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }
    return meta.datum;
  };

  const todayStr = new Date().toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  // Dynamische Sitzungs-Metadaten exakt wie sitzungs_meta in generate_material.py
  const sitzungsMetaEntries = [
    ['Datum', getMetaDateLong()],
    ['Beginn', meta.beginn || '18:15 Uhr'],
    ['Raum', meta.raum],
    ['Standort', meta.standort],
    ['Redeleitung', meta.redeleitung],
    ['Protokoll', meta.protokoll]
  ];
  if (meta.anhang && meta.anhang.trim() !== '') {
    sitzungsMetaEntries.push(['Anhang', meta.anhang.trim()]);
  }

  // Setze den Dokumenttitel passend zu output_pdf = f"Material_{yymmdd}.pdf" für den Browser-PDF-Export
  useEffect(() => {
    if (meta.datum) {
      const parts = meta.datum.split('-');
      if (parts.length === 3) {
        const yymmdd = `${parts[0].slice(-2)}${parts[1]}${parts[2]}`;
        document.title = `Material_${yymmdd}`;
        return;
      }
    }
    document.title = 'Sitzungsmaterial';
  }, [meta.datum]);

  const handlePrint = () => {
    window.print();
  };

  const printDate = getPrintDateShort();

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white font-sans text-gray-800">
      {/* --- EDITOR / UI ANSICHT (Wird beim Druck ausgeblendet) --- */}
      <div className="print:hidden max-w-4xl mx-auto p-6 space-y-6">
        <div className="flex flex-wrap justify-between items-center gap-4 bg-[#005030] text-white p-6 rounded-xl shadow-lg">
          <div className="flex items-center gap-4">
            <img
              src={assetUrl('Stuve Logo lang.png')}
              alt="StuVe Logo"
              className="h-12 w-auto bg-white p-1.5 rounded"
            />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Material Generator</h1>
              <p className="text-green-100 mt-0.5 text-sm md:text-base">
                Konvent der Fachschaften, LMU München
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPrintPreview(!showPrintPreview)}
              className="flex items-center gap-1.5 bg-[#003d24] hover:bg-[#00663d] text-white px-4 py-2.5 rounded-lg text-sm font-semibold border border-green-700 transition"
            >
              {showPrintPreview ? <EyeOff size={18} /> : <Eye size={18} />}
              {showPrintPreview ? 'Vorschau ausblenden' : 'Druckvorschau'}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 bg-red-700 hover:bg-red-600 text-white px-3 py-2.5 rounded-lg text-sm font-semibold transition"
              title="Eingaben & Dateien zurücksetzen"
            >
              <RotateCcw size={18} />
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={mergedData.length === 0}
              className="flex items-center gap-2 bg-white text-[#005030] px-5 py-2.5 rounded-lg font-bold hover:bg-gray-100 transition shadow disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Printer size={20} /> Sitzungsmaterial generieren
            </button>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-xl font-bold text-[#005030] mb-4 flex items-center gap-2">
            <FileText size={24} /> Metadaten der Sitzung & CSV-Dateien
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Datum der Sitzung
              </label>
              <input
                type="date"
                value={meta.datum}
                onChange={(e) => setMeta({ ...meta, datum: e.target.value })}
                className="w-full border-gray-300 rounded-md shadow-sm p-2 border focus:ring-[#005030] focus:border-[#005030]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Beginn (für Sitzungsübersicht)
              </label>
              <input
                type="text"
                value={meta.beginn}
                onChange={(e) => setMeta({ ...meta, beginn: e.target.value })}
                className="w-full border-gray-300 rounded-md shadow-sm p-2 border"
                placeholder="18:15 Uhr"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Raum (Freitext, z.B. A120)
              </label>
              <input
                type="text"
                value={meta.raum}
                onChange={(e) => setMeta({ ...meta, raum: e.target.value })}
                className="w-full border-gray-300 rounded-md shadow-sm p-2 border"
                placeholder="z.B. A120 oder M110"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Standort (Freitext, z.B. Geschwister-Scholl-Platz 1)
              </label>
              <input
                type="text"
                value={meta.standort}
                onChange={(e) => setMeta({ ...meta, standort: e.target.value })}
                className="w-full border-gray-300 rounded-md shadow-sm p-2 border"
                placeholder="z.B. Geschwister-Scholl-Platz 1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Redeleitung (z.B. Loey Schatzl)
              </label>
              <input
                type="text"
                value={meta.redeleitung}
                onChange={(e) => setMeta({ ...meta, redeleitung: e.target.value })}
                className="w-full border-gray-300 rounded-md shadow-sm p-2 border"
                placeholder="Name(n)..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Protokollführung (z.B. Mark Eckhardt, Anna Maria Hörl)
              </label>
              <input
                type="text"
                value={meta.protokoll}
                onChange={(e) => setMeta({ ...meta, protokoll: e.target.value })}
                className="w-full border-gray-300 rounded-md shadow-sm p-2 border"
                placeholder="Name(n)..."
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Anhang (optional, z.B. „Protokoll vom 06.05.2026“ – Leerlassen für keinen Anhang)
              </label>
              <input
                type="text"
                value={meta.anhang}
                onChange={(e) => setMeta({ ...meta, anhang: e.target.value })}
                className="w-full border-gray-300 rounded-md shadow-sm p-2 border"
                placeholder="z.B. Protokoll vom 06.05.2026"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-4 rounded-lg border border-dashed border-gray-300">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Tagesordnung (.csv)
              </label>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => handleFileUpload(e, 'tagesordnung')}
                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:font-semibold file:bg-green-50 file:text-[#005030] hover:file:bg-green-100"
              />
              {fileNames.tagesordnung && (
                <p className="text-xs text-green-700 mt-1 font-medium">
                  Geladen: {fileNames.tagesordnung} ({tagesordnung.length} öffentliche TOPs)
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Anträge (.csv){' '}
                <span className="font-normal text-gray-500">(Standard / Optional)</span>
              </label>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => handleFileUpload(e, 'antraege')}
                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:font-semibold file:bg-green-50 file:text-[#005030] hover:file:bg-green-100"
              />
              {fileNames.antraege && (
                <p className="text-xs text-green-700 mt-1 font-medium">
                  Geladen: {fileNames.antraege} ({antraegeRaw.length} Anträge)
                </p>
              )}
            </div>
          </div>
        </div>

        {mergedData.length > 0 && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg text-[#005030]">
                Erkannte Tagesordnungspunkte ({mergedData.length})
              </h3>
              <span className="text-xs text-gray-500">
                Interne TOPs (agenda_type = internal) wurden automatisch ausgefiltert
              </span>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {mergedData.map((row, i) => (
                <div
                  key={i}
                  className="flex justify-between items-center p-3 bg-gray-50 rounded border border-gray-100"
                >
                  <span className="font-medium">
                    {row.item_number}: {row.title}
                  </span>
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      row.antraege.length > 0
                        ? 'bg-green-100 text-[#005030]'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {row.antraege.length}{' '}
                    {row.antraege.length === 1 ? 'Antrag verknüpft' : 'Anträge verknüpft'}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 p-4 bg-blue-50 text-blue-800 rounded flex gap-3 text-sm items-center">
              <AlertCircle className="shrink-0" size={20} />
              <p>
                Die Daten wurden erfolgreich verknüpft. Klicken Sie oben auf{' '}
                <strong>„Sitzungsmaterial generieren“</strong>, um das PDF im Layout des
                Python-Skripts zu speichern, oder nutzen Sie die{' '}
                <strong>„Druckvorschau“</strong>.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* --- DRUCK- / VORSCHAU-ANSICHT (Exakt nach dem HTML/CSS-Template aus generate_material.py) --- */}
      <div
        className={
          showPrintPreview
            ? 'block max-w-[210mm] mx-auto my-8 bg-white shadow-2xl p-[25mm_20mm] print:shadow-none print:m-0 print:p-0 text-[#222222]'
            : 'hidden print:block text-[#222222] min-h-screen'
        }
      >
        <style
          dangerouslySetInnerHTML={{
            __html: `
          @page {
              size: A4;
              margin: 25mm 20mm;
              @bottom-center {
                  content: counter(page);
                  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
                  font-size: 9pt;
                  color: #555555;
              }
          }

          * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              box-sizing: border-box;
          }

          .material-doc {
              font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
              font-size: 11pt;
              line-height: 1.4;
              color: #222222;
              background-color: #ffffff;
              width: 100%;
          }

          /* Deckblatt analog zu @page :first + .cover-page in generate_material.py */
          .cover-page {
              text-align: center;
              padding-top: 60mm;
              min-height: 245mm;
              page-break-after: always;
              break-after: page;
              position: relative;
              z-index: 1;
          }
          .cover-seal-bg {
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              width: 90%;
              height: auto;
              opacity: 0.2;
              z-index: -1;
              pointer-events: none;
          }
          .institution {
              font-size: 16pt;
              font-weight: bold;
              color: #005030;
              margin-bottom: 10mm;
              text-transform: uppercase;
              letter-spacing: 1px;
          }
          .title {
              font-size: 24pt;
              font-weight: bold;
              margin-bottom: 5mm;
              color: #222222;
          }
          .subtitle {
              font-size: 16pt;
              color: #555555;
              margin-bottom: 30mm;
          }
          .event-details {
              font-size: 12pt;
              color: #333333;
              margin-bottom: 3mm;
              line-height: 1.6;
          }

          /* Wiederholende Kopfzeile ab Seite 2 analog zu .page-header in generate_material.py */
          .print-layout-table {
              width: 100%;
              border-collapse: collapse;
              border: none !important;
              margin: 0 !important;
          }
          .print-layout-table > thead {
              display: table-header-group;
          }
          .print-layout-table > tbody {
              display: table-row-group;
          }
          .print-layout-table > thead > tr > td,
          .print-layout-table > tbody > tr > td {
              border: none !important;
              padding: 0 !important;
          }

          .page-header {
              display: flex;
              align-items: center;
              gap: 10px;
              margin-bottom: 8mm;
          }
          .page-header img {
              height: 41px;
              width: auto;
          }
          .page-header .header-text {
              font-size: 10pt;
              font-weight: 400;
              color: #999999;
              line-height: 1;
              white-space: normal;
              max-width: 175px;
          }

          /* Überschriften exakt wie in generate_material.py */
          .material-doc h1 {
              font-size: 18pt;
              font-weight: bold;
              color: #005030;
              border-bottom: 2px solid #005030;
              padding-bottom: 5px;
              margin-top: 0;
              margin-bottom: 14px;
              page-break-after: avoid;
              break-after: avoid;
          }
          .material-doc h2 {
              font-size: 14pt;
              font-weight: bold;
              color: #222222;
              margin-top: 25px;
              margin-bottom: 10px;
              page-break-after: avoid;
              break-after: avoid;
          }
          .material-doc h3 {
              font-size: 11pt;
              font-weight: bold;
              text-transform: uppercase;
              color: #666666;
              margin-top: 15px;
              margin-bottom: 5px;
              page-break-after: avoid;
              break-after: avoid;
          }

          /* Fließtext & HTML-Inhalte aus CSV */
          .item-text {
              margin-bottom: 15px;
              text-align: justify;
              hyphens: auto;
              overflow-wrap: break-word;
          }
          .item-text p {
              margin: 0 0 10px 0;
          }
          .item-text p:last-child {
              margin-bottom: 0;
          }
          .item-text ul {
              list-style-type: disc;
              padding-left: 25px;
              margin: 8px 0 12px 0;
          }
          .item-text ol {
              list-style-type: decimal;
              padding-left: 25px;
              margin: 8px 0 12px 0;
          }
          .item-text ul ul,
          .item-text ol ul {
              list-style-type: circle;
              padding-left: 20px;
              margin: 4px 0;
          }
          .item-text li {
              margin-bottom: 3px;
          }
          .item-text a {
              color: #0000EE;
              text-decoration: underline;
          }
          .item-text strong, .item-text b {
              font-weight: bold;
          }
          .item-text em, .item-text i {
              font-style: italic;
          }
          .item-text u {
              text-decoration: underline;
          }

          /* Antragsbox exakt wie in generate_material.py */
          .antrag-box {
              background-color: #f4f7f6;
              border-left: 5px solid #005030;
              padding: 15px 20px;
              margin-top: 15px;
              margin-bottom: 20px;
              page-break-inside: avoid;
              break-inside: avoid;
          }
          .antrag-header {
              font-weight: bold;
              font-size: 10pt;
              color: #005030;
              border-bottom: 1px solid #d0ded8;
              padding-bottom: 8px;
              margin-bottom: 12px;
          }

          /* Tabellen-Styling exakt wie in generate_material.py */
          .material-table,
          .item-text table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 30px;
          }
          .material-table th,
          .material-table td,
          .item-text table th,
          .item-text table td {
              border: 1px solid #dddddd;
              padding: 10px;
              text-align: left;
              font-size: 10pt;
              vertical-align: middle;
          }
          .material-table th,
          .item-text table th {
              background-color: #f2f2f2;
              font-weight: bold;
          }

          /* Meta-Tabelle (Sitzungsübersicht) exakt wie in generate_material.py */
          .meta-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 30px;
          }
          .meta-table th {
              background-color: transparent;
              border: none;
              font-weight: bold;
              padding: 5px 10px 5px 0;
              text-align: left;
              font-size: 10pt;
          }
          .meta-table td {
              border: none;
              padding: 5px 0;
              text-align: left;
              font-size: 10pt;
          }
          .meta-table tr {
              border-bottom: 1px solid #eeeeee;
          }
          .meta-table tr:last-child {
              border-bottom: none;
          }

          /* Inhaltsverzeichnis Styling exakt wie in generate_material.py */
          .toc-list {
              list-style-type: none;
              padding-left: 0;
              margin-right: 20mm;
              margin-bottom: 30px;
          }
          .toc-list li {
              margin-bottom: 8px;
          }
          .toc-list a {
              text-decoration: none;
              color: #005030;
              font-weight: bold;
              display: flex;
              align-items: baseline;
              width: 100%;
          }
          .toc-list a::after {
              content: "";
              flex-grow: 1;
              border-bottom: 1px dotted #555555;
              margin-left: 6px;
              position: relative;
              top: -3px;
          }

          .page-break {
              page-break-before: always;
              break-before: page;
          }
        `
          }}
        />

        <div className="material-doc">
          {/* --- DECKBLATT (Seite 1 ohne Header, mit Hintergrund-Siegel) --- */}
          <div className="cover-page">
            <img
              src={assetUrl('Siegel.png')}
              alt=""
              className="cover-seal-bg"
            />
            <div className="institution">
              Konvent der Fachschaften
              <br />
              Ludwig-Maximilians-Universität München
            </div>
            <div className="title">Sitzungsmaterial</div>
            <div className="subtitle">Sitzung am {printDate}</div>
            <div className="event-details">Ab 18 Uhr c.t. in {meta.raum}</div>
            <div className="event-details">{meta.standort}</div>
            <div style={{ fontSize: '12pt' }}>
              <strong>Stand:</strong> {todayStr}
            </div>
          </div>

          {/* --- HAUPTDOKUMENT AB SEITE 2 MIT RUNNING HEADER --- */}
          <table className="print-layout-table">
            <thead>
              <tr>
                <td>
                  <div className="page-header" id="pageHeader">
                    <img src={assetUrl('Stuve Logo lang.png')} alt="Stuve Logo" />
                    <div className="header-text">
                      Material für die Sitzung am {printDate}
                    </div>
                  </div>
                </td>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  {/* --- VERFAHRENSHINWEISE & HANDGESTEN --- */}
                  <h1>Verfahrenshinweise &amp; Handgesten</h1>
                  <p style={{ margin: '0 0 14px 0' }}>
                    Die folgenden Handgesten erleichtern die Kommunikation während der Sitzung:
                  </p>
                  <table className="material-table">
                    <thead>
                      <tr>
                        <th width="20%">Geste</th>
                        <th width="80%">Bedeutung</th>
                      </tr>
                    </thead>
                    <tbody>
                      {GESTEN.map((geste, idx) => (
                        <tr key={idx}>
                          <td style={{ textAlign: 'center', padding: '3px 5px' }}>
                            <img
                              src={assetUrl(geste.img)}
                              alt={geste.alt}
                              style={{
                                width: '85%',
                                maxWidth: '95px',
                                height: 'auto',
                                display: 'inline-block'
                              }}
                            />
                          </td>
                          <td>
                            <strong>{geste.label}</strong>
                            {geste.text ? ` ${geste.text}` : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* --- WICHTIGE ABKÜRZUNGEN --- */}
                  <h1>Wichtige Abkürzungen</h1>
                  <table className="material-table">
                    <thead>
                      <tr>
                        <th width="30%">Abkürzung</th>
                        <th width="70%">Bedeutung</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ABKUERZUNGEN.map((abk, idx) => (
                        <tr key={idx}>
                          <td>
                            <strong>{abk.k}</strong>
                          </td>
                          <td>{abk.v}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="page-break" />

                  {/* --- SITZUNGSÜBERSICHT & INHALTSVERZEICHNIS --- */}
                  <h1>Sitzungsübersicht</h1>
                  <table className="meta-table">
                    <tbody>
                      {sitzungsMetaEntries.map(([key, value]) => (
                        <tr key={key}>
                          <th width="30%">{key}</th>
                          <td width="70%">{value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <h2>Inhaltsverzeichnis</h2>
                  <ul className="toc-list">
                    {mergedData.map((row, idx) => (
                      <li key={idx}>
                        <a href={`#top-${row.slug}`}>
                          {row.item_number}: {row.title}
                        </a>
                      </li>
                    ))}
                  </ul>

                  <div className="page-break" />

                  {/* --- TAGESORDNUNG UND ANTRÄGE --- */}
                  <h1>Tagesordnung und Anträge</h1>

                  {mergedData.map((row, index) => (
                    <React.Fragment key={index}>
                      <h2 id={`top-${row.slug}`}>
                        {row.item_number}: {row.title}
                      </h2>

                      {!isNaOrEmpty(row.text) && (
                        <div
                          className="item-text"
                          dangerouslySetInnerHTML={{
                            __html: formatHtmlContent(row.text)
                          }}
                        />
                      )}

                      {row.antraege &&
                        row.antraege.length > 0 &&
                        row.antraege.map((aRow, aIdx) => (
                          <div className="antrag-box" key={aIdx}>
                            <div className="antrag-header">
                              Antrag: {aRow.Bezeichner} | Einreichend: {aRow.Antragsteller} | Status:{' '}
                              {aRow.Status}
                            </div>
                            <h3>Antragstext</h3>
                            <div
                              className="item-text"
                              dangerouslySetInnerHTML={{
                                __html: formatHtmlContent(aRow.Text)
                              }}
                            />

                            <h3>Begründung</h3>
                            <div
                              className="item-text"
                              dangerouslySetInnerHTML={{
                                __html: formatHtmlContent(aRow.Begruendung)
                              }}
                            />
                          </div>
                        ))}
                    </React.Fragment>
                  ))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

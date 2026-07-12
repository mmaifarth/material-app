import React, { useState, useEffect } from 'react';
import { FileText, Printer, AlertCircle } from 'lucide-react';

// --- HILFSFUNKTIONEN ---

const slugify = (text) => {
  if (!text) return 'item';
  return text.toString().toLowerCase().trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
};

const parseCSV = (csvText) => {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length === 0) return [];

  const headerLine = lines[0];
  const separator = (headerLine.split(';').length > headerLine.split(',').length) ? ';' : ',';

  const parseLine = (line) => {
    const result = [];
    let cell = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' && line[i + 1] === '"') {
        cell += '"';
        i++; 
      } else if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === separator && !inQuotes) {
        result.push(cell.trim());
        cell = '';
      } else {
        cell += char;
      }
    }
    result.push(cell.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const data = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    data.push(row);
  }
  return data;
};

// --- STATISCHE DATEN ---

const ABKUERZUNGEN = [
  { k: "AK", v: "Arbeitskreis" },
  { k: "ASL", v: "Ausschuss für Studium und Lehre" },
  { k: "BayHIG", v: "Bayerisches Hochschulinnovationsgesetz" },
  { k: "BayStuRa", v: "Bayerischer Landesstudierendenrat" },
  { k: "EHL", v: "Erweiterte Hochschulleitung" },
  { k: "FS", v: "Fachschaft" },
  { k: "FSV", v: "Fachschaftsvertretung" },
  { k: "GeFü", v: "Geschäftsführung" },
  { k: "GeVo", v: "Geschäftsführung + Vorstand" },
  { k: "GO (KF)", v: "Geschäftsordnung des Konvents der Fachschaften" },
  { k: "GrundO", v: "Grundordnung der LMU" },
  { k: "HR", v: "Hochschulrat" },
  { k: "HSG", v: "Hochschulgruppe" },
  { k: "MZL", v: "Münchner Zentrum für Lehrerbildung" },
  { k: "StMWK", v: "Bayerisches Staatsministerium für Wissenschaft und Kunst" },
  { k: "StuVe", v: "Studierendenvertretung" },
  { k: "TOP", v: "Tagesordnungspunkt" },
  { k: "ZSK", v: "Zentrale Studienzuschusskommission" }
];

const GESTEN = [
  { img: "GO-Antrag.png", fallback: "GO", color: "#f97316", text: "Hat Vorrang (z. B. Schluss der Redeliste)", label: "GO-Antrag" },
  { img: "Redebeitrag.png", fallback: "👆", color: "#3b82f6", text: "Bis Nummer auf Redeliste steht", label: "Redebeitrag" },
  { img: "Falsche-Fakten.png", fallback: "❌", color: "#ef4444", text: "Reine Richtigstellung", label: "Falsche Fakten" },
  { img: "Redezeit.png", fallback: "⏱️", color: "#8b5cf6", text: "", label: "Redezeitbegrenzung" },
  { img: "Schneller.png", fallback: "⏩", color: "#06b6d4", text: "", label: "Komm zum Punkt / Wiederholung" },
  { img: "Pause.png", fallback: "⏸️", color: "#eab308", text: "Zur Klärung von Verständnisfragen", label: "Pause" },
  { img: "Lauter-Sprechen.png", fallback: "🔊", color: "#10b981", text: "", label: "Lauter Sprechen" },
  { img: "Diskussion-Rahmen.png", fallback: "🔄", color: "#6366f1", text: "", label: "Diskussion fällt aus dem Rahmen" },
  { img: "Ruhe.png", fallback: "🤫", color: "#64748b", text: "", label: "Ruhe" },
  { img: "Zustimmung.png", fallback: "👍", color: "#22c55e", text: "", label: "Zustimmung" },
  { img: "Ablehnung.png", fallback: "👎", color: "#ef4444", text: "", label: "Ablehnung" }
];

// --- HAUPTKOMPONENTE ---

export default function App() {
  const [meta, setMeta] = useState({
    datum: new Date().toISOString().split('T')[0],
    beginn: '18:15',
    redeleitung: '',
    protokoll: '',
    anhang: '',
    raum: 'A120',
    ort: 'Geschwister-Scholl-Platz 1'
  });

  const [tagesordnung, setTagesordnung] = useState([]);
  const [antraegeRaw, setAntraegeRaw] = useState([]);
  const [mergedData, setMergedData] = useState([]);

  // Handler für Datei-Upload
  const handleFileUpload = (event, type) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const data = parseCSV(e.target.result);
      if (type === 'tagesordnung') {
        const enrichedData = data.map(row => ({
          ...row,
          item_number: (row.item_number || "").replace(/\.0$/, "").trim(),
          title: (row.title || "").trim(),
          slug: slugify((row.item_number || "") + "-" + (row.title || "")),
          text: row.text || row.Text || ""
        }));
        setTagesordnung(enrichedData);
      } else {
        setAntraegeRaw(data);
      }
    };
    reader.readAsText(file);
  };

  // Relationales Mapping: Anträge zu Tagesordnungspunkten zuordnen
  useEffect(() => {
    if (tagesordnung.length > 0) {
      const combined = tagesordnung.map(top => {
        const matchingAntraege = antraegeRaw.filter(a => 
          (a.Titel || "").trim() === top.title || 
          (a.TOP && String(a.TOP).trim() === String(top.item_number).trim())
        ).map(a => ({
          Bezeichner: a.Bezeichner || '',
          Antragsteller: a['Antragsteller*in'] || a.Antragsteller || '',
          Status: a.Status || '',
          Text: a.Text || '',
          Begruendung: a.Begründung || a.Begruendung || ''
        }));
        
        return { ...top, antraege: matchingAntraege };
      });
      setMergedData(combined);
    }
  }, [tagesordnung, antraegeRaw]);

  const handlePrint = () => {
    window.print();
  };

  const formattedPrintDate = () => {
    if (!meta.datum) return "";
    try {
      const dateParts = meta.datum.split('-');
      return `${dateParts[2]}.${dateParts[1]}.${dateParts[0]}`;
    } catch { return meta.datum; }
  };

  const todayStr = new Date().toLocaleDateString('de-DE');

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white font-sans text-gray-800">
      
      {/* --- EDITOR / UI ANSICHT (Wird beim Druck ausgeblendet) --- */}
      <div className="print:hidden max-w-4xl mx-auto p-6 space-y-6">
        
        <div className="flex justify-between items-center bg-[#005030] text-white p-6 rounded-xl shadow-lg">
          <div>
            <h1 className="text-3xl font-bold">Material Generator</h1>
            <p className="text-green-100 mt-1 text-lg">Konvent der Fachschaften, LMU München</p>
          </div>
          <button 
            onClick={handlePrint}
            disabled={mergedData.length === 0}
            className="flex items-center gap-2 bg-white text-[#005030] px-6 py-3 rounded-lg font-bold hover:bg-gray-100 transition shadow disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Printer size={20} /> Sitzungsmaterial generieren
          </button>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-xl font-bold text-[#005030] mb-4 flex items-center gap-2">
            <FileText size={24}/> Rahmendaten erfassen
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Datum der Sitzung</label>
              <input type="date" value={meta.datum} onChange={e => setMeta({...meta, datum: e.target.value})} className="w-full border-gray-300 rounded-md shadow-sm p-2 border focus:ring-[#005030] focus:border-[#005030]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Beginn (Uhrzeit c.t.)</label>
              <input type="time" value={meta.beginn} onChange={e => setMeta({...meta, beginn: e.target.value})} className="w-full border-gray-300 rounded-md shadow-sm p-2 border" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Redeleitung</label>
              <input type="text" value={meta.redeleitung} onChange={e => setMeta({...meta, redeleitung: e.target.value})} className="w-full border-gray-300 rounded-md shadow-sm p-2 border" placeholder="Name(n)..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Protokollführung</label>
              <input type="text" value={meta.protokoll} onChange={e => setMeta({...meta, protokoll: e.target.value})} className="w-full border-gray-300 rounded-md shadow-sm p-2 border" placeholder="Name(n)..." />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Anhang (Optional)</label>
              <input type="text" value={meta.anhang} onChange={e => setMeta({...meta, anhang: e.target.value})} className="w-full border-gray-300 rounded-md shadow-sm p-2 border" placeholder="z.B. Protokoll vom XX.XX.XXXX" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-4 rounded-lg border border-dashed border-gray-300">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Tagesordnung (.csv)</label>
              <input type="file" accept=".csv" onChange={e => handleFileUpload(e, 'tagesordnung')} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:font-semibold file:bg-green-50 file:text-[#005030] hover:file:bg-green-100" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Anträge (.csv) <span className="font-normal text-gray-500">(Optional)</span></label>
              <input type="file" accept=".csv" onChange={e => handleFileUpload(e, 'antraege')} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:font-semibold file:bg-green-50 file:text-[#005030] hover:file:bg-green-100" />
            </div>
          </div>
        </div>

        {mergedData.length > 0 && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="font-bold text-lg mb-4 text-[#005030]">Vorschau (Erkannte Daten)</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {mergedData.map((row, i) => (
                <div key={i} className="flex justify-between items-center p-3 bg-gray-50 rounded border border-gray-100">
                  <span className="font-medium">{row.item_number}: {row.title}</span>
                  <span className="text-xs bg-gray-200 px-2 py-1 rounded-full">{row.antraege.length} Anträge verknüpft</span>
                </div>
              ))}
            </div>
            <div className="mt-4 p-4 bg-blue-50 text-blue-800 rounded flex gap-3 text-sm">
               <AlertCircle className="shrink-0" />
               <p>Die Daten wurden erfolgreich verknüpft. Klicken Sie oben auf <strong>"Sitzungsmaterial generieren"</strong>, um die strukturierte Druckansicht (PDF) zu öffnen.</p>
            </div>
          </div>
        )}
      </div>

      {/* --- DRUCK ANSICHT (Sichtbar nur bei window.print()) --- */}
      <div className="hidden print:block text-black min-h-screen">
        <style dangerouslySetInnerHTML={{__html: `
          @page {
              size: A4;
              margin: 25mm 20mm 20mm 20mm !important; 
          }
          
          /* Basis Reset für präzisen Druck */
          * { 
              -webkit-print-color-adjust: exact !important; 
              print-color-adjust: exact !important; 
              box-sizing: border-box !important;
          }
          
          html, body, .hidden.print\\:block { 
              background-color: #ffffff !important; 
              width: 100% !important; 
              margin: 0 !important;
              padding: 0 !important;
          }
          body { 
              font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; 
              font-size: 11pt; 
              line-height: 1.4; 
              color: #222; 
          }
          
          /* Deckblatt */
          .cover-page { 
              display: flex;
              flex-direction: column;
              align-items: center;
              padding-top: 60mm;
              width: 100%;
              height: 240mm;
              page-break-after: always; 
              break-after: page;
              position: relative; 
              z-index: 1; 
          }
          .cover-content { text-align: center; z-index: 10; width: 100%; }
          .cover-seal {
              position: absolute; top: 20%; left: 10%; width: 80%; height: 60%;
              object-fit: contain; opacity: 0.15; z-index: -1; pointer-events: none;
          }
          
          .institution { font-size: 16pt; font-weight: bold; color: #005030; margin-bottom: 10mm; text-transform: uppercase; letter-spacing: 1px; }
          .title { font-size: 24pt; font-weight: bold; margin-bottom: 5mm; color: #000; }
          .subtitle { font-size: 16pt; color: #555; margin-bottom: 30mm; }
          .event-details { font-size: 12pt; color: #333; margin-bottom: 3mm; line-height: 1.6; }

          /* Kopfzeile (Simuliert via Table-Header für den Wiederholungseffekt) */
          .print-layout-table { width: 100%; border: none !important; margin: 0 !important; }
          .print-layout-table > thead { display: table-header-group; }
          .print-layout-table > tbody { display: table-row-group; }
          .print-layout-table > thead > tr > td, .print-layout-table > tbody > tr > td {
              border: none !important; padding: 0 !important; width: 100%; overflow-wrap: break-word !important; 
          }

          /* Typographie */
          h1 { font-size: 18pt; color: #005030; border-bottom: 2px solid #005030; padding-bottom: 5px; margin-top: 0; page-break-after: avoid; margin-bottom: 20px;}
          h2 { font-size: 14pt; font-weight: bold; margin-top: 25px; margin-bottom: 10px; page-break-after: avoid; }
          h3 { font-size: 11pt; text-transform: uppercase; color: #666; margin-top: 15px; margin-bottom: 5px; page-break-after: avoid; }

          .item-text { margin-bottom: 15px; text-align: justify; hyphens: auto; overflow-wrap: anywhere !important; word-break: break-word !important; }
          .item-text img { max-width: 100% !important; height: auto !important; }
          
          /* Boxen & Tabellen */
          .antrag-box { background-color: #f4f7f6; border-left: 5px solid #005030; padding: 15px 20px; margin-top: 15px; margin-bottom: 20px; page-break-inside: avoid; break-inside: avoid;}
          .antrag-header { font-weight: bold; font-size: 10pt; color: #005030; border-bottom: 1px solid #d0ded8; padding-bottom: 8px; margin-bottom: 12px; }

          table.data-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; page-break-inside: avoid; }
          table.data-table th, table.data-table td { border: 1px solid #ddd; padding: 10px; text-align: left; font-size: 10pt; }
          table.data-table th { background-color: #f2f2f2; }

          table.meta-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; page-break-inside: avoid; }
          table.meta-table th { background-color: transparent; border: none; font-weight: bold; padding: 5px 10px 5px 0; text-align: left;}
          table.meta-table td { border: none; padding: 5px 0; }
          table.meta-table tr { border-bottom: 1px solid #eee; }
          table.meta-table tr:last-child { border-bottom: none; }

          /* TOC */
          .toc-list { list-style-type: none; padding-left: 0; margin-right: 20mm; }
          .toc-item { margin-bottom: 8px; }
          .toc-link { color: #005030; font-weight: bold; text-decoration: none; display: block; }
          
          .page-break { page-break-before: always; break-before: page; }
          
          /* Fallback Styling für fehlende Gesten-Bilder */
          .gesture-fallback { display: inline-flex; align-items: center; justify-content: center; width: 60px; height: 60px; border-radius: 8px; font-weight: bold; font-size: 18pt; color: white; margin: 0 auto;}
        `}} />

        {/* --- DECKBLATT --- */}
        <div className="cover-page">
            {/* Pfad erwartet, dass Siegel.png im public-Ordner der GitHub Page liegt */}
            <img src="Siegel.png" className="cover-seal" alt="" onError={(e) => e.target.style.display = 'none'} />
            <div className="cover-content">
                <div className="institution">Konvent der Fachschaften<br/>Ludwig-Maximilians-Universität München</div>
                <div className="title">Sitzungsmaterial</div>
                <div className="subtitle">Sitzung am {formattedPrintDate()}</div>
                <div className="event-details">Ab {meta.beginn} Uhr c.t. in {meta.raum}</div>
                <div className="event-details">{meta.ort}</div>
                <div style={{fontSize: '12pt', marginTop: '15mm', fontWeight: 'bold'}}>Stand: <span style={{fontWeight: 'normal'}}>{todayStr}</span></div>
            </div>
        </div>

        {/* --- HAUPTDOKUMENT --- */}
        <table className="print-layout-table">
          <thead>
            <tr>
              <td style={{ border: 'none', padding: 0 }}>
                {/* Header-Zeile, die auf jeder Seite wiederholt wird */}
                <div style={{ paddingBottom: '4px', marginBottom: '15px' }}>
                  <table style={{ width: '100%', borderBottom: '1px solid #ddd', paddingBottom: '4px' }}>
                    <tbody>
                      <tr>
                        <td style={{ width: '50%', textAlign: 'left', border: 'none', padding: 0 }}>
                           <img src="Stuve Logo lang.png" alt="StuVe" style={{ height: '35px' }} onError={(e) => e.target.style.display = 'none'} />
                        </td>
                        <td style={{ width: '50%', textAlign: 'right', verticalAlign: 'bottom', border: 'none', padding: 0, color: '#777', fontSize: '9pt' }}>
                          Material für die Sitzung am {formattedPrintDate()}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </td>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ border: 'none', padding: 0, paddingBottom: '30px' }}>
                
                {/* --- VERFAHRENSHINWEISE --- */}
                <h1>Verfahrenshinweise & Handgesten</h1>
                <p>Die folgenden Handgesten erleichtern die Kommunikation während der Sitzung:</p>
                <table className="data-table">
                  <thead>
                    <tr><th width="20%">Geste</th><th width="80%">Bedeutung</th></tr>
                  </thead>
                  <tbody>
                    {GESTEN.map((geste, idx) => (
                      <tr key={idx}>
                        <td style={{ textAlign: 'center', padding: '3px 5px', verticalAlign: 'middle' }}>
                          <object data={geste.img} type="image/png" style={{ width: '85%', maxWidth: '80px', height: 'auto', display: 'block', margin: '0 auto' }}>
                             {/* Fallback, falls Bilddatei auf Github Pages fehlt */}
                             <div className="gesture-fallback" style={{ backgroundColor: geste.color }}>
                                {geste.fallback}
                             </div>
                          </object>
                        </td>
                        <td style={{ verticalAlign: 'middle' }}>
                          <strong>{geste.label}</strong>
                          {geste.text && <><br/>{geste.text}</>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* --- ABKÜRZUNGEN --- */}
                <h1 style={{marginTop: '30px'}}>Wichtige Abkürzungen</h1>
                <table className="data-table">
                  <thead>
                    <tr><th width="30%">Abkürzung</th><th width="70%">Bedeutung</th></tr>
                  </thead>
                  <tbody>
                    {ABKUERZUNGEN.map((abk, idx) => (
                      <tr key={idx}>
                        <td><strong>{abk.k}</strong></td>
                        <td>{abk.v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="page-break"></div>

                {/* --- SITZUNGSÜBERSICHT & TOC --- */}
                <h1>Sitzungsübersicht</h1>
                <table className="meta-table">
                    <tbody>
                      <tr><th width="30%">Datum</th><td width="70%">{formattedPrintDate()}</td></tr>
                      <tr><th>Beginn</th><td>{meta.beginn} Uhr c.t.</td></tr>
                      <tr><th>Redeleitung</th><td>{meta.redeleitung}</td></tr>
                      <tr><th>Protokoll</th><td>{meta.protokoll}</td></tr>
                      {meta.anhang && <tr><th>Anhang</th><td>{meta.anhang}</td></tr>}
                    </tbody>
                </table>

                <h2 style={{marginTop: '40px'}}>Inhaltsverzeichnis</h2>
                <ul className="toc-list">
                    {mergedData.map((row, i) => (
                      <li key={i} className="toc-item">
                        <a href={`#top-${row.slug}`} className="toc-link">
                          {row.item_number}: {row.title}
                        </a>
                      </li>
                    ))}
                </ul>

                <div className="page-break"></div>

                {/* --- TAGESORDNUNG & ANTRÄGE CONTENT --- */}
                <h1>Tagesordnung und Anträge</h1>
                
                {mergedData.map((row, index) => (
                  <div key={index} style={{ marginBottom: '30px' }}>
                    <h2 id={`top-${row.slug}`}>{row.item_number}: {row.title}</h2>
                    
                    {row.text && (
                        <div className="item-text" dangerouslySetInnerHTML={{__html: row.text.replace(/\n/g, '<br/>')}}></div>
                    )}

                    {row.antraege && row.antraege.length > 0 && row.antraege.map((antrag, aIdx) => (
                      <div className="antrag-box" key={aIdx}>
                          <div className="antrag-header">
                              Antrag: {antrag.Bezeichner} | Einreichend: {antrag.Antragsteller} | Status: {antrag.Status}
                          </div>

                          {antrag.Text && (
                            <>
                              <h3>Antragstext / Beschlussfassung</h3>
                              <div className="item-text" dangerouslySetInnerHTML={{__html: antrag.Text.replace(/\n/g, '<br/>')}}></div>
                            </>
                          )}

                          {antrag.Begruendung && (
                            <>
                              <h3>Begründung</h3>
                              <div className="item-text" dangerouslySetInnerHTML={{__html: antrag.Begruendung.replace(/\n/g, '<br/>')}}></div>
                            </>
                          )}
                      </div>
                    ))}
                  </div>
                ))}
                
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
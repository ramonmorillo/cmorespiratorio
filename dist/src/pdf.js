// PDF del informe: lo genera el núcleo CMO (src/cmo-ds/cmo-pdf.js, derivado de este módulo) desde la estructura única de informe.
import {toCoreReport} from './assessment.js';
import {reportToPdf as corePdf, toWinAnsi, textWidth, wrapText} from './cmo-ds/cmo-pdf.js';
import {VERSION} from './clinical.js';
export {toWinAnsi, textWidth, wrapText};

/** Genera el PDF a partir de la estructura de informe de src/report.js. Devuelve Uint8Array. */
export const reportToPdf = r => corePdf(toCoreReport(r, {version: VERSION}));

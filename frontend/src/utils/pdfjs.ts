import * as pdfjsLib from 'pdfjs-dist';
// Vite-specific: bundles the worker as its own asset and gives us its final URL.
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

export default pdfjsLib;

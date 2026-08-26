/**
 * Scoped print → the PDF path every report shares. The browser's print
 * pipeline is the highest-fidelity, zero-dependency PDF engine available;
 * the `.brf-print-root` / `.brf-no-print` CSS (index.css) scopes it to just
 * the report element so the app chrome never ships in the file.
 */
export function printScoped(): void {
  document.body.classList.add('brf-printing');
  const cleanup = () => {
    document.body.classList.remove('brf-printing');
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  window.print();
}

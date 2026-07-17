/* Dashboard – je Firma eigene Kacheln. */
import { registriere } from '../kern/registry.js';
import { nochNichtPortiert, sicher } from '../kern/ui.js';

registriere({
  id: 'dashboard',
  titel: 'Dashboard',
  zeichen: '▦',
  rollen: ['admin', 'leitung'],
  render: (ctx) => `
    <div class="karte" style="margin-bottom:20px">
      <div style="font-size:13px;color:var(--muted);font-weight:600">Angemeldet in</div>
      <div style="font-size:22px;font-weight:800;margin-top:4px">${sicher(ctx.firma.firma)}</div>
      <div style="font-size:14px;color:var(--muted);margin-top:6px">
        ${sicher(ctx.firma.strasse ?? '')} · ${sicher(ctx.firma.plz ?? '')} ${sicher(ctx.firma.ort ?? '')}
      </div>
    </div>
    ${nochNichtPortiert('Kennzahlen', 'src/module/dashboard.js')}`,
});

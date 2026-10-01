// The same solved, nonlinear scale is used by live and offline CFD views.
export function renderPressureLegend(legend, report) {
  const scale = report?.pressureColorNormalization;
  if (!scale?.linearRgbAnchors || !report.pressureRangePa) return;
    const srgb = (channel) => Math.round(255 * (channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055));
    // Preserve the solved field's linear-RGB transfer and nonlinear ticks.
    const gradient = Array.from({ length: 65 }, (_, i) => {
      const position = i / 64;
      const end = Math.min(scale.positions.length - 1, Math.max(1, scale.positions.findIndex((entry) => entry >= position)));
      const start = end - 1;
      const mix = (position - scale.positions[start]) / (scale.positions[end] - scale.positions[start]);
      const color = scale.linearRgbAnchors[start].slice(0, 3).map((channel, j) => channel + mix * (scale.linearRgbAnchors[end][j] - channel));
      return `rgb(${color.map(srgb).join(',')}) ${position * 100}%`;
    });
    const heading = document.createElement('p');
    heading.textContent = 'Gauge pressure · Pa';
    const bar = document.createElement('div');
    bar.className = 'case-3d-legend-bar';
    bar.style.background = `linear-gradient(90deg,${gradient.join(',')})`;
    const labels = document.createElement('div');
    labels.className = 'case-3d-legend-ticks';
    const [minimum, maximum] = report.pressureRangePa;
    for (const pressure of scale.legendTicksPa) {
      const normalized = pressure < 0 ? .5 - .5 * Math.asinh(-pressure / scale.scalePa) / Math.asinh(-minimum / scale.scalePa) : .5 + .5 * Math.asinh(pressure / scale.scalePa) / Math.asinh(maximum / scale.scalePa);
      const label = document.createElement('span');
      label.style.left = `${normalized * 100}%`;
      label.textContent = Math.round(pressure).toLocaleString('en-US');
      labels.append(label);
    }
    const note = document.createElement('small');
    note.textContent = 'Nonlinear scale · Steady solved field';
    legend.replaceChildren(heading, bar, labels, note);
    legend.hidden = false;
}

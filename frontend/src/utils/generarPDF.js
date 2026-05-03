/**
 * Lakshmi Q2 - Gestión de Inversiones
 * Módulo: Portafolios
 * Autor: Luis Yhaser Olmos Torres
 * Institución: Tecnológico de Monterrey
 * Fecha de creación: 2026-05-03
 *
 * Genera un PDF con el reporte del portafolio incluyendo gráficas.
 */
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import Plotly from 'plotly.js/dist/plotly';


const ACCENT = [59, 130, 246];
const GRAY = [156, 163, 175];
const DARK = [17, 24, 39];

/**
 * Captura todas las gráficas Plotly visibles en el DOM como imágenes PNG base64.
 * @returns {Promise<string[]>} Array de data URLs
 */
async function capturarGraficas() {
  const plots = document.querySelectorAll('.js-plotly-plot');
  const images = [];
  for (const plot of plots) {
    try {
      const url = await Plotly.toImage(plot, { format: 'jpeg', width: 600, height: 250, scale: 1 });
      images.push(url);
    } catch {
      // Skip plots that can't be captured
    }
  }
  return images;
}

export default async function generarPDFPortafolio({ portafolio, posiciones, transacciones }) {
  // Capturar gráficas ANTES de generar el PDF
  const graficas = await capturarGraficas();

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  let y = 15;

  // ─── Header ───────────────────────────────────────────────────
  doc.setFillColor(...DARK);
  doc.rect(0, 0, W, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Lakshmi Q2', 14, 12);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Reporte de Portafolio', 14, 18);
  doc.setTextColor(...GRAY);
  doc.text(new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }), 14, 24);
  doc.text(`Portafolio: ${portafolio.nombre}`, W - 14, 18, { align: 'right' });
  doc.text(`Moneda: ${portafolio.moneda || 'USD'}`, W - 14, 24, { align: 'right' });
  y = 36;

  // ─── Resumen ──────────────────────────────────────────────────
  const activas = (posiciones || []).filter(p => p.cantidad > 0 && p.precio_actual > 0);
  const valorTotal = activas.reduce((s, p) => s + (p.valor_mercado || p.precio_actual * p.cantidad), 0);
  const pnlTotal = activas.reduce((s, p) => s + (p.pnl_bruto || 0), 0);

  y = seccion(doc, 'Resumen General', y);
  doc.autoTable({
    startY: y,
    body: [
      ['Valor Total', `$${fmt(valorTotal)}`],
      ['Posiciones Activas', `${activas.length}`],
      ['P&L Bruto Total', `$${fmt(pnlTotal)}`],
      ['Capital Inicial', `$${fmt(portafolio.capital_inicial || 0)}`],
    ],
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 2, textColor: [30, 30, 30] },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } },
    margin: { left: 14, right: 14 },
  });
  y = doc.lastAutoTable.finalY + 6;

  // ─── Posiciones ───────────────────────────────────────────────
  y = seccion(doc, 'Posiciones', y);
  if (activas.length > 0) {
    doc.autoTable({
      startY: y,
      head: [['Ticker', 'Cant.', 'Precio Prom.', 'Precio Actual', 'Valor', 'P&L', 'P&L %']],
      body: activas.map(p => [
        p.ticker, fmt(p.cantidad, 0), `$${fmt(p.precio_promedio)}`, `$${fmt(p.precio_actual)}`,
        `$${fmt(p.valor_mercado || p.precio_actual * p.cantidad)}`, `$${fmt(p.pnl_bruto)}`, `${fmt(p.pnl_porcentual)}%`,
      ]),
      headStyles: { fillColor: ACCENT, textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 2 },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  // ─── Gráficas de la pestaña activa ────────────────────────────
  if (graficas.length > 0) {
    y = checkPage(doc, y, 80);
    y = seccion(doc, 'Gráficas', y);
    const chartW = W - 28; // margins
    const chartH = 55;

    for (const img of graficas) {
      y = checkPage(doc, y, chartH + 8);
      try {
        doc.addImage(img, 'JPEG', 14, y, chartW, chartH);
        y += chartH + 4;
      } catch {
        // Skip if image can't be added
      }
    }
    y += 4;
  }

  // ─── Transacciones recientes ──────────────────────────────────
  const txList = transacciones?.items || transacciones?.transacciones || [];
  if (txList.length > 0) {
    y = checkPage(doc, y, 40);
    y = seccion(doc, 'Transacciones Recientes (últimas 20)', y);
    doc.autoTable({
      startY: y,
      head: [['Fecha', 'Ticker', 'Tipo', 'Cantidad', 'Precio', 'Total']],
      body: txList.slice(0, 20).map(tx => [
        tx.fecha?.substring(0, 10) || '—', tx.ticker, tx.tipo, fmt(tx.cantidad, 0),
        `$${fmt(tx.precio_unitario)}`, `$${fmt((tx.cantidad || 0) * (tx.precio_unitario || 0))}`,
      ]),
      headStyles: { fillColor: ACCENT, textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 2 },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  // ─── Dashboard (métricas + gráficas generadas) ────────────────
  if (activas.length >= 2) {
    try {
      const res = await fetch(`/api/portafolios/${portafolio.id}/dashboard`);
      if (res.ok) {
        const dash = await res.json();
        y = checkPage(doc, y, 60);
        y = seccion(doc, 'Dashboard — Métricas de Riesgo', y);

        const m = dash.metricas;
        const metricasData = [
          ['Rendimiento Anual', `${m.rendimiento}%`],
          ['Riesgo (Volatilidad)', `${m.riesgo}%`],
          ['Sharpe Ratio', `${m.sharpe}`],
          ['Sortino Ratio', `${m.sortino}`],
          ['Beta vs SPY', `${m.beta}`],
          ['Max Drawdown', `${m.max_drawdown}%`],
          ['VaR 99% Diario', `$${m.var.diario_usd} (${m.var.diario}%)`],
          ['VaR 99% Anual', `$${m.var.anual_usd} (${m.var.anual}%)`],
        ];
        if (dash.twr) {
          metricasData.push(['TWR (Rend. Real)', `${dash.twr.twr_total}% (${dash.twr.dias} días)`]);
          metricasData.push(['TWR Anualizado', `${dash.twr.twr_anualizado}%`]);
        }
        doc.autoTable({
          startY: y, body: metricasData, theme: 'plain',
          styles: { fontSize: 9, cellPadding: 2 },
          columnStyles: { 0: { fontStyle: 'bold', cellWidth: 55 } },
          margin: { left: 14, right: 14 },
        });
        y = doc.lastAutoTable.finalY + 4;

        // Pesos + contribución al riesgo
        if (dash.pesos) {
          y = checkPage(doc, y, 30);
          y = seccion(doc, 'Pesos y Contribución al Riesgo', y);
          doc.autoTable({
            startY: y,
            head: [['Ticker', 'Peso (%)', 'Contrib. Riesgo (%)']],
            body: dash.tickers.map(t => [t, `${dash.pesos[t]}%`, `${dash.risk_contrib[t]}%`]),
            headStyles: { fillColor: ACCENT, textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
            styles: { fontSize: 8, cellPadding: 2 },
            margin: { left: 14, right: 14 },
          });
          y = doc.lastAutoTable.finalY + 4;
        }

        // Generar gráficas del dashboard off-screen con Plotly
        const dashCharts = await generarGraficasDashboard(dash);
        if (dashCharts.length > 0) {
          y = checkPage(doc, y, 60);
          y = seccion(doc, 'Gráficas del Dashboard', y);
          const cW = (W - 32) / 2;
          const cH = 45;
          for (let i = 0; i < dashCharts.length; i += 2) {
            y = checkPage(doc, y, cH + 8);
            try { doc.addImage(dashCharts[i].img, 'JPEG', 14, y, cW, cH); } catch {}
            if (dashCharts[i + 1]) {
              try { doc.addImage(dashCharts[i + 1].img, 'JPEG', 18 + cW, y, cW, cH); } catch {}
            }
            // Labels
            doc.setFontSize(7); doc.setTextColor(...GRAY);
            doc.text(dashCharts[i].label, 14, y + cH + 3);
            if (dashCharts[i + 1]) doc.text(dashCharts[i + 1].label, 18 + cW, y + cH + 3);
            y += cH + 8;
          }
        }

        // Resumen técnico
        if (dash.resumen_tecnico?.length > 0) {
          y = checkPage(doc, y, 30);
          y = seccion(doc, 'Resumen Técnico por Activo', y);
          doc.autoTable({
            startY: y,
            head: [['Ticker', 'Precio', 'RSI', 'MACD', 'SMA 50', 'Tendencia', 'Señales']],
            body: dash.resumen_tecnico.map(t => [
              t.ticker, t.error ? '—' : `$${t.precio}`, t.rsi ?? '—',
              t.macd_histograma != null ? t.macd_histograma.toFixed(2) : '—',
              t.sma50 ?? '—', t.tendencia || '—', (t.señales || []).join(', ') || '—',
            ]),
            headStyles: { fillColor: ACCENT, textColor: [255, 255, 255], fontSize: 7, fontStyle: 'bold' },
            styles: { fontSize: 7, cellPadding: 2 },
            margin: { left: 14, right: 14 },
          });
        }
      }
    } catch { /* dashboard fetch failed */ }
  }

  // ─── Footer ───────────────────────────────────────────────────
  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text(`Lakshmi Q2 — Generado el ${new Date().toLocaleString('es-MX')}`, 14, H - 8);
    doc.text(`Página ${i} de ${pages}`, W - 14, H - 8, { align: 'right' });
  }

  doc.save(`Portafolio_${portafolio.nombre.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ─── Generar gráficas del dashboard off-screen ──────────────────
async function generarGraficasDashboard(dash) {
  const charts = [];
  const opts = { format: 'jpeg', width: 500, height: 220, scale: 1 };
  const layout = { paper_bgcolor: '#ffffff', plot_bgcolor: '#f9fafb', font: { size: 10, color: '#374151' }, margin: { t: 10, r: 10, b: 30, l: 50 }, showlegend: false };

  // Crecimiento de $1
  if (dash.historico?.fechas?.length > 0) {
    const div = document.createElement('div');
    document.body.appendChild(div);
    await Plotly.newPlot(div, [{ x: dash.historico.fechas, y: dash.historico.crecimiento, type: 'scatter', mode: 'lines', line: { color: '#3b82f6', width: 2 }, fill: 'tozeroy', fillcolor: 'rgba(59,130,246,0.1)' }], { ...layout }, { staticPlot: true });
    const img = await Plotly.toImage(div, opts);
    charts.push({ img, label: 'Crecimiento de $1' });
    Plotly.purge(div); div.remove();
  }

  // Drawdown
  if (dash.historico?.drawdown?.length > 0) {
    const div = document.createElement('div');
    document.body.appendChild(div);
    await Plotly.newPlot(div, [{ x: dash.historico.fechas, y: dash.historico.drawdown, type: 'scatter', mode: 'lines', fill: 'tozeroy', line: { color: '#ef4444', width: 1.5 }, fillcolor: 'rgba(239,68,68,0.15)' }], { ...layout, yaxis: { ...layout.yaxis, title: '%' } }, { staticPlot: true });
    const img = await Plotly.toImage(div, opts);
    charts.push({ img, label: 'Drawdown' });
    Plotly.purge(div); div.remove();
  }

  // TWR
  if (dash.twr?.fechas?.length > 0) {
    const div = document.createElement('div');
    document.body.appendChild(div);
    const color = dash.twr.twr_total >= 0 ? '#10b981' : '#ef4444';
    await Plotly.newPlot(div, [{ x: dash.twr.fechas, y: dash.twr.valores, type: 'scatter', mode: 'lines', line: { color, width: 2 }, fill: 'tozeroy', fillcolor: dash.twr.twr_total >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)' }], { ...layout, yaxis: { ...layout.yaxis, title: '%', zeroline: true } }, { staticPlot: true });
    const img = await Plotly.toImage(div, opts);
    charts.push({ img, label: `TWR: ${dash.twr.twr_total}%` });
    Plotly.purge(div); div.remove();
  }

  // Correlación heatmap
  if (dash.correlacion && dash.tickers?.length >= 2) {
    const t = dash.tickers;
    const z = t.map(t1 => t.map(t2 => dash.correlacion[t1]?.[t2] ?? 0));
    const div = document.createElement('div');
    document.body.appendChild(div);
    await Plotly.newPlot(div, [{ z, x: t, y: t, type: 'heatmap', colorscale: 'RdYlGn', zmin: -1, zmax: 1 }], { ...layout, margin: { t: 10, r: 60, b: 60, l: 60 } }, { staticPlot: true });
    const img = await Plotly.toImage(div, opts);
    charts.push({ img, label: 'Correlación' });
    Plotly.purge(div); div.remove();
  }

  return charts;
}

// ─── Helpers ────────────────────────────────────────────────────
function seccion(doc, titulo, y) {
  doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(...ACCENT);
  doc.text(titulo, 14, y);
  doc.setDrawColor(...ACCENT); doc.setLineWidth(0.3);
  doc.line(14, y + 1.5, doc.internal.pageSize.getWidth() - 14, y + 1.5);
  return y + 6;
}

function checkPage(doc, y, needed) {
  if (y + needed > doc.internal.pageSize.getHeight() - 15) { doc.addPage(); return 15; }
  return y;
}

function fmt(val, decimals = 2) {
  if (val == null || isNaN(val)) return '—';
  return Number(val).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

import { useRef, useEffect, useCallback } from 'react';
import Plotly from 'plotly.js/dist/plotly';

/**
 * Wrapper that makes a Plotly chart resizable via native CSS resize.
 * Uses ResizeObserver + direct Plotly.Plots.resize() to redraw charts
 * when the container size changes.
 *
 * Key insight: react-plotly.js only listens to window.resize events,
 * NOT container resize. We must call Plotly.Plots.resize() directly
 * using the imported Plotly module (not window.Plotly which doesn't exist).
 */
export default function ResizableChart({ defaultHeight = 300, children }) {
  const containerRef = useRef(null);
  const rafRef = useRef(null);

  const triggerResize = useCallback(() => {
    if (!containerRef.current) return;
    // Find all Plotly chart elements inside this container
    const plots = containerRef.current.querySelectorAll('.js-plotly-plot');
    plots.forEach((plotEl) => {
      try {
        Plotly.Plots.resize(plotEl);
      } catch {
        // Chart might not be fully initialized yet
      }
    });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver(() => {
      // Use requestAnimationFrame to batch resize calls
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(triggerResize);
    });

    observer.observe(el);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
  }, [triggerResize]);

  return (
    <div
      ref={containerRef}
      className="rounded-lg bg-bloomberg-panel border border-white/5 resizable-chart"
      style={{
        height: `${defaultHeight}px`,
        minHeight: '150px',
        minWidth: '200px',
        resize: 'both',
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  );
}

import { useState } from 'react';
import Spinner from '../common/Spinner';
import ErrorMessage from '../common/ErrorMessage';
import Badge from '../common/Badge';

/**
 * Cuestionario de perfil de riesgo — 5 preguntas con 4 opciones cada una.
 * Muestra barra de progreso y resultado con nombre de perfil y descripción.
 *
 * @param {object} props
 * @param {function} props.onComplete - Callback con { perfil, puntaje, descripcion }
 *
 * Valida: Requisitos 7.1
 */

const PREGUNTAS = [
  {
    id: 1,
    texto: '¿Cuál es su horizonte de inversión?',
    opciones: [
      { valor: 1, texto: 'Menos de 1 año' },
      { valor: 2, texto: '1 a 3 años' },
      { valor: 3, texto: '3 a 5 años' },
      { valor: 4, texto: 'Más de 5 años' },
    ],
  },
  {
    id: 2,
    texto: '¿Qué porcentaje de pérdida temporal toleraría?',
    opciones: [
      { valor: 1, texto: 'Menos del 5%' },
      { valor: 2, texto: 'Entre 5% y 15%' },
      { valor: 3, texto: 'Entre 15% y 30%' },
      { valor: 4, texto: 'Más del 30%' },
    ],
  },
  {
    id: 3,
    texto: '¿Cuál es su objetivo principal de inversión?',
    opciones: [
      { valor: 1, texto: 'Preservar capital' },
      { valor: 2, texto: 'Generar ingreso' },
      { valor: 3, texto: 'Crecimiento' },
      { valor: 4, texto: 'Máximo crecimiento' },
    ],
  },
  {
    id: 4,
    texto: '¿Cuál es su experiencia invirtiendo?',
    opciones: [
      { valor: 1, texto: 'Ninguna' },
      { valor: 2, texto: 'Básica' },
      { valor: 3, texto: 'Intermedia' },
      { valor: 4, texto: 'Avanzada' },
    ],
  },
  {
    id: 5,
    texto: 'Si su portafolio cayera un 20%, ¿qué haría?',
    opciones: [
      { valor: 1, texto: 'Vendo todo' },
      { valor: 2, texto: 'Vendo una parte' },
      { valor: 3, texto: 'Mantengo posiciones' },
      { valor: 4, texto: 'Compro más' },
    ],
  },
];

const PERFIL_VARIANTE = {
  'Ultra Conservador': 'rojo',
  Conservador: 'amarillo',
  Moderado: 'azul',
  Balanceado: 'verde',
  Agresivo: 'verde',
};

export default function RiskProfileForm({ onComplete }) {
  const [respuestas, setRespuestas] = useState({});
  const [resultado, setResultado] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const totalPreguntas = PREGUNTAS.length;
  const respondidas = Object.keys(respuestas).length;
  const progreso = Math.round((respondidas / totalPreguntas) * 100);
  const todasRespondidas = respondidas === totalPreguntas;

  const handleSeleccion = (preguntaId, valor) => {
    setRespuestas((prev) => ({ ...prev, [preguntaId]: valor }));
  };

  const handleSubmit = async () => {
    if (!todasRespondidas) return;

    setLoading(true);
    setError(null);

    try {
      const listaRespuestas = PREGUNTAS.map((p) => respuestas[p.id]);
      const res = await fetch('/api/wizard/perfil', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ respuestas: listaRespuestas }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al calcular perfil');

      setResultado(data);
      if (onComplete) onComplete(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Spinner mensaje="Calculando perfil de riesgo..." />;

  if (resultado) {
    return (
      <div className="space-y-4" role="region" aria-label="Resultado del perfil de riesgo">
        <div className="bg-bloomberg-panel rounded-xl border border-white/10 p-6 text-center">
          <p className="text-bloomberg-text-muted text-sm mb-2">Su perfil de riesgo es</p>
          <h3 className="text-2xl font-bold text-bloomberg-text mb-3">
            {resultado.perfil}
          </h3>
          <Badge
            texto={`Puntaje: ${resultado.puntaje} / 20`}
            variante={PERFIL_VARIANTE[resultado.perfil] || 'azul'}
          />
          <p className="text-bloomberg-text-muted mt-4 text-sm leading-relaxed">
            {resultado.descripcion}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" role="form" aria-label="Cuestionario de perfil de riesgo">
      {/* Barra de progreso */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-bloomberg-text-muted">
          <span>Progreso</span>
          <span>{respondidas} de {totalPreguntas} preguntas</span>
        </div>
        <div
          className="w-full h-2 bg-white/5 rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={progreso}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Progreso del cuestionario: ${progreso}%`}
        >
          <div
            className="h-full bg-bloomberg-accent rounded-full transition-all duration-300"
            style={{ width: `${progreso}%` }}
          />
        </div>
      </div>

      {error && <ErrorMessage mensaje={error} onReintentar={() => setError(null)} />}

      {/* Preguntas */}
      {PREGUNTAS.map((pregunta, idx) => (
        <fieldset
          key={pregunta.id}
          className="bg-bloomberg-panel rounded-xl border border-white/10 p-5"
        >
          <legend className="text-bloomberg-text font-medium text-sm mb-3">
            <span className="text-bloomberg-accent mr-2">{idx + 1}.</span>
            {pregunta.texto}
          </legend>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {pregunta.opciones.map((opcion) => {
              const seleccionada = respuestas[pregunta.id] === opcion.valor;
              return (
                <button
                  key={opcion.valor}
                  type="button"
                  onClick={() => handleSeleccion(pregunta.id, opcion.valor)}
                  className={`px-4 py-3 rounded-lg border text-sm text-left transition-all
                    ${
                      seleccionada
                        ? 'border-bloomberg-accent bg-bloomberg-accent/15 text-bloomberg-accent'
                        : 'border-white/10 bg-white/5 text-bloomberg-text hover:border-white/20 hover:bg-white/10'
                    }`}
                  role="radio"
                  aria-checked={seleccionada}
                  aria-label={opcion.texto}
                >
                  {opcion.texto}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}

      {/* Botón enviar */}
      <button
        onClick={handleSubmit}
        disabled={!todasRespondidas}
        className={`w-full py-3 rounded-lg font-medium text-sm transition-all
          ${
            todasRespondidas
              ? 'bg-bloomberg-accent text-white hover:bg-bloomberg-accent/80 cursor-pointer'
              : 'bg-white/5 text-bloomberg-text-muted cursor-not-allowed'
          }`}
        aria-label="Calcular perfil de riesgo"
      >
        Calcular Perfil de Riesgo
      </button>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

const COLOR_CLAVE = "#003366";
const COLOR_MIX = "#8ecae6";
const COLOR_TECNO = "#009bde";

const CORTES = [
  { id: "lk7", nombre: "LK7", detalle: "Todos los colores, Lamborghini incluido.", color: COLOR_CLAVE },
  { id: "lambo", nombre: "LK7 Lamborghini Black", detalle: "Solo el color LAMBORGHINI BLACK.", color: COLOR_MIX },
  { id: "lk7k", nombre: "LK7K", detalle: "El otro modelo clave.", color: COLOR_TECNO },
];

function tarjeta(grupo) {
  if (!grupo) return null;
  return grupo;
}

export default function Cobertura() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/cobertura", { cache: "no-store" })
      .then(async (respuesta) => {
        if (!respuesta.ok) throw new Error("lectura");
        setDatos(await respuesta.json());
      })
      .catch(() => setError("No se pudo leer la cobertura."));
  }, []);

  return (
    <section>
      <div className="encabezado">
        <div>
          <h1>Cobertura</h1>
          <p className="ciclo">
            {datos?.referenciaTexto && datos?.cierreTexto
              ? `Tiendas con stock al ${datos.referenciaTexto}. Pronóstico al ${datos.cierreTexto}.`
              : "Tiendas del circuito con al menos un teléfono clave."}
          </p>
        </div>
        <div className="actualizar">
          {datos?.actualizadoTexto ? (
            <p className="sub">
              Última actualización {datos.actualizadoTexto}. {datos.filasDatos} ingresos en Datos · {datos.tiendas} tiendas · Top 300: {datos.top300}.
            </p>
          ) : null}
        </div>
      </div>
      {error ? <p className="aviso fallo">{error}</p> : null}
      {!datos && !error ? <p className="aviso">Cargando cobertura…</p> : null}
      {datos ? (
        <>
          <p className="sub explicacion">
            Una tienda cubierta es la que ya tiene al menos una unidad. El ritmo son las tiendas que pasaron de cero a cubiertas en los últimos 7 días. Al cierre se suma ese ritmo por los {datos.diasFaltan} días que faltan, sin pasar del total. El IMEI se queda en el Excel y no se publica aquí.
          </p>
          <div className="dos-conteos">
            {CORTES.map((corte) => {
              const todas = tarjeta(datos.grupos?.[corte.id]?.todas);
              const top = tarjeta(datos.grupos?.[corte.id]?.top300);
              if (!todas) return null;
              return (
                <article key={corte.id} className="panel">
                  <h2>{corte.nombre}</h2>
                  <p className="sub explicacion">{corte.detalle}</p>
                  <div className="numeros">
                    <article>
                      <span>Cubiertas</span>
                      <strong style={{ color: corte.color }}>
                        {todas.cubiertas} · {todas.pct}%
                      </strong>
                    </article>
                    <article>
                      <span>Al cierre</span>
                      <strong>{todas.cierre}</strong>
                    </article>
                  </div>
                  <div className="corte-leyenda">
                    <span>
                      <i style={{ background: corte.color }} />
                      Todas {todas.cubiertas} de {todas.total} · ritmo {todas.ritmo}/día · nuevas 7 días {todas.nuevas7}
                    </span>
                  </div>
                  {top ? (
                    <div className="corte-leyenda">
                      <span>
                        <i style={{ background: COLOR_TECNO }} />
                        Top 300: {top.cubiertas} de {top.total} ({top.pct}%) · al cierre {top.cierre}
                      </span>
                    </div>
                  ) : null}
                  <p className="sub">Cantidad en tienda: {todas.cantidad}.</p>
                </article>
              );
            })}
          </div>
        </>
      ) : null}
    </section>
  );
}

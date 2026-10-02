"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";

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

async function esExcel(archivo) {
  const firma = new Uint8Array(await archivo.slice(0, 2).arrayBuffer());
  return firma[0] === 0x50 && firma[1] === 0x4b;
}

export default function Cobertura() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const archivoRef = useRef(null);

  function cargar() {
    return fetch("/api/cobertura", { cache: "no-store" })
      .then(async (respuesta) => {
        if (!respuesta.ok) throw new Error("lectura");
        setDatos(await respuesta.json());
        setError("");
      })
      .catch(() => setError("No se pudo leer la cobertura."));
  }

  useEffect(() => {
    cargar();
  }, []);

  async function subirExcel(evento) {
    const archivo = evento.target.files?.[0];
    evento.target.value = "";
    if (!archivo) return;
    if (!archivo.name.toLowerCase().endsWith(".xlsx") || !(await esExcel(archivo))) {
      setAviso("El archivo tiene que ser un Excel .xlsx.");
      return;
    }
    setSubiendo(true);
    setAviso("");
    try {
      await upload("cobertura/actual.xlsx", archivo, {
        access: "private",
        handleUploadUrl: "/api/cobertura/subir",
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        multipart: archivo.size > 4 * 1024 * 1024,
      });
      await cargar();
      setAviso("Excel subido. La fecha de actualización ya es la de esta subida.");
    } catch {
      setAviso("No se pudo subir el Excel.");
    } finally {
      setSubiendo(false);
    }
  }

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
              Última actualización {datos.actualizadoTexto}. Datos del Excel hasta {datos.referenciaTexto}.
            </p>
          ) : null}
        </div>
      </div>
      {aviso ? <p className="aviso">{aviso}</p> : null}
      {error ? <p className="aviso fallo">{error}</p> : null}
      {!datos && !error ? <p className="aviso">Cargando cobertura…</p> : null}
      {datos ? (
        <article className="panel lista-archivos">
          <h2>
            {datos.referenciaTexto && datos.cierreTexto
              ? `Reporte del ${datos.referenciaTexto} – ${datos.cierreTexto}`
              : "Reporte de cobertura"}
          </h2>
          <div className="reporte-actual">
            <div>
              <p className="sub">Total {datos.filasDatos} registros.</p>
              <p className="sub">
                Abre el libro de este reporte
                {datos.referenciaTexto && datos.cierreTexto
                  ? `, del ${datos.referenciaTexto} al ${datos.cierreTexto},`
                  : ""}{" "}
                en el navegador.
              </p>
              <p className="sub">
                {datos.tiendas} tiendas · Top 300: {datos.top300}. Para cambiar el libro, edítalo en Excel, ciérralo y súbelo. La fecha de arriba pasa a ser la de esa subida.
              </p>
            </div>
            <div className="reporte-acciones">
              <label className={`btn secundario${subiendo ? " ocupado" : ""}`}>
                {subiendo ? "Subiendo…" : "Subir Excel"}
                <input
                  ref={archivoRef}
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  hidden
                  disabled={subiendo}
                  onChange={subirExcel}
                />
              </label>
              <Link className="btn" href="/cobertura/libro">
                Abrir el Excel
              </Link>
            </div>
          </div>
        </article>
      ) : null}
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

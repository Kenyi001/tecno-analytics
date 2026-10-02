"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const COLOR_CLAVE = "#003366";
const COLOR_MIX = "#8ecae6";

function esClave(nombre) {
  return /^lk7k?$/i.test(String(nombre || "").trim());
}

function partesDe(items) {
  const suma = items.reduce((total, item) => total + item.ventas, 0);
  if (!suma) return items.map((item) => ({ ...item, parte: 0 }));
  const partes = items.map((item) => ({ ...item, parte: Math.round((item.ventas / suma) * 100) }));
  const ajuste = 100 - partes.reduce((total, item) => total + item.parte, 0);
  if (partes.length) partes[partes.length - 1].parte += ajuste;
  return partes;
}

function anchosDe(grupos, total) {
  if (!total) return grupos.map(() => 0);
  const anchos = grupos.map((grupo) => {
    const suma = grupo.partes.reduce((acumulado, parte) => acumulado + parte.ventas, 0);
    return Math.round((suma / total) * 100);
  });
  if (anchos.length) anchos[anchos.length - 1] += 100 - anchos.reduce((a, n) => a + n, 0);
  return anchos;
}

function formatoBs(valor) {
  if (valor == null) return "—";
  return new Intl.NumberFormat("es-BO", {
    style: "currency",
    currency: "BOB",
    minimumFractionDigits: 2,
  })
    .format(valor)
    .replace("BOB", "Bs");
}

function numero(valor) {
  return new Intl.NumberFormat("es-BO").format(valor ?? 0);
}

function flechaDe(tendencia) {
  if (tendencia === "sube") return "▲";
  if (tendencia === "baja") return "▼";
  return "·";
}

function LeyendaClave() {
  return (
    <div className="corte-leyenda">
      <span>
        <i style={{ background: COLOR_CLAVE }} />
        Clave, LK7 y LK7K
      </span>
      <span>
        <i style={{ background: COLOR_MIX }} />
        MIX, los demás modelos
      </span>
    </div>
  );
}

function Barras({ items, colorDe, base, ancha, conDelta }) {
  const suma = base || items.reduce((total, item) => total + item.ventas, 0) || 1;
  return (
    <ul className={ancha ? "barras anchas" : "barras"}>
      {items.map((item) => {
        const parte = Math.round((item.ventas / suma) * 100);
        const delta =
          conDelta && item.deltaPp != null
            ? ` ${flechaDe(item.tendencia)}${item.deltaPp > 0 ? "+" : ""}${item.deltaPp} pp`
            : "";
        return (
          <li key={item.nombre}>
            <span className="barra-nombre" title={item.nombre}>
              {item.nombre}
            </span>
            <span className="barra-riel">
              <span style={{ width: `${parte}%`, background: colorDe?.(item.nombre) }} />
            </span>
            <span className="barra-num">
              {item.ventas} · {parte}%{delta}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function CruceCompacto({ grupos, total, insight }) {
  const anchos = anchosDe(grupos, total);
  return (
    <div className="cruce-compacto">
      <ul className="cruce">
        {grupos.map((grupo, indice) => {
          const suma = grupo.partes.reduce((acumulado, parte) => acumulado + parte.ventas, 0);
          const partes = partesDe(grupo.partes);
          return (
            <li key={grupo.nombre}>
              <div className="cruce-cabeza">
                <strong>{grupo.nombre}</strong>
                <span>
                  {suma} · {anchos[indice]}%
                </span>
              </div>
              <div className="cruce-pista">
                <div className="cruce-barra" style={{ width: `${Math.max(0, anchos[indice])}%` }}>
                  {partes.map((parte) => (
                    <span
                      key={parte.nombre}
                      style={{
                        width: `${parte.parte}%`,
                        background: parte.nombre === "Clave" ? COLOR_CLAVE : COLOR_MIX,
                      }}
                    />
                  ))}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <LeyendaClave />
      {insight ? (
        <p className="insight">
          TECNO aporta el {insight.pctClaveTecno}% de la Clave con el {insight.pctVolumenTecno}% del volumen.
        </p>
      ) : null}
    </div>
  );
}

function LecturaPrincipal({ proyeccion, vsAnterior, finTexto }) {
  if (!proyeccion) return null;
  const base = proyeccion.totalProyectado;
  const lo = proyeccion.conservador;
  const hi = proyeccion.optimista;
  let ritmoFrase = "Pocos datos para comparar el ritmo de 7 días.";
  if (!proyeccion.pocosDatos && proyeccion.deltaRitmoPct != null) {
    const abs = Math.abs(proyeccion.deltaRitmoPct);
    const lado = proyeccion.deltaRitmoPct < 0 ? "bajo" : "sobre";
    ritmoFrase = `Los últimos 7 días van ${abs}% ${lado} el ritmo del ciclo.`;
  }
  const semaforo = vsAnterior?.semaforo || "igual";
  return (
    <article className={`panel lectura semaforo-${semaforo}`}>
      <p className="lectura-kicker">Proyección al cierre · {finTexto}</p>
      <p className="lectura-numero">
        Cierre estimado ~{numero(base)}
        <span className="lectura-rango">
          {" "}
          (rango {numero(lo)} a {numero(hi)})
        </span>
      </p>
      <p className="sub lectura-frase">{ritmoFrase}</p>
      {vsAnterior ? (
        <p className="sub vs-anterior">
          Vs cierre ciclo anterior ({numero(vsAnterior.cierreAnterior)}, al {vsAnterior.cierreTexto}):{" "}
          {vsAnterior.delta > 0 ? "+" : ""}
          {numero(vsAnterior.delta)} ({vsAnterior.pct > 0 ? "+" : ""}
          {vsAnterior.pct}%)
        </p>
      ) : (
        <p className="sub vs-anterior">Sin cierre del ciclo anterior para comparar.</p>
      )}
    </article>
  );
}

function RangoProyeccion({ proyeccion }) {
  if (!proyeccion) return null;
  const lo = proyeccion.conservador;
  const hi = Math.max(proyeccion.optimista, 1);
  const base = proyeccion.totalProyectado;
  const span = Math.max(1, hi - lo);
  const pctBase = Math.min(100, Math.max(0, ((base - lo) / span) * 100));
  const pctHoy = Math.min(100, Math.max(0, ((proyeccion.total - lo) / span) * 100));
  return (
    <article className="panel bloque">
      <h2>Proyección al cierre</h2>
      <p className="sub explicacion">
        {proyeccion.hoyParcial
          ? `Ritmo sobre ${proyeccion.diasCompletos} días completos (hoy parcial, no incluido). Día ${proyeccion.posicion} de ${proyeccion.cicloDias}.`
          : `Ritmo sobre ${proyeccion.diasCompletos} días completos. Día ${proyeccion.posicion} de ${proyeccion.cicloDias}.`}
      </p>
      <div className="rango-pista" aria-hidden="true">
        <span className="rango-fill" style={{ left: 0, width: "100%" }} />
        <span className="rango-hoy" style={{ left: `${pctHoy}%` }} title="Ventas a hoy" />
        <span className="rango-base" style={{ left: `${pctBase}%` }} title="Base" />
      </div>
      <div className="rango-marcas">
        <div>
          <span>Conservador</span>
          <strong>{numero(lo)}</strong>
          <p className="sub">{proyeccion.etiquetas?.conservador}</p>
        </div>
        <div className="rango-base-marca">
          <span>Base</span>
          <strong>{numero(base)}</strong>
          <p className="sub">{proyeccion.etiquetas?.base}</p>
        </div>
        <div>
          <span>Optimista</span>
          <strong>{numero(hi)}</strong>
          <p className="sub">{proyeccion.etiquetas?.optimista}</p>
        </div>
      </div>
      <p className="sub">
        Clave {numero(proyeccion.clave)} → {numero(proyeccion.claveProyectada)} · MIX {numero(proyeccion.mix)} →{" "}
        {numero(proyeccion.mixProyectada)}
      </p>
    </article>
  );
}

function Sparkline({ porDia, porDiaAnterior, tieneAnterior }) {
  const serie = porDia || [];
  if (serie.length < 2) return null;
  const valores = serie.map((d) => d.ventas);
  const max = Math.max(1, ...valores, ...(porDiaAnterior || []).map((d) => d.ventas));
  const w = 320;
  const h = 64;
  const step = w / Math.max(1, serie.length - 1);
  const punto = (i, v) => `${(i * step).toFixed(1)},${(h - (v / max) * (h - 4) - 2).toFixed(1)}`;
  const linea = valores.map((v, i) => punto(i, v)).join(" ");
  const ma7 = valores.map((_, i) => {
    const ventana = valores.slice(Math.max(0, i - 6), i + 1);
    return ventana.reduce((a, n) => a + n, 0) / ventana.length;
  });
  const lineaMa = ma7.map((v, i) => punto(i, v)).join(" ");
  let lineaAnt = "";
  if (tieneAnterior && porDiaAnterior?.length) {
    const porIndice = porDiaAnterior.slice(0, serie.length).map((d) => d.ventas);
    while (porIndice.length < serie.length) porIndice.push(0);
    lineaAnt = porIndice.map((v, i) => punto(i, v)).join(" ");
  }
  return (
    <article className="panel bloque">
      <h2>Ventas por día</h2>
      <p className="sub explicacion">
        Barras del ciclo actual y media móvil de 7 días
        {tieneAnterior ? "; línea clara = mismo día del ciclo anterior." : "."}
      </p>
      <svg className="sparkline" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Serie diaria de ventas">
        {lineaAnt ? <polyline fill="none" stroke="#c5dff3" strokeWidth="1.5" points={lineaAnt} /> : null}
        <polyline fill="none" stroke="#8ecae6" strokeWidth="2" points={lineaMa} />
        <polyline fill="none" stroke="#003366" strokeWidth="2" points={linea} />
      </svg>
      <div className="corte-leyenda">
        <span>
          <i style={{ background: "#003366" }} />
          Diario
        </span>
        <span>
          <i style={{ background: "#8ecae6" }} />
          Media 7 días
        </span>
        {tieneAnterior ? (
          <span>
            <i style={{ background: "#c5dff3" }} />
            Ciclo anterior
          </span>
        ) : null}
      </div>
    </article>
  );
}

function Kpis({ proyeccion, pctClave }) {
  if (!proyeccion) return null;
  const flecha = flechaDe(proyeccion.tendencia);
  return (
    <div className="numeros kpis-ventas">
      <article>
        <span>Ventas a hoy</span>
        <strong>{numero(proyeccion.total)}</strong>
        <p className="sub">
          Día {proyeccion.posicion}/{proyeccion.cicloDias}
        </p>
      </article>
      <article>
        <span>Proyección</span>
        <strong>{numero(proyeccion.totalProyectado)}</strong>
        <p className="sub">base al cierre</p>
      </article>
      <article>
        <span>Ritmo</span>
        <strong>
          {proyeccion.ritmoDiario}
          {!proyeccion.pocosDatos && proyeccion.ritmo7 != null ? (
            <small>
              {" "}
              / {proyeccion.ritmo7} {flecha}
            </small>
          ) : null}
        </strong>
        <p className="sub">{proyeccion.pocosDatos ? "pocos datos (7d)" : "ciclo / últimos 7d"}</p>
      </article>
      <article>
        <span>% Clave</span>
        <strong>{pctClave}%</strong>
        <p className="sub">
          {numero(proyeccion.clave)} de {numero(proyeccion.total)}
        </p>
      </article>
    </div>
  );
}

export default function Ventas() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [actualizando, setActualizando] = useState(false);
  const [progreso, setProgreso] = useState({ avance: 8, frase: "En fila para empezar." });
  const [versiones, setVersiones] = useState(false);
  const [verTodosModelos, setVerTodosModelos] = useState(false);
  const [verTodosFijos, setVerTodosFijos] = useState(false);
  const [consultaAbierta, setConsultaAbierta] = useState(false);
  const [codigoBusqueda, setCodigoBusqueda] = useState("");
  const [consulta, setConsulta] = useState(null);
  const [buscandoCodigo, setBuscandoCodigo] = useState(false);
  const [errorCodigo, setErrorCodigo] = useState("");
  const timer = useRef(null);

  async function cargar() {
    const respuesta = await fetch("/api/ventas", { cache: "no-store" });
    if (!respuesta.ok) throw new Error("lectura");
    setDatos(await respuesta.json());
  }

  useEffect(() => {
    cargar().catch(() => setError("No se pudieron leer las ventas."));
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  useEffect(() => {
    if (!consultaAbierta) return undefined;
    function alTeclado(evento) {
      if (evento.key === "Escape") setConsultaAbierta(false);
    }
    window.addEventListener("keydown", alTeclado);
    return () => window.removeEventListener("keydown", alTeclado);
  }, [consultaAbierta]);

  async function buscarCodigo(evento) {
    evento.preventDefault();
    const codigo = codigoBusqueda.trim();
    if (!codigo || buscandoCodigo) return;
    setBuscandoCodigo(true);
    setErrorCodigo("");
    setConsulta(null);
    try {
      const respuesta = await fetch(`/api/ventas/consulta?codigo=${encodeURIComponent(codigo)}`, { cache: "no-store" });
      const cuerpo = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok) {
        setErrorCodigo(cuerpo.error || "No se pudo consultar ese código.");
        return;
      }
      setConsulta(cuerpo);
    } catch {
      setErrorCodigo("No se pudo consultar ese código.");
    } finally {
      setBuscandoCodigo(false);
    }
  }

  async function actualizar() {
    if (!datos || actualizando) return;
    setAviso("");
    setProgreso({ avance: 8, frase: "En fila para empezar." });
    setActualizando(true);
    const respuesta = await fetch("/api/ventas", { method: "POST" });
    const cuerpo = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) {
      setActualizando(false);
      setAviso(cuerpo.aviso || "No se pudo pedir la actualización.");
      return;
    }
    const desde = cuerpo.desde;
    const limite = Date.now() + 16 * 60 * 1000;
    timer.current = setInterval(async () => {
      if (Date.now() > limite) {
        clearInterval(timer.current);
        setActualizando(false);
        setAviso("La actualización sigue en curso. Vuelve a abrir Ventas en unos minutos.");
        return;
      }
      try {
        const estado = await fetch(`/api/ventas/estado?desde=${desde}`, { cache: "no-store" });
        const cuerpoEstado = await estado.json();
        if (cuerpoEstado.frase || cuerpoEstado.avance) {
          setProgreso({
            avance: cuerpoEstado.estado === "listo" ? 100 : cuerpoEstado.avance || 12,
            frase: cuerpoEstado.frase || "Trabajando en la actualización.",
          });
        }
        if (cuerpoEstado.estado === "listo") {
          clearInterval(timer.current);
          setProgreso({ avance: 100, frase: "Listo." });
          await cargar();
          setTimeout(() => setActualizando(false), 900);
        } else if (cuerpoEstado.estado === "fallo") {
          clearInterval(timer.current);
          setActualizando(false);
          setAviso(cuerpoEstado.aviso || "La actualización de ventas no terminó.");
        }
      } catch {
        // siguiente vuelta
      }
    }, 8000);
  }

  const hasta = datos?.ciclo?.hastaTexto || "…";
  const conteos = datos?.vista?.conteos;
  const proyeccion = conteos?.proyeccion || conteos?.pronostico;
  const cruce = conteos?.porCruce;
  const modelos = verTodosModelos ? conteos?.porModelo || [] : conteos?.porModeloTop || conteos?.porModelo || [];
  const departamentos = (conteos?.porEstado || []).slice(0, 6);
  const fijos = verTodosFijos ? conteos?.porFijos || [] : conteos?.porFijosTop || [];
  const anteriores = (datos?.archivos || []).filter((archivo) => archivo.dia !== datos?.vista?.dia);
  const tieneSerieAnterior = Boolean(datos?.referenciaAnterior?.tieneSerieDiaria);

  return (
    <section className="ventas-tablero">
      <div className="encabezado">
        <div>
          <h1>Ventas</h1>
          <p className="ciclo">
            {datos ? `Ciclo ${datos.ciclo.inicioTexto} – ${datos.ciclo.finTexto}.` : "Ventas del ciclo, del 21 al 20."}
          </p>
        </div>
        <div className="actualizar">
          {actualizando ? (
            <div className="progreso" role="status" aria-live="polite">
              <div className="progreso-pista">
                <div className="progreso-barra" style={{ width: `${Math.max(8, Math.min(100, progreso.avance))}%` }} />
              </div>
              <p className="sub">{progreso.frase}</p>
            </div>
          ) : (
            <button type="button" className="btn" onClick={actualizar} disabled={!datos}>
              {`Actualizar hasta ${hasta}`}
            </button>
          )}
          {datos?.vista?.actualizadoTexto ? (
            <p className="sub">
              Última actualización {datos.vista.actualizadoTexto}. Datos del Excel hasta {datos.vista.datosTexto}.
            </p>
          ) : datos ? (
            <p className="sub">Todavía no hay una actualización de este ciclo.</p>
          ) : null}
        </div>
      </div>
      {aviso ? <p className="aviso fallo">{aviso}</p> : null}
      {error ? <p className="aviso fallo">{error}</p> : null}
      {!datos && !error ? <p className="aviso">Cargando ventas…</p> : null}
      {datos && !conteos ? (
        <p className="aviso">Todavía no hay un archivo de este ciclo. Puedes pedirlo con el botón.</p>
      ) : null}

      {conteos && proyeccion ? (
        <>
          <LecturaPrincipal
            proyeccion={proyeccion}
            vsAnterior={conteos.vsAnterior}
            finTexto={datos.ciclo.finTexto}
          />
          <RangoProyeccion proyeccion={proyeccion} />
          <Kpis proyeccion={proyeccion} pctClave={conteos.pctClave} />
          <Sparkline
            porDia={proyeccion.porDia}
            porDiaAnterior={datos.referenciaAnterior?.porDia}
            tieneAnterior={tieneSerieAnterior}
          />
          <div className="tres-columnas">
            <article className="panel">
              <h2>¿Quién?</h2>
              <p className="sub explicacion">TECNO (Area Sales Manager) frente al mercado.</p>
              {cruce ? (
                <CruceCompacto grupos={cruce} total={conteos.registros} insight={conteos.insightQuien} />
              ) : (
                <p className="sub">Esa columna no está en el archivo.</p>
              )}
              <h3 className="mini-titulo">Top vendedores fijos</h3>
              <p className="sub explicacion">
                % sobre las {numero(conteos.ventasFijos)} ventas de Fijos ({conteos.ventasFijos && conteos.registros
                  ? `${Math.round((conteos.ventasFijos / conteos.registros) * 100)}% del reporte`
                  : "—"}
                ).
              </p>
              {fijos.length ? <Barras items={fijos} base={conteos.ventasFijos} ancha /> : <p className="sub">Sin fijos.</p>}
              {(conteos.porFijosOcultos > 0 || (conteos.porFijos || []).length > 5) && (
                <button type="button" className="enlace" onClick={() => setVerTodosFijos((v) => !v)}>
                  {verTodosFijos ? "Ver top 5" : "Ver todos"}
                </button>
              )}
            </article>
            <article className="panel">
              <h2>¿Qué?</h2>
              <p className="sub explicacion">Participación de modelos. ▲▼ vs ciclo anterior (puntos porcentuales).</p>
              {modelos.length ? (
                <Barras
                  items={modelos}
                  colorDe={(nombre) => (esClave(nombre) ? COLOR_CLAVE : COLOR_MIX)}
                  conDelta
                />
              ) : (
                <p className="sub">Sin ventas.</p>
              )}
              <LeyendaClave />
              {(conteos.porModeloOcultos > 0 || (conteos.porModelo || []).length > 5) && (
                <button type="button" className="enlace" onClick={() => setVerTodosModelos((v) => !v)}>
                  {verTodosModelos ? "Ver top 5 + Otros" : "Ver todos"}
                </button>
              )}
            </article>
            <article className="panel">
              <h2>¿Dónde?</h2>
              <p className="sub explicacion">Departamentos. El Alto entra en La Paz. ▲▼ en pp vs ciclo anterior.</p>
              {departamentos.length ? <Barras items={departamentos} conDelta /> : <p className="sub">Sin ventas.</p>}
              <LeyendaClave />
            </article>
          </div>
        </>
      ) : null}

      {datos ? (
        <article className="panel lista-archivos pie-herramientas">
          <h2>Herramientas</h2>
          <div className="reporte-actual">
            <div>
              <p className="sub">
                {datos.vista
                  ? `${numero(conteos?.registros || 0)} ventas · Excel del ${datos.ciclo.inicioTexto} al ${datos.vista.datosTexto}.`
                  : "Todavía no hay un archivo de este ciclo."}
              </p>
            </div>
            <div className="reporte-acciones">
              <button type="button" className="btn secundario" onClick={() => setConsultaAbierta(true)} disabled={!datos.vista}>
                Consultar código
              </button>
              <button type="button" className="btn secundario" onClick={() => setVersiones((abierto) => !abierto)}>
                {versiones ? "Ocultar versiones" : "Versiones anteriores"}
              </button>
              {datos.vista ? (
                <Link className="btn" href={`/ventas/libro?dia=${datos.vista.dia}`}>
                  Abrir el Excel
                </Link>
              ) : null}
            </div>
          </div>
          {versiones ? (
            <div className="versiones">
              <p className="sub">Excel de días anteriores del mismo ciclo.</p>
              {anteriores.length ? (
                <ul>
                  {anteriores.map((archivo) => (
                    <li key={archivo.dia}>
                      <span>{archivo.texto}</span>
                      <Link href={`/ventas/libro?dia=${archivo.dia}`}>Abrir</Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="sub">Por ahora solo está este Excel.</p>
              )}
            </div>
          ) : null}
        </article>
      ) : null}

      {consultaAbierta ? (
        <div className="velo" onClick={() => setConsultaAbierta(false)}>
          <div
            className="consulta"
            role="dialog"
            aria-modal="true"
            aria-labelledby="consulta-titulo"
            onClick={(evento) => evento.stopPropagation()}
          >
            <div className="consulta-cabeza">
              <h2 id="consulta-titulo">Consultar código</h2>
              <button type="button" className="btn secundario" onClick={() => setConsultaAbierta(false)}>
                Cerrar
              </button>
            </div>
            <p className="sub explicacion">Busca un código de Fijos (BOS…) o un Uploader ID (BOV…) en el reporte actual.</p>
            <form className="consulta-forma" onSubmit={buscarCodigo}>
              <input
                value={codigoBusqueda}
                onChange={(evento) => setCodigoBusqueda(evento.target.value)}
                placeholder="BOS… o BOV… (Uploader ID)"
                autoFocus
              />
              <button type="submit" className="btn" disabled={buscandoCodigo || !codigoBusqueda.trim()}>
                {buscandoCodigo ? "Buscando…" : "Buscar"}
              </button>
            </form>
            {errorCodigo ? <p className="aviso fallo">{errorCodigo}</p> : null}
            {consulta && !consulta.encontrado ? <p className="sub">Ese código no está en el reporte.</p> : null}
            {consulta?.encontrado ? (
              <div className="consulta-resultado">
                <div className="consulta-meta">
                  <p className={`consulta-tipo ${consulta.tipo === "uploader" ? "uploader" : "fijos"}`}>
                    {consulta.tipo === "uploader" ? "Consulta por UPLOADER" : "Consulta por Fijos"}
                  </p>
                  <div className="consulta-banner">
                    <strong>{consulta.semana ? `Semana ${consulta.semana}` : "Reporte del ciclo"}</strong>
                    <span>{consulta.rango}</span>
                  </div>
                </div>
                <dl className="consulta-ficha">
                  <div className="consulta-ficha-nombre">
                    <dt>Nombre</dt>
                    <dd>{consulta.nombre || "Sin nombre"}</dd>
                  </div>
                  {consulta.tipo === "uploader" ? (
                    <>
                      <div>
                        <dt>Uploader ID</dt>
                        <dd>{consulta.uploaderId || "—"}</dd>
                      </div>
                      <div>
                        <dt>Código</dt>
                        <dd>{consulta.codigo || "—"}</dd>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <dt>Código</dt>
                        <dd>{consulta.codigo || "—"}</dd>
                      </div>
                      <div>
                        <dt>Uploader ID</dt>
                        <dd>{consulta.uploaderId || "—"}</dd>
                      </div>
                    </>
                  )}
                </dl>
                <div className="consulta-seccion">
                  <h3 className="consulta-seccion-titulo">Tiendas</h3>
                  {(consulta.locales || []).length ? (
                    <table className="lista consulta-locales">
                      <thead>
                        <tr>
                          <th>Tienda</th>
                          <th>Shop ID</th>
                          <th>Ciudad</th>
                        </tr>
                      </thead>
                      <tbody>
                        {consulta.locales.map((local) => (
                          <tr key={`${local.shopId}-${local.tienda}`}>
                            <td>{local.tienda}</td>
                            <td>{local.shopId}</td>
                            <td>{local.ciudad}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="sub">Sin tiendas en este reporte.</p>
                  )}
                </div>
                <div className="consulta-corte">
                  <span>
                    <i style={{ background: COLOR_CLAVE }} />
                    Clave {consulta.clave}
                  </span>
                  <span>
                    <i style={{ background: COLOR_MIX }} />
                    MIX {consulta.mix}
                  </span>
                  <strong className="corte-total">Total {consulta.total}</strong>
                </div>
                <div className="consulta-seccion">
                  <h3 className="consulta-seccion-titulo">Modelos y comisión</h3>
                  {consulta.modelos.length ? (
                    <>
                      <table className="lista">
                        <thead>
                          <tr>
                            <th>Modelo</th>
                            <th>Estado</th>
                            <th className="derecha">Ventas</th>
                            <th className="derecha">Comisión Bs</th>
                          </tr>
                        </thead>
                        <tbody>
                          {consulta.modelos.map((fila) => (
                            <tr key={`${fila.modelo}-${fila.estado}`}>
                              <td>{fila.modelo}</td>
                              <td>
                                <span className={fila.estado === "Activado" ? "consulta-estado activado" : "consulta-estado no-activado"}>
                                  {fila.estado}
                                </span>
                              </td>
                              <td className="derecha">{fila.ventas}</td>
                              <td className="derecha">{formatoBs(fila.comisionBs)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  ) : (
                    <p className="sub">Ese código está en Fijos y no tiene ventas en este reporte.</p>
                  )}
                </div>
                <div className="consulta-comision">
                  <span>Comisión total del ciclo</span>
                  {consulta.comisionBs == null ? (
                    <strong>—</strong>
                  ) : (
                    <>
                      <strong>{formatoBs(consulta.comisionBs)}</strong>
                      <p className="sub">
                        {consulta.comisionFuente === "profit"
                          ? `Desde el PROFIT de Fijos, con ${consulta.tipoCambio ?? 8} Bs por dólar del libro.`
                          : "Sale de Comision Bs. de Fijos del ciclo."}
                      </p>
                    </>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

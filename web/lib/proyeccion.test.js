import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  deltaParticipacionPp,
  diasEntre,
  hoyIsoLaPaz,
  listarDias,
  participacion,
  proyectarVentas,
  sumarDias,
  topConOtros,
} from "./proyeccion.js";

function filasDe(porDia, modelo = "KN3") {
  const filas = [];
  for (const [dia, n] of Object.entries(porDia)) {
    for (let i = 0; i < n; i++) filas.push([modelo, dia]);
  }
  return filas;
}

const columnas = ["Model", "Sales Date"];

describe("diasEntre y ciclos 21→20", () => {
  it("cuenta 30 días del 21 sep al 20 oct", () => {
    assert.equal(diasEntre("2026-09-21", "2026-10-20"), 30);
  });
  it("cuenta 31 días del 21 ene al 20 feb", () => {
    assert.equal(diasEntre("2026-01-21", "2026-02-20"), 31);
    assert.equal(diasEntre("2024-01-21", "2024-02-20"), 31);
  });
  it("cuenta 28 o 29 días del 21 feb al 20 mar según bisiesto", () => {
    assert.equal(diasEntre("2026-02-21", "2026-03-20"), 28);
    assert.equal(diasEntre("2024-02-21", "2024-03-20"), 29);
  });
});

describe("hoyIsoLaPaz medianoche", () => {
  it("23:30 La Paz (03:30 UTC del día siguiente) sigue en el día La Paz", () => {
    // 2026-10-02 23:30 America/La_Paz = 2026-10-03 03:30 UTC (UTC-4)
    const utc = new Date("2026-10-03T03:30:00.000Z");
    assert.equal(hoyIsoLaPaz(utc), "2026-10-02");
  });
  it("00:30 La Paz del 3 oct es ya 3 oct", () => {
    const utc = new Date("2026-10-03T04:30:00.000Z");
    assert.equal(hoyIsoLaPaz(utc), "2026-10-03");
  });
});

describe("proyectarVentas — día parcial no se cuenta dos veces", () => {
  it("el parcial se reemplaza por el ritmo, no se suma", () => {
    // 11 días completos × 10 = 110; día parcial (hoy) = 150
    const porDia = {};
    let dia = "2026-09-21";
    for (let i = 0; i < 11; i++) {
      porDia[dia] = 10;
      dia = sumarDias(dia, 1);
    }
    porDia["2026-10-02"] = 150; // parcial
    const r = proyectarVentas({
      columnas,
      filas: filasDe(porDia),
      ciclo: { inicio: "2026-09-21", finEtiqueta: "2026-10-20", hasta: "2026-10-02" },
      hoyLaPaz: "2026-10-02",
    });
    assert.equal(r.diasCompletos, 11);
    assert.equal(r.posicion, 12);
    assert.equal(r.ventasCompletas, 110);
    assert.equal(r.total, 260);
    // cierre = 110 + (110/11) * (30-11) = 110 + 10*19 = 300
    assert.equal(r.totalProyectado, 300);
    // Incorrecto sería 110+150+10*19 = 450
    assert.notEqual(r.totalProyectado, 450);
  });
});

describe("proyectarVentas — escenarios", () => {
  function serieConRitmos() {
    // 14 días: 10/día, luego últimos 7 a 5/día → 7d bajo; mejor ventana al inicio
    const porDia = {};
    let dia = "2026-09-21";
    for (let i = 0; i < 7; i++) {
      porDia[dia] = 20;
      dia = sumarDias(dia, 1);
    }
    for (let i = 0; i < 7; i++) {
      porDia[dia] = 5;
      dia = sumarDias(dia, 1);
    }
    return porDia;
  }

  it("conservador ≤ base ≤ optimista cuando 7d baja", () => {
    const r = proyectarVentas({
      columnas,
      filas: filasDe(serieConRitmos()),
      ciclo: { inicio: "2026-09-21", finEtiqueta: "2026-10-20" },
      hoyLaPaz: "2026-10-05",
    });
    assert.ok(r.diasCompletos >= 7);
    assert.equal(r.pocosDatos, false);
    assert.ok(r.conservador <= r.totalProyectado);
    assert.ok(r.totalProyectado <= r.optimista);
    assert.ok(r.optimista > r.totalProyectado || r.ritmo7 < r.ritmoDiario);
  });

  it("marca pocosDatos con menos de 7 días completos", () => {
    const porDia = { "2026-09-21": 10, "2026-09-22": 10, "2026-09-23": 10 };
    const r = proyectarVentas({
      columnas,
      filas: filasDe(porDia),
      ciclo: { inicio: "2026-09-21", finEtiqueta: "2026-10-20" },
      hoyLaPaz: "2026-09-24",
    });
    assert.equal(r.diasCompletos, 3);
    assert.equal(r.pocosDatos, true);
    assert.equal(r.conservador, r.totalProyectado);
    assert.equal(r.optimista, r.totalProyectado);
    assert.equal(r.etiquetas.conservador, "pocos datos");
  });

  it("avance calendario ≠ días completos del ritmo", () => {
    const porDia = Object.fromEntries(listarDias("2026-09-21", "2026-10-01").map((d) => [d, 8]));
    porDia["2026-10-02"] = 3;
    const r = proyectarVentas({
      columnas,
      filas: filasDe(porDia),
      ciclo: { inicio: "2026-09-21", finEtiqueta: "2026-10-20" },
      hoyLaPaz: "2026-10-02",
    });
    assert.equal(r.posicion, 12);
    assert.equal(r.diasCompletos, 11);
    assert.notEqual(r.posicion, r.diasCompletos);
  });
});

describe("helpers de ranking", () => {
  it("topConOtros agrupa la cola", () => {
    const items = Array.from({ length: 8 }, (_, i) => ({ nombre: `M${i}`, ventas: 100 - i }));
    const r = topConOtros(items, 5);
    assert.equal(r.visibles.length, 6);
    assert.ok(r.visibles.at(-1).esOtros);
    assert.equal(r.ocultos, 3);
  });

  it("deltaParticipacionPp usa puntos porcentuales", () => {
    const actual = participacion([
      { nombre: "KN3", ventas: 57 },
      { nombre: "LK7", ventas: 43 },
    ]);
    const anterior = participacion([
      { nombre: "KN3", ventas: 54 },
      { nombre: "LK7", ventas: 46 },
    ]);
    const delta = deltaParticipacionPp(actual, anterior);
    const kn3 = delta.find((i) => i.nombre === "KN3");
    assert.ok(kn3.deltaPp > 0);
    assert.equal(kn3.tendencia, "sube");
  });
});

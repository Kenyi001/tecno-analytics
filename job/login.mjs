import puppeteer from "puppeteer";
import { LOGIN_URL } from "./ruta-ventas.mjs";

const ESPERA_MS = 500;
const INTENTOS = 40;

function leerCookies(texto) {
  const cookies = Object.fromEntries(
    texto
      .split(";")
      .map((par) => par.trim().split("="))
      .filter(([clave]) => clave)
  );
  const pAuth = cookies.utoken;
  const pRtoken = cookies.urtoken;
  if (!pAuth || !pRtoken) return null;
  return { pAuth, pRtoken };
}

async function esperarTokens(page) {
  for (let i = 0; i < INTENTOS; i++) {
    const desdeDocumento = await page.evaluate(() => document.cookie);
    const tokens = leerCookies(desdeDocumento);
    if (tokens) return tokens;
    const jar = await page.cookies("https://dcr.imwav.com");
    const armado = jar.map((c) => `${c.name}=${c.value}`).join("; ");
    const desdeJar = leerCookies(armado);
    if (desdeJar) return desdeJar;
    await new Promise((r) => setTimeout(r, ESPERA_MS));
  }
  return null;
}

export async function entrarDcr(usuario, clave) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage();
    await page.goto(LOGIN_URL, { waitUntil: "networkidle2", timeout: 60000 });
    const usuarioInput = await page.waitForSelector('input[name="username"]', { timeout: 15000 });
    const claveInput = await page.$('input[name="password"]');
    if (!usuarioInput || !claveInput) {
      throw new Error("No apareció el formulario de entrada de DCR");
    }
    await usuarioInput.type(usuario);
    await claveInput.type(clave);
    const casillas = await page.$$("input[type='checkbox']");
    const terminos = casillas[1];
    if (!terminos) throw new Error("No apareció la casilla de términos");
    await terminos.evaluate((el) => el.click());
    const marcada = await terminos.evaluate((el) => el.checked);
    if (!marcada) throw new Error("No se pudo marcar la casilla de términos");
    const boton = await page.$(".login-btn");
    if (!boton) throw new Error("No apareció el botón de entrada");
    await boton.evaluate((el) => el.click());
    const tokens = await esperarTokens(page);
    if (!tokens) throw new Error("La entrada no devolvió la sesión");
    return tokens;
  } finally {
    await browser.close().catch(() => {});
  }
}

export function encabezadosDcr(tokens, usuario) {
  return {
    accept: "application/json, text/plain, */*",
    "content-type": "application/json",
    client: "web",
    companyid: "14",
    lang: "en-us",
    local: "en-us",
    loginsource: "DCR",
    "p-auth": tokens.pAuth,
    "p-empno": usuario,
    "p-langid": "en-us",
    "p-requestid": crypto.randomUUID(),
    "p-rtoken": tokens.pRtoken,
    "p-syscode": "DCR",
    timezone: "GMT-04:00",
    cookie: `utoken=${tokens.pAuth}; urtoken=${tokens.pRtoken}`,
  };
}

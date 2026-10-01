export default async function Acceso({ searchParams }) {
  const params = await searchParams;
  const mal = params?.error === "1";
  return (
    <main className="entrada">
      <form className="tarjeta-entrada" method="post" action="/api/acceso">
        <p className="marca-entrada">tecno-analytics</p>
        <h1>Entrada</h1>
        <p className="sub">Clave de oficina para ver los reportes.</p>
        <label htmlFor="clave">Clave</label>
        <input id="clave" name="clave" type="password" autoComplete="current-password" required />
        {mal ? <p className="error">Esa clave no abre la página.</p> : null}
        <button className="btn" type="submit">
          Entrar
        </button>
      </form>
    </main>
  );
}

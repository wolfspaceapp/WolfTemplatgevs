/* ============================================================
   CONFIGURACIÓN  —  Edita SOLO este archivo para tu blog
   ============================================================
   Esta app usa el FEED de Blogger como "base de datos".
   Cada ENTRADA (post) del blog = un anime/serie.
   ------------------------------------------------------------ */

window.APP_CONFIG = {

  /* 1) Dominio de tu blog (SIN la barra final).
     Ej: "https://mianime.blogspot.com"  */
  BLOG_URL: "https://ejemplo-anime.blogspot.com",

  /* 2) Nombre y branding */
  APP_NAME: "NekoWolf",
  BRAND_LETTER: "N",            // letra del logo circular
  ACCENT: "#f47521",            // color de acento (naranja)

  /* 3) Cuántos posts pedir al feed (máx 150 recomendado) */
  MAX_RESULTS: 150,

  /* 4) Etiquetas (labels de Blogger) que arman las filas del Inicio.
     Cada fila mostrará los posts que tengan esa etiqueta.
     El orden aquí = orden en pantalla. */
  HOME_ROWS: [
    { title: "Los imperdibles de hoy", label: "Destacado" },
    { title: "Episodios Nuevos",        label: "Nuevo" },
    { title: "Películas Destacadas",    label: "Pelicula" },
    { title: "Series Más Populares",    label: "Popular" },
    { title: "Acción & Suspenso",       label: "Accion" },
    { title: "Ciencia Ficción & Aventura", label: "Ciencia Ficcion" }
  ],

  /* 5) Géneros que aparecen en la pestaña Explorar > Géneros */
  GENRES: [
    "Accion", "Comedia", "Drama", "Romance", "Fantasia",
    "Shounen", "Terror", "Ciencia Ficcion", "Recuentos de la Vida", "Aventura"
  ],

  /* 6) Etiqueta para la sección Simulcasts (temporada actual) */
  SIMULCAST_LABEL: "Simulcast",

  /* 7) Imagen de respaldo si un post no trae portada */
  FALLBACK_POSTER: "https://via.placeholder.com/300x450/1a1a1a/f47521?text=Anime",

  /* 8) Palabras clave para detectar metadatos dentro de las ETIQUETAS
        del post. (Opcional — así marcas tipo/idioma por post)        */
  TAG_MARKERS: {
    MOVIE:  ["pelicula", "película", "movie", "film"],
    DUB:    ["dob", "doblaje", "latino", "dub"],
    SUB:    ["sub", "subtitulado"],
    RATING: ["14+", "16+", "18+", "7+", "todos"]
  }
};

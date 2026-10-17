# 🐺 NekoWolf — Plantilla Web App de Anime (alimentada por Blogger)

Plantilla **HTML + CSS + JS** para una **web app móvil** de streaming de anime, con el
diseño tipo app (tema oscuro, acento naranja, barra inferior, carruseles, pantalla de
detalle con episodios y reproductor). **No necesita servidor**: usa el **feed de Blogger
como base de datos**. Optimizada para empaquetar con **AppsGeyser** u otro wrapper (WebView).

## 📁 Archivos

| Archivo | Qué es |
|---|---|
| `index.html` | Estructura de la app |
| `styles.css` | Diseño móvil (tema oscuro / naranja) |
| `config.js` | **⚙️ Lo único que editas:** tu blog y etiquetas |
| `app.js` | Motor que lee el feed de Blogger y arma la app |

---

## 🚀 Paso 1 — Configurar tu blog

Abre **`config.js`** y cambia:

```js
BLOG_URL: "https://TU-BLOG.blogspot.com",   // ← tu blog (sin barra final)
APP_NAME: "NekoWolf",
ACCENT:   "#f47521",                        // color de acento
```

> El blog debe ser **público**. La app usa `https://TU-BLOG.blogspot.com/feeds/posts/default?alt=json`.

## 📝 Paso 2 — Crear el contenido en Blogger

**Cada ENTRADA (post) del blog = un anime / serie.**

| En Blogger | Se usa como |
|---|---|
| Título del post | Título del anime |
| Primera imagen del post | Portada (poster) |
| Texto del post | Sinopsis |
| **Etiquetas** del post | Géneros + categorías de las filas |
| Enlaces de video en el post | Episodios |

### Etiquetas especiales (controlan dónde aparece)
- `Destacado` → aparece en el **hero** y "Los imperdibles de hoy"
- `Nuevo` → fila "Episodios Nuevos"
- `Popular`, `Pelicula`, `Accion`, `Comedia`, `Drama`, `Romance`, `Fantasia`, `Shounen`, `Terror`, `Ciencia Ficcion`, `Aventura`
- `Simulcast` → pestaña Simulcasts
- `Dob` / `Sub` → marca doblaje / subtitulado
- `14+`, `16+`, `18+` → clasificación

> Puedes cambiar/añadir filas y géneros en `HOME_ROWS` y `GENRES` dentro de `config.js`.

### Episodios dentro del post
Agrega en el **contenido del post** (vista HTML de Blogger) una línea por episodio:

```
[EP]1. El día en que la paz empezó|https://www.youtube.com/watch?v=XXXX|23m|Naoto vive tranquilo...|https://url-miniatura.jpg[/EP]
[EP]2. Una mentirita|https://drive.google.com/file/d/XXXX/view|23m|Tras un beso inesperado...[/EP]
```

Formato: `[EP]Título|URL-video|Duración|Descripción|Miniatura[/EP]`
(solo el **Título** y la **URL** son obligatorios; lo demás es opcional).

**Enlaces de video soportados automáticamente:** YouTube, Google Drive, Vimeo y
archivos directos `.mp4`/`.m3u8`/`.webm`. (Si no usas `[EP]...[/EP]`, la app toma
todos los enlaces `<a>` del post como episodios.)

---

## 📱 Paso 3 — Empaquetar en AppsGeyser

1. Sube los 4 archivos a un hosting (GitHub Pages, Netlify, tu propio Blogger como
   página HTML, etc.) y obtén la **URL pública** de `index.html`.
2. En **AppsGeyser** elige la plantilla **"Website"** y pega esa URL.
3. Configura nombre, ícono y genera el APK.

La plantilla ya incluye:
- `viewport` bloqueado (sin zoom) y soporte de *notch* (`safe-area-inset`).
- Soporte del **botón atrás** del teléfono (cierra reproductor/detalle/búsqueda).
- Carga del feed por **JSONP**, evitando problemas de CORS en el WebView.

> **Prueba local:** por el JSONP de Blogger puedes abrir `index.html` directo en el
> navegador del móvil o en el escritorio; no requiere servidor.

---

## 🎨 Personalización rápida
- **Color:** `ACCENT` en `config.js`.
- **Logo (letra):** `BRAND_LETTER`.
- **Filas del inicio:** `HOME_ROWS`.
- **Géneros:** `GENRES`.
- **Portada de respaldo:** `FALLBACK_POSTER`.

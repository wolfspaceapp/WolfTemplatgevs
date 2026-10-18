# 🐺 NekoWolf — Tema de Blogger (detalle de anime en las entradas)

Este tema (`tema-blogger.xml`) hace que **cada entrada (post) de Blogger** se vea y
funcione como la pantalla de detalle de anime (`detalle.html`): hero con póster,
tabs (Sinopsis / Reparto / Información), episodios con temporadas, selección de
**idioma → servidor**, **reproductor profesional**, favorito, Mi lista, continuar
viendo y **omitir intro**.

---

## 🚀 Instalación

1. En Blogger: **Tema → ⋮ (flecha) → Restaurar / Copia de seguridad → Subir** y elige `tema-blogger.xml`.
2. (Opcional) Edita los **colores** en el objeto `THEME` dentro del `<script>` del tema.
3. Crea entradas con los marcadores de abajo. Cada **entrada = un anime/serie/película**.

> El tema usa el **cuerpo del post** como base de datos. No necesitas backend.

---

## ✍️ Cómo escribir una entrada (vista HTML de Blogger)

### 1. Título del post → título del anime
### 2. Primera imagen del post → póster y fondo
### 3. Etiquetas (labels) del post → géneros (y tipo)
- Añade una etiqueta con `Pelicula` / `Movie` / `Film` para que sea **película** (sin episodios).
- El resto de etiquetas se muestran como **géneros**.

### 4. Metadatos — bloque `[NW] ... [/NW]`
```
[NW]
year: 2024
rating: 8.7
status: En emisión
studio: MAPPA
duration: 24 min/ep
audio: Japonés · Latino
director: Sunghoo Park
season: Temporada 1
badges: Simulcast, HD 1080p, SUB · DOB, 16+
synopsis: (opcional; si no, se usa el texto del post)
poster: https://.../poster.jpg   (opcional)
backdrop: https://.../fondo.jpg   (opcional)
[/NW]
```
Todos los campos son **opcionales**.

### 5. Episodios — un bloque `[EP] ... [/EP]` por episodio
Formato:
```
[EP]NÚMERO|TÍTULO|DURACIÓN|DESCRIPCIÓN|MINIATURA|FUENTES[/EP]
```
Donde **FUENTES** es `Idioma=Servidor:URL,Servidor:URL;Idioma2=Servidor:URL`

Ejemplo:
```
[EP]1|Ryomen Sukuna|24m|Yuji descubre las maldiciones.|https://img/ep1.jpg|Latino=YourUpload:https://.../ep1-lat.mp4,Mega:https://.../ep1-lat2.mp4;Subtitulado=YouTube:https://youtu.be/XXXX[/EP]
[EP]2|Para mí mismo|24m|Comienza el entrenamiento.||Latino=Streamtape:https://.../ep2.mp4;Subtitulado=YouTube:https://youtu.be/YYYY[/EP]
```
- **Número, Título, Duración, Descripción, Miniatura** → solo Número y Título son necesarios.
- **FUENTES** define los idiomas y, dentro de cada uno, los servidores (`Nombre:URL`).
- Servidores soportados automáticamente: **YouTube, Google Drive, Vimeo, OK.ru** y
  archivos directos **.mp4/.webm/.m3u8** (se reproducen en el reproductor integrado).

> **Si no pones `[EP]...`**, el tema toma todos los enlaces `<a>` del post como
> episodios (un servidor cada uno).

### 6. Película → fuentes generales
Si la entrada es **película** (etiqueta `Pelicula`), usa un solo `[EP]` (o define
las fuentes en el primer `[EP]`); se mostrarán como las fuentes generales de la peli.

### 7. (Opcional) Reparto — bloque `[CAST] ... [/CAST]`
```
[CAST]Yuji Itadori:J. Enoki:https://img/yuji.jpg, Megumi:Y. Uchida:https://img/megumi.jpg[/CAST]
```
Formato por actor: `Nombre:Rol:Imagen` (separados por comas).

---

## 🎨 Personalizar colores
Dentro del `<script>` del tema, edita:
```js
var THEME = {
  accent:"#f47521", accent2:"#ff9a52",
  gradFrom:"#ffa24d", gradMid:"#f47521", gradTo:"#e8630e", gradAngle:"135deg",
  bg:"#0a0a0a", bg2:"#141414", card:"#1a1a1a"
};
```
El color se aplica a **toda la interfaz** (botón reproducir, tabs, switches, etc.).

---

## ✅ Funciones incluidas en cada entrada
- Hero con póster flotante + fondo animado (Ken Burns + parallax).
- Tabs **Sinopsis / Reparto / Información** con gestos (swipe).
- Episodios con **temporada** (selector nativo) y **orden** (reciente/antiguo).
- Switch **visto / no visto** por episodio (persistente).
- **Favorito** (❤️) y **Mi lista** (Viendo, Completado, etc.) con persistencia.
- **Botón Reproducir** estilo Netflix (Reanudar T·E si hay progreso).
- Flujo **idioma → servidor → reproductor**.
- **Reproductor profesional**: play/pausa, ±10s, barra de progreso, velocidad,
  pantalla completa, buffering, **omitir intro** y **autoplay del siguiente** en el
  mismo idioma (con fallback automático).

> Nota: el almacenamiento (favoritos, vistos, progreso) usa `localStorage` del
> navegador del usuario.

---

## 🛠️ Si la entrada no se ve bien

1. **Escribe el código en la vista HTML** del editor de Blogger (botón `<>` / "Vista HTML"),
   no en la vista "Redactar". Pega el bloque generado tal cual.
2. El tema ahora **normaliza** el contenido que Blogger reformatea (convierte `<br>`,
   `<p>`, `&nbsp;` y los enlaces `<a>` de vuelta a texto/URL), así que los marcadores
   `[NW]`, `[EP]`, `[CAST]` se leen aunque Blogger los envuelva en HTML.
3. Asegúrate de **publicar** la entrada (no solo previsualizar el editor).
4. Comprueba que instalaste el tema en **Tema → Restaurar/Copia de seguridad** (subir XML),
   no en "Editar HTML" pegando parcialmente.
5. Si ves el texto crudo de los marcadores: revisa que el `<script>` del tema esté presente
   (algunos widgets de terceros pueden bloquear scripts). El contenido se construye por JS
   al cargar la página de la entrada.

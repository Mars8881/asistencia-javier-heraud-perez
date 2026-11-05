# Sistema de Asistencia QR — I.E. Javier Heraud Pérez

Sistema web de registro de asistencia con **código QR**, con roles de **docente** y **estudiante**.

## Estado del proyecto

| Etapa | Descripción | Estado |
|-------|-------------|--------|
| 1 | Frontend (HTML, CSS, JavaScript) | ✅ Terminado |
| 2 | Paneles por rol, QR real y registro de asistencia | ✅ Funcional |
| 3 | Conexión a Supabase (PostgreSQL + autenticación) | ✅ Implementado, listo para credenciales |
| 4 | Despliegue en GitHub + Railway | ✅ Configurado, listo para publicar |

> **Modo actual: demo local.** El sistema funciona completo sin servidor y guarda los datos en el navegador. Al completar las credenciales de Supabase, cambia automáticamente a modo nube.

## Estructura

```
.
├── index.html              # Interfaz completa (login, paneles, modales)
├── css/
│   └── styles.css          # Diseño institucional y responsive
├── js/
│   ├── config.js           # Configuración y credenciales de Supabase
│   ├── db.js               # Capa de datos (local + Supabase)
│   └── app.js              # Lógica de interfaz, roles y QR
├── supabase/
│   └── schema.sql          # Tablas, trigger y políticas RLS
├── server.js               # Servidor estático sin dependencias
├── package.json            # Scripts de Node (npm start)
├── railway.json            # Configuración de despliegue en Railway
├── .gitignore
└── README.md
```

## Cómo ejecutar

### Opción 1 — Abrir directamente (más rápido)
Abra `index.html` con doble clic. Funciona sin instalar nada.

### Opción 2 — Servidor local
```bash
node server.js
```
Luego abra `http://localhost:8080`.

### Opción 3 — VS Code Live Server
1. **File → Open Folder…** y seleccione la carpeta del proyecto.
2. Pulse **Go Live** (abajo a la derecha).

> Para escanear el QR desde un celular, use la URL de red que entrega Live Server (ej. `http://192.168.1.50:5500`) o publique el sitio. Con `file://` el celular no puede abrir el enlace.

## Flujo de uso

### Docente
1. Elija **Docente**, escriba su nombre e ingrese.
2. **＋ Nueva sesión** → materia, grado y sección.
3. Se genera un **código único** (`JHP-XXXXXX`) y su **QR real**.
4. Puede copiar el código, ver asistentes, filtrar y finalizar la sesión.

### Estudiante
1. Elija **Estudiante**, escriba su nombre e ingrese.
2. Escanee el QR o ingrese el código.
3. **Registrar mi asistencia** → valida código, evita duplicados y guarda.

### Datos de demostración
El sistema inicia con 2 sesiones y 3 asistencias de ejemplo. Se pueden borrar con **Reiniciar demo** en el panel del docente.

## Conectar Supabase (Etapa 3)

1. Cree un proyecto en <https://supabase.com>.
2. Abra **SQL Editor → New query**, pegue el contenido de `supabase/schema.sql` y ejecútelo.
3. En **Authentication → Providers → Email**, desactive **Confirm email** (para que el registro inicie sesión al instante).
4. En **Settings → API** copie **Project URL** y **anon public key**.
5. Péguelos en `js/config.js`:

```js
supabaseUrl: 'https://TU-PROYECTO.supabase.co',
supabaseAnonKey: 'TU_ANON_KEY',
useSupabase: true,
```

6. Recargue la página. El distintivo superior debe decir **Supabase**.
7. En el login aparecerán los campos **correo** y **contraseña**. La primera vez se crea la cuenta automáticamente con el rol elegido.

> La `anon key` es pública por diseño; la seguridad real la aplican las políticas **RLS** incluidas en el esquema.

## Desplegar en GitHub y Railway (Etapa 4)

### GitHub
```bash
git init
git add .
git commit -m "Sistema de asistencia QR - I.E. Javier Heraud Pérez"
git branch -M main
git remote add origin https://github.com/USUARIO/REPOSITORIO.git
git push -u origin main
```

### Railway
1. Ingrese a <https://railway.app> con su cuenta de GitHub.
2. **New Project → Deploy from GitHub repo** y seleccione el repositorio.
3. Railway detecta `package.json` y `railway.json`; no requiere variables de entorno.
4. En **Settings → Networking → Generate Domain** obtiene la URL pública.
5. Verifique el estado en `https://TU-DOMINIO/health`.

Con la URL pública, el QR generado apuntará a esa dirección y podrá escanearse desde cualquier celular.

## Seguridad

- Roles validados en la interfaz **y** en las políticas RLS de PostgreSQL.
- Un estudiante solo puede insertar su propia asistencia (`student_id = auth.uid()`).
- Solo un docente puede crear clases (`role = 'docente'`).
- Restricción única `(student_id, class_id)` para impedir asistencias duplicadas.
- No se exponen claves secretas: solo se usa la `anon key` pública.

## Próximos pasos sugeridos

1. Panel de administración para gestionar docentes, estudiantes y grados.
2. Exportación de asistencias a Excel/PDF.
3. Lectura de QR con la cámara dentro de la web.
4. Notificaciones o reportes automáticos de inasistencias.

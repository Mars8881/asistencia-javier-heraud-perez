/* ============================================================
   Configuración del sistema — I.E. Javier Heraud Pérez
   ------------------------------------------------------------
   MODO DEMO (por defecto)
   La aplicación funciona sin servidor y guarda los datos en
   el navegador. No requiere configurar nada.

   MODO SUPABASE (nube)
   1. Cree un proyecto en https://supabase.com
   2. Ejecute supabase/schema.sql en el SQL Editor
   3. En Settings → API copie:
        - Project URL
        - anon public key
   4. Péguelos abajo y cambie useSupabase a true
   ============================================================ */

window.JHP_CONFIG = {
  schoolName: 'I.E. Javier Heraud Pérez',
  schoolShort: 'JHP',
  schoolYear: '2026',

  /* ---------- Conexión a Supabase ---------- */
  supabaseUrl: '',        // Ej: 'https://abcdefgh.supabase.co'
  supabaseAnonKey: '',    // Ej: 'eyJhbGciOiJIUzI1NiIs...'
  useSupabase: false,     // Cambiar a true cuando estén completos

  /* ---------- Modo demostración ---------- */
  demoMode: true
};

# Instalar Family Nest para tu familia

Cada familia usa su propia copia: su propio proyecto gratuito de [Supabase](https://supabase.com) (donde viven los datos) y su propio despliegue en [Vercel](https://vercel.com). Ningún dato de tu familia pasa por este repositorio. Necesitas Node.js 22 o superior, `git` y unos 45 minutos la primera vez.

## 1. Crear tu proyecto de Supabase

1. Crea una cuenta en Supabase y un proyecto nuevo (plan gratuito). Guarda la contraseña de la base de datos en un gestor de contraseñas.
2. En **Project Settings → API** copia la **Project URL** y la clave **publishable** (`sb_publishable_...`). Esas son las dos únicas que usará la app.
3. **Nunca** copies la clave `secret` / `service_role` a la app, a Vercel ni a ningún archivo del repositorio.

### Autenticación por código de correo

La app inicia sesión con un código de 6 dígitos que llega al correo.

1. **Authentication → Providers → Email**: activa el proveedor de correo. Fija **Email OTP Length = 6** y **Email OTP Expiration = 600** segundos.
2. **Authentication → Emails → Templates**: hay que editar **dos** plantillas, *Magic link or OTP* y *Confirm sign up*. Las dos deben enviar el código con `{{ .Token }}`, **no** con `{{ .ConfirmationURL }}` (un enlace no sirve en la app instalada). Pega esto en cada una:

   Asunto: `Tu código de Family Nest`

   ```html
   <h2>Family Nest</h2>
   <p>Tu código para entrar es:</p>
   <p style="font-size: 28px; font-weight: bold; letter-spacing: 6px;">{{ .Token }}</p>
   <p>Vale 10 minutos. Si no lo pediste, ignora este mensaje.</p>
   ```

3. **SMTP propio.** Supabase ahora exige un SMTP propio para editar las plantillas y para que el envío sea confiable (el correo integrado es solo de pruebas y tiene un límite muy bajo por hora). En **Authentication → Emails → SMTP Settings** activa *Custom SMTP*:
   - Para una sola familia basta una cuenta de Gmail con una **contraseña de aplicación** (requiere verificación en dos pasos): servidor `smtp.gmail.com`, puerto `465`, usuario tu correo, contraseña la de aplicación.
   - Un proveedor transaccional (Resend, Brevo, Postmark…) es mejor: más entregabilidad y no ata el envío a una cuenta personal.

## 2. Aplicar las migraciones

Desde una copia del repositorio (`git clone` y `npm install`):

```bash
npx supabase login
npx supabase link --project-ref <tu-project-ref>
npx supabase db push
```

`db push` aplica en orden `supabase/migrations/0001` a `0005`. **No uses `--include-seed`**: la semilla es una familia inventada para pruebas y bloquearía tu primera configuración. Tu base debe quedar vacía de datos hasta que configures la familia en el paso 4.

## 3. Desplegar en Vercel

1. En Vercel: **Add New → Project** e importa tu copia (fork) del repositorio. Framework: **Vite** (lo detecta solo).
2. En **Environment Variables** carga solo estas dos:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
3. Despliega. Obtendrás una dirección `https://tu-proyecto.vercel.app`.
4. **Después de desplegar**, vuelve a Supabase → **Authentication → URL Configuration**: pon esa dirección en **Site URL** y agrégala en **Redirect URLs**.

## 4. Abrir, configurar la familia y repartir el código

1. Abre la dirección. La primera vez la app te pide configurar la familia: nombre, país, zona horaria y los miembros (apodo, color, cumpleaños).
2. Reparte el **código de unión** a cada persona: cada teléfono lo escribe una vez, elige su apodo libre y queda ligado a esa cuenta.

## 5. Instalar en cada teléfono

- **iPhone (iOS 16.4 o superior)**: abre la dirección en **Safari** → botón **Compartir** → **Agregar a inicio**. Abre la app desde el ícono de inicio.
- **Android**: en Chrome → menú ⋮ → **Instalar aplicación**.

## 6. Pantalla de la casa (la pared)

En el monitor o tableta de la pared, abre la app y elige la opción **"Esta es la pantalla de la casa"**. Ocupa todo el monitor y tiene botón de pantalla completa.

## Límites del plan gratuito

- **El proyecto se pausa tras 7 días de poca actividad.** Con uso diario no pasa. Un proyecto pausado se restaura desde el panel de Supabase hasta un año después.
- **No hay copias de seguridad automáticas.** Exporta tus datos de vez en cuando (el registro de eventos tiene exportación CSV) o usa `supabase db dump`.
- **El correo integrado limita los códigos por hora.** Configura un SMTP propio (ver arriba).

## Actualizar

Cuando haya cambios: trae la última versión del repositorio, corre `npx supabase db push` para las migraciones nuevas y Vercel publica la app al hacer push.

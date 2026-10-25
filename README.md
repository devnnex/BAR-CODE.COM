# Código de Barras · inventario y caja local

Aplicación web para **un solo dispositivo por negocio**. Guarda productos, existencias, movimientos y ventas en **IndexedDB**, dentro del navegador de ese dispositivo. No usa Supabase, cuentas, servidor de datos ni internet para operar.

## Probar desde el celular

Abre **https://devnnex.github.io/BAR-CODE.COM/** en el navegador del teléfono. El sitio se publica desde la rama `main` de este repositorio. Instálalo desde el menú del navegador para tener el acceso directo y usarlo sin conexión después de la primera carga.

Los datos de prueba quedan en ese navegador y dispositivo. La vista abierta desde `file://` y la versión publicada tienen bases locales separadas; usa el respaldo JSON de Ajustes si necesitas trasladar datos.

## Abrir ahora

Abre [index.html](index.html) con doble clic. Todos los archivos necesarios están al lado del HTML y se cargan con rutas relativas. También puedes ejecutar `npm run serve` y abrir `http://localhost:5500/`.

La primera apertura crea la base local. En Inventario agrega productos con código, precio, costo y existencias. En Caja escanea o busca productos, confirma la venta y luego imprime el recibo. En Ajustes define el nombre del negocio y descarga respaldos.

## Instalar como PWA

Para instalarla en Android o iPhone, publica estos mismos archivos por **HTTPS** o sírvelos desde `localhost` para pruebas. Abrir `index.html` como `file://` muestra la aplicación, pero los navegadores no instalan PWAs desde archivos locales. El `sw.js` guarda la interfaz para abrirla sin conexión una vez instalada.

En Android, usa la opción del navegador **Instalar aplicación**. En iPhone, abre el sitio en Safari y usa **Compartir → Añadir a pantalla de inicio**. Autoriza la cámara al escanear. Si la cámara no está disponible, escribe el código manualmente.

## Datos y respaldos

IndexedDB pertenece al **origen** del navegador. La copia abierta como archivo y la copia abierta desde un dominio HTTPS **no comparten datos**. Para cambiar de ubicación, navegador o teléfono, descarga un respaldo JSON en Ajustes y restáuralo en la nueva instalación. Haz respaldos periódicos; borrar los datos del navegador también puede borrar el inventario y las ventas.

El cobro guarda venta y descuento de existencias en una sola transacción. Si falta stock, la venta se rechaza sin modificarlo. El catálogo puede exportarse como CSV; el respaldo JSON conserva además ventas, movimientos, configuración y consecutivo de recibos.

## Impresión

Los recibos están formateados para papel de 80 mm y usan el diálogo de impresión del teléfono o navegador. Que una impresora térmica Bluetooth aparezca allí depende del modelo y del servicio de impresión instalado. Una PWA no puede garantizar conexión Bluetooth directa a cualquier impresora en Android y iPhone; hay que probar el equipo concreto.

## Desarrollo y verificación

`index.html`, `app.js`, `db.js`, `app.css`, `scanner.bundle.js`, el manifiesto, iconos y `sw.js` son el producto estático. Para reconstruir el lector de cámara y actualizar la caché PWA:

```powershell
npm install
npm run build
npm test
```

`npm run build` también copia los archivos publicables a `dist/`. El lector usa `@zxing/browser` (MIT). La aplicación propia se escribió desde cero tras revisar como referencia funcional `Dinesh-Sowndar/flutter_billing_app`, cuyo repositorio no declara licencia comercial. El clon original está fuera de esta carpeta y no forma parte de `dist/`.

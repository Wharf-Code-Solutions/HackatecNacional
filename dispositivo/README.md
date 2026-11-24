# Dispositivo · módulo M4

La estación centinela que mide el agua del Alto Atoyac, **simulada**. La descripción
completa, con rangos, consumos y lo que falta validar, está en
[`ficha-tecnica.md`](ficha-tecnica.md).

## Qué hay aquí

```
ficha-tecnica.md          los cuatro bloques, el ciclo del firmware, lo medido y lo supuesto
simulador/
  modelo.js               el agua, las sondas, la energía y el enlace (lo que no es firmware)
  firmware.js             la máquina de estados del ESP32: dormir, medir, guardar, enviar
  montaje.js              arma una estación desde los fixtures del contrato
  prueba.js               siete pruebas en Node, sin dependencias
  escena.js               la figura en 3D (Three.js): valle con el río en su cauce de taludes, agua turbia
                          que cambia con la turbiedad, las sondas, el gabinete abierto
                          (controlador, SD, módem, baterías), panel, antena y la torre celular
  recepcion.js            lo que recibe la plataforma: línea de tiempo de 12 h, ● recibida, ○ en la SD
  index.html, ui.js, estilos.css    la interfaz: figura 3D, recepción con el valor de cada parámetro
                                    y cuatro pruebas (dos descargas, lluvia, corte de red)
```

Cero dependencias en la lógica: JavaScript plano, sin compilar. La figura usa Three.js r149
desde unpkg; sin WebGL, la página avisa y la recepción y la tabla siguen funcionando. `modelo.js` y `firmware.js` no conocen la
pantalla; por eso las mismas funciones se animan en el navegador y se prueban en Node.

## Correrlo

La interfaz lee los fixtures de `contrato/fixtures/`, así que se sirve el repositorio desde
su raíz (con doble clic el navegador bloquea la lectura):

```powershell
python -m http.server 8000
```

Abrir `http://127.0.0.1:8000/dispositivo/simulador/`.

Para ver cómo responde el backend a lo que envía la estación:

```powershell
python contrato/servidor_mock.py
```

El simulador se conecta solo a `http://127.0.0.1:8080` (otra dirección con `?backend=`, ninguna
con `?backend=`). Si la plataforma abre una alerta, aparece una línea en rojo sobre la recepción.

## Probarlo

```powershell
node dispositivo/simulador/prueba.js
```

Verifica el ciclo, la cola en la SD tras un corte de red, las fallas de sonda, la saturación
de turbiedad, la energía y las cinco estaciones. Además escribe los paquetes en un archivo
temporal; para comprobar que cumplen el contrato:

```powershell
python contrato/validador.py lectura $env:TEMP\paquetes_simulador.json
```

## Frontera

M4 es dueño de esta carpeta y **no toca el contrato**. Habla con el resto del sistema
únicamente por `POST /lecturas`. Si el simulador necesita un campo que `lectura` no tiene, se
propone el cambio por el protocolo de `docs/contexto/05-protocolo-de-cambios.md`.

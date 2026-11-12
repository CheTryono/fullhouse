# Exportaciones históricas reproducibles

Los nueve JSON son salidas de los métodos originales de Fullhouse, ejecutados
con entradas sintéticas; no son respaldos personales ni objetos construidos a
mano para satisfacer el validador nuevo. Cada archivo incluye el commit completo,
la versión, las operaciones reproducidas y el `data` exportado.

| Versión | Commit original |
| --- | --- |
| 0.1 | 01527cc |
| 0.2 | b352429 |
| 0.3 | fc7b9ab |
| 0.4 | e7ddcba |
| 0.5 | fc64f09 |
| 0.6 | a1bfe58 |
| 0.7 | d716246 |
| 0.8 | 3dc1e5b |
| 0.9 | b09c941 |

Para regenerarlos desde la raíz, con esos objetos Git disponibles:

```sh
node scripts/generate-historical-backups.cjs
```

El generador usa `git show <commit>:app.js` sin cambiar el checkout. Ejecuta el
JavaScript servido de cada versión en `node:vm`: inicialización con sus ejemplos
originales, creación de meta, avance, rutina con minutos decimales, evento,
marcado de pasos, notas y, cuando existen, evidencia y revisión diaria. Usa su
`exportData()` real, captura el Blob y verifica que corresponde a los datos de su
escritor `save()`. Los ejemplos incluidos en el repositorio son demostraciones,
no información de una persona.

Los adaptadores de React, almacenamiento, descarga e imagen son sintéticos y no
prueban renderizado ni decodificación de fotografías. Fecha, zona horaria y
aleatoriedad están fijadas. Se revisaron también los tipos y escritores de las
revisiones originales para seleccionar operaciones compatibles. Los casos no
agotan todas las combinaciones posibles de versiones o datos.

Las versiones 0.5–0.9 escriben `11:57.5` al fijar el término a las 12:00 de una
rutina de 2,5 minutos. Es una salida real de sus cálculos, rechazada por el
validador introducido inicialmente en la PR #2. Ahora se admite el componente de
minutos fraccionario, sin redondear ni reescribir el respaldo.

La suite normal lee estos archivos y no necesita historia Git, red ni ejecutar
versiones antiguas durante cada prueba. Verifica validación, carga local sin
reescritura e importación conservando todos los campos.

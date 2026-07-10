// enviar-metricas.js
const fs = require('fs');
const { InfluxDB, Point } = require('@influxdata/influxdb-client');

// Variables de entorno inyectadas por GitHub Actions
const url = process.env.INFLUX_URL;
const token = process.env.INFLUX_TOKEN;
const org = process.env.INFLUX_ORG;
const bucket = process.env.INFLUX_BUCKET;

// Instanciar cliente
const client = new InfluxDB({ url, token });
const writeApi = client.getWriteApi(org, bucket, 'ns'); // 'ns' = precisión de nanosegundos

try {
    // 1. Leer el JSON generado por Jest
    const data = JSON.parse(fs.readFileSync('resultados-auditoria.json', 'utf8'));

    // 2. Extraer las métricas clave
    const totalPruebas = data.numTotalTests;
    const pruebasPasadas = data.numPassedTests;
    const pruebasFallidas = data.numFailedTests;

    // 3. Crear el punto de datos (Data Point)
    const puntoSqa = new Point('auditoria_seguridad')
        .tag('proyecto', 'masterferre')
        .tag('estandar', 'iso25010')
        .intField('total', totalPruebas)
        .intField('pasadas', pruebasPasadas)
        .intField('fallidas', pruebasFallidas);

    // 4. Escribir en InfluxDB
    writeApi.writePoint(puntoSqa);
    
    writeApi.close().then(() => {
        console.log('Métricas enviadas exitosamente a InfluxDB con Joy Over Instructions!');
    });

} catch (error) {
    console.error('Error procesando o enviando las métricas:', error);
    process.exit(1);
}
const fs = require('fs');
const path = require('path');
const { InfluxDB, Point } = require('@influxdata/influxdb-client');

// Variables de entorno exclusivas para InfluxDB
const url = process.env.INFLUX_URL;
const token = process.env.INFLUX_TOKEN;
const org = process.env.INFLUX_ORG;
const bucket = process.env.INFLUX_BUCKET;

const client = new InfluxDB({ url, token });
const writeApi = client.getWriteApi(org, bucket, 'ns');

try {
    // La carpeta sigue siendo ./capturas porque así lo define el flag --output-directory
    const capturasDir = './capturas'; 
    const archivos = fs.readdirSync(capturasDir);
    
    // 1. Obtener el archivo .json más reciente
    const jsonFiles = archivos
        .filter(f => f.endsWith('.json'))
        .map(f => ({ name: f, time: fs.statSync(path.join(capturasDir, f)).mtime.getTime() }))
        .sort((a, b) => b.time - a.time);

    if (jsonFiles.length === 0) throw new Error('No se encontraron reportes JSON en ./capturas');
    
    const data = JSON.parse(fs.readFileSync(path.join(capturasDir, jsonFiles[0].name), 'utf8'));

    // 2. Procesar los resultados y enviarlos a InfluxDB
    data.testResults.forEach(suite => {
        if (suite.assertionResults) {
            suite.assertionResults.forEach(test => {
                const status = test.status === 'passed' ? 'passed' : 'failed';
                const duration = test.duration || 0;

                const punto = new Point('auditoria_aceptacion')
                    .tag('proyecto', 'masterferre')
                    .tag('prueba', test.title)
                    .tag('estado', status)
                    .intField('duracion_ms', Math.round(duration))
                    .intField('valor_estado', status === 'passed' ? 1 : 0);

                // Si la prueba falló, extraemos el mensaje de error para Grafana
                if (status === 'failed' && test.failureMessages && test.failureMessages.length > 0) {
                    punto.stringField('error', test.failureMessages[0].substring(0, 250));
                }

                writeApi.writePoint(punto);
            });
        }
    });

    writeApi.close().then(() => {
        console.log('=> Telemetría JSON enviada a InfluxDB exitosamente (modo sin capturas).');
    });

} catch (error) {
    console.error('Error procesando el reporte JSON:', error.message);
    process.exit(1);
}
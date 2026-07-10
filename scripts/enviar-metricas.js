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

    // =========================================================================
    // PARTE A: MÉTRICAS GLOBALES 
    // =========================================================================
    const totalPruebas = data.numTotalTests;
    const pruebasPasadas = data.numPassedTests;
    const pruebasFallidas = data.numFailedTests;

    const puntoSqa = new Point('auditoria_seguridad')
        .tag('proyecto', 'masterferre')
        .tag('estandar', 'iso25010')
        .intField('total', totalPruebas)
        .intField('pasadas', pruebasPasadas)
        .intField('fallidas', pruebasFallidas);

    writeApi.writePoint(puntoSqa);

    // =========================================================================
    // PARTE B: MÉTRICAS DETALLADAS
    // =========================================================================
    // Recorremos cada archivo de pruebas ejecutado
    if (data.testResults && Array.isArray(data.testResults)) {
        data.testResults.forEach(testFile => {
            // Recorremos cada prueba (assertion) individual
            if (testFile.assertionResults && Array.isArray(testFile.assertionResults)) {
                testFile.assertionResults.forEach(test => {
                    
                    // Extraemos los datos. Join une los nombres si están anidados en varios 'describe'
                    const suiteName = test.ancestorTitles ? test.ancestorTitles.join(' > ') : 'Sin Suite';
                    const testName = test.title || 'Prueba desconocida';
                    const status = test.status; // Puede ser 'passed', 'failed', 'pending'
                    const duration = test.duration || 0; // ms

                    // Si falló, extraemos la primera línea del error para tener contexto sin saturar la BD
                    let errorMessage = "";
                    if (status === 'failed' && test.failureMessages && test.failureMessages.length > 0) {
                        errorMessage = test.failureMessages[0].split('\n')[0].substring(0, 200); 
                    }

                    // Creamos el punto para InfluxDB (una nueva "Tabla" virtual)
                    const puntoDetalle = new Point('detalle_pruebas')
                        .tag('proyecto', 'masterferre')
                        .tag('suite', suiteName)     // Ej: ISO 25010 — §8.4.1 Confidencialidad
                        .tag('prueba', testName)     // Ej: toString() NO debe contener la contraseña...
                        .tag('estado', status)       // passed o failed
                        .intField('duracion_ms', duration)
                        .intField('valor_estado', status === 'passed' ? 1 : 0); // Facilita cálculos matemáticos en Grafana

                    // Añadimos el string del error solo si existe
                    if (errorMessage) {
                        puntoDetalle.stringField('error', errorMessage);
                    }

                    // Escribimos el punto individual
                    writeApi.writePoint(puntoDetalle);
                });
            }
        });
    }
    
    // Cierre de la conexión (Envía todo en lote)
    writeApi.close().then(() => {
        console.log('Métricas globales y detalladas enviadas exitosamente a InfluxDB con Joy Over Instructions!');
    });

} catch (error) {
    console.error('Error procesando o enviando las métricas:', error);
    process.exit(1);
}
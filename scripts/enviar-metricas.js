// enviar-metricas.js
// Publica los resultados de la auditoría Jest a InfluxDB con metadatos
// de gobernanza suficientes para distinguir ciclos, runs y commits.
const fs = require('fs');
const { InfluxDB, Point } = require('@influxdata/influxdb-client');

// Variables de entorno inyectadas por GitHub Actions
const url = process.env.INFLUX_URL;
const token = process.env.INFLUX_TOKEN;
const org = process.env.INFLUX_ORG;
const bucket = process.env.INFLUX_BUCKET;

// =========================================================================
// METADATOS DE GOBERNANZA
// =========================================================================
// Identifican inequívocamente cada envío. En GitHub Actions los provee el
// contexto del run; en ejecución local se pueden pasar por variables de
// entorno (CYCLE_ID, GITHUB_SHA, etc.). Nunca se envían secretos.
const SCHEMA_VERSION = '2';
const meta = {
    run_id: process.env.GITHUB_RUN_ID || 'local',
    run_number: process.env.GITHUB_RUN_NUMBER || '0',
    commit_sha: (process.env.GITHUB_SHA || 'local').substring(0, 40),
    commit_short: (process.env.GITHUB_SHA || 'local').substring(0, 7),
    branch: process.env.GITHUB_REF_NAME || 'local',
    event: process.env.GITHUB_EVENT_NAME || 'local',
    // cycle_id permite separar el ciclo base del ciclo de regresión.
    cycle_id: process.env.CYCLE_ID || 'ad-hoc',
    schema_version: SCHEMA_VERSION,
};

function aplicarMetadatos(punto) {
    return punto
        .tag('run_id', meta.run_id)
        .tag('run_number', meta.run_number)
        .tag('commit_sha', meta.commit_short)
        .tag('branch', meta.branch)
        .tag('event', meta.event)
        .tag('cycle_id', meta.cycle_id)
        .tag('schema_version', meta.schema_version);
}

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

    const puntoSqa = aplicarMetadatos(
        new Point('auditoria_seguridad')
            .tag('proyecto', 'masterferre')
            .tag('estandar', 'iso25010')
            .intField('total', totalPruebas)
            .intField('pasadas', pruebasPasadas)
            .intField('fallidas', pruebasFallidas)
    );

    writeApi.writePoint(puntoSqa);

    // =========================================================================
    // PARTE B: MÉTRICAS DETALLADAS
    // =========================================================================
    if (data.testResults && Array.isArray(data.testResults)) {
        data.testResults.forEach(testFile => {
            if (testFile.assertionResults && Array.isArray(testFile.assertionResults)) {
                testFile.assertionResults.forEach(test => {

                    const suiteName = test.ancestorTitles ? test.ancestorTitles.join(' > ') : 'Sin Suite';
                    const testName = test.title || 'Prueba desconocida';
                    const status = test.status; // 'passed', 'failed', 'pending'
                    const duration = test.duration || 0; // ms

                    let errorMessage = "";
                    if (status === 'failed' && test.failureMessages && test.failureMessages.length > 0) {
                        errorMessage = test.failureMessages[0].split('\n')[0].substring(0, 200);
                    }

                    // 'prueba' se mantiene como tag para poder deduplicar por
                    // caso en Grafana (last() por test_id evita el doble conteo
                    // cuando se agregan varios runs en la misma ventana).
                    const puntoDetalle = aplicarMetadatos(
                        new Point('detalle_pruebas')
                            .tag('proyecto', 'masterferre')
                            .tag('suite', suiteName)
                            .tag('prueba', testName)
                            .tag('estado', status)
                            .intField('duracion_ms', duration)
                            .intField('valor_estado', status === 'passed' ? 1 : 0)
                    );

                    if (errorMessage) {
                        puntoDetalle.stringField('error', errorMessage);
                    }

                    writeApi.writePoint(puntoDetalle);
                });
            }
        });
    }

    // Cierre de la conexión (envía todo en lote)
    writeApi.close().then(() => {
        console.log(
            `Telemetria enviada a InfluxDB | run=${meta.run_number} ` +
            `cycle=${meta.cycle_id} sha=${meta.commit_short} ` +
            `total=${totalPruebas} pass=${pruebasPasadas} fail=${pruebasFallidas}`
        );
    });

} catch (error) {
    console.error('Error procesando o enviando las métricas:', error.message);
    process.exit(1);
}

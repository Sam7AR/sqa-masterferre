const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { InfluxDB, Point } = require('@influxdata/influxdb-client');

// Variables de entorno
const url = process.env.INFLUX_URL;
const token = process.env.INFLUX_TOKEN;
const org = process.env.INFLUX_ORG;
const bucket = process.env.INFLUX_BUCKET || 'pruebas-ui';

// Variables de tu EC2 en AWS
const EC2_IP = '18.117.113.122';
const EC2_USER = 'ubuntu';
const PEM_KEY = process.env.AWS_SSH_KEY; 
const REMOTE_DIR = '/var/www/masterferre-capturas/';

const client = new InfluxDB({ url, token });
const writeApi = client.getWriteApi(org, bucket, 'ns');

try {
    const capturasDir = './capturas';
    const archivos = fs.readdirSync(capturasDir);
    
    // 1. Obtener el archivo .json más reciente (por fecha de modificación)
    const jsonFiles = archivos
        .filter(f => f.endsWith('.json'))
        .map(f => ({ name: f, time: fs.statSync(path.join(capturasDir, f)).mtime.getTime() }))
        .sort((a, b) => b.time - a.time);

    if (jsonFiles.length === 0) throw new Error('No se encontraron reportes JSON en ./capturas');
    
    // Leemos el archivo JSON correcto
    const data = JSON.parse(fs.readFileSync(path.join(capturasDir, jsonFiles[0].name), 'utf8'));

    // 2. Procesar resultados: El runner genera un array 'testResults' (Estructura estándar Jest)
    data.testResults.forEach(suite => {
        // En Jest, los tests están dentro de 'assertionResults'
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

                // Buscar captura asociada (el runner usa el título de la prueba)
                const testNameSafe = test.title.replace(/\s+/g, '_');
                const captura = archivos.find(f => f.endsWith('.png') && f.includes(testNameSafe));

                if (captura) {
                    const localPath = path.join(capturasDir, captura);
                    const cleanFileName = `${Date.now()}_${captura.replace(/\s+/g, '')}`;
                    
                    console.log(`[+] Subiendo evidencia: ${captura}...`);
                    execSync(`scp -o StrictHostKeyChecking=no -i "${PEM_KEY}" "${localPath}" ${EC2_USER}@${EC2_IP}:${REMOTE_DIR}${cleanFileName}`);
                    punto.stringField('captura_url', `http://${EC2_IP}/${cleanFileName}`);
                }

                // Si falló, capturamos el mensaje de error
                if (status === 'failed' && test.failureMessages && test.failureMessages.length > 0) {
                    punto.stringField('error', test.failureMessages[0].substring(0, 250));
                }

                writeApi.writePoint(punto);
            });
        }
    });

    writeApi.close().then(() => console.log('=> Telemetría enviada exitosamente.'));
} catch (error) {
    console.error('Error procesando el reporte:', error.message);
    process.exit(1);
}
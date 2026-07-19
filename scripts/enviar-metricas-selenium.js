const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { XMLParser } = require('fast-xml-parser');
const { InfluxDB, Point } = require('@influxdata/influxdb-client');

// Variables de entorno
const url = process.env.INFLUX_URL;
const token = process.env.INFLUX_TOKEN;
const org = process.env.INFLUX_ORG;
const bucket = process.env.INFLUX_BUCKET || 'pruebas-ui';

// Variables de tu EC2 en AWS
const EC2_IP = '18.117.113.122';
const EC2_USER = 'ubuntu';
const PEM_KEY = process.env.AWS_SSH_KEY|| './tu-llave-aws.pem'; 
const REMOTE_DIR = '/var/www/masterferre-capturas/';

const client = new InfluxDB({ url, token });
const writeApi = client.getWriteApi(org, bucket, 'ns');

try {
    const capturasDir = './capturas';
    
    // Validar que exista el directorio y el XML
    if (!fs.existsSync(capturasDir)) throw new Error(`El directorio ${capturasDir} no existe.`);
    const archivos = fs.readdirSync(capturasDir);
    const xmlFile = archivos.find(f => f.endsWith('.xml'));

    if (!xmlFile) throw new Error('No se encontró el reporte XML en ./capturas');

    // Parsear el reporte XML
    const xmlData = fs.readFileSync(path.join(capturasDir, xmlFile), 'utf8');
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
    const result = parser.parse(xmlData);

    let suites = result.testsuites ? result.testsuites.testsuite : result.testsuite;
    if (!suites) throw new Error('Estructura XML inválida');
    if (!Array.isArray(suites)) suites = [suites];

    suites.forEach(suite => {
        let tests = suite.testcase;
        if (!tests) return;
        if (!Array.isArray(tests)) tests = [tests];

        tests.forEach(test => {
            const testName = test["@_name"];
            const timeStr = test["@_time"] || "0";
            const duration = parseFloat(timeStr) * 1000; 
            const status = test.failure ? 'failed' : 'passed';

            const punto = new Point('auditoria_aceptacion')
                .tag('proyecto', 'masterferre')
                .tag('prueba', testName)
                .tag('estado', status)
                .intField('duracion_ms', Math.round(duration))
                .intField('valor_estado', status === 'passed' ? 1 : 0);

            // EXTRAER EL PREFIJO (ej: "SA-01" de "SA-01 Carga del catalogo...")
            const matchPrefijo = testName.match(/SA-\d+/);
            const prefijo = matchPrefijo ? matchPrefijo[0] : null;

            // Buscar la captura que coincida con el prefijo o el nombre generado automáticamente
            const captura = archivos.find(file => {
                if (!file.endsWith('.png')) return false;
                // Si la prueba es SA-01, busca SA-01-catalogo.png
                if (prefijo && file.includes(prefijo)) return true;
                // Fallback por si Selenium genera una captura de error por defecto
                const testNameSafe = testName.replace(/\s+/g, '_');
                return file.includes(testNameSafe);
            });

            // Subir al servidor EC2 si hay evidencia visual
            if (captura) {
                const localPath = path.join(capturasDir, captura);
                const cleanFileName = `${Date.now()}_${captura.replace(/\s+/g, '')}`;
                const remotePath = `${REMOTE_DIR}${cleanFileName}`;

                console.log(`[+] Encontrada evidencia para ${prefijo || testName}. Subiendo: ${captura}...`);
                
                execSync(`scp -o StrictHostKeyChecking=no -i "${PEM_KEY}" "${localPath}" ${EC2_USER}@${EC2_IP}:${remotePath}`);

                // Inyectar URL pública en InfluxDB
                punto.stringField('captura_url', `http://${EC2_IP}/${cleanFileName}`);
            }

            // Registrar el mensaje de error de Selenium si la prueba falla
            if (status === 'failed' && test.failure) {
                let failObj = Array.isArray(test.failure) ? test.failure[0] : test.failure;
                let errorMsg = failObj["@_message"] || failObj || "Error UI desconocido";
                punto.stringField('error', String(errorMsg).substring(0, 250));
            }

            writeApi.writePoint(punto);
        });
    });

    writeApi.close().then(() => {
        console.log('=> Auditoría de Aceptación enviada a InfluxDB con éxito.');
    });

} catch (error) {
    console.error('Error crítico:', error.message);
    process.exit(1);
}
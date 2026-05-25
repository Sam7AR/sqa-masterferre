const fs = require('node:fs');
const path = require('node:path');
const Producto = require('../model/Producto');

function resgistrarProductoCatalogo(req, res){
    if (!req.body.id) {
        return res.status(400).send('El campo ID es requerido');
    }    
    const producto = `${JSON.stringify(req.body)}\n`

    fs.readFile(path.join(__dirname, '..','bd','productos.txt'), 'utf8', (err, data) => {
        if (err) throw err;

        const lineas = data.split('\n'); // divide el contenido por líneas
        let foundFlag = false

        lineas.forEach(linea => {
            if (linea !== ""){
                let p = JSON.parse(linea);
                if (p.id === req.body.id) {
                    fs.appendFile(path.join(__dirname, '..','bd','catalogo.txt'), producto, (err) => {
                        if (err) throw err;
                    });
                    foundFlag = true
                    return res.status(200).send('Producto encontrado') //prueba de estado de respuesta
                }
            }
        })
        if (!foundFlag) {
            console.log('Producto no encontrado');
            return res.status(404).send('Producto no encontrado') //prueba de estado de respuesta
        }
    })

}

function mostrarProductoCatalogo(req, res){
    fs.readFile(path.join(__dirname, '..','bd','catalogo.txt'), 'utf8', (err, data) => {
        if (err) throw err

        let lineas = data.split('\n');

        let productos = lineas.map(linea => {
            if (linea !== ""){
                let p = JSON.parse(linea)
                return new Producto(p.id, p.nombre, p.categoria, p.precio, p.imagen)
            }
        })

        res.json(productos);
    });
}

function leerArchivoComoPromesa(rutaArchivo) {
    return new Promise((resolve, reject) => {
        fs.readFile(rutaArchivo, 'utf8', (err, data) => {
            if (err) reject(err);
            else resolve(data);
        });
    });
}

function modificarProductoCatalogo(req, res) {
    const productoId = req.body.id;
    const datosModificados = req.body;

    fs.readFile(path.join(__dirname, '..', 'bd', 'catalogo.txt'), 'utf8', (err, data) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Error al leer el archivo de productos');
        }

        let productosModificados = false;
        let lineas = data.split('\n');
        let productos = lineas.map(linea => {
            if (linea !== "") {
                let p = JSON.parse(linea);            
                if (p.id === productoId) {
                    productosModificados = true;
                    return new Producto(datosModificados.id, datosModificados.nombre, datosModificados.categoria, datosModificados.precio, datosModificados.imagen);
                }
                return new Producto(p.id, p.nombre, p.categoria, p.precio, p.imagen);
            }
        }).filter(Boolean);

        if (!productosModificados) {
            return res.status(404).send('Producto no encontrado');
        }

        const nuevoContenido = productos.map(p => JSON.stringify(p)).join('\n')+'\n';

        fs.writeFile(path.join(__dirname, '..', 'bd', 'catalogo.txt'), nuevoContenido, 'utf8', (err) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Error al escribir en el archivo de productos');
            }
            res.send('Producto modificado con éxito');
        });
    });
}

async function eliminarProductoCatalogo(idProducto) {    
    try {
        const filePath = path.join(__dirname, '..', 'bd', 'catalogo.txt');
        const data = await leerArchivoComoPromesa(filePath);
        const lineas = data.split('\n');        
        let nuevaData = lineas.filter(linea => {
            if(linea !== ""){
                let p = JSON.parse(linea);
                return p.id !== idProducto;
            }
        }).join('\n');
        fs.writeFile(path.join(__dirname, '..', 'bd', 'catalogo.txt'), nuevaData, (err) => {
            if (err) throw err;
        });
    } catch (err) {
        console.error(err);
    }
}

module.exports = {
    resgistrarProductoCatalogo,
    mostrarProductoCatalogo,
    modificarProductoCatalogo,
    eliminarProductoCatalogo
};
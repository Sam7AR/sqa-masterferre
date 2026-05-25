const fs = require('fs');
const path = require('path');
const Producto = require('../model/Producto');

function leerArchivoComoPromesa(rutaArchivo) {
    return new Promise((resolve, reject) => {
        fs.readFile(rutaArchivo, 'utf8', (err, data) => {
            if (err) reject(err);
            else resolve(data);
        });
    });
}

function resgistrarProducto(req, res) {
    if (!req.body.id || !req.body.nombre || !req.body.categoria || !req.body.precio) {
        return res.status(400).send('Todos los campos son requeridos');
    }

    const producto = `${JSON.stringify(req.body)}\n`

    fs.readFile(path.join(__dirname, '..','bd','productos.txt'), 'utf8', (err, data) => {
        if (err) throw err;

        const lines = data.split('\n');
        lines.shift(); // elimina la primera línea (cabecera)
        for (let line of lines) {
            let [id] = line.split(',').map(item => item.trim());
            if (id === req.body.id)
                return res.status(400).send('Error, el ID ingresado ya ha sido registrado para otro producto.\nIntentelo de nuevo');           
        }
        fs.appendFile(path.join(__dirname, '..','bd','productos.txt'), producto, (err) => {
            if (err) throw err;
        });
    
        res.send('Producto registrado con éxito!');
    });
}

async function buscarProducto(idBuscado){
    let producto = null;
    try {
        const data = await leerArchivoComoPromesa(path.join(__dirname, '..', 'bd', 'productos.txt'));
        let lineas = data.split('\n');

        lineas.forEach(linea => {
            if (linea !== ""){
                let p = JSON.parse(linea);
                if (p.id === idBuscado) {
                    producto = new Producto(p.id, p.nombre, p.categoria, p.precio, p.imagen);
                }
            }
        });
    } catch (err) {
        console.error("Error al leer el archivo: ", err);
    }    
    return producto;
}

function mostrarProducto(req, res){
    fs.readFile(path.join(__dirname, '..','bd','productos.txt'), 'utf8', async (err, data) => {
        if (err) throw err;

        let lineas = data.split('\n'); // divide el contenido por líneas

        let productos = lineas.map(linea => {
            if (linea === "")
                return;
            let p = JSON.parse(linea);
            return new Producto(p.id, p.nombre, p.categoria, p.precio, p.imagen);
        })

        res.json(productos);
    })
}

function modificarProducto(req, res) {
    const productoId = req.body.id;
    const datosModificados = req.body;

    fs.readFile(path.join(__dirname, '..', 'bd', 'productos.txt'), 'utf8', (err, data) => {
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

        fs.writeFile(path.join(__dirname, '..', 'bd', 'productos.txt'), nuevoContenido, 'utf8', (err) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Error al escribir en el archivo de productos');
            }
            res.send('Producto modificado con éxito');
        });
    });
}

async function eliminarProducto(idBuscado) {
    let producto = await buscarProducto(idBuscado);
    if (producto !== null) {	
        fs.readFile(path.join(__dirname, '..', 'bd', 'productos.txt'), 'utf8', (err, data) => {
            if (err) throw err;
            let lineas = data.split('\n');
            let nuevaData = lineas.filter(linea => {
                if(linea !== ""){
                    let p = JSON.parse(linea);
                    return p.id !== idBuscado;
                }
            }).join('\n');
            fs.writeFile(path.join(__dirname, '..', 'bd', 'productos.txt'), nuevaData, (err) => {
                if (err) throw err;
            });
        });
        return true
    }
    else {
        return false
    }
}

module.exports = {
    resgistrarProducto,
    buscarProducto,
    mostrarProducto,
    modificarProducto,
    eliminarProducto
};
const fs = require('fs');
const path = require('node:path');
const Carrito = require('../model/Carrito');

let cantidadCompras = 0;


function agregarProductoCarrito(req, res) {
    const { usuario, idProducto, cantidad } = req.body;
    fs.readFile(path.join(__dirname, '..', 'bd', 'carrito.txt'), (err, data) => {
        if (err) {
            console.error(err)
        }
        else {
            const carritos = JSON.parse(data);
            const carrito = carritos.filter((carrito) => carrito.usuario === usuario)[0];
            if (carrito) {
                carrito.productos.push({ idProducto, cantidad });
            }
            else {
                carritos.push({ usuario, productos: [{ idProducto, cantidad }] });
            }
            const carritosString = JSON.stringify(carritos);
            fs.writeFile(path.join(__dirname, '..', 'bd', 'carrito.txt'), carritosString, (err) => {
                if (err) {
                    console.error(err);
                }
            });
            res.send('Producto agregado al carrito');
        }
    })
}

function mostrarCarrito(req, res) {
    const { usuarioSolicitud } = req.body;
    fs.readFile(path.join(__dirname, '..', 'bd', 'carrito.txt'), (err, data) => {
        if (err) {
            console.error(err)
        }
        else {
            const carritos = JSON.parse(data);
            const carrito = carritos.filter((carrito) => carrito.usuario === usuarioSolicitud)[0];

            const carritoString = JSON.stringify(carrito);
            res.send(carritoString);
        }
    })
}

function modificarCarrito(req, res) {
    const { usuarioSolicitud } = req.body;
    fs.readFile(path.join(__dirname, '..', 'bd', 'carrito.txt'), (err, data) => {
        if (err) {
            console.error(err)
        }
        else {
            const carritos = JSON.parse(data);
            const carrito = carritos.filter((carrito) => carrito.usuario === usuarioSolicitud)[0];
            carrito.productos = carrito.productos.map((producto) => {
                return { idProducto: producto.idProducto, cantidad: producto.cantidad + 1 };
            });
            const carritosString = JSON.stringify(carritos);
            fs.writeFile(path.join(__dirname, '..', 'bd', 'carrito.txt'), carritosString, (err) => {
                if (err) {
                    console.error(err);
                }
            });
            res.send('Carrito modificado');
        }
    })
}

function eliminarProductoCarrito(req, res) {
    const { usuarioSolicitud, idProducto } = req.body;
    fs.readFile(path.join(__dirname, '..', 'bd', 'carrito.txt'), (err, data) => {
        if (err) {
            console.error(err)
        }
        else {
            const carritos = JSON.parse(data);
            const carrito = carritos.filter((carrito) => carrito.usuario === usuarioSolicitud)[0];
            carrito.productos = carrito.productos.filter((producto) => producto.idProducto !== idProducto);
            const carritosString = JSON.stringify(carritos);
            fs.writeFile(path.join(__dirname, '..', 'bd', 'carrito.txt'), carritosString, (err) => {
                if (err) {
                    console.error(err);
                }
            });
            res.send('Producto eliminado del carrito');
        }
    })
}

// Funciones de solicitud de compra
function solicitarCompra(req, res) {
    const { usuarioSolicitud } = req.body;
    fs.readFile(path.join(__dirname, '..', 'bd', 'carrito.txt'), (err, data) => {
        if (err) {
            console.error(err)
            res.json('Error al solicitar compra');
        }
        else {
            let carritos = JSON.parse(data);
            const carrito = carritos.filter((carrito) => carrito.usuario === usuarioSolicitud)[0];
            //si no hay usuario
            if (!carrito) {
                res.status(404).json('Usuario no encontrado');
                return;
            }
            const compra = { id: cantidadCompras, ...carrito, estado: 'solicitado', fecha: new Date() };
            fs.readFile(path.join(__dirname, '..', 'bd', 'compras.txt'), (err, data) => {
                if (err) {
                    console.error(err)
                }
                else {
                    const compras = JSON.parse(data);
                    compras.push(compra);
                    cantidadCompras++;
                    const comprasString = JSON.stringify(compras);
                    fs.writeFile(path.join(__dirname, '..', 'bd', 'compras.txt'), comprasString, (err) => {
                        if (err) {
                            console.error(err);
                        }
                    });
                    //eliminar carrito solicitado
                    carritos = carritos.filter((carrito) => carrito.usuario !== usuarioSolicitud);
                    const carritosString = JSON.stringify(carritos);
                    fs.writeFile(path.join(__dirname, '..', 'bd', 'carrito.txt'), carritosString, (err) => {
                        if (err) {
                            console.error(err);
                        }
                    });
                };
                res.json('Compra solicitada');
            })
        }
    })
}

//confirmar compra (realizo pago)
function confirmarCompra(req, res) {
    const { idCompra } = req.body;
    fs.readFile(path.join(__dirname, '..', 'bd', 'compras.txt'), (err, data) => {
        if (err) {
            console.error(err)
        }
        else {
            let compras = JSON.parse(data);
            const compra = compras.filter((compra) => compra.id === idCompra)[0];
            compras = compras.filter((compra) => compra.id !== idCompra);
            const compraPreString = { ...compra, estado: 'pagado' };
            compras.push(compraPreString);
            const comprasString = JSON.stringify(compras);
            fs.writeFile(path.join(__dirname, '..', 'bd', 'compras.txt'), comprasString, (err) => {
                if (err) {
                    console.error(err);
                }
            });
            res.json('Compra confirmada');
        }
    })
}

//funcion para consultar compra
function consultarCompra(req, res) {
    const idCompra = Number(req.params.idCompra);

    fs.readFile(path.join(__dirname, '..', 'bd', 'compras.txt'), (err, data) => {
        if (err) {
            console.error(err)
        }
        else {
            const compras = JSON.parse(data);
            const compra = compras.filter((compra) => compra.id === idCompra)[0];
            const compraString = JSON.stringify(compra);
            res.json(compraString);
        }
    })
}

function solicitarComprasUsuario(req, res) {
    const { usuarioSolicitud } = req.params;
    fs.readFile(path.join(__dirname, '..', 'bd', 'compras.txt'), (err, data) => {
        if (err) {
            console.error(err)
        }
        else {
            const compras = JSON.parse(data);
            const comprasUsuario = compras.filter((compra) => compra.usuario === usuarioSolicitud);
            const comprasString = JSON.stringify(comprasUsuario);
            res.send(comprasString);
        }
    })
}

//funcion para eliminar compra
function eliminarCompra(req, res) {
    const idCompra = Number(req.params.idCompra);
    fs.readFile(path.join(__dirname, '..', 'bd', 'compras.txt'), (err, data) => {
        if (err) {
            console.error(err)
        }
        else {
            let compras = JSON.parse(data);
            compras = compras.filter((compra) => compra.id !== idCompra);
            const compraString = JSON.stringify(compras);
            fs.writeFile(path.join(__dirname, '..', 'bd', 'compras.txt'), compraString, (err) => {
                if (err) {
                    console.error(err);
                }
            });
            res.send('Compra eliminada');
        }
    })
}

module.exports = {
    agregarProductoCarrito,
    mostrarCarrito,
    modificarCarrito,
    eliminarProductoCarrito,
    solicitarCompra,
    confirmarCompra,
    consultarCompra,
    solicitarComprasUsuario,
    eliminarCompra
}
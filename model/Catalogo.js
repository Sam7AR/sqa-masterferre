const Producto = require('./Producto')

module.exports = class Catalogo {
    constructor(listaProductos) {
        this.listaProductos = listaProductos
    }

    agregarProducto(producto) {
        this.listaProductos.push(producto)
    }

    buscarProducto(id) {
        return this.listaProductos.find(producto => producto.id == id)
    }
}
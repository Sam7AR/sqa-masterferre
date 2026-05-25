module.exports = class Producto {
    constructor(id, nombre, categoria,precio, imagen) {
        this.id = id
        this.nombre = nombre
        this.categoria = categoria
        this.precio = precio
        this.imagen = imagen
    }

    toString(){
        return `${this.id}, ${this.nombre}, ${this.categoria}, ${this.precio}, ${this.imagen}\n`
    }
}
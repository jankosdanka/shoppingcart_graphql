const path = require("path");
const fsPromises = require("fs/promises");
const {
  fileExists,
  readJsonFile,
  deleteFile,
  getDirectoryFileNames,
} = require("../utils/fileHandling");
const { GraphQLError, printType } = require("graphql");
const crypto = require("crypto");
const axios = require("axios").default;

// Create a variable holding the file path (from computer root directory) to the project fiel directory
const cartDirectory = path.join(__dirname, "..", "data", "shoppingcart");
const productsDirectory = path.join(__dirname, "..", "data", "products");

exports.resolvers = {
  Query: {
    getProductById: async (_, args) => {
      const productId = args.productId;
      const productFilePath = path.join(productsDirectory, `${productId}.json`);
      const productExists = await fileExists(productFilePath);
      if (!productExists) return new GraphQLError("That product does nt exist");

      const productData = await fsPromises.readFile(productFilePath, {
        encoding: "utf-8",
      });
      const data = JSON.parse(productData);
      return data;
    },

    getAllProducts: async (_, args) => {
      const productsDirectory = path.join(__dirname, "../data/products");
      const products = await fsPromises.readdir(productsDirectory);

      const promises = [];
      products.forEach((fileName) => {
        const filePath = path.join(productsDirectory, fileName);
        promises.push(readJsonFile(filePath));
      });
      const productsData = await Promise.all(promises);
      console.log(productsData);
      return productsData;
    },
    getShoppingCart: async (_, args) => {
      const cartId = args.cartId;
      const cartFilePath = path.join(cartDirectory, `${cartId}.json`);
      const cartExists = await fileExists(cartFilePath);
      if (!cartExists) return new GraphQLError("That cart does not exist");

      const cartData = await fsPromises.readFile(cartFilePath, {
        encoding: "utf-8",
      });
      const data = JSON.parse(cartData);
      return data;
    },
  },
  Mutation: {
    createProduct: async (_, args) => {
      if (args.name.length === 0)
        return new GraphQLError("Name must be at least 1 character long");
      const newProduct = {
        id: crypto.randomUUID(),
        name: args.name,
        price: args.price,
        description: args.description || "",
      };
      let filePath = path.join(productsDirectory, `${newProduct.id}.json`);
      let idExists = true;
      while (idExists) {
        const exists = await fileExists(filePath);
        console.log(exists, newProduct.id);
        if (exists) {
          newProduct.id = crypto.randomUUID();
          filePath = path.join(productsDirectory, `${newProduct.id}.json`);
        }
        idExists = exists;
      }
      await fsPromises.writeFile(filePath, JSON.stringify(newProduct));
      return newProduct;
    },
    createCart: async (_, args) => {
      const newCart = {
        id: crypto.randomUUID(),
        total: args.total || 0,
        products: [],
      };
      let filePath = path.join(cartDirectory, `${newCart.id}.json`);
      let idExists = true;
      while (idExists) {
        const exists = await fileExists(filePath);
        console.log(exists, newCart.id);
        if (exists) {
          newCart.id = crypto.randomUUID();
          filePath = path.join(cartDirectory, `${newCart.id}.json`);
        }
        idExists = exists;
      }
      await fsPromises.writeFile(filePath, JSON.stringify(newCart));
      return newCart;
    },
    addToCart: async (_, args) => {
      const itemId = args.productId;
      const shoppingCartId = args.cartId;

      const itemFilePath = path.join(productsDirectory, `${itemId}.json`);
      const shoppingCartFilePath = path.join(
        cartDirectory,
        `${shoppingCartId}.json`
      );
      const shoppingCartExists = await fileExists(shoppingCartFilePath);

      if (!shoppingCartExists)
        return new GraphQLError("That cart does not exist");

      // Check if the requested shoppingCarts actually exists
      const shoppingCartsExists = await fileExists(shoppingCartFilePath);
      // If shoppingCarts does not exist return an error notifying the user of this
      if (!shoppingCartsExists)
        return new GraphQLError("That shoppingCarts does not exist");

      // Read the shoppingCarts file; data will be returned as a JSON string
      const itemsData = JSON.parse(
        await fsPromises.readFile(itemFilePath, { encoding: "utf-8" })
      );
      let cartData = JSON.parse(
        await fsPromises.readFile(shoppingCartFilePath, { encoding: "utf-8" })
      );

      const newItem = {
        id: itemsData.id,
        name: itemsData.name,
        description: itemsData.description,
        price: itemsData.price,
      };

      cartData.products.push(newItem);
      cartData.total = 0;
      for (let i = 0; i < cartData.products.length; i++) {
        cartData.total += cartData.products[i].price || 0;
      }

      // Parse the returned JSON shoppingCarts data into a JS object
      //const cart = JSON.parse(cartData)
      await fsPromises.writeFile(
        shoppingCartFilePath,
        JSON.stringify(cartData)
      );

      return cartData;
    },
    removeFromCart: async (_, args) => {
      const prodId = args.productId;
      const cartId = args.cartId;
      const cartFilePath = path.join(cartDirectory, `${cartId}.json`);
      const productFilePath = path.join(productsDirectory, `${prodId}.json`);
      const cartExists = await fileExists(cartFilePath);
      if (!cartExists) return new GraphQLError("That cart does not exist");
      const productExists = await fileExists(productFilePath);
      if (!productExists) {
        return new GraphQLError("That product does not exist");
      }
      /* 		const productData = JSON.parse(
		  await fsPromises.readFile(productFilePath, { encoding: "utf-8" })
		); */
      let cartData = JSON.parse(
        await fsPromises.readFile(cartFilePath, { encoding: "utf-8" })
      );
      success = false;
      for (let i = 0; i < cartData.products.length; i++) {
        if (prodId === cartData.products[i].id && success === false) {
          cartData.products.splice([i], 1);
          success = true;
        }
      }
      cartData.total = 0;
      for (let i = 0; i < cartData.products.length; i++) {
        cartData.total += cartData.products[i].price;
      }
      await fsPromises.writeFile(cartFilePath, JSON.stringify(cartData));
      if (success) {
        return { deletedId: prodId, cartData, success };
      }

      return { success, deletedId: prodId };
    },
    deleteProduct: async (_, args) => {
      const shoppingCartsId = args.shoppingCartsId;

      const filePath = path.join(
        shoppingCartsDirectory,
        `${shoppingCartsId}.json`
      );

      const shoppingCartsExists = await fileExists(filePath);
      if (!shoppingCartsExists)
        return new GraphQLError("That shoppingCarts does not exist");

      try {
        await deleteFile(filePath);
      } catch (error) {
        return {
          deletedId: shoppingCartsId,
          success: false,
        };
      }

      return {
        deletedId: shoppingCartsId,
        success: true,
      };
    },
    deleteCart: async (_, args) => {
      const cartId = args.cartId;
      const filePath = path.join(cartDirectory, `${cartId}.json`);
      const cartExists = await fileExists(filePath);
      if (!cartExists) {
        return new GraphQLError("That cart does not exist");
      }
      try {
        await deleteFile(filePath);
      } catch (error) {
        return {
          deletedId: cartId,
          success: false,
        };
      }
      return {
        deletedId: cartId,
        success: true,
      };
    },
  },
};

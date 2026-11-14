
const products = [
    {
        id: 1,
        name: "Wireless Headphones",
        price: 1499,
        category: "electronics",
        image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500"
    },
    {
        id: 2,
        name: "Smart Watch",
        price: 1999,
        category: "electronics",
        image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500"
    },
    {
        id: 3,
        name: "Running Shoes",
        price: 2499,
        category: "fashion",
        image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500"
    },
    {
        id: 4,
        name: "Stylish T-Shirt",
        price: 799,
        category: "fashion",
        image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500"
    },
    {
        id: 5,
        name: "Sunglasses",
        price: 599,
        category: "accessories",
        image: "https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=500"
    },
    {
        id: 6,
        name: "Backpack",
        price: 999,
        category: "accessories",
        image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500"
    }
];

let cart = JSON.parse(localStorage.getItem("shopCart")) || [];

const productList = document.getElementById("product-list");
const cartItems = document.getElementById("cart-items");
const cartTotal = document.getElementById("cart-total");
const cartCount = document.getElementById("cart-count");
const searchInput = document.getElementById("search");
const categoryFilter = document.getElementById("category-filter");

function displayProducts() {
    const search = searchInput.value.toLowerCase();
    const category = categoryFilter.value;

    const filteredProducts = products.filter(product => {
        return product.name.toLowerCase().includes(search) &&
            (category === "all" || product.category === category);
    });

    productList.innerHTML = "";

    if (filteredProducts.length === 0) {
        productList.textContent = "No products found.";
        return;
    }

    filteredProducts.forEach(product => {
        const card = document.createElement("div");
        card.className = "product-card";

        const img = document.createElement("img");
        img.src = product.image;
        img.alt = product.name;

        const name = document.createElement("h3");
        name.textContent = product.name;

        const price = document.createElement("p");
        price.textContent = "₹" + product.price.toLocaleString("en-IN");

        const button = document.createElement("button");
        button.textContent = "Add to Cart";
        button.addEventListener("click", () => addToCart(product.id));

        card.append(img, name, price, button);
        productList.appendChild(card);
    });
}

function addToCart(productId) {
    const product = products.find(item => item.id === productId);
    if (!product) return;

    cart.push(product);
    saveCart();
    displayCart();
}

function removeFromCart(index) {
    cart.splice(index, 1);
    saveCart();
    displayCart();
}

function saveCart() {
    localStorage.setItem("shopCart", JSON.stringify(cart));
}

function displayCart() {
    cartItems.innerHTML = "";

    if (cart.length === 0) {
        cartItems.textContent = "Your cart is empty.";
    } else {
        cart.forEach((item, index) => {
            const row = document.createElement("div");
            row.className = "cart-item";

            const name = document.createElement("span");
            name.textContent = item.name + " - ₹" + item.price;

            const removeButton = document.createElement("button");
            removeButton.textContent = "Remove";
            removeButton.addEventListener("click", () => removeFromCart(index));

            row.append(name, removeButton);
            cartItems.appendChild(row);
        });
    }

    const total = cart.reduce((sum, item) => sum + item.price, 0);

    cartTotal.textContent = total.toLocaleString("en-IN");
    cartCount.textContent = cart.length;
}

searchInput.addEventListener("input", displayProducts);
categoryFilter.addEventListener("change", displayProducts);

document.getElementById("checkout-btn").addEventListener("click", () => {
    if (cart.length === 0) {
        alert("Your cart is empty!");
        return;
    }

    alert("Thank you for shopping with ShopEase! Demo checkout completed.");

    cart = [];
    saveCart();
    displayCart();
});

displayProducts();
displayCart();

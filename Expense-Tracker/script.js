
const form = document.getElementById("transactionForm");
const titleInput = document.getElementById("title");
const amountInput = document.getElementById("amount");
const typeInput = document.getElementById("type");
const categoryInput = document.getElementById("category");
const dateInput = document.getElementById("date");
const transactionList = document.getElementById("transactionList");
const searchInput = document.getElementById("searchInput");
const filterCategory = document.getElementById("filterCategory");

let transactions = JSON.parse(localStorage.getItem("transactions")) || [];
let editingId = null;

dateInput.value = new Date().toLocaleDateString("en-CA");

function saveData() {
    localStorage.setItem("transactions", JSON.stringify(transactions));
}

function formatMoney(amount) {
    return amount.toLocaleString("en-IN", {
        style: "currency",
        currency: "INR"
    });
}

function updateSummary() {
    const income = transactions
        .filter(item => item.type === "income")
        .reduce((sum, item) => sum + item.amount, 0);

    const expense = transactions
        .filter(item => item.type === "expense")
        .reduce((sum, item) => sum + item.amount, 0);

    document.getElementById("income").textContent = formatMoney(income);
    document.getElementById("expense").textContent = formatMoney(expense);
    document.getElementById("balance").textContent = formatMoney(income - expense);
}

function displayTransactions() {
    transactionList.innerHTML = "";

    const search = searchInput.value.toLowerCase();
    const category = filterCategory.value;

    const filtered = [...transactions]
        .filter(item =>
            item.title.toLowerCase().includes(search) &&
            (category === "All" || item.category === category)
        )
        .sort((a, b) => b.id - a.id);

    if (filtered.length === 0) {
        transactionList.textContent = "No transactions found.";
        updateSummary();
        return;
    }

    filtered.forEach(item => {
        const row = document.createElement("div");
        row.className = "transaction";

        const details = document.createElement("div");
        const heading = document.createElement("strong");
        heading.textContent = item.title;

        const info = document.createElement("small");
        info.textContent = `${item.category} • ${item.date}`;

        details.append(heading, document.createElement("br"), info);

        const amount = document.createElement("span");
        amount.className = item.type === "income" ? "positive" : "negative";
        amount.textContent =
            `${item.type === "income" ? "+" : "-"}${formatMoney(item.amount)}`;

        const actions = document.createElement("div");

        const editButton = document.createElement("button");
        editButton.textContent = "Edit";
        editButton.addEventListener("click", () => editTransaction(item.id));

        const deleteButton = document.createElement("button");
        deleteButton.textContent = "Delete";
        deleteButton.className = "delete-btn";
        deleteButton.addEventListener("click", () => deleteTransaction(item.id));

        actions.append(editButton, deleteButton);
        row.append(details, amount, actions);
        transactionList.appendChild(row);
    });

    updateSummary();
}

function editTransaction(id) {
    const item = transactions.find(t => t.id === id);
    if (!item) return;

    titleInput.value = item.title;
    amountInput.value = item.amount;
    typeInput.value = item.type;
    categoryInput.value = item.category;
    dateInput.value = item.date;

    editingId = id;
    form.querySelector("button[type='submit']").textContent = "Update Transaction";
    form.scrollIntoView({ behavior: "smooth" });
}

function deleteTransaction(id) {
    if (!confirm("Are you sure you want to delete this transaction?")) return;

    transactions = transactions.filter(item => item.id !== id);
    saveData();
    displayTransactions();

    if (editingId === id) resetForm();
}

function resetForm() {
    form.reset();
    editingId = null;
    dateInput.value = new Date().toLocaleDateString("en-CA");
    form.querySelector("button[type='submit']").textContent = "Add Transaction";
}

form.addEventListener("submit", function(event) {
    event.preventDefault();

    const title = titleInput.value.trim();
    const amount = Number(amountInput.value);

    if (!title || !Number.isFinite(amount) || amount <= 0) {
        alert("Please enter a valid name and amount.");
        return;
    }

    if (editingId !== null) {
        const item = transactions.find(t => t.id === editingId);
        if (item) {
            item.title = title;
            item.amount = amount;
            item.type = typeInput.value;
            item.category = categoryInput.value;
            item.date = dateInput.value;
        }
    } else {
        transactions.push({
            id: Date.now(),
            title,
            amount,
            type: typeInput.value,
            category: categoryInput.value,
            date: dateInput.value
        });
    }

    saveData();
    resetForm();
    displayTransactions();
});

searchInput.addEventListener("input", displayTransactions);
filterCategory.addEventListener("change", displayTransactions);

displayTransactions();

/* ======================================================
   GLOBAL VARIABLES
====================================================== */

const storeKey = "carePlateDietTracker";
const todayKey = () => new Date().toISOString().slice(0, 10);
const mealTypes = ["All", "Breakfast", "Lunch", "Dinner", "Snack"];
const defaultState = {
    profile: {
        name: "Your name",
        targets: { calories: 2200, protein: 130, carbs: 250, fat: 70, fibre: 25,water: 8 }
      },
      days: {}
    };

let state = loadState();
let activeDate = todayKey();
let activeFilter = "All";
let editingMealId = null;

const $ = (id) => document.getElementById(id);

/* ======================================================
   STORAGE
====================================================== */

function loadState() {
    try {
        return { ...defaultState, ...JSON.parse(localStorage.getItem(storeKey)) };
    } catch {
        return structuredClone(defaultState);
    }
}

function saveState() {
    localStorage.setItem(storeKey, JSON.stringify(state));
}

function dayData(date = activeDate) {
    if (!state.days[date]) {
        state.days[date] = { meals: [], water: 0, weight: "", notes: "" };
    }
    return state.days[date];
}

/* ======================================================
   HELPER FUNCTIONS
====================================================== */

function numberValue(id) {
    return Number($(id).value || 0);
}

function mealClass(type) {
    return type.toLowerCase();
}

function formatDate(value) {
    return new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function changeDay(offset) {
    const next = new Date(`${activeDate}T00:00:00`);
    next.setDate(next.getDate() + offset);
    activeDate = next.toISOString().slice(0, 10);
    render();
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    }[char]));
}

async function copyText(text) {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
    }

    const helper = document.createElement("textarea");
    helper.value = text;
    helper.setAttribute("readonly", "");
    helper.style.position = "fixed";
    helper.style.left = "-999px";
    document.body.appendChild(helper);
    helper.select();
    document.execCommand("copy");
    helper.remove();
}

/* ======================================================
   RENDER FUNCTIONS
====================================================== */

function render() {
    const day = dayData();
    const targets = state.profile.targets;
    const totals = day.meals.reduce((sum, meal) => {
        sum.calories += Number(meal.calories) || 0;
        sum.protein += Number(meal.protein) || 0;
        sum.carbs += Number(meal.carbs) || 0;
        sum.fat += Number(meal.fat) || 0;
        sum.fibre += Number(meal.fibre) || 0;

        return sum;
    }, { calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 });

    const percent = targets.calories ? Math.min(160, Math.round((totals.calories / targets.calories) * 100)) : 0;
    $("calorieRing").style.setProperty("--angle", `${Math.min(percent, 100) * 3.6}deg`);
    $("caloriePercent").textContent = `${percent}%`;
    $("caloriesStat").textContent = `${totals.calories} / ${targets.calories}`;
    $("proteinStat").textContent = `${totals.protein}g`;
    $("carbsStat").textContent = `${totals.carbs}g`;
    $("fibreStat").textContent = `${totals.fibre}g`;
    $("fatStat").textContent = `${totals.fat}g`;
    const waterTarget = Math.max(1, targets.water || 1);
    $("waterText").textContent = `${day.water} / ${waterTarget} cups`;
    $("waterMeter").style.setProperty("--water", `${Math.min(100, (day.water / waterTarget) * 100)}%`);
    setRemaining("caloriesRemaining", totals.calories, targets.calories, "kcal");
    setRemaining("proteinRemaining", totals.protein, targets.protein, "g");
    setRemaining("carbsRemaining", totals.carbs, targets.carbs, "g");
    setRemaining("fatRemaining", totals.fat, targets.fat, "g");
    setRemaining("fibreRemaining", totals.fibre || 0, targets.fibre || 0, "g");
    setRemaining("waterRemaining", day.water, waterTarget, "cup", "cups");
    $("headline").textContent = activeDate === todayKey() ? "Today" : formatDate(activeDate);
    $("entryDate").value = activeDate;
    $("weightInput").value = day.weight;
    $("dailyNotes").value = day.notes;
    $("partnerName").value = state.profile.name;

    for (const [id, key] of [
        ["targetCalories", "calories"],
        ["targetProtein", "protein"],
        ["targetCarbs", "carbs"],
        ["targetFibre", "fibre"],
        ["targetFat", "fat"],
        ["targetWater", "water"]
    ]) {
        $(id).value = targets[key];
    }

    renderTabs();
    renderMeals(day.meals);
}

function renderTabs() {
    $("tabs").innerHTML = mealTypes.map(type => (
        `<button class="tab ${activeFilter === type ? "active" : ""}" data-filter="${type}">${type}</button>`
    )).join("");
}

function renderMeals(meals) {
    const visible = activeFilter === "All" ? meals : meals.filter(meal => meal.type === activeFilter);
    if (!visible.length) {
        $("mealList").innerHTML = `<div class="empty">No meals logged for this view yet.</div>`;
        return;
    }

    $("mealList").innerHTML = visible.map(meal => `
        <article class="meal">
        <div>
            <h4>${escapeHtml(meal.name)}</h4>
            <p>${escapeHtml(meal.notes || "No notes")}</p>
            <div class="meal-meta">
               <span class="pill ${mealClass(meal.type)}">${meal.type}</span>
                <span class="pill">${meal.calories} kcal</span>
                <span class="pill">P ${meal.protein || 0}g</span>
                <span class="pill">C ${meal.carbs || 0}g</span>
                <span class="pill">F ${meal.fat || 0}g</span>
                <span class="pill">Fi ${meal.fibre || 0}g</span>
            </div>
        </div>
        <div class="meal-actions">
            <button
                class="edit-btn"
                data-edit="${meal.id}">
                ✎ Edit
            </button>

            <button
                class="icon-btn"
                title="Repeat meal"
                aria-label="Repeat meal"
                data-repeat="${meal.id}">
                ⟳ Repeat
            </button>

            <button
                class="danger"
                data-delete="${meal.id}">
                ✖ Delete
            </button>
        </div>
        </article>
    `).join("");
}

/* ======================================================
   EDIT MEALS
====================================================== */

function loadMealIntoForm(meal) {

    $("mealType").value = meal.type;
    $("mealName").value = meal.name;

    $("calories").value = meal.calories;
    $("protein").value = meal.protein;
    $("carbs").value = meal.carbs;
    $("fat").value = meal.fat;
    $("fibre").value = meal.fibre || 0;

    $("mealNotes").value = meal.notes || "";

    editingMealId = meal.id;

    $("mealSubmit").textContent = "Save Changes";
    $("cancelEdit").style.display = "inline-flex";

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

function cancelEditing() {

    editingMealId = null;

    $("mealForm").reset();

    $("mealSubmit").textContent = "Add Meal";

    $("cancelEdit").style.display = "none";

    render();
}

function remainingText(current, target, unit, pluralUnit = unit) {
  const safeCurrent = Number(current) || 0;
  const safeTarget = Number(target) || 0;
  const diff = safeTarget - safeCurrent;
  const absDiff = Math.abs(diff);
  const label = absDiff === 1 ? unit : pluralUnit;

  if (diff === 0) return "⋆.˚𓇼 Target reached ⋆.˚𓇼";
  if (diff < 0) return `${absDiff} ${label} over`;
  return `${diff} ${label} left`;
}

function setRemaining(id, current, target, unit, pluralUnit = unit) {
  const element = $(id);
  if (!element) return;

  element.textContent = remainingText(current, target, unit, pluralUnit);
}


/* ======================================================
   EVENT LISTENERS
====================================================== */

$("mealForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const mealData = {
        type: $("mealType").value,
        name: $("mealName").value.trim(),
        calories: numberValue("calories"),
        protein: numberValue("protein"),
        carbs: numberValue("carbs"),
        fat: numberValue("fat"),
        fibre: numberValue("fibre"),
        notes: $("mealNotes").value.trim()
    };

    const day = dayData();
    if (editingMealId) {

        const meal = day.meals.find(m => m.id === editingMealId);

        if (meal) {
            Object.assign(meal, mealData);
        }

       cancelEditing();

    } else {

        day.meals.unshift({
            id: crypto.randomUUID(),
            ...mealData,
            createdAt: new Date().toISOString()
        });

    }

    saveState();
    event.target.reset();
    render();
});

$("mealList").addEventListener("click", (event) => {
    const deleteId = event.target.dataset.delete;
    const repeatId = event.target.dataset.repeat;
    const editId = event.target.dataset.edit;
    const day = dayData();
      
    if (editId) {
        const meal = day.meals.find(m => m.id === editId);

        if (meal) {
            loadMealIntoForm(meal);
        }

        return;
    }

    if (deleteId) {
        day.meals = day.meals.filter(meal => meal.id !== deleteId);
    }

    if (repeatId) {
        const original = day.meals.find(meal => meal.id === repeatId);
        if (original) {
          day.meals.unshift({ ...original, id: crypto.randomUUID(), createdAt: new Date().toISOString() });
        }
    }

      saveState();
      render();
});

$("tabs").addEventListener("click", (event) => {
    if (!event.target.dataset.filter) return;
    activeFilter = event.target.dataset.filter;
    render();
});

$("addWater").addEventListener("click", () => {
    dayData().water += 1;
    saveState();
    render();
});

$("saveWeight").addEventListener("click", () => {
    dayData().weight = $("weightInput").value;
    saveState();
    render();
});

$("saveNotes").addEventListener("click", () => {
    dayData().notes = $("dailyNotes").value.trim();
    saveState();
    render();
});

$("prevDay").addEventListener("click", () => changeDay(-1));
$("nextDay").addEventListener("click", () => changeDay(1));
$("entryDate").addEventListener("change", (event) => {
    activeDate = event.target.value || todayKey();
    render();
});

$("partnerName").addEventListener("input", (event) => {
    state.profile.name = event.target.value || "Name";
    saveState();
});

$("cancelEdit").addEventListener("click", () => {
    cancelEditing();
});

for (const [id, key] of [
    ["targetCalories", "calories"],
    ["targetProtein", "protein"],
    ["targetCarbs", "carbs"],
    ["targetFibre", "fibre"],
    ["targetFat", "fat"],
    ["targetWater", "water"]
]) {
    $(id).addEventListener("change", (event) => {
        state.profile.targets[key] = Number(event.target.value || 0);
        saveState();
        render();
    });
}

$("exportDay").addEventListener("click", async () => {
    const day = dayData();
    const text = [
        `Care Plate export for ${formatDate(activeDate)}`,
        `Weight: ${day.weight || "not logged"}`,
        `Water: ${day.water} cups`,
        `Notes: ${day.notes || "none"}`,
        "",
        ...day.meals.map(meal => `${meal.type}: ${meal.name} - ${meal.calories} kcal, P${meal.protein || 0} C${meal.carbs || 0} F${meal.fat || 0} Fi${meal.fibre || 0}`)
    ].join("\n");

    await copyText(text);
    $("exportDay").textContent = "Copied";
    setTimeout(() => $("exportDay").textContent = "Export day", 1300);
});

$("addWater").addEventListener("click", () => {
    dayData().water += 1;
    saveState();
    render();
});

$("removeWater").addEventListener("click", () => {
    dayData().water = Math.max(0, dayData().water - 1);
    saveState();
    render();
});

/* ======================================================
   INITIALIZE APP
====================================================== */

render();
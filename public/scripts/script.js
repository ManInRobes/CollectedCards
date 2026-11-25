/*
TODO:
- Add Login functionality
- Add Logout functionality
- Add Manager data ^, and as a manager select from cooks to add recipes to their Task page
*/

// Toggle Light/Dark mode and save preference to localStorage
function toggleDarkMode() {
  document.body.classList.toggle('dark-mode');
  const isDarkMode = document.body.classList.contains('dark-mode');
  localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
}

// Initialize theme on page load based on saved preference
function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
  }
}

// Helper to parse numbers and fractions (e.g., "1/2", "1.5", "2") into floats
function parseNumericValue(valStr) {
  if (!valStr) return null;
  const clean = valStr.trim();
  if (clean.includes('/')) {
    const parts = clean.split('/');
    const num = parseFloat(parts[0]);
    const den = parseFloat(parts[1]);
    return den ? num / den : null;
  }
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? null : parsed;
}

// Helper to format floats back into readable strings (handling simple fractions)
function formatScaledValue(baseNum, scale) {
  if (baseNum === null) return '';
  const total = baseNum * scale;
  
  // Clean up floating point oddities (e.g., 1.500000002 -> 1.5)
  const rounded = Math.round(total * 100) / 100;
  
  // Quick fraction mapper for common cooking amounts
  if (rounded === 0.0625) return '1/16';
  if (rounded === 0.25) return '1/4';
  if (rounded === 0.33 || rounded === 0.34) return '1/3';
  if (rounded === 0.5) return '1/2';
  if (rounded === 0.66 || rounded === 0.67) return '2/3';
  if (rounded === 0.75) return '3/4';
  
  return rounded.toString();
}

// Automatically handle plurality based on the final quantity
function formatUnit(unitStr, totalQty) {
  if (!unitStr) return '';
  const cleanUnit = unitStr.trim();
  const num = parseFloat(totalQty) || 1;

  // Common culinary mapping (singular -> plural)
  const plurals = {
    'clove': 'cloves',
    'cup': 'cups',
    'pinch': 'pinches',
    'packet': 'packets',
    'slice': 'slices',
    'piece': 'pieces',
    'can': 'cans',
    'can of': 'cans of',
    'lb': 'lbs',
    'oz': 'oz',
    'gram': 'grams',
    'kg': 'kg',
    'ml': 'ml',
    'liter': 'liters'
  };

  const singulars = Object.fromEntries(Object.entries(plurals).map(([k, v]) => [v, k]));
  const lowerUnit = cleanUnit.toLowerCase();

  if (num === 1) {
    // Return singular form if quantity is 1
    return plurals[lowerUnit] ? singulars[plurals[lowerUnit]] || lowerUnit : lowerUnit.replace(/s$/, '');
  } else {
    // Return plural form if quantity is not 1 (e.g., 2, 0.5, 3)
    return plurals[lowerUnit] || (lowerUnit.endsWith('s') ? lowerUnit : lowerUnit + 's');
  }
}

// Global scaling function triggered when the number input changes
function updateRecipeScale(recipeIndex, scaleFactor) {
  const card = document.querySelector(`.recipe-card[data-recipe-index="${recipeIndex}"]`);
  if (!card) return;

  const scale = (scaleFactor === "" || parseFloat(scaleFactor) < 1) ? 1 : parseFloat(scaleFactor);
  const valueSpans = card.querySelectorAll('.ingredient-value');

  valueSpans.forEach(span => {
    const baseNum = span.getAttribute('data-base-num');
    const rawValue = span.getAttribute('data-raw-value');
    const baseUnit = span.getAttribute('data-base-unit') || ''; // Pull original text unit
    const strongTag = span.querySelector('strong');

    if (!baseNum || baseNum === '') {
      strongTag.textContent = rawValue;
    } else {
      const parsedBase = parseFloat(baseNum);
      const totalNum = parsedBase * scale;
      const scaledNumStr = formatScaledValue(parsedBase, scale);
      
      // Automatically pluralize/singularize the unit based on the scaled total
      const dynamicUnit = formatUnit(baseUnit, totalNum);
      
      strongTag.textContent = dynamicUnit ? `${scaledNumStr} ${dynamicUnit}` : scaledNumStr;
    }
  });
}

// Fetch and render the example user's saved recipes list across the app
async function loadUserData() {
  try {
    const res = await fetch('/api/user');
    const user = await res.json();
    
    // Update the header title with the user's actual name
    const nameHeader = document.getElementById('user-name-header');
    if (nameHeader) {
      nameHeader.textContent = user.name;
    }

    const savedListEl = document.getElementById('user-saved-list');
    const tasksSavedListEl = document.getElementById('tasks-saved-recipes-list');

    // Wrap the empty message in an <li> so it matches the <ul> structure
    if (user.savedRecipes.length === 0) {
      const emptyHtml = '<li style="padding: 0.5rem 0; color: #6b7280; font-size: 0.875rem; list-style: none;">No saved recipes yet.</li>';
      if (savedListEl) savedListEl.innerHTML = emptyHtml;
      if (tasksSavedListEl) tasksSavedListEl.innerHTML = emptyHtml;
      return;
    }

    // Generate the HTML template for the saved recipes including ingredients and instructions
    const recipesHTML = user.savedRecipes.map(recipe => `
      <li style="padding: 1rem; border-radius: 6px; margin-bottom: 0.75rem;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
          <div>
            <strong>${recipe.title}</strong> 
            <span style="color: #007bff; font-size: 0.8rem;">(${recipe.scale || 1}x batch)</span>
            <br><small">${recipe.category}</small>
          </div>
          <button onclick="removeRecipeFromUser('${recipe.title.replace(/'/g, "\\'")}')" style="background:none; border:none; color: #ef4444; cursor:pointer; font-size:1rem;" title="Remove">✕</button>
        </div>
        
        <!-- Scaled Ingredients List -->
        ${recipe.ingredients && recipe.ingredients.length > 0 ? `
          <div style="margin-top: 0.5rem;">
            <strong style="font-size: 0.85rem">Ingredients:</strong>
            <ul style="margin-top: 0.2rem; padding-left: 1.2rem; font-size: 0.85rem; color: #4b5563;">
              ${recipe.ingredients.map(i => `<li>${i.display}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        <!-- Instructions List -->
        ${recipe.instructions && recipe.instructions.length > 0 ? `
          <div style="margin-top: 0.75rem;">
            <strong>Instructions:</strong>
            <ol style="margin-top: 0.2rem; padding-left: 1.2rem; font-size: 0.85rem;">
              ${recipe.instructions.map(inst => `<li style="margin-bottom: 0.25rem;">${inst}</li>`).join('')}
            </ol>
          </div>
        ` : ''}

      <hr>
      </li>
    `).join('');

    // Update both UI locations
    if (savedListEl) savedListEl.innerHTML = recipesHTML;
    if (tasksSavedListEl) tasksSavedListEl.innerHTML = recipesHTML;

  } catch (err) {
    console.error('Failed to load user data', err);
  }
}

// Grabs the current scale, scaled ingredients, and instructions from the card
function saveRecipeFromCard(title, category, recipeIndex) {
  const card = document.querySelector(`.recipe-card[data-recipe-index="${recipeIndex}"]`);
  if (!card) return;

  const scaleInput = document.getElementById(`scale-${recipeIndex}`);
  const scale = scaleInput ? scaleInput.value : 1;

  // Extract ingredients
  const ingredients = [];
  card.querySelectorAll('.ingredient-item').forEach(item => {
    const qtyText = item.querySelector('.ingredient-value strong').textContent.trim();
    const nameText = item.querySelector('.ingredient-name').textContent.trim();
    ingredients.push({ display: `${qtyText} ${nameText}` });
  });

  // Extract instructions
  const instructions = [];
  card.querySelectorAll('ol li').forEach(li => {
    instructions.push(li.textContent.trim());
  });

  saveRecipeToUser(title, category, scale, ingredients, instructions);
}

// Updated save function to accept instructions
async function saveRecipeToUser(title, category, scale = 1, ingredients = [], instructions = []) {
  const res = await fetch('/api/user/recipes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, category, scale, ingredients, instructions })
  });
  
  if (res.ok) {
    loadUserData();
  }
}

// Remove a recipe from the user's list
async function removeRecipeFromUser(title) {
  const res = await fetch('/api/user/recipes', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title })
  });
  
  if (res.ok) {
    loadUserData();
  }
}

// Populate the master recipe selector dropdown from all text files
async function loadMasterRecipeDropdown() {
  try {
    const res = await fetch('/api/all-recipes');
    const recipes = await res.json();
    
    const selectEl = document.getElementById('master-recipe-select');
    if (!selectEl) return;

    selectEl.innerHTML = '<option value="">Select a recipe...</option>' + recipes.map(r => `
      <option value="${r.title}" data-category="${r.category}">${r.title} (${r.category})</option>
    `).join('');
  } catch (err) {
    console.error('Failed to load master recipe list', err);
  }
}

// Build formatted ingredient display strings for a recipe object at a given scale
function buildScaledIngredientDisplays(rawIngredients = [], scale = 1) {
  const numericScale = (scale === '' || isNaN(parseFloat(scale)) || parseFloat(scale) < 1)
    ? 1
    : parseFloat(scale);

  return rawIngredients.map(ing => {
    const rawVal = ing.value || '';
    const nameText = (ing.name || '').trim();
    const baseNum = parseNumericValue(rawVal);
    const unitMatch = rawVal ? rawVal.replace(/[\d\/\.\-]+/g, '').trim() : '';

    let qtyText = rawVal;
    if (baseNum !== null) {
      const totalNum = baseNum * numericScale;
      const scaledNumStr = formatScaledValue(baseNum, numericScale);
      const dynamicUnit = formatUnit(unitMatch, totalNum);
      qtyText = dynamicUnit ? `${scaledNumStr} ${dynamicUnit}` : scaledNumStr;
    }

    return {
      display: [qtyText.trim(), nameText].filter(Boolean).join(' ')
    };
  });
}

// Handle adding a full recipe (ingredients + instructions + scale) from the sidebar dropdown
async function addSelectedRecipeFromDropdown() {
  const selectEl = document.getElementById('master-recipe-select');
  if (!selectEl || !selectEl.value) return;

  const scaleEl = document.getElementById('master-recipe-scale');
  const rawScale = scaleEl ? parseFloat(scaleEl.value) : 1;
  const scale = (!isNaN(rawScale) && rawScale >= 1) ? rawScale : 1;

  const selectedTitle = selectEl.value;
  const selectedOption = selectEl.options[selectEl.selectedIndex];
  const category = selectedOption.getAttribute('data-category');

  let finalTitle = selectedTitle;
  let ingredients = [];
  let instructions = [];

  try {
    const res = await fetch(`/api/recipes/${encodeURIComponent(category)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const categoryRecipes = await res.json();

    // Match by title first, or fall back to matching normalized filename/title
    const normalize = str => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const matched =
      categoryRecipes.find(r => r.title === selectedTitle) ||
      categoryRecipes.find(r => normalize(r.title) === normalize(selectedTitle));

    if (matched) {
      finalTitle = matched.title || selectedTitle;
      ingredients = buildScaledIngredientDisplays(matched.ingredients || [], scale);
      instructions = [...(matched.instructions || [])];
    } else {
      console.warn(`Recipe "${selectedTitle}" not found in category "${category}"`);
    }
  } catch (err) {
    console.error('Failed to load full recipe for quick add:', err);
  }

  await saveRecipeToUser(finalTitle, category, scale, ingredients, instructions);

  selectEl.value = '';
  if (scaleEl) scaleEl.value = '1';
}

// Main App Initialization
async function initRecipeApp() {
  // Initialize theme preference on startup
  initTheme();

  const tabContainer = document.getElementById('category-tabs');
  const contentDisplay = document.getElementById('recipe-display');

  // Load user profile and dropdown state on startup
  loadUserData();
  loadMasterRecipeDropdown();

  try {
    const res = await fetch('/api/categories');
    const categories = await res.json();

    if (categories.length === 0) {
      contentDisplay.innerHTML = '<p>No recipe folders found in LocalTestRecipes.</p>';
      return;
    }

    if (tabContainer) tabContainer.innerHTML = '';

    categories.forEach((category, index) => {
      const btn = document.createElement('button');
      btn.className = 'tab-btn';
      btn.textContent = category;
      
      btn.onclick = async () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const recipesRes = await fetch(`/api/recipes/${category}`);
        const recipes = await recipesRes.json();

        contentDisplay.innerHTML = `<h2>${category}</h2>` + recipes.map((r, recipeIndex) => `
          <div class="recipe-card" data-recipe-index="${recipeIndex}">
            <div class="recipe-header">
              <div>
                <h3>${r.title}</h3>
                <button class="save-btn" onclick="saveRecipeFromCard('${r.title.replace(/'/g, "\\'")}', '${category}', ${recipeIndex})">+ Save to My List</button>
              </div>
              <div class="multiplier-container">
                <label for="scale-${recipeIndex}" style="font-size: 0.75rem; color: #6b7280; margin-right: 4px;">Scale:</label>
                <input type="number" 
                      id="scale-${recipeIndex}" 
                      class="multiplier-input" 
                      value="1" 
                      min="1" 
                      oninput="updateRecipeScale(${recipeIndex}, this.value)" 
                      style="width: 55px; padding: 2px 4px; font-size: 0.875rem; border: 1px solid #d1d5db; border-radius: 4px;">
              </div>
            </div>
            
            <h4>Ingredients</h4>
            <ul>
               ${(r.ingredients || []).map(ing => {
                const baseNum = parseNumericValue(ing.value);
                const unitMatch = ing.value ? ing.value.replace(/[\d\/\.\-]+/g, '').trim() : '';

                return `
                  <li class="ingredient-item">
                    <span class="ingredient-value" 
                          data-base-num="${baseNum !== null ? baseNum : ''}" 
                          data-raw-value="${ing.value || ''}"
                          data-base-unit="${unitMatch}">
                      <strong>${ing.value || ''}</strong>
                    </span>
                    <span class="ingredient-name">${ing.name || ''}</span>
                  </li>
                `;
              }).join('')}
            </ul>

            <h4>Instructions</h4>
            <ol>
              ${(r.instructions || []).map(inst => `<li>${inst}</li>`).join('')}
            </ol>
          </div>
        `).join('');
      };

      if (tabContainer) tabContainer.appendChild(btn);

      if (index === 0) btn.click();
    });

  } catch (error) {
    console.error('Failed to load recipes:', error);
    contentDisplay.innerHTML = '<p>Error loading recipes. Make sure your local server is running.</p>';
  }
}

// Tab navigation between recipe and tasks
function switchTab(tabName) {
  const tasksView = document.getElementById('tasks-view');
  const recipesView = document.getElementById('recipes-view');
  
  const tasksBtn = document.getElementById('tab-btn-tasks');
  const recipesBtn = document.getElementById('tab-btn-recipes');

  tasksView.classList.add('hidden');
  recipesView.classList.add('hidden');

  tasksBtn.classList.remove('active');
  recipesBtn.classList.remove('active');

  if (tabName === 'tasks') {
    tasksView.classList.remove('hidden');
    tasksBtn.classList.add('active');
  } else if (tabName === 'recipes') {
    recipesView.classList.remove('hidden');
    recipesBtn.classList.add('active');
  }
}

// Run app on page load
initRecipeApp();
/*
TODO:
- Add Login functionality
- Add Logout functionality
- Add Manager data ^, and as a manager select from cooks to add recipes to their Task page
*/

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
  if (rounded === 0.0625) return '1/16'
  if (rounded === 0.25) return '1/4';
  if (rounded === 0.33 || rounded === 0.34) return '1/3';
  if (rounded === 0.5) return '1/2';
  if (rounded === 0.66 || rounded === 0.67) return '2/3';
  if (rounded === 0.75) return '3/4';
  
  return rounded.toString();
}

//Automatically handle plurality based on the final quantity
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

// Global scaling function triggered when the dropdown changes
function updateRecipeScale(recipeIndex, scaleFactor) {
  const card = document.querySelector(`.recipe-card[data-recipe-index="${recipeIndex}"]`);
  if (!card) return;

  const scale = parseFloat(scaleFactor);
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

// Fetch and render the example user's saved recipes list
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
    if (!savedListEl) return;

    if (user.savedRecipes.length === 0) {
      savedListEl.innerHTML = '<p style="color: #6b7280; font-size: 0.875rem;">No saved recipes yet.</p>';
      return;
    }

    savedListEl.innerHTML = user.savedRecipes.map(recipe => `
      <li>
        <span><strong>${recipe.title}</strong><br><small style="color: #6b7280;">${recipe.category}</small></span>
        <button onclick="removeRecipeFromUser('${recipe.title.replace(/'/g, "\\'")}')" style="background:none; border:none; color: #ef4444; cursor:pointer; font-size:1rem;" title="Remove">✕</button>
      </li>
    `).join('');
  } catch (err) {
    console.error('Failed to load user data', err);
  }
}

// Save a recipe to the user's list
async function saveRecipeToUser(title, category) {
  const res = await fetch('/api/user/recipes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, category })
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

// Handle adding a recipe from the dropdown selection box
async function addSelectedRecipeFromDropdown() {
  const selectEl = document.getElementById('master-recipe-select');
  if (!selectEl || !selectEl.value) return;

  const selectedOption = selectEl.options[selectEl.selectedIndex];
  const title = selectEl.value;
  const category = selectedOption.getAttribute('data-category');

  await saveRecipeToUser(title, category);
  selectEl.value = ""; 
}

// Main App Initialization
async function initRecipeApp() {
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
// TO DO: make it also save quantites of recipes as well for Tasks
        contentDisplay.innerHTML = `<h2>${category}</h2>` + recipes.map((r, recipeIndex) => `
          <div class="recipe-card" data-recipe-index="${recipeIndex}">
            <div class="recipe-header">
              <div>
              
                <h3>${r.title}</h3>
                <button class="save-btn" onclick="saveRecipeToUser('${r.title.replace(/'/g, "\\'")}', '${category}')">+ Save to My List</button>
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
                  <li>
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
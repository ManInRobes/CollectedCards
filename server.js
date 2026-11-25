const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();

// Middleware
app.use(express.static(__dirname));
app.use(express.json());

// Path to your recipes folder
const RECIPES_DIR = path.join(__dirname, 'src', 'LocalTestRecipes');

// Example user state (in memory)
let exampleUser = {
  name: "Chef Gabriel",
  savedRecipes: []
};

// Parse a single .txt recipe file into structured data
function parseRecipeFile(filePath, fallbackTitle) {
  const rawContent = fs.readFileSync(filePath, 'utf-8');

  let title = fallbackTitle;
  let ingredients = [];
  let instructions = [];

  const lines = rawContent.split(/\r?\n/);
  let currentSection = '';

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;

    const lower = trimmed.toLowerCase();

    // Detect section headers
    if (lower.startsWith('title:')) {
      title = trimmed.replace(/^title:\s*/i, '');
    } else if (lower.includes('ingredient')) {
      currentSection = 'ingredients';
    } else if (lower.includes('instruction') || lower.includes('direction') || lower.includes('method')) {
      currentSection = 'instructions';
    } else {
      if (currentSection === 'ingredients') {
        // Remove bullet points if present (- or *)
        const cleanItem = trimmed.replace(/^[-*•]\s*/, '');

        // Try to split quantity vs name (e.g., "1 lb beef" -> value: "1 lb", name: "beef")
        const match = cleanItem.match(/^([\d\/\.\s\-]+(tbsp|tsp|cup|cups|lb|lbs|oz|clove|cloves|pinch|head|packets?)?)\s+(.*)$/i);

        if (match) {
          ingredients.push({
            value: match[1].trim(),
            name: match[3].trim()
          });
        } else {
          ingredients.push({
            value: '',
            name: cleanItem
          });
        }
      } else if (currentSection === 'instructions') {
        // Remove leading numbers like "1.", "2)", etc.
        const cleanInst = trimmed.replace(/^\d+[\.\)]\s*/, '');
        instructions.push(cleanInst);
      }
    }
  });

  return {
    title,
    ingredients,
    instructions
  };
}

// Look up and hydrate a recipe from disk if client-sent ingredients/instructions are empty
function findRecipeInDisk(title, category) {
  if (!category || !fs.existsSync(RECIPES_DIR)) return null;

  const categoryPath = path.join(RECIPES_DIR, category);
  if (!fs.existsSync(categoryPath)) return null;

  const normalize = str => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const files = fs.readdirSync(categoryPath)
    .filter(file => path.extname(file).toLowerCase() === '.txt');

  for (const filename of files) {
    const baseName = path.basename(filename, '.txt');
    const parsed = parseRecipeFile(path.join(categoryPath, filename), baseName);

    if (
      parsed.title === title ||
      baseName === title ||
      normalize(parsed.title) === normalize(title) ||
      normalize(baseName) === normalize(title)
    ) {
      const formattedIngredients = (parsed.ingredients || []).map(ing => ({
        display: ing.value ? `${ing.value} ${ing.name || ''}`.trim() : (ing.name || '')
      }));

      return {
        title: parsed.title,
        ingredients: formattedIngredients,
        instructions: parsed.instructions || []
      };
    }
  }

  return null;
}

// 1. Get categories (folders)
app.get('/api/categories', (req, res) => {
  if (!fs.existsSync(RECIPES_DIR)) return res.json([]);

  const categories = fs.readdirSync(RECIPES_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  res.json(categories);
});

// 2. Get recipes (txt files) inside a category with structured parsing
app.get('/api/recipes/:category', (req, res) => {
  const categoryPath = path.join(RECIPES_DIR, req.params.category);
  if (!fs.existsSync(categoryPath)) return res.json([]);

  const files = fs.readdirSync(categoryPath)
    .filter(file => path.extname(file).toLowerCase() === '.txt');

  const recipes = files.map(filename => {
    const baseName = path.basename(filename, '.txt');
    return parseRecipeFile(path.join(categoryPath, filename), baseName);
  });

  res.json(recipes);
});

// 3. Get example user data
app.get('/api/user', (req, res) => {
  res.json(exampleUser);
});

// 4. Save a recipe to the example user's list (with scale, ingredient, and instruction support)
app.post('/api/user/recipes', (req, res) => {
  let { title, category, scale, ingredients, instructions } = req.body;
  if (!title) return res.status(400).json({ error: 'Recipe title is required' });

  if ((!ingredients || ingredients.length === 0) || (!instructions || instructions.length === 0)) {
    const diskRecipe = findRecipeInDisk(title, category);
    if (diskRecipe) {
      if (!ingredients || ingredients.length === 0) ingredients = diskRecipe.ingredients;
      if (!instructions || instructions.length === 0) instructions = diskRecipe.instructions;
    }
  }

  // Prevent duplicate saves (or update scale, ingredients & instructions if already saved)
  const existingRecipe = exampleUser.savedRecipes.find(r => r.title === title && r.category === category);

  if (existingRecipe) {
    existingRecipe.scale = scale || 1;
    existingRecipe.ingredients = ingredients || [];
    existingRecipe.instructions = instructions || [];
  } else {
    exampleUser.savedRecipes.push({
      title,
      category,
      scale: scale || 1,
      ingredients: ingredients || [],
      instructions: instructions || [],
      savedAt: new Date()
    });
  }

  res.json({ success: true, savedRecipes: exampleUser.savedRecipes });
});

// 5. Remove a recipe from the example user's list
app.delete('/api/user/recipes', (req, res) => {
  const { title } = req.body;
  exampleUser.savedRecipes = exampleUser.savedRecipes.filter(r => r.title !== title);
  res.json({ success: true, savedRecipes: exampleUser.savedRecipes });
});

// 6. Get a flat list of all available recipes for selection dropdown
app.get('/api/all-recipes', (req, res) => {
  if (!fs.existsSync(RECIPES_DIR)) return res.json([]);

  const categories = fs.readdirSync(RECIPES_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  let allRecipes = [];

  categories.forEach(category => {
    const categoryPath = path.join(RECIPES_DIR, category);
    if (!fs.existsSync(categoryPath)) return;

    const files = fs.readdirSync(categoryPath)
      .filter(file => path.extname(file).toLowerCase() === '.txt');

    files.forEach(filename => {
      allRecipes.push({
        title: path.basename(filename, '.txt'),
        category: category
      });
    });
  });

  res.json(allRecipes);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Recipe server running on port ${PORT}`);
});
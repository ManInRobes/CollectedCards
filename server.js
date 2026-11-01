const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();

// Middleware
app.use(express.static(__dirname));
app.use(express.json()); // Crucial for parsing JSON request bodies

// Path to your recipes folder
const RECIPES_DIR = path.join(__dirname, 'src', 'LocalTestRecipes');

// Example user state (in memory)
let exampleUser = {
  name: "Chef Gabriel",
  savedRecipes: []
};

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
    const filePath = path.join(categoryPath, filename);
    const rawContent = fs.readFileSync(filePath, 'utf-8');
    
    let title = path.basename(filename, '.txt');
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
        // We are inside a section, process lines
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
  });

  res.json(recipes);
});

// 3. Get example user data
app.get('/api/user', (req, res) => {
  res.json(exampleUser);
});

// 4. Save a recipe to the example user's list
app.post('/api/user/recipes', (req, res) => {
  const { title, category } = req.body;
  if (!title) return res.status(400).json({ error: 'Recipe title is required' });

  // Prevent duplicate saves
  const exists = exampleUser.savedRecipes.some(r => r.title === title && r.category === category);
  if (!exists) {
    exampleUser.savedRecipes.push({ title, category, savedAt: new Date() });
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
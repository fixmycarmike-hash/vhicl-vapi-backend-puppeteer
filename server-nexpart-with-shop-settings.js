const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import services
const ShopSettingsService = require('./shop-settings-service-complete.js');
const LaborService = require('./labor-service.js');
const EmailService = require('./email-service-updated.js');
const NexpartApiService = require('./nexpart-api-service.js');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Shop settings endpoints
app.get('/api/shop-settings', async (req, res) => {
  try {
    const shopSettings = await ShopSettingsService.getSettings();
    res.json(shopSettings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/shop-settings', async (req, res) => {
  try {
    const updatedSettings = await ShopSettingsService.updateSettings(req.body);
    res.json(updatedSettings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Labor endpoints
app.get('/api/labor/:year/:make/:model', async (req, res) => {
  try {
    const { year, make, model } = req.params;
    const operations = await LaborService.getLaborOperations(year, make, model);
    res.json(operations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Nexpart API endpoints
app.get('/api/parts/search', async (req, res) => {
  try {
    const { term, make, model, year } = req.query;
    const nexpart = new NexpartApiService();
    const parts = await nexpart.searchParts(term, { make, model, year });
    res.json(parts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/parts/pricing/:partNumber', async (req, res) => {
  try {
    const { partNumber } = req.params;
    const nexpart = new NexpartApiService();
    const pricing = await nexpart.getPartsPricing(partNumber);
    res.json(pricing);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/vehicle/vin/:vin', async (req, res) => {
  try {
    const { vin } = req.params;
    const nexpart = new NexpartApiService();
    const vehicle = await nexpart.decodeVIN(vin);
    res.json(vehicle);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`VHICL Pro Backend running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Server ready!`);
});

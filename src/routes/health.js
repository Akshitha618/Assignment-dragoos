const express = require('express');
const { getDatabase } = require('../database/connection');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * GET /api/health
 * Health check endpoint
 */
router.get('/', async (req, res) => {
  try {
    const db = getDatabase();
    const startTime = Date.now();
    
    // Test database connection
    await new Promise((resolve, reject) => {
      db.get('SELECT 1 as test', (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    const dbResponseTime = Date.now() - startTime;
    
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      database: {
        status: 'connected',
        responseTime: `${dbResponseTime}ms`
      },
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        unit: 'MB'
      }
    };
    
    res.json({
      success: true,
      data: healthStatus
    });
    
  } catch (error) {
    logger.error('Health check failed:', error);
    
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Database connection failed',
      uptime: process.uptime()
    });
  }
});

/**
 * GET /api/health/detailed
 * Detailed health check with system information
 */
router.get('/detailed', async (req, res) => {
  try {
    const db = getDatabase();
    const startTime = Date.now();
    
    // Test database with a more complex query
    const userCount = await new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });
    
    const dataCount = await new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM data_entries', (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });
    
    const dbResponseTime = Date.now() - startTime;
    
    const detailedHealth = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      database: {
        status: 'connected',
        responseTime: `${dbResponseTime}ms`,
        statistics: {
          users: userCount,
          dataEntries: dataCount
        }
      },
      system: {
        platform: process.platform,
        nodeVersion: process.version,
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          external: Math.round(process.memoryUsage().external / 1024 / 1024),
          unit: 'MB'
        },
        cpu: {
          usage: process.cpuUsage()
        }
      }
    };
    
    res.json({
      success: true,
      data: detailedHealth
    });
    
  } catch (error) {
    logger.error('Detailed health check failed:', error);
    
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
      uptime: process.uptime()
    });
  }
});

module.exports = router;
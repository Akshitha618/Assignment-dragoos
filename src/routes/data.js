const express = require('express');
const Joi = require('joi');
const { getDatabase } = require('../database/connection');
const { authenticate } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Validation schemas
const createDataSchema = Joi.object({
  title: Joi.string().min(1).max(255).required(),
  content: Joi.string().allow(''),
  category: Joi.string().max(50),
  tags: Joi.array().items(Joi.string()),
  metadata: Joi.object(),
  isPublic: Joi.boolean().default(false)
});

const updateDataSchema = Joi.object({
  title: Joi.string().min(1).max(255),
  content: Joi.string().allow(''),
  category: Joi.string().max(50),
  tags: Joi.array().items(Joi.string()),
  metadata: Joi.object(),
  isPublic: Joi.boolean()
});

/**
 * GET /api/data
 * Get data entries for the authenticated user
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const db = getDatabase();
    const { 
      page = 1, 
      limit = 10, 
      search = '', 
      category = '', 
      sortBy = 'created_at',
      sortOrder = 'DESC',
      includePublic = false 
    } = req.query;
    
    const offset = (page - 1) * limit;
    const validSortFields = ['created_at', 'updated_at', 'title', 'category'];
    const validSortOrders = ['ASC', 'DESC'];
    
    const finalSortBy = validSortFields.includes(sortBy) ? sortBy : 'created_at';
    const finalSortOrder = validSortOrders.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

    let whereClause = 'WHERE (user_id = ?';
    const params = [req.user.id];

    // Include public data if requested
    if (includePublic === 'true') {
      whereClause += ' OR is_public = 1';
    }
    whereClause += ')';

    if (search) {
      whereClause += ' AND (title LIKE ? OR content LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (category) {
      whereClause += ' AND category = ?';
      params.push(category);
    }

    // Get total count
    const totalCount = await new Promise((resolve, reject) => {
      db.get(
        `SELECT COUNT(*) as count FROM data_entries ${whereClause}`,
        params,
        (err, row) => {
          if (err) reject(err);
          else resolve(row.count);
        }
      );
    });

    // Get data entries
    const dataEntries = await new Promise((resolve, reject) => {
      db.all(
        `SELECT d.*, u.username 
         FROM data_entries d 
         LEFT JOIN users u ON d.user_id = u.id 
         ${whereClause} 
         ORDER BY d.${finalSortBy} ${finalSortOrder} 
         LIMIT ? OFFSET ?`,
        [...params, parseInt(limit), offset],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    // Parse JSON fields
    const processedData = dataEntries.map(entry => ({
      id: entry.id,
      userId: entry.user_id,
      username: entry.username,
      title: entry.title,
      content: entry.content,
      category: entry.category,
      tags: entry.tags ? JSON.parse(entry.tags) : [],
      metadata: entry.metadata ? JSON.parse(entry.metadata) : {},
      isPublic: entry.is_public,
      createdAt: entry.created_at,
      updatedAt: entry.updated_at
    }));

    res.json({
      success: true,
      data: {
        entries: processedData,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / limit),
          totalItems: totalCount,
          itemsPerPage: parseInt(limit)
        }
      }
    });

  } catch (error) {
    logger.error('Get data entries error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/data/:id
 * Get specific data entry
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    const dataEntry = await new Promise((resolve, reject) => {
      db.get(
        `SELECT d.*, u.username 
         FROM data_entries d 
         LEFT JOIN users u ON d.user_id = u.id 
         WHERE d.id = ?`,
        [id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!dataEntry) {
      return res.status(404).json({
        success: false,
        error: 'Data entry not found'
      });
    }

    // Check access permissions
    if (dataEntry.user_id !== req.user.id && !dataEntry.is_public && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: {
        entry: {
          id: dataEntry.id,
          userId: dataEntry.user_id,
          username: dataEntry.username,
          title: dataEntry.title,
          content: dataEntry.content,
          category: dataEntry.category,
          tags: dataEntry.tags ? JSON.parse(dataEntry.tags) : [],
          metadata: dataEntry.metadata ? JSON.parse(dataEntry.metadata) : {},
          isPublic: dataEntry.is_public,
          createdAt: dataEntry.created_at,
          updatedAt: dataEntry.updated_at
        }
      }
    });

  } catch (error) {
    logger.error('Get data entry error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/data
 * Create new data entry
 */
router.post('/', authenticate, async (req, res) => {
  try {
    // Validate input
    const { error, value } = createDataSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    const { title, content, category, tags, metadata, isPublic } = value;
    const db = getDatabase();

    // Create data entry
    const entryId = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO data_entries (user_id, title, content, category, tags, metadata, is_public) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          req.user.id,
          title,
          content || '',
          category || null,
          tags ? JSON.stringify(tags) : null,
          metadata ? JSON.stringify(metadata) : null,
          isPublic || false
        ],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });

    // Get created entry
    const createdEntry = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM data_entries WHERE id = ?',
        [entryId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    logger.info(`Data entry created: ${entryId} by user ${req.user.id}`);

    res.status(201).json({
      success: true,
      message: 'Data entry created successfully',
      data: {
        entry: {
          id: createdEntry.id,
          userId: createdEntry.user_id,
          title: createdEntry.title,
          content: createdEntry.content,
          category: createdEntry.category,
          tags: createdEntry.tags ? JSON.parse(createdEntry.tags) : [],
          metadata: createdEntry.metadata ? JSON.parse(createdEntry.metadata) : {},
          isPublic: createdEntry.is_public,
          createdAt: createdEntry.created_at,
          updatedAt: createdEntry.updated_at
        }
      }
    });

  } catch (error) {
    logger.error('Create data entry error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * PUT /api/data/:id
 * Update data entry
 */
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    // Check if entry exists and user has permission
    const existingEntry = await new Promise((resolve, reject) => {
      db.get(
        'SELECT user_id FROM data_entries WHERE id = ?',
        [id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!existingEntry) {
      return res.status(404).json({
        success: false,
        error: 'Data entry not found'
      });
    }

    if (existingEntry.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Validate input
    const { error, value } = updateDataSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    // Build update query
    const updateFields = [];
    const updateParams = [];

    Object.keys(value).forEach(key => {
      if (value[key] !== undefined) {
        let dbField = key;
        let dbValue = value[key];

        if (key === 'isPublic') {
          dbField = 'is_public';
        } else if (key === 'tags' && dbValue) {
          dbValue = JSON.stringify(dbValue);
        } else if (key === 'metadata' && dbValue) {
          dbValue = JSON.stringify(dbValue);
        }

        updateFields.push(`${dbField} = ?`);
        updateParams.push(dbValue);
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update'
      });
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateParams.push(id);

    // Update entry
    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE data_entries SET ${updateFields.join(', ')} WHERE id = ?`,
        updateParams,
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Get updated entry
    const updatedEntry = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM data_entries WHERE id = ?',
        [id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    logger.info(`Data entry updated: ${id} by user ${req.user.id}`);

    res.json({
      success: true,
      message: 'Data entry updated successfully',
      data: {
        entry: {
          id: updatedEntry.id,
          userId: updatedEntry.user_id,
          title: updatedEntry.title,
          content: updatedEntry.content,
          category: updatedEntry.category,
          tags: updatedEntry.tags ? JSON.parse(updatedEntry.tags) : [],
          metadata: updatedEntry.metadata ? JSON.parse(updatedEntry.metadata) : {},
          isPublic: updatedEntry.is_public,
          createdAt: updatedEntry.created_at,
          updatedAt: updatedEntry.updated_at
        }
      }
    });

  } catch (error) {
    logger.error('Update data entry error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * DELETE /api/data/:id
 * Delete data entry
 */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    // Check if entry exists and user has permission
    const existingEntry = await new Promise((resolve, reject) => {
      db.get(
        'SELECT user_id FROM data_entries WHERE id = ?',
        [id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!existingEntry) {
      return res.status(404).json({
        success: false,
        error: 'Data entry not found'
      });
    }

    if (existingEntry.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Delete entry
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM data_entries WHERE id = ?', [id], function(err) {
        if (err) reject(err);
        else resolve();
      });
    });

    logger.info(`Data entry deleted: ${id} by user ${req.user.id}`);

    res.json({
      success: true,
      message: 'Data entry deleted successfully'
    });

  } catch (error) {
    logger.error('Delete data entry error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/data/categories/list
 * Get list of all categories
 */
router.get('/categories/list', authenticate, async (req, res) => {
  try {
    const db = getDatabase();

    const categories = await new Promise((resolve, reject) => {
      db.all(
        `SELECT DISTINCT category, COUNT(*) as count 
         FROM data_entries 
         WHERE category IS NOT NULL AND category != '' 
         AND (user_id = ? OR is_public = 1)
         GROUP BY category 
         ORDER BY count DESC, category ASC`,
        [req.user.id],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    res.json({
      success: true,
      data: {
        categories: categories.map(cat => ({
          name: cat.category,
          count: cat.count
        }))
      }
    });

  } catch (error) {
    logger.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;
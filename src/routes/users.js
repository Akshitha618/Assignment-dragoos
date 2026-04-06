const express = require('express');
const bcrypt = require('bcryptjs');
const Joi = require('joi');
const { getDatabase } = require('../database/connection');
const { authenticate, authorize } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Validation schemas
const updateUserSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(50),
  email: Joi.string().email(),
  role: Joi.string().valid('user', 'admin'),
  isActive: Joi.boolean()
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).max(128).required()
});

/**
 * GET /api/users
 * Get all users (admin only)
 */
router.get('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const db = getDatabase();
    const { page = 1, limit = 10, search = '', role = '' } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (search) {
      whereClause += ' AND (username LIKE ? OR email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (role) {
      whereClause += ' AND role = ?';
      params.push(role);
    }

    // Get total count
    const totalCount = await new Promise((resolve, reject) => {
      db.get(
        `SELECT COUNT(*) as count FROM users ${whereClause}`,
        params,
        (err, row) => {
          if (err) reject(err);
          else resolve(row.count);
        }
      );
    });

    // Get users
    const users = await new Promise((resolve, reject) => {
      db.all(
        `SELECT id, username, email, role, is_active, created_at, updated_at 
         FROM users ${whereClause} 
         ORDER BY created_at DESC 
         LIMIT ? OFFSET ?`,
        [...params, parseInt(limit), offset],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    res.json({
      success: true,
      data: {
        users: users.map(user => ({
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          isActive: user.is_active,
          createdAt: user.created_at,
          updatedAt: user.updated_at
        })),
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / limit),
          totalItems: totalCount,
          itemsPerPage: parseInt(limit)
        }
      }
    });

  } catch (error) {
    logger.error('Get users error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/users/:id
 * Get user by ID
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    // Check if user can access this profile
    if (req.user.role !== 'admin' && req.user.id !== parseInt(id)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You can only view your own profile.'
      });
    }

    const user = await new Promise((resolve, reject) => {
      db.get(
        'SELECT id, username, email, role, is_active, created_at, updated_at FROM users WHERE id = ?',
        [id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          isActive: user.is_active,
          createdAt: user.created_at,
          updatedAt: user.updated_at
        }
      }
    });

  } catch (error) {
    logger.error('Get user error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * PUT /api/users/:id
 * Update user
 */
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    // Check if user can update this profile
    if (req.user.role !== 'admin' && req.user.id !== parseInt(id)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You can only update your own profile.'
      });
    }

    // Validate input
    const { error, value } = updateUserSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    // Non-admin users cannot change role or isActive status
    if (req.user.role !== 'admin') {
      delete value.role;
      delete value.isActive;
    }

    // Check if user exists
    const existingUser = await new Promise((resolve, reject) => {
      db.get('SELECT id FROM users WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Check for duplicate email/username
    if (value.email || value.username) {
      const duplicateUser = await new Promise((resolve, reject) => {
        const conditions = [];
        const params = [];

        if (value.email) {
          conditions.push('email = ?');
          params.push(value.email);
        }
        if (value.username) {
          conditions.push('username = ?');
          params.push(value.username);
        }

        params.push(id);

        db.get(
          `SELECT id FROM users WHERE (${conditions.join(' OR ')}) AND id != ?`,
          params,
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (duplicateUser) {
        return res.status(409).json({
          success: false,
          error: 'Email or username already exists'
        });
      }
    }

    // Build update query
    const updateFields = [];
    const updateParams = [];

    Object.keys(value).forEach(key => {
      const dbField = key === 'isActive' ? 'is_active' : key;
      updateFields.push(`${dbField} = ?`);
      updateParams.push(value[key]);
    });

    if (updateFields.length === 0) {
      // If no fields to update (e.g., non-admin tried to change role only), 
      // just return the current user data without error
      const currentUser = await new Promise((resolve, reject) => {
        db.get(
          'SELECT id, username, email, role, is_active, created_at, updated_at FROM users WHERE id = ?',
          [id],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      return res.json({
        success: true,
        message: 'No changes made',
        data: {
          user: {
            id: currentUser.id,
            username: currentUser.username,
            email: currentUser.email,
            role: currentUser.role,
            isActive: currentUser.is_active,
            createdAt: currentUser.created_at,
            updatedAt: currentUser.updated_at
          }
        }
      });
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateParams.push(id);

    // Update user
    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
        updateParams,
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Get updated user
    const updatedUser = await new Promise((resolve, reject) => {
      db.get(
        'SELECT id, username, email, role, is_active, created_at, updated_at FROM users WHERE id = ?',
        [id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    logger.info(`User ${id} updated successfully by user ${req.user.id}`);

    res.json({
      success: true,
      message: 'User updated successfully',
      data: {
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          email: updatedUser.email,
          role: updatedUser.role,
          isActive: updatedUser.is_active,
          createdAt: updatedUser.created_at,
          updatedAt: updatedUser.updated_at
        }
      }
    });

  } catch (error) {
    logger.error('Update user error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/users/:id/change-password
 * Change user password
 */
router.post('/:id/change-password', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    // Check if user can change this password
    if (req.user.id !== parseInt(id)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You can only change your own password.'
      });
    }

    // Validate input
    const { error, value } = changePasswordSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    const { currentPassword, newPassword } = value;

    // Get current user
    const user = await new Promise((resolve, reject) => {
      db.get(
        'SELECT password_hash FROM users WHERE id = ?',
        [id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValidPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    // Hash new password
    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [newPasswordHash, id],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    logger.info(`Password changed successfully for user ${id}`);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    logger.error('Change password error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * DELETE /api/users/:id
 * Delete user (admin only)
 */
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    // Check if user exists
    const user = await new Promise((resolve, reject) => {
      db.get('SELECT id FROM users WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Prevent admin from deleting themselves
    if (req.user.id === parseInt(id)) {
      return res.status(400).json({
        success: false,
        error: 'You cannot delete your own account'
      });
    }

    // Delete user (cascade will handle related records)
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM users WHERE id = ?', [id], function(err) {
        if (err) reject(err);
        else resolve();
      });
    });

    logger.info(`User ${id} deleted by admin ${req.user.id}`);

    res.json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    logger.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;
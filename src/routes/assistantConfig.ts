import 'dotenv/config'
import { and, desc, eq } from 'drizzle-orm'
import express from 'express'
import { db } from '../db'
import { assistantPrompts, assistantTools } from '../db/schema-postgres'

const router = express.Router()

// Middleware to authenticate user (this should be extracted to a shared file)
export const authenticateUser = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : req.cookies?.auth_token

    if (!token) {
      res.status(401).json({ error: 'No token provided' })
      return
    }

    // Simple token validation (in production, use proper JWT library)
    const payload = JSON.parse(Buffer.from(token, 'base64').toString())

    if (payload.exp < Date.now()) {
      res.status(401).json({ error: 'Token expired' })
      return
    }

    req.user = {
      userId: payload.userId,
      role: payload.role,
      exp: payload.exp,
    }
    next()
  } catch (error) {
    console.error('Authentication error:', error)
    res.status(401).json({ error: 'Authentication failed' })
  }
}

// PROMPT ENDPOINTS

// Get active prompt for user
router.get('/prompt', authenticateUser, async (req, res) => {
  try {
    const userId = req.user?.userId
    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' })
      return
    }

    const activePrompt = await db
      .select()
      .from(assistantPrompts)
      .where(
        and(
          eq(assistantPrompts.saasUserId, userId),
          eq(assistantPrompts.isActive, true),
        ),
      )
      .orderBy(desc(assistantPrompts.createdAt))
      .limit(1)

    if (activePrompt.length === 0) {
      res.json({ prompt: '' }) // Return empty prompt if none exists
      return
    }

    res.json({ prompt: activePrompt[0].prompt, id: activePrompt[0].id })
  } catch (error) {
    console.error('Error fetching prompt:', error)
    res.status(500).json({ error: 'Failed to fetch prompt' })
  }
})

// Save or update prompt
router.post('/prompt', authenticateUser, async (req, res) => {
  try {
    const userId = req.user?.userId
    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' })
      return
    }

    const { prompt } = req.body

    if (!prompt || typeof prompt !== 'string') {
      res.status(400).json({ error: 'Prompt is required and must be a string' })
      return
    }

    // Deactivate any existing active prompts
    await db
      .update(assistantPrompts)
      .set({ isActive: false, updatedAt: new Date() })
      .where(
        and(
          eq(assistantPrompts.saasUserId, userId),
          eq(assistantPrompts.isActive, true),
        ),
      )

    // Insert new prompt
    const newPrompt = await db
      .insert(assistantPrompts)
      .values({
        saasUserId: userId,
        prompt,
        isActive: true,
      })
      .returning()

    res.json({
      message: 'Prompt saved successfully',
      prompt: newPrompt[0].prompt,
      id: newPrompt[0].id,
    })
  } catch (error) {
    console.error('Error saving prompt:', error)
    res.status(500).json({ error: 'Failed to save prompt' })
  }
})

// TOOL ENDPOINTS

// Get all active tools for user
router.get('/tools', authenticateUser, async (req, res) => {
  try {
    const userId = req.user?.userId
    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' })
      return
    }

    const tools = await db
      .select()
      .from(assistantTools)
      .where(
        and(
          eq(assistantTools.saasUserId, userId),
          eq(assistantTools.isActive, true),
        ),
      )
      .orderBy(desc(assistantTools.createdAt))

    // Parse parameters JSON for each tool
    const parsedTools = tools.map((tool) => ({
      ...tool,
      parameters: JSON.parse(tool.parameters),
    }))

    res.json({ tools: parsedTools })
  } catch (error) {
    console.error('Error fetching tools:', error)
    res.status(500).json({ error: 'Failed to fetch tools' })
  }
})

// Get specific tool by ID
router.get('/tools/:id', authenticateUser, async (req, res) => {
  try {
    const userId = req.user?.userId
    const toolId = req.params.id

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' })
      return
    }

    const tool = await db
      .select()
      .from(assistantTools)
      .where(
        and(
          eq(assistantTools.id, parseInt(toolId)),
          eq(assistantTools.saasUserId, userId),
          eq(assistantTools.isActive, true),
        ),
      )
      .limit(1)

    if (tool.length === 0) {
      res.status(404).json({ error: 'Tool not found' })
      return
    }

    // Parse parameters JSON
    const parsedTool = {
      ...tool[0],
      parameters: JSON.parse(tool[0].parameters),
    }

    res.json({ tool: parsedTool })
  } catch (error) {
    console.error('Error fetching tool:', error)
    res.status(500).json({ error: 'Failed to fetch tool' })
  }
})

// Create new tool
router.post('/tools', authenticateUser, async (req, res) => {
  try {
    const userId = req.user?.userId
    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' })
      return
    }

    const { name, description, parameters, implementation } = req.body

    if (!name || !description || !parameters || !implementation) {
      res.status(400).json({
        error: 'Name, description, parameters, and implementation are required',
      })
      return
    }

    // Validate parameters is an array
    if (!Array.isArray(parameters)) {
      res.status(400).json({ error: 'Parameters must be an array' })
      return
    }

    // Insert new tool
    const newTool = await db
      .insert(assistantTools)
      .values({
        saasUserId: userId,
        name,
        description,
        parameters: JSON.stringify(parameters),
        implementation,
        isActive: true,
      })
      .returning()

    const parsedTool = {
      ...newTool[0],
      parameters: JSON.parse(newTool[0].parameters),
    }

    res.status(201).json({
      message: 'Tool created successfully',
      tool: parsedTool,
    })
  } catch (error) {
    console.error('Error creating tool:', error)
    res.status(500).json({ error: 'Failed to create tool' })
  }
})

// Update existing tool
router.put('/tools/:id', authenticateUser, async (req, res) => {
  try {
    const userId = req.user?.userId
    const toolId = req.params.id

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' })
      return
    }

    const { name, description, parameters, implementation } = req.body

    if (!name || !description || !parameters || !implementation) {
      res.status(400).json({
        error: 'Name, description, parameters, and implementation are required',
      })
      return
    }

    // Validate parameters is an array
    if (!Array.isArray(parameters)) {
      res.status(400).json({ error: 'Parameters must be an array' })
      return
    }

    // Check if tool exists and belongs to user
    const existingTool = await db
      .select()
      .from(assistantTools)
      .where(
        and(
          eq(assistantTools.id, parseInt(toolId)),
          eq(assistantTools.saasUserId, userId),
          eq(assistantTools.isActive, true),
        ),
      )
      .limit(1)

    if (existingTool.length === 0) {
      res.status(404).json({ error: 'Tool not found' })
      return
    }

    // Update tool
    const updatedTool = await db
      .update(assistantTools)
      .set({
        name,
        description,
        parameters: JSON.stringify(parameters),
        implementation,
        updatedAt: new Date(),
      })
      .where(eq(assistantTools.id, parseInt(toolId)))
      .returning()

    const parsedTool = {
      ...updatedTool[0],
      parameters: JSON.parse(updatedTool[0].parameters),
    }

    res.json({
      message: 'Tool updated successfully',
      tool: parsedTool,
    })
  } catch (error) {
    console.error('Error updating tool:', error)
    res.status(500).json({ error: 'Failed to update tool' })
  }
})

// Delete tool (soft delete)
router.delete('/tools/:id', authenticateUser, async (req, res) => {
  try {
    const userId = req.user?.userId
    const toolId = req.params.id

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' })
      return
    }

    // Check if tool exists and belongs to user
    const existingTool = await db
      .select()
      .from(assistantTools)
      .where(
        and(
          eq(assistantTools.id, parseInt(toolId)),
          eq(assistantTools.saasUserId, userId),
          eq(assistantTools.isActive, true),
        ),
      )
      .limit(1)

    if (existingTool.length === 0) {
      res.status(404).json({ error: 'Tool not found' })
      return
    }

    // Soft delete tool by setting isActive to false
    await db
      .update(assistantTools)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(assistantTools.id, parseInt(toolId)))

    res.json({ message: 'Tool deleted successfully' })
  } catch (error) {
    console.error('Error deleting tool:', error)
    res.status(500).json({ error: 'Failed to delete tool' })
  }
})

export default router

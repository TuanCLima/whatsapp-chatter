import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { and, desc, eq } from 'drizzle-orm'
import express from 'express'
import multer from 'multer'
import { db } from '../db'
import { assistantPrompts, assistantTools } from '../db/schema-postgres'

const router = express.Router()

// Serve uploaded tool images
router.use(
  '/tool-images',
  express.static(path.join(process.cwd(), 'public', 'tool-images')),
)

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = path.join(process.cwd(), 'public', 'tool-images')
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: (_req, file, cb) => {
    // Generate unique filename
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${file.originalname}`
    cb(null, uniqueName)
  },
})

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (_req, file, cb) => {
    // Allow only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true)
    } else {
      cb(null, false)
    }
  },
})

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
router.post(
  '/tools',
  authenticateUser,
  upload.single('image'),
  async (req, res) => {
    try {
      const userId = req.user?.userId
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' })
        return
      }

      const { name, description, parameters, toolType, implementation } =
        req.body
      const uploadedFile = req.file

      if (!name || !description || !parameters) {
        res.status(400).json({
          error: 'Name, description, and parameters are required',
        })
        return
      }

      // Validate tool type
      const validToolType: 'image' | 'implementation' =
        toolType === 'image' ? 'image' : 'implementation'

      // Validation based on tool type
      if (validToolType === 'implementation' && !implementation) {
        res.status(400).json({
          error: 'Implementation is required for implementation tools',
        })
        return
      }

      if (validToolType === 'image' && !uploadedFile) {
        res.status(400).json({
          error: 'Image file is required for image tools',
        })
        return
      }

      // Validate parameters is an array
      if (!Array.isArray(JSON.parse(parameters))) {
        res.status(400).json({ error: 'Parameters must be an array' })
        return
      }

      // Prepare tool data
      const baseToolData = {
        saasUserId: userId,
        name,
        description,
        parameters,
        toolType: validToolType,
        isActive: true,
      }

      let finalToolData: typeof assistantTools.$inferInsert

      if (validToolType === 'implementation') {
        finalToolData = {
          ...baseToolData,
          implementation,
        }
      } else {
        // Image tool
        finalToolData = {
          ...baseToolData,
          imageUrl: uploadedFile
            ? `/tool-images/${uploadedFile.filename}`
            : null,
          imageName: uploadedFile ? uploadedFile.originalname : null,
        }
      }

      // Insert new tool
      const newTool = await db
        .insert(assistantTools)
        .values(finalToolData)
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
  },
)

// Update existing tool
router.put(
  '/tools/:id',
  authenticateUser,
  upload.single('image'),
  async (req, res) => {
    try {
      const userId = req.user?.userId
      const toolId = req.params.id

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' })
        return
      }

      const { name, description, parameters, toolType, implementation } =
        req.body
      const uploadedFile = req.file

      if (!name || !description || !parameters) {
        res.status(400).json({
          error: 'Name, description, and parameters are required',
        })
        return
      }

      // Validate tool type
      const validToolType: 'image' | 'implementation' =
        toolType === 'image' ? 'image' : 'implementation'

      // Validation based on tool type
      if (validToolType === 'implementation' && !implementation) {
        res.status(400).json({
          error: 'Implementation is required for implementation tools',
        })
        return
      }

      // Validate parameters is an array
      if (!Array.isArray(JSON.parse(parameters))) {
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

      // Prepare update data
      const baseUpdateData = {
        name,
        description,
        parameters,
        toolType: validToolType,
        updatedAt: new Date(),
      }

      let finalUpdateData: Partial<typeof assistantTools.$inferInsert>

      if (validToolType === 'implementation') {
        finalUpdateData = {
          ...baseUpdateData,
          implementation,
          // Clear image fields for implementation tools
          imageUrl: null,
          imageName: null,
        }
      } else {
        // Image tool
        finalUpdateData = {
          ...baseUpdateData,
          // Clear implementation for image tools
          implementation: null,
        }

        // Only update image fields if a new image was uploaded
        if (uploadedFile) {
          finalUpdateData.imageUrl = `/tool-images/${uploadedFile.filename}`
          finalUpdateData.imageName = uploadedFile.originalname
        }
      }

      // Update tool
      const updatedTool = await db
        .update(assistantTools)
        .set(finalUpdateData)
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
  },
)

// Delete tool (hard delete)
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

    const tool = existingTool[0]

    // If it's an image tool, delete the associated image file
    if (tool.toolType === 'image' && tool.imageUrl) {
      try {
        // Extract filename from the URL path
        const imagePath = path.join(process.cwd(), 'public', tool.imageUrl)

        // Check if file exists and delete it
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath)
          console.log(`Deleted image file: ${imagePath}`)
        }
      } catch (fileError) {
        console.error('Error deleting image file:', fileError)
        // Continue with database deletion even if file deletion fails
      }
    }

    // Hard delete tool from database
    await db
      .delete(assistantTools)
      .where(eq(assistantTools.id, parseInt(toolId)))

    res.json({ message: 'Tool deleted successfully' })
  } catch (error) {
    console.error('Error deleting tool:', error)
    res.status(500).json({ error: 'Failed to delete tool' })
  }
})

export default router
